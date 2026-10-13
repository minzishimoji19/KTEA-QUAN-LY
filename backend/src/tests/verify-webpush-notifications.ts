import assert from 'assert';
import { pushNotificationService, OPERATOR_RECIPIENTS } from '../services/pushNotification.service.js';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { FollowUpStatus } from '@prisma/client';

async function runTests() {
  console.log('--- Bắt đầu kiểm thử Web Push Notifications ---');

  // Test 1: VAPID Public Key
  console.log('1. Kiểm tra VAPID Public Key...');
  const pubKey = pushNotificationService.getPublicKey();
  assert(pubKey && pubKey.length > 20, 'VAPID public key phải tồn tại và hợp lệ');
  console.log('   ✓ VAPID Public Key:', pubKey.slice(0, 20) + '...');

  // Test 2: Xác thực passkey
  console.log('2. Kiểm tra xác thực passkey...');
  assert(!pushNotificationService.verifyPasskey('sai_mat_khau'), 'Passkey sai phải bị từ chối');
  assert(pushNotificationService.verifyPasskey(env.PUSH_AUTH_PASSKEY), 'Passkey đúng phải được chấp nhận');
  console.log('   ✓ Xác thực passkey an toàn');

  // Test 3: Đăng ký thiết bị giả lập
  console.log('3. Kiểm tra đăng ký subscription vào database...');
  const testEndpoint = `https://fcm.googleapis.com/fcm/send/test-endpoint-${Date.now()}`;
  const subData = {
    recipient: 'Ktea',
    subscription: {
      endpoint: testEndpoint,
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9ScVU7M2a',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    },
    deviceName: 'Test Device 1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    passkey: env.PUSH_AUTH_PASSKEY,
  };

  const registered = await pushNotificationService.registerSubscription(subData);
  assert(registered && registered.endpoint === testEndpoint, 'Subscription phải được lưu');
  assert(registered.recipient === 'Ktea', 'Recipient phải là Ktea');
  console.log('   ✓ Đăng ký thiết bị thành công:', registered.id);

  // Test 4: Lấy danh sách thiết bị
  console.log('4. Kiểm tra lấy danh sách thiết bị...');
  const devices = await pushNotificationService.getSubscriptionsForRecipient('Ktea', env.PUSH_AUTH_PASSKEY);
  assert(devices.length > 0, 'Phải có ít nhất 1 thiết bị cho Ktea');
  assert(devices.some(d => d.id === registered.id), 'Danh sách phải chứa thiết bị vừa tạo');
  console.log('   ✓ Lấy danh sách thiết bị thành công (Tìm thấy:', devices.length, 'thiết bị)');

  // Test 5: Idempotency log
  console.log('5. Kiểm tra cơ chế chống trùng lặp (Idempotency log)...');
  const testFollowUpId = `test-followup-${Date.now()}`;
  const testEventType = 'NEW_FOLLOW_UP';

  // Giả lập log lượt gửi thứ nhất
  await prisma.pushNotificationLog.create({
    data: {
      followUpId: testFollowUpId,
      eventType: testEventType,
      recipient: 'Ktea',
      status: 'SENT',
      title: 'KTEA CRM — Có lịch chăm sóc mới',
      body: 'Nội dung kiểm thử',
    },
  });

  // Kiểm tra trùng unique key: Prisma sẽ ném P2002 nếu cố insert duplicate (hoặc upsert an toàn)
  let duplicated = false;
  try {
    await prisma.pushNotificationLog.create({
      data: {
        followUpId: testFollowUpId,
        eventType: testEventType,
        recipient: 'Ktea',
        status: 'SENT',
        title: 'Thử gửi trùng',
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      duplicated = true;
    }
  }
  assert(duplicated, 'Unique constraint (followUpId, eventType, recipient) phải ngăn chặn bản ghi trùng');
  console.log('   ✓ Cơ chế Unique Index chặn trùng lặp tuyệt đối');

  // Test 6: Định dạng ngày giờ theo múi giờ Asia/Ho_Chi_Minh
  console.log('6. Kiểm tra múi giờ Asia/Ho_Chi_Minh...');
  const dateUtc = new Date('2026-10-13T03:00:00.000Z'); // 10:00 sáng tại VN (+7)
  const formattedVn = pushNotificationService.formatDateTimeVN(dateUtc);
  assert(formattedVn.includes('10:00'), `Phải hiển thị 10:00 theo múi giờ VN (Thực tế: ${formattedVn})`);
  console.log('   ✓ Múi giờ chính xác:', formattedVn);

  // Test 7: Dọn dẹp thiết bị test
  console.log('7. Dọn dẹp thiết bị test...');
  await pushNotificationService.unregisterSubscription(testEndpoint);
  await prisma.pushNotificationLog.deleteMany({
    where: { followUpId: testFollowUpId },
  });
  console.log('   ✓ Dọn dẹp hoàn tất');

  console.log('\n🎉 TẤT CẢ CÁC BƯỚC TEST BACKEND WEB PUSH ĐÃ ĐẠT 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Kiểm thử thất bại:', err);
    process.exit(1);
  });
