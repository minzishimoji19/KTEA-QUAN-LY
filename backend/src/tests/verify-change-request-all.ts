/**
 * Comprehensive Verification Suite for KTEA CRM Customer Change Request:
 * - Part 2: Survey Status in Customer List (NOT_CREATED, SENT, COMPLETED, expired/revoked handling, no tokenHash leak)
 * - Part 3: Date Format Standardization (dd/MM/yyyy & yyyy-MM-dd strict parsing, leap years, no day/month swap, no timezone shift)
 * - Part 4: Questionnaire Management (ADMIN rename, safe draft deletion, block deletion on published/used, archive/restore)
 * - Part 5 & 6: Partner RBAC & Care Schedule Workflow (Partner customer/schedule scoping, complete own schedule, block other Partner's schedule, block caregiver change, server-set completedAt, audit logging, preserve Customer.overallStatus)
 */

import prisma from '../config/database';
import {
  Role,
  AssessmentStatus,
  FollowUpStatus,
  QuestionType,
  CustomerStatus,
  UserStatus,
} from '@prisma/client';
import { computeCustomerSurveyStatus } from '../services/customerStatus.service';
import { customerService } from '../services/customer.service';
import { customerAccessService } from '../services/customerAccess.service';
import { parseStrictDateOnly, formatDateDdMmYyyy, isLeapYear } from '../utils/dateUtils';
import { questionnaireService } from '../services/questionnaire.service';
import { assessmentService } from '../services/assessment.service';
import { publicSurveyService } from '../services/publicSurvey.service';
import { followUpService } from '../services/followUp.service';
import { ForbiddenError, BadRequestError, NotFoundError } from '../utils/errors';

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

