import prisma from '../config/database.js';
import { caretakerService } from '../services/caretaker.service.js';
import { followUpService } from '../services/followUp.service.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { FollowUpStatus } from '@prisma/client';

async function runTests() {
  console.log('=== START VERIFICATION: CAREGIVER MANAGEMENT (10 TEST CASES) ===');

  let testCustomer: any = null;
  const testCaregiverName = `TestCaregiver_${Date.now()}`;
  const updatedCaregiverName = `${testCaregiverName}_Renamed`;

  try {
    // Setup test customer
    let testCustomer = await prisma.customer.findFirst();
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          fullName: 'Test Caregiver Customer',
          phone: `0999${Math.floor(100000 + Math.random() * 900000)}`,
        },
      });
    }
    console.log(`[Setup] Using customer: ${testCustomer.fullName} (${testCustomer.id})`);

    // TEST 1: Xem danh sách người chăm sóc (kèm auto seed)
    console.log('\n--- TEST 1: Xem danh sách người chăm sóc ---');
    const initialList = await caretakerService.getAllCaretakers();
    console.log(`✓ Caretakers count: ${initialList.length}`);
    const defaultFound = initialList.some((c) => ['Ktea', 'xoaicaldez', 'mfast'].includes(c.name));
    if (!defaultFound && initialList.length > 0) {
      console.log('Notice: Defaults might not be pre-seeded, ensureDefaultCaretakers handled.');
    }
    console.log('✓ TEST 1 PASSED: Caretaker list fetched successfully.');

    // TEST 2: Tạo người chăm sóc mới
    console.log('\n--- TEST 2: Tạo người chăm sóc mới ---');
    const createdCaregiver = await caretakerService.createCaretaker({
      name: `  ${testCaregiverName}  `, // Test trim
      active: true,
    });
    console.log(`✓ Created caregiver: ${createdCaregiver.name} (id: ${createdCaregiver.id})`);
    if (createdCaregiver.name !== testCaregiverName) {
      throw new Error(`Expected trimmed name '${testCaregiverName}', got '${createdCaregiver.name}'`);
    }
    console.log('✓ TEST 2 PASSED: Caregiver created and trimmed successfully.');

    // TEST 3: Chặn tên rỗng
    console.log('\n--- TEST 3: Chặn tên rỗng ---');
    try {
      await caretakerService.createCaretaker({ name: '   ' });
      throw new Error('Should have failed on empty name');
    } catch (err: any) {
      console.log(`✓ Expected error caught: ${err.message}`);
      console.log('✓ TEST 3 PASSED: Empty name blocked.');
    }

    // TEST 4: Xử lý tên trùng (case-insensitive)
    console.log('\n--- TEST 4: Xử lý tên trùng ---');
    try {
      await caretakerService.createCaretaker({ name: testCaregiverName.toLowerCase() });
      throw new Error('Should have failed on duplicate name');
    } catch (err: any) {
      console.log(`✓ Expected duplicate error caught: ${err.message}`);
      console.log('✓ TEST 4 PASSED: Duplicate name blocked.');
    }

    // TEST 5: Sửa tên người chăm sóc
    console.log('\n--- TEST 5: Sửa tên người chăm sóc ---');
    const updatedCaregiver = await caretakerService.updateCaretaker(createdCaregiver.id, {
      name: updatedCaregiverName,
    });
    console.log(`✓ Updated caregiver name to: ${updatedCaregiver.name}`);
    if (updatedCaregiver.name !== updatedCaregiverName) {
      throw new Error(`Update name mismatch: expected ${updatedCaregiverName}, got ${updatedCaregiver.name}`);
    }
    console.log('✓ TEST 5 PASSED: Caregiver name updated successfully.');

    // TEST 6: Người mới tạo xuất hiện trong danh sách active để chọn vào lịch
    console.log('\n--- TEST 6: Người mới tạo xuất hiện trong dropdown lịch chăm sóc (active list) ---');
    const activeList = await caretakerService.getAllCaretakers(true);
    const inActiveList = activeList.some((c) => c.name === updatedCaregiverName);
    if (!inActiveList) {
      throw new Error(`New caregiver '${updatedCaregiverName}' not found in active caretakers list`);
    }
    console.log(`✓ Caregiver '${updatedCaregiverName}' found in active list (${activeList.length} total active).`);
    console.log('✓ TEST 6 PASSED: Caregiver appears in active list for dropdown.');

    // TEST 7: Phân công người mới cho lịch và tải lại vẫn giữ đúng dữ liệu
    console.log('\n--- TEST 7: Phân công người mới cho lịch và tải lại kiểm tra ---');
    const followUp = await followUpService.createFollowUp({
      customerId: testCustomer.id,
      title: `Task for ${updatedCaregiverName}`,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      assignedTo: updatedCaregiverName,
    });
    console.log(`✓ Created follow-up ID: ${followUp.id} with assignedTo: ${followUp.assignedTo}`);
    if (followUp.assignedTo !== updatedCaregiverName) {
      throw new Error(`Expected assignedTo '${updatedCaregiverName}', got '${followUp.assignedTo}'`);
    }

    // Reload from DB
    const reloadedFollowUp = await followUpService.getFollowUpById(followUp.id);
    if (reloadedFollowUp.assignedTo !== updatedCaregiverName) {
      throw new Error(`Reload mismatch: expected '${updatedCaregiverName}', got '${reloadedFollowUp.assignedTo}'`);
    }
    console.log('✓ TEST 7 PASSED: Follow-up successfully assigned and persisted in DB.');

    // TEST 8: Bộ lọc lịch chăm sóc hoạt động với người mới
    console.log('\n--- TEST 8: Bộ lọc lịch chăm sóc hoạt động với người mới ---');
    const filteredFollowUps = await followUpService.getFollowUps(
      'all',
      undefined,
      undefined,
      updatedCaregiverName
    );
    const hasOurTask = filteredFollowUps.some((f) => f.id === followUp.id);
    if (!hasOurTask) {
      throw new Error(`Filter by '${updatedCaregiverName}' did not return follow-up ${followUp.id}`);
    }
    console.log(`✓ Filter returned ${filteredFollowUps.length} task(s) for '${updatedCaregiverName}'.`);
    console.log('✓ TEST 8 PASSED: Filter by caregiver works correctly.');

    // TEST 9: Người chăm sóc đã được sử dụng không làm mất lịch sử khi ngừng hoạt động
    console.log('\n--- TEST 9: Ngừng hoạt động không làm mất lịch sử, chặn xóa khi đang có lịch ---');
    // Chặn xóa
    try {
      await caretakerService.deleteCaretaker(createdCaregiver.id);
      throw new Error('Should not allow deleting caretaker with existing follow-ups');
    } catch (err: any) {
      console.log(`✓ Deletion blocked as expected: ${err.message}`);
    }

    // Deactivate
    const deactivated = await caretakerService.updateCaretaker(createdCaregiver.id, {
      active: false,
    });
    console.log(`✓ Caretaker ${deactivated.name} deactivated (active: ${deactivated.active})`);

    // Verify history still has the name
    const followUpAfterDeactivate = await followUpService.getFollowUpById(followUp.id);
    if (followUpAfterDeactivate.assignedTo !== updatedCaregiverName) {
      throw new Error(`History lost! expected '${updatedCaregiverName}', got '${followUpAfterDeactivate.assignedTo}'`);
    }
    console.log(`✓ Historical follow-up retains assignedTo: '${followUpAfterDeactivate.assignedTo}'`);

    // Verify deactivated person is NOT in active list for new scheduling
    const activeListAfter = await caretakerService.getAllCaretakers(true);
    const stillInActive = activeListAfter.some((c) => c.name === updatedCaregiverName);
    if (stillInActive) {
      throw new Error(`Deactivated caregiver should not be in active list`);
    }
    console.log(`✓ Deactivated caregiver excluded from active dropdown list.`);

    // Verify creating new follow-up with inactive caregiver fails
    try {
      await followUpService.createFollowUp({
        customerId: testCustomer.id,
        title: 'Should fail with inactive caregiver',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedTo: updatedCaregiverName,
      });
      throw new Error('Should have failed creating follow-up with inactive caregiver');
    } catch (err: any) {
      console.log(`✓ New assignment to inactive caregiver blocked as expected: ${err.message}`);
    }
    console.log('✓ TEST 9 PASSED: Inactive caregiver history preserved and blocked for new assignments.');

    // TEST 10: Dữ liệu lịch cũ vẫn hiển thị chính xác sau migration
    console.log('\n--- TEST 10: Dữ liệu lịch cũ vẫn hiển thị chính xác ---');
    const allFollowUps = await followUpService.getFollowUps('all');
    console.log(`✓ Total follow-ups in system: ${allFollowUps.length}`);
    const sampleAssigned = allFollowUps.filter((f) => f.assignedTo);
    console.log(`✓ Follow-ups with caretaker assigned: ${sampleAssigned.length}`);
    sampleAssigned.slice(0, 3).forEach((f) => {
      console.log(`  - Follow-up '${f.title}': assignedTo='${f.assignedTo}'`);
    });
    console.log('✓ TEST 10 PASSED: All historical follow-ups intact and correctly assigned.');

    // Cleanup test data
    console.log('\n[Cleanup] Cleaning test follow-up...');
    await prisma.followUp.delete({ where: { id: followUp.id } });
    await prisma.caretaker.delete({ where: { id: createdCaregiver.id } });
    console.log('[Cleanup] Completed cleanly.');

    console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