async function runVerification() {
  console.log('================================================================================');
  console.log('🚀 KTEA CRM — VERIFYING ALL CHANGE REQUEST REQUIREMENTS (PARTS 2, 3, 4, 5, 6)');
  console.log('================================================================================\n');

  const initialCustomerCount = await prisma.customer.count();
  console.log(`📊 Initial customer count before verification: ${initialCustomerCount}\n`);

  // Track temporary IDs for guaranteed cleanup
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdQuestionnaireIds: string[] = [];

  try {
    // =========================================================================
    // PART 2: SURVEY STATUS COMPUTATION & API FILTERING
    // =========================================================================
    console.log('--------------------------------------------------------------------------------');
    console.log('PHẦN 2 — TRẠNG THÁI KHẢO SÁT TRONG DANH SÁCH KHÁCH HÀNG');
    console.log('--------------------------------------------------------------------------------');

    const now = new Date('2026-10-28T10:00:00.000Z');
    const futureDate = new Date('2026-11-15T10:00:00.000Z');
    const pastDate = new Date('2026-10-01T10:00:00.000Z');

    // Case 1: Customer never had a link
    const statusNever = computeCustomerSurveyStatus([], now);
    assert(
      statusNever.surveyStatus === 'NOT_CREATED' &&
        statusNever.surveyStatusLabel === 'Chưa tạo link khảo sát' &&
        statusNever.hasExpiredOrRevokedLinks === false,
      'Khách chưa từng có link -> NOT_CREATED ("Chưa tạo link khảo sát")'
    );

    // Case 2: Customer has active unopened link
    const statusUnopened = computeCustomerSurveyStatus(
      [
        {
          id: 'a1',
          status: AssessmentStatus.IN_PROGRESS,
          completedAt: null,
          startedAt: now,
          publicSurveyLink: {
            id: 'l1',
            status: 'ACTIVE',
            expiresAt: futureDate,
            revokedAt: null,
            lastAccessedAt: null,
            createdAt: now,
          },
        },
      ],
      now
    );
    assert(
      statusUnopened.surveyStatus === 'SENT' && statusUnopened.surveyStatusLabel === 'Đã gửi khảo sát',
      'Khách có link hợp lệ chưa mở -> SENT ("Đã gửi khảo sát")'
    );

    // Case 3: Customer opened link and saved draft answers
    const statusDraft = computeCustomerSurveyStatus(
      [
        {
          id: 'a2',
          status: AssessmentStatus.IN_PROGRESS,
          completedAt: null,
          startedAt: now,
          _count: { answers: 3 },
          publicSurveyLink: {
            id: 'l2',
            status: 'ACTIVE',
            expiresAt: futureDate,
            revokedAt: null,
            lastAccessedAt: now,
            createdAt: now,
          },
        },
      ],
      now
    );
    assert(
      statusDraft.surveyStatus === 'SENT' &&
        statusDraft.surveyStatusLabel === 'Đã gửi khảo sát' &&
        statusDraft.hasOpenedLink === true &&
        statusDraft.hasDraftProgress === true,
      'Khách đã mở link / lưu nháp -> vẫn hiển thị SENT ("Đã gửi khảo sát") kèm hasOpenedLink=true & hasDraftProgress=true'
    );

    // Case 4: Customer has expired link and no completed assessment
    const statusExpired = computeCustomerSurveyStatus(
      [
        {
          id: 'a3',
          status: AssessmentStatus.IN_PROGRESS,
          completedAt: null,
          startedAt: pastDate,
          publicSurveyLink: {
            id: 'l3',
            status: 'ACTIVE',
            expiresAt: pastDate,
            revokedAt: null,
            lastAccessedAt: null,
            createdAt: pastDate,
          },
        },
      ],
      now
    );
    assert(
      statusExpired.surveyStatus === 'NOT_CREATED' &&
        statusExpired.surveyStatusLabel === 'Chưa tạo link khảo sát' &&
        statusExpired.hasExpiredOrRevokedLinks === true &&
        statusExpired.latestInactiveLinkStatus === 'EXPIRED',
      'Khách có link hết hạn và chưa hoàn thành -> NOT_CREATED ("Chưa tạo link khảo sát") + hasExpiredOrRevokedLinks=true (EXPIRED)'
    );

    // Case 5: Customer has revoked link and no completed assessment
    const statusRevoked = computeCustomerSurveyStatus(
      [
        {
          id: 'a4',
          status: AssessmentStatus.CANCELLED,
          completedAt: null,
          startedAt: pastDate,
          publicSurveyLink: {
            id: 'l4',
            status: 'REVOKED',
            expiresAt: futureDate,
            revokedAt: now,
            lastAccessedAt: null,
            createdAt: pastDate,
          },
        },
      ],
      now
    );
    assert(
      statusRevoked.surveyStatus === 'NOT_CREATED' &&
        statusRevoked.surveyStatusLabel === 'Chưa tạo link khảo sát' &&
        statusRevoked.hasExpiredOrRevokedLinks === true &&
        statusRevoked.latestInactiveLinkStatus === 'REVOKED',
      'Khách có link bị thu hồi và chưa hoàn thành -> NOT_CREATED ("Chưa tạo link khảo sát") + hasExpiredOrRevokedLinks=true (REVOKED)'
    );

    // Case 6: Customer completed an assessment
    const statusCompleted = computeCustomerSurveyStatus(
      [
        {
          id: 'a5',
          status: AssessmentStatus.COMPLETED,
          completedAt: now,
          startedAt: pastDate,
          publicSurveyLink: {
            id: 'l5',
            status: 'COMPLETED',
            expiresAt: futureDate,
            revokedAt: null,
            lastAccessedAt: pastDate,
            createdAt: pastDate,
          },
        },
      ],
      now
    );
    assert(
      statusCompleted.surveyStatus === 'COMPLETED' &&
        statusCompleted.surveyStatusLabel === 'Khách đã điền khảo sát' &&
        statusCompleted.completedCount === 1,
      'Khách đã hoàn thành khảo sát -> COMPLETED ("Khách đã điền khảo sát")'
    );

    // Case 7: Customer has multiple links: 1 completed assessment AND 1 newer link in progress
    const statusMultiple = computeCustomerSurveyStatus(
      [
        {
          id: 'a6_new',
          status: AssessmentStatus.IN_PROGRESS,
          completedAt: null,
          startedAt: now,
          publicSurveyLink: {
            id: 'l6_new',
            status: 'ACTIVE',
            expiresAt: futureDate,
            revokedAt: null,
            lastAccessedAt: now,
            createdAt: now,
          },
        },
        {
          id: 'a6_old',
          status: AssessmentStatus.COMPLETED,
          completedAt: pastDate,
          startedAt: pastDate,
          publicSurveyLink: {
            id: 'l6_old',
            status: 'COMPLETED',
            expiresAt: futureDate,
            revokedAt: null,
            lastAccessedAt: pastDate,
            createdAt: pastDate,
          },
        },
      ],
      now
    );
    assert(
      statusMultiple.surveyStatus === 'COMPLETED' &&
        statusMultiple.surveyStatusLabel === 'Khách đã điền khảo sát' &&
        statusMultiple.completedCount === 1 &&
        statusMultiple.activeLinkCount === 1,
      'Khách có nhiều link (1 đã hoàn thành + 1 đang mở) -> ưu tiên COMPLETED ("Khách đã điền khảo sát") và giữ thông tin activeLinkCount=1'
    );

    // Verify customer list API response includes surveyStatus and never exposes tokenHash
    const listRes = await customerService.getCustomers({ page: 1, pageSize: 10 });
    const serializedList = JSON.stringify(listRes);
    assert(
      !serializedList.includes('tokenHash'),
      'API danh sách khách hàng tuyệt đối không lộ tokenHash'
    );
    if (listRes.items.length > 0) {
      assert(
        Boolean((listRes.items[0] as any).surveyStatus),
        'API danh sách khách hàng trả về trường surveyStatus đã tính sẵn từ backend'
      );
    }

    // =========================================================================
    // PART 3: DATE FORMAT STANDARDIZATION (dd/MM/yyyy & yyyy-MM-dd)
    // =========================================================================
    console.log('\n--------------------------------------------------------------------------------');
    console.log('PHẦN 3 — CHUẨN HÓA ĐỊNH DẠNG NGÀY THÁNG (dd/MM/yyyy)');
    console.log('--------------------------------------------------------------------------------');

    // Test 03/04/2000 (Day = 3, Month = 4, Year = 2000 - no month/day swap)
    const parsed0304 = parseStrictDateOnly('03/04/2000');
    assert(
      parsed0304 !== null &&
        parsed0304.day === 3 &&
        parsed0304.month === 4 &&
        parsed0304.year === 2000 &&
        parsed0304.isoDate === '2000-04-03' &&
        parsed0304.displayDate === '03/04/2000',
      'Parse "03/04/2000" -> ngày 03, tháng 04, năm 2000 (isoDate="2000-04-03", không đảo ngày/tháng)'
    );

    // Test ISO input 2000-04-03
    const parsedIso0304 = parseStrictDateOnly('2000-04-03');
    assert(
      parsedIso0304 !== null &&
        parsedIso0304.day === 3 &&
        parsedIso0304.month === 4 &&
        parsedIso0304.year === 2000 &&
        parsedIso0304.displayDate === '03/04/2000',
      'Parse ISO "2000-04-03" -> hiển thị "03/04/2000" chính xác'
    );

    // Test end of month valid & invalid
    const parsedEndOfMonthValid = parseStrictDateOnly('30/04/2026');
    const parsedEndOfMonthInvalid = parseStrictDateOnly('31/04/2026');
    assert(
      parsedEndOfMonthValid !== null && parsedEndOfMonthValid.isoDate === '2026-04-30',
      'Ngày cuối tháng hợp lệ "30/04/2026" -> hợp lệ'
    );
    assert(
      parsedEndOfMonthInvalid === null,
      'Ngày cuối tháng không hợp lệ "31/04/2026" -> bị từ chối (null)'
    );

    // Test leap year valid (29/02/2024) and invalid (29/02/2023)
    const parsedLeapValid = parseStrictDateOnly('29/02/2024');
    const parsedLeapInvalid = parseStrictDateOnly('29/02/2023');
    assert(
      isLeapYear(2024) && parsedLeapValid !== null && parsedLeapValid.isoDate === '2024-02-29',
      'Ngày nhuận hợp lệ "29/02/2024" -> hợp lệ ("2024-02-29")'
    );
    assert(
      !isLeapYear(2023) && parsedLeapInvalid === null,
      'Ngày nhuận không hợp lệ "29/02/2023" -> bị từ chối (null)'
    );

    // Test empty and malformed values
    assert(parseStrictDateOnly('') === null, 'Giá trị rỗng "" -> trả về null');
    assert(parseStrictDateOnly('invalid-date') === null, 'Giá trị sai định dạng -> trả về null');
    assert(parseStrictDateOnly('15/13/2026') === null, 'Tháng 13 ("15/13/2026") -> trả về null');

    // Test saving and reloading customer dateOfBirth without timezone off-by-one shift
    const testDobCustomer = await customerService.createCustomer({
      fullName: 'TEST_CR_DOB_CUSTOMER',
      phone: `0999${Date.now().toString().slice(-6)}`,
      dateOfBirth: '03/04/2000',
    });
    createdCustomerIds.push(testDobCustomer.id);

    const fetchedDobCustomer = await customerService.getCustomerById(testDobCustomer.id);
    assert(
      formatDateDdMmYyyy(fetchedDobCustomer.dateOfBirth) === '03/04/2000',
      'Lưu và tải lại dateOfBirth "03/04/2000" trong DB giữ nguyên ngày 03/04/2000 không bị lệch múi giờ'
    );

    // =========================================================================
    // PART 4: QUESTIONNAIRE MANAGEMENT (RENAME, SAFE DELETE, ARCHIVE/RESTORE)
    // =========================================================================
    console.log('\n--------------------------------------------------------------------------------');
    console.log('PHẦN 4 — QUẢN LÝ QUESTIONNAIRE: ĐỔI TÊN, XÓA BẢN NHÁP, GIỮ LỊCH SỬ');
    console.log('--------------------------------------------------------------------------------');

    const adminUser = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });
    const adminActor = adminUser
      ? { userId: adminUser.id, email: adminUser.email }
      : undefined;

    // 4.1 Create a brand new draft questionnaire
    const uniqueCode = `CR_TEST_Q_${Date.now()}`;
    const draftQ = await questionnaireService.createQuestionnaire({
      code: uniqueCode,
      title: 'Bộ câu hỏi nháp ban đầu',
      description: 'Mô tả ban đầu',
      createdBy: adminUser?.email || 'admin@ktea.local',
    });
    createdQuestionnaireIds.push(draftQ.id);

    const fetchedDraftQ = await questionnaireService.getQuestionnaireById(draftQ.id);
    assert(
      fetchedDraftQ.canHardDelete === true,
      'Questionnaire nháp mới tạo có canHardDelete = true'
    );

    // 4.2 Rename the draft questionnaire
    const renamedQ = await questionnaireService.updateQuestionnaire(
      draftQ.id,
      {
        title: 'Bộ câu hỏi nháp đã đổi tên',
        description: 'Mô tả cập nhật',
      },
      adminActor
    );
    assert(
      renamedQ.title === 'Bộ câu hỏi nháp đã đổi tên' &&
        renamedQ.versions.length === 1 &&
        renamedQ.versions[0].versionNumber === 1,
      'ADMIN đổi tên bộ câu hỏi thành công mà không làm thay đổi version history'
    );

    // 4.3 Add a question and publish v1 on a second test questionnaire to test deletion blocking & archiving
    const usedCode = `CR_TEST_USED_Q_${Date.now()}`;
    const usedQ = await questionnaireService.createQuestionnaire({
      code: usedCode,
      title: 'Bộ câu hỏi đã xuất bản',
      createdBy: adminUser?.email || 'admin@ktea.local',
    });
    createdQuestionnaireIds.push(usedQ.id);

    const v1Id = usedQ.versions[0].id;
    await questionnaireService.saveDraftQuestions(usedQ.id, v1Id, [
      {
        code: `Q_DOB_${Date.now()}`,
        questionText: 'Ngày sinh của bạn',
        questionType: QuestionType.DATE,
        isRequired: true,
        active: true,
        displayOrder: 1,
      },
    ]);
    await questionnaireService.publishVersion(
      usedQ.id,
      v1Id,
      adminUser?.email || 'admin@ktea.local'
    );

    // Verify hard-delete is blocked once published
    let deletePublishedBlocked = false;
    try {
      await questionnaireService.deleteQuestionnaire(usedQ.id, adminActor);
    } catch (err) {
      if (err instanceof BadRequestError) {
        deletePublishedBlocked = true;
      }
    }
    assert(
      deletePublishedBlocked,
      'Chặn xóa cứng (400 BadRequestError) đối với bộ câu hỏi đã có phiên bản PUBLISHED'
    );

    // Archive the published questionnaire (active: false)
    const archivedQ = await questionnaireService.updateQuestionnaire(
      usedQ.id,
      { active: false },
      adminActor
    );
    assert(
      archivedQ.active === false,
      'Cho phép ngừng sử dụng / lưu trữ (active=false) bộ câu hỏi đã xuất bản'
    );

    // Verify archived questionnaire cannot be used to start a new assessment or create a public link
    let startArchivedBlocked = false;
    try {
      await assessmentService.startAssessment(
        testDobCustomer.id,
        { id: adminUser?.id || 'admin', role: Role.ADMIN },
        { questionnaireId: usedQ.id }
      );
    } catch (err) {
      if (err instanceof BadRequestError) {
        startArchivedBlocked = true;
      }
    }
    assert(
      startArchivedBlocked,
      'Không cho phép tạo khảo sát mới từ bộ câu hỏi đã lưu trữ (active=false)'
    );

    let linkArchivedBlocked = false;
    try {
      await publicSurveyService.createLink(
        testDobCustomer.id,
        { questionnaireVersionId: v1Id },
        { id: adminUser?.id || 'admin', role: Role.ADMIN }
      );
    } catch (err) {
      if (err instanceof BadRequestError) {
        linkArchivedBlocked = true;
      }
    }
    assert(
      linkArchivedBlocked,
      'Không cho phép tạo link khảo sát công khai mới từ bộ câu hỏi đã lưu trữ (active=false)'
    );

    // Hard-delete the unused draft questionnaire (draftQ) -> must succeed cleanly
    const deleteDraftRes = await questionnaireService.deleteQuestionnaire(draftQ.id, adminActor);
    assert(
      deleteDraftRes.deleted === true,
      'Cho phép xóa hẳn (hard delete) bộ câu hỏi nháp chưa từng có khảo sát hoặc phiên bản xuất bản'
    );
    createdQuestionnaireIds.splice(createdQuestionnaireIds.indexOf(draftQ.id), 1);

    // =========================================================================
    // PART 5 & 6: PARTNER RBAC & CARE SCHEDULE WORKFLOW
    // =========================================================================
    console.log('\n--------------------------------------------------------------------------------');
    console.log('PHẦN 5 & 6 — PHÂN QUYỀN PARTNER & WORKFLOW HOÀN THÀNH LỊCH CHĂM SÓC');
    console.log('--------------------------------------------------------------------------------');

    const suffix = Date.now().toString().slice(-6);
    const partnerA = await prisma.user.create({
      data: {
        email: `partner_a_${suffix}@test-ktea.local`,
        passwordHash: 'not_used_for_login',
        fullName: `Partner A ${suffix}`,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });
    createdUserIds.push(partnerA.id);

    const partnerB = await prisma.user.create({
      data: {
        email: `partner_b_${suffix}@test-ktea.local`,
        passwordHash: 'not_used_for_login',
        fullName: `Partner B ${suffix}`,
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });
    createdUserIds.push(partnerB.id);

    const customerForA = await prisma.customer.create({
      data: {
        fullName: `Customer of Partner A ${suffix}`,
        phone: `0981${suffix}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });
    createdCustomerIds.push(customerForA.id);

    const customerForB = await prisma.customer.create({
      data: {
        fullName: `Customer of Partner B ${suffix}`,
        phone: `0982${suffix}`,
        overallStatus: CustomerStatus.LEAD_MOI,
      },
    });
    createdCustomerIds.push(customerForB.id);

    // Assign customerForA to partnerA, and customerForB to partnerB
    await prisma.customerAssignment.create({
      data: {
        customerId: customerForA.id,
        userId: partnerA.id,
      },
    });
    await prisma.customerAssignment.create({
      data: {
        customerId: customerForB.id,
        userId: partnerB.id,
      },
    });

    // Also test a shared customer where both Partner A and Partner B have separate schedules
    await prisma.customerAssignment.create({
      data: {
        customerId: customerForA.id,
        userId: partnerB.id,
      },
    });

    const partnerAContext = {
      userId: partnerA.id,
      role: Role.PARTNER,
      email: partnerA.email,
      fullName: partnerA.fullName,
    };
    const partnerBContext = {
      userId: partnerB.id,
      role: Role.PARTNER,
      email: partnerB.email,
      fullName: partnerB.fullName,
    };

    // 5.1 Partner A can see customerForA, cannot see customerForB
    const assignedIdsA = await customerAccessService.getAssignedCustomerIds(partnerA.id);
    const listForA = await customerService.getCustomers({
      page: 1,
      pageSize: 50,
      scopedCustomerIds: assignedIdsA,
      scopedUserId: partnerA.id,
    });
    const idsForA = listForA.items.map((c: any) => c.id);
    assert(
      idsForA.includes(customerForA.id) && !idsForA.includes(customerForB.id),
      'Partner A chỉ nhìn thấy khách hàng được phân công cho mình, không thấy khách của Partner B'
    );

    let accessUnassignedCustomerBlocked = false;
    try {
      await customerAccessService.assertCustomerAccess(
        { id: partnerA.id, role: Role.PARTNER },
        customerForB.id
      );
    } catch (err) {
      if (err instanceof ForbiddenError || err instanceof NotFoundError) {
        accessUnassignedCustomerBlocked = true;
      }
    }
    assert(
      accessUnassignedCustomerBlocked,
      'Partner A truy cập trực tiếp ID khách hàng không thuộc mình -> bị chặn (403/404 chống lộ bản ghi)'
    );

    // 5.2 Create schedule for Partner A and schedule for Partner B on customerForA
    const scheduleForA = await followUpService.createFollowUp({
      customerId: customerForA.id,
      title: 'Gọi tư vấn lần 1 của Partner A',
      description: 'Ghi chú ban đầu',
      dueAt: new Date().toISOString(),
      assignedToUserId: partnerA.id,
      assignedTo: partnerA.fullName,
    });
    assert(
      scheduleForA.assignedToUserId === partnerA.id && scheduleForA.assignedTo === partnerA.fullName,
      'Partner A tạo lịch chăm sóc -> gắn assignedToUserId và tên của chính Partner A'
    );

    const scheduleForB = await followUpService.createFollowUp({
      customerId: customerForA.id,
      title: 'Lịch riêng của Partner B',
      dueAt: new Date().toISOString(),
      assignedToUserId: partnerB.id,
      assignedTo: partnerB.fullName,
    });

    // 5.3 Verify Partner A listing follow-ups only sees scheduleForA and NOT scheduleForB
    const scopeA = await customerAccessService.getPartnerCaregiverScope(partnerA.id);
    const followUpsListA = await followUpService.getFollowUps(
      'all',
      undefined,
      undefined,
      undefined,
      assignedIdsA,
      { userId: partnerA.id, aliases: scopeA.aliases }
    );
    const followUpIdsA = followUpsListA.map((f: any) => f.id);
    assert(
      followUpIdsA.includes(scheduleForA.id) && !followUpIdsA.includes(scheduleForB.id),
      'Danh sách lịch chăm sóc của Partner A chỉ hiển thị lịch của Partner A, ẩn lịch của Partner B kể cả trên khách chung'
    );

    // Verify customer detail for Partner A only includes Partner A's followUps
    const detailForA = await customerService.getCustomerDetail(customerForA.id, partnerA.id);
    const detailFollowUpIds = (detailForA.followUps || []).map((f: any) => f.id);
    assert(
      detailFollowUpIds.includes(scheduleForA.id) && !detailFollowUpIds.includes(scheduleForB.id),
      'Chi tiết khách hàng khi xem bởi Partner A chỉ trả về lịch chăm sóc của Partner A'
    );

    // 6.1 Partner A updates status to IN_PROGRESS and updates care notes
    const inProgressSchedule = await followUpService.updateFollowUp(
      scheduleForA.id,
      {
        status: FollowUpStatus.IN_PROGRESS,
        description: 'Đang liên hệ khách hàng qua Zalo',
      },
      partnerAContext
    );
    assert(
      inProgressSchedule.status === FollowUpStatus.IN_PROGRESS &&
        inProgressSchedule.description === 'Đang liên hệ khách hàng qua Zalo',
      'Partner A cập nhật trạng thái sang Đang xử lý (IN_PROGRESS) và cập nhật ghi chú chăm sóc thành công'
    );

    // 6.2 Partner A marks their own schedule as COMPLETED -> server sets completedAt & logs activity/audit
    const completedSchedule = await followUpService.updateFollowUp(
      scheduleForA.id,
      {
        status: FollowUpStatus.COMPLETED,
        description: 'Đã tư vấn xong gói KTEA Detox',
      },
      partnerAContext
    );
    assert(
      completedSchedule.status === FollowUpStatus.COMPLETED &&
        completedSchedule.completedAt !== null &&
        completedSchedule.description === 'Đã tư vấn xong gói KTEA Detox',
      'Partner A đánh dấu hoàn thành (COMPLETED) lịch của mình -> server tự động ghi nhận completedAt và lưu ghi chú'
    );

    // Verify Customer.overallStatus was NOT mutated when completing follow-up
    const customerAfterComplete = await prisma.customer.findUnique({ where: { id: customerForA.id } });
    assert(
      customerAfterComplete?.overallStatus === CustomerStatus.LEAD_MOI,
      'Hoàn thành lịch chăm sóc không tự ý thay đổi trạng thái tổng thể của khách hàng (Customer.overallStatus)'
    );

    // Verify AuditLog was recorded with Partner A's actorId
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entityType: 'FOLLOW_UP',
        entityId: scheduleForA.id,
        actorId: partnerA.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(
      Boolean(auditEntry),
      'Hệ thống lưu AuditLog ghi nhận đúng actorId của Partner A khi hoàn thành lịch chăm sóc'
    );

    // 6.3 Idempotent retry: Partner A calls updateFollowUp with COMPLETED again
    const retryComplete = await followUpService.updateFollowUp(
      scheduleForA.id,
      { status: FollowUpStatus.COMPLETED },
      partnerAContext
    );
    assert(
      retryComplete.status === FollowUpStatus.COMPLETED,
      'Partner bấm hoàn thành lặp lại (retry) được xử lý idempotent an toàn, không sinh lỗi'
    );

    // 6.4 Partner A blocked from reopening a COMPLETED schedule
    let reopenByPartnerBlocked = false;
    try {
      await followUpService.updateFollowUp(
        scheduleForA.id,
        { status: FollowUpStatus.PENDING },
        partnerAContext
      );
    } catch (err) {
      if (err instanceof ForbiddenError) {
        reopenByPartnerBlocked = true;
      }
    }
    assert(
      reopenByPartnerBlocked,
      'Partner không được tự ý mở lại lịch chăm sóc đã hoàn thành (403 ForbiddenError)'
    );

    // 6.5 Partner A blocked from changing caregiver (assignedTo / assignedToUserId)
    let changeCaregiverBlocked = false;
    try {
      await followUpService.updateFollowUp(
        scheduleForA.id,
        { assignedToUserId: partnerB.id },
        partnerAContext
      );
    } catch (err) {
      if (err instanceof ForbiddenError) {
        changeCaregiverBlocked = true;
      }
    }
    assert(
      changeCaregiverBlocked,
      'Partner cố gắng đổi người chăm sóc sang người khác -> bị chặn 403 ForbiddenError'
    );

    // 6.6 Partner A blocked from completing or editing Partner B's schedule
    let editOtherPartnerScheduleBlocked = false;
    try {
      await followUpService.updateFollowUp(
        scheduleForB.id,
        { status: FollowUpStatus.COMPLETED },
        partnerAContext
      );
    } catch (err) {
      if (err instanceof ForbiddenError) {
        editOtherPartnerScheduleBlocked = true;
      }
    }
    assert(
      editOtherPartnerScheduleBlocked,
      'Partner A cố gắng hoàn thành lịch chăm sóc của Partner B -> bị chặn 403 ForbiddenError'
    );

    const bulkOtherPartnerRes = await followUpService.completeBulkFollowUps(
      { ids: [scheduleForB.id] },
      partnerAContext
    );
    assert(
      bulkOtherPartnerRes.succeeded.length === 0 && bulkOtherPartnerRes.failed.length === 1,
      'Partner A cố gắng bulk-complete lịch chăm sóc của Partner B -> bị từ chối trong danh sách failed'
    );

    // 6.7 Partner B can bulk-complete their own schedule (scheduleForB)
    const bulkBRes = await followUpService.completeBulkFollowUps(
      { ids: [scheduleForB.id] },
      partnerBContext
    );
    assert(
      bulkBRes.succeeded.length === 1 && bulkBRes.failed.length === 0,
      'Partner B bulk-complete lịch chăm sóc của chính mình thành công (succeeded.length = 1)'
    );
  } finally {
    // Clean up all temporary test entities in reverse dependency order
    console.log('\n🧹 Cleaning up temporary test records...');

    if (createdCustomerIds.length > 0 || createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: createdCustomerIds } },
            { actorId: { in: createdUserIds } },
          ],
        },
      });
    }

    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      });
    }

    if (createdQuestionnaireIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: createdQuestionnaireIds } },
      });
      await prisma.questionnaire.deleteMany({
        where: { id: { in: createdQuestionnaireIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    const finalCustomerCount = await prisma.customer.count();
    assert(
      finalCustomerCount === initialCustomerCount,
      `Bảo toàn dữ liệu DB: Số lượng khách hàng trước (${initialCustomerCount}) và sau test (${finalCustomerCount}) giữ nguyên 100%`
    );
  }

  console.log('\n================================================================================');
  console.log(`🎯 KẾT QUẢ KIỂM THỬ TỔNG HỢP: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error('❌ Verification failed with unhandled error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
