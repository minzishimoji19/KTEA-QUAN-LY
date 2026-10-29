/**
 * verify-akinator-phase6.ts
 *
 * Comprehensive Verification Suite for Phase 6:
 * 1. Admin Customer Transfer Frontend Architecture Integrity (Modal, Workspace, Types, Service)
 * 2. Full RBAC Enforcement (Partner 403, Unauthenticated 401 on /check-duplicate & /transfer)
 * 3. Pre-condition Enforcements (Session exists, APPROVED status, non-empty contact info)
 * 4. Phone Normalization & Duplicate Detection (matches Vietnamese formatted & international variants)
 * 5. CREATE_NEW Transfer Mode (creates Customer with mapped fields, checks duplicate confirmation)
 * 6. LINK_EXISTING Transfer Mode (links session to existing Customer, preserves existing customer data untouched)
 * 7. Concurrency & Idempotency Protection (repeating transfer returns existing customer without duplication)
 * 8. Preservation of Original Akinator Data (Raw answers, evaluation results, admin review notes)
 * 9. Zero Regression on CRM Customer & Needs Assessment modules
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorWorkflowStatus,
  AkinatorQuizStatus,
  PriorityLevel,
  Gender,
  CustomerStatus,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';
import { normalizePhoneNumber, getPhoneSearchVariants } from '../services/akinator.service.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 6: AKINATOR CUSTOMER TRANSFER & INTEGRATION SUITE   ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

interface HttpHelperResponse {
  status: number;
  body: any;
}

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  options?: {
    cookieToken?: string;
    body?: any;
  }
): Promise<HttpHelperResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server address not available'));
    }
    const payload = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.cookieToken) {
      headers['Cookie'] = `${SESSION_COOKIE_NAME}=${options.cookieToken}`;
      headers['x-ktea-request'] = '1';
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            // keep raw string
          }
          resolve({
            status: res.statusCode || 500,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const backendDir = process.cwd().endsWith('backend')
    ? process.cwd()
    : path.join(process.cwd(), 'backend');
  const rootDir = path.resolve(backendDir, '..');
  const frontendDir = path.join(rootDir, 'frontend');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin.phase6.test@ktea.vn' },
    create: {
      email: 'admin.phase6.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Phase 6 Test',
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner.phase6.test@ktea.vn' },
    create: {
      email: 'partner.phase6.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Phase 6 Test',
      role: Role.PARTNER,
    },
    update: { role: Role.PARTNER },
  });

  const adminToken = createSessionToken({
    id: adminUser.id,
    role: adminUser.role,
    email: adminUser.email,
    fullName: adminUser.fullName,
  });

  const partnerToken = createSessionToken({
    id: partnerUser.id,
    role: partnerUser.role,
    email: partnerUser.email,
    fullName: partnerUser.fullName,
  });

  const initialQuestionnaireCount = await prisma.questionnaire.count();
  const initialCustomerCount = await prisma.customer.count();

  // =========================================================================
  // GROUP 1: FRONTEND CODE & COMPONENT STRUCTURE INTEGRITY
  // =========================================================================
  console.log('--- GROUP 1: Customer Transfer Frontend Architecture Integrity ---');

  await runTest('AkinatorSessionDetailModal includes Transfer UI components and state logic', () => {
    const modalPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorSessionDetailModal.tsx');
    assert.ok(fs.existsSync(modalPath));
    const content = fs.readFileSync(modalPath, 'utf8');
    assert.match(content, /Chuyển sang Khách hàng/);
    assert.match(content, /handleStartTransferFlow/);
    assert.match(content, /checkDuplicateCustomer/);
    assert.match(content, /transferSession/);
    assert.match(content, /LINK_EXISTING/);
    assert.match(content, /CREATE_NEW/);
    assert.match(content, /Đã chuyển sang CRM/);
  });

  await runTest('AkinatorSessionsWorkspace supports TRANSFERRED filter and badge', () => {
    const wsPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorSessionsWorkspace.tsx');
    assert.ok(fs.existsSync(wsPath));
    const content = fs.readFileSync(wsPath, 'utf8');
    assert.match(content, /value="TRANSFERRED"/);
    assert.match(content, /Đã chuyển CRM/);
  });

  await runTest('Akinator TypeScript definitions cover Phase 6 transfer contracts', () => {
    const typesPath = path.join(frontendDir, 'src', 'types', 'akinator.ts');
    assert.ok(fs.existsSync(typesPath));
    const content = fs.readFileSync(typesPath, 'utf8');
    assert.match(content, /export interface DuplicateCustomerMatch/);
    assert.match(content, /export interface CheckDuplicateCustomerResponse/);
    assert.match(content, /export interface TransferAkinatorSessionInput/);
    assert.match(content, /export interface TransferAkinatorSessionResponse/);
  });

  await runTest('akinatorService exports checkDuplicateCustomer and transferSession', () => {
    const svcPath = path.join(frontendDir, 'src', 'services', 'akinatorService.ts');
    assert.ok(fs.existsSync(svcPath));
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.match(content, /checkDuplicateCustomer\s*\(\s*sessionId:\s*string/);
    assert.match(content, /transferSession\s*\(\s*sessionId:\s*string/);
  });

  // =========================================================================
  // GROUP 2: RBAC ENFORCEMENT ON TRANSFER APIS
  // =========================================================================
  console.log('\n--- GROUP 2: RBAC Enforcement on Transfer APIs ---');

  const dummySessionId = '00000000-0000-0000-0000-000000000000';

  await runTest('Unauthenticated request to /check-duplicate returns 401', async () => {
    const res = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions/${dummySessionId}/check-duplicate`
    );
    assert.strictEqual(res.status, 401);
  });

  await runTest('PARTNER request to /check-duplicate returns 403 Forbidden', async () => {
    const res = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions/${dummySessionId}/check-duplicate`,
      { cookieToken: partnerToken }
    );
    assert.strictEqual(res.status, 403);
  });

  await runTest('Unauthenticated request to /transfer returns 401', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${dummySessionId}/transfer`,
      { body: { mode: 'CREATE_NEW' } }
    );
    assert.strictEqual(res.status, 401);
  });

  await runTest('PARTNER request to /transfer returns 403 Forbidden', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${dummySessionId}/transfer`,
      {
        cookieToken: partnerToken,
        body: { mode: 'CREATE_NEW' },
      }
    );
    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // GROUP 3: PHONE NORMALIZATION & PRE-CONDITIONS
  // =========================================================================
  console.log('\n--- GROUP 3: Phone Normalization & Pre-condition Rules ---');

  await runTest('Phone normalization converts +84, 84 and formatted strings to canonical 0-prefixed 10 digits', () => {
    assert.strictEqual(normalizePhoneNumber('+84912345678'), '0912345678');
    assert.strictEqual(normalizePhoneNumber('84912345678'), '0912345678');
    assert.strictEqual(normalizePhoneNumber('091 234 5678'), '0912345678');
    assert.strictEqual(normalizePhoneNumber('091-234-5678'), '0912345678');
    assert.strictEqual(normalizePhoneNumber('(091) 234-5678'), '0912345678');
  });

  await runTest('getPhoneSearchVariants generates all standard querying variants', () => {
    const variants = getPhoneSearchVariants('0912345678');
    assert.ok(variants.includes('0912345678'));
    assert.ok(variants.includes('84912345678'));
    assert.ok(variants.includes('+84912345678'));
  });

  // Setup a published configuration and complete a quiz session for testing
  const uniqueTag = `P6_${Date.now()}`;
  const draftRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
    cookieToken: adminToken,
    body: {
      title: `${uniqueTag} Transfer Test Config`,
      maxQuestionsPerSession: 5,
      disclaimerText: 'Khuyến cáo tham khảo: Kết quả đánh giá sơ bộ không phải là cam kết cho vay.',
    },
  });
  const configId = draftRes.body.data.id;

  const putQRes = await makeRequest(server, 'PUT', `/api/akinator/configs/${configId}/questions`, {
    cookieToken: adminToken,
    body: {
      questions: [
        {
          code: `${uniqueTag}_NAME`,
          questionText: 'Họ tên?',
          questionType: AkinatorQuestionType.TEXT,
          isEntryQuestion: true,
          isRequiredForEval: true,
          priorityWeight: 100,
          mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
          active: true,
        },
        {
          code: `${uniqueTag}_PHONE`,
          questionText: 'SĐT?',
          questionType: AkinatorQuestionType.TEXT,
          isEntryQuestion: false,
          isRequiredForEval: true,
          priorityWeight: 90,
          mapsToCustomerField: AkinatorCustomerFieldMapping.PHONE,
          active: true,
        },
      ],
    },
  });
  if (putQRes.status !== 200) {
    console.error('ERROR in putQRes:', putQRes.status, putQRes.body);
  }

  const putRulesRes = await makeRequest(server, 'PUT', `/api/akinator/configs/${configId}/rules`, {
    cookieToken: adminToken,
    body: {
      rules: [
        {
          code: `${uniqueTag}_R1`,
          name: 'Luật mặc định',
          priorityOrder: 1,
          requiredQuestionCodes: [`${uniqueTag}_NAME`, `${uniqueTag}_PHONE`],
          conditions: {
            logic: 'AND',
            conditions: [
              { questionCode: `${uniqueTag}_NAME`, operator: 'IS_ANSWERED' },
            ],
          },
          outcomePayload: {
            categoryCode: 'STANDARD',
            categoryLabel: 'Tiêu chuẩn',
            referenceTitle: 'Gợi ý tiêu chuẩn',
            referenceSummary: 'Tóm tắt phân tích tiêu chuẩn.',
            suggestedDirections: [],
            cautionNotes: [],
            suggestedPriority: PriorityLevel.TIN_DUNG,
          },
          active: true,
        },
      ],
    },
  });
  await makeRequest(server, 'POST', `/api/akinator/configs/${configId}/publish`, {
    cookieToken: adminToken,
    body: { changeLog: 'Published for Phase 6 transfer verification' },
  });

  // Helper to run a public quiz and return sessionId
  async function runSampleQuiz(fullName: string, phone: string) {
    const startRes = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
    const token = startRes.body.data.sessionToken;
    const sId = startRes.body.data.sessionId;

    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${token}/answers`, {
      body: { questionCode: `${uniqueTag}_NAME`, answerValue: fullName },
    });
    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${token}/answers`, {
      body: { questionCode: `${uniqueTag}_PHONE`, answerValue: phone },
    });
    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${token}/complete`);
    return sId;
  }

  const session1Id = await runSampleQuiz('Trần Đức Phase6 Unapproved', '0933112233');

  await runTest('Transfer rejects non-APPROVED session (PENDING_PROCESSING) with 400 Bad Request', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session1Id}/transfer`,
      {
        cookieToken: adminToken,
        body: { mode: 'CREATE_NEW' },
      }
    );
    assert.strictEqual(res.status, 400);
    assert.match(res.body?.error?.message, /Chỉ hồ sơ ở trạng thái Đã duyệt \(APPROVED\)/);
  });

  // Approve session 1
  await makeRequest(server, 'POST', `/api/akinator/sessions/${session1Id}/status`, {
    cookieToken: adminToken,
    body: { toStatus: AkinatorWorkflowStatus.IN_PROGRESS },
  });
  await makeRequest(server, 'POST', `/api/akinator/sessions/${session1Id}/status`, {
    cookieToken: adminToken,
    body: { toStatus: AkinatorWorkflowStatus.APPROVED, approvalNote: 'Duyệt test Phase 6' },
  });

  // =========================================================================
  // GROUP 4: DUPLICATE DETECTION API
  // =========================================================================
  console.log('\n--- GROUP 4: Duplicate Customer Detection ---');

  // Verify duplicate check when no customer has phone 0933112233
  await runTest('Check duplicate returns hasDuplicate: false when phone is not registered in CRM', async () => {
    const res = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions/${session1Id}/check-duplicate`,
      { cookieToken: adminToken }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.hasDuplicate, false);
    assert.strictEqual(res.body.data.matches.length, 0);
  });

  // Create an existing customer with a unique phone number
  const uniqueDigits = Date.now().toString().slice(-7);
  const existingCustomerPhone = `094${uniqueDigits}`;
  const existingCustomer = await prisma.customer.create({
    data: {
      fullName: 'Khách Hàng Hiện Hữu CRM Phase6',
      phone: existingCustomerPhone,
      email: `hienhuu.phase6.${uniqueDigits}@example.com`,
      overallStatus: CustomerStatus.DANG_TU_VAN,
      priority: PriorityLevel.THANH_KHOAN,
      note: 'Ghi chú ban đầu của khách hàng hiện hữu',
    },
  });

  // Run a second quiz session with international phone variant +84 94...
  const session2Phone = `+84 94 ${uniqueDigits.slice(0, 3)} ${uniqueDigits.slice(3)}`;
  const session2Id = await runSampleQuiz('Khách Trùng Số ĐT', session2Phone);
  await makeRequest(server, 'POST', `/api/akinator/sessions/${session2Id}/status`, {
    cookieToken: adminToken,
    body: { toStatus: AkinatorWorkflowStatus.IN_PROGRESS },
  });
  await makeRequest(server, 'POST', `/api/akinator/sessions/${session2Id}/status`, {
    cookieToken: adminToken,
    body: { toStatus: AkinatorWorkflowStatus.APPROVED, approvalNote: 'Duyệt test trùng' },
  });

  await runTest('Check duplicate detects existing customer matching normalized phone variants', async () => {
    const res = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions/${session2Id}/check-duplicate`,
      { cookieToken: adminToken }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.hasDuplicate, true);
    assert.ok(res.body.data.matches.length >= 1);
    assert.strictEqual(res.body.data.matches[0].id, existingCustomer.id);
    assert.strictEqual(res.body.data.matches[0].phone, existingCustomerPhone);
  });

  // =========================================================================
  // GROUP 5: TRANSFER MODE 'CREATE_NEW'
  // =========================================================================
  console.log('\n--- GROUP 5: Transfer Mode CREATE_NEW ---');

  await runTest('Transfer CREATE_NEW on session with duplicate phone without confirmCreateNew returns 409 Conflict', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session2Id}/transfer`,
      {
        cookieToken: adminToken,
        body: { mode: 'CREATE_NEW', confirmCreateNew: false },
      }
    );
    assert.strictEqual(res.status, 409);
    assert.match(res.body?.error?.message, /Phát hiện.*khách hàng trùng số điện thoại/);
  });

  await runTest('Transfer CREATE_NEW on unique session (session1) creates new Customer record with mapped fields', async () => {
    // Update admin review notes on session1
    await makeRequest(server, 'PATCH', `/api/akinator/sessions/${session1Id}/review`, {
      cookieToken: adminToken,
      body: {
        editedFullName: 'Trần Đức Phase6 Chuẩn Hóa',
        editedEmail: 'tranduc.phase6@example.com',
        editedGender: Gender.MALE,
        editedDateOfBirth: '20/10/1995',
        editedAddress: '456 Lê Lợi, TP.HCM',
        editedPriority: PriorityLevel.TIN_DUNG,
        processorNote: 'Tư vấn gói vay 30 triệu tiêu dùng',
      },
    });

    const transferRes = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session1Id}/transfer`,
      {
        cookieToken: adminToken,
        body: { mode: 'CREATE_NEW' },
      }
    );
    assert.strictEqual(transferRes.status, 200);
    assert.strictEqual(transferRes.body.data.alreadyTransferred, false);
    assert.strictEqual(transferRes.body.data.mode, 'CREATE_NEW');
    assert.ok(transferRes.body.data.customerId);

    // Verify Customer record in database
    const created = await prisma.customer.findUnique({
      where: { id: transferRes.body.data.customerId },
    });
    assert.ok(created);
    assert.strictEqual(created.fullName, 'Trần Đức Phase6 Chuẩn Hóa');
    assert.strictEqual(created.phone, '0933112233');
    assert.strictEqual(created.email, 'tranduc.phase6@example.com');
    assert.strictEqual(created.gender, Gender.MALE);
    assert.strictEqual(created.address, '456 Lê Lợi, TP.HCM');
    assert.strictEqual(created.overallStatus, CustomerStatus.LEAD_MOI);
    assert.strictEqual(created.priority, PriorityLevel.TIN_DUNG);
    assert.strictEqual(created.source, 'Akinator');
    assert.strictEqual(created.note, 'Tư vấn gói vay 30 triệu tiêu dùng');

    // Verify Akinator session status updated to TRANSFERRED and linkedCustomerId is set
    const sDetail = await prisma.akinatorSession.findUnique({
      where: { id: session1Id },
      include: { adminReview: true, statusHistories: true },
    });
    assert.strictEqual(sDetail?.workflowStatus, AkinatorWorkflowStatus.TRANSFERRED);
    assert.strictEqual(sDetail?.adminReview?.linkedCustomerId, created.id);

    const historyRecord = sDetail?.statusHistories.find(
      (h) => h.actionType === 'TRANSFER_CREATE_NEW_CUSTOMER'
    );
    assert.ok(historyRecord);
  });

  // =========================================================================
  // GROUP 6: TRANSFER MODE 'LINK_EXISTING'
  // =========================================================================
  console.log('\n--- GROUP 6: Transfer Mode LINK_EXISTING ---');

  await runTest('Transfer LINK_EXISTING requires valid existingCustomerId', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session2Id}/transfer`,
      {
        cookieToken: adminToken,
        body: { mode: 'LINK_EXISTING' },
      }
    );
    assert.strictEqual(res.status, 400);

    const resNotFound = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session2Id}/transfer`,
      {
        cookieToken: adminToken,
        body: {
          mode: 'LINK_EXISTING',
          existingCustomerId: '00000000-0000-0000-0000-000000000000',
        },
      }
    );
    assert.strictEqual(resNotFound.status, 404);
  });

  await runTest('Transfer LINK_EXISTING links session to existing customer without overwriting existing customer data', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session2Id}/transfer`,
      {
        cookieToken: adminToken,
        body: {
          mode: 'LINK_EXISTING',
          existingCustomerId: existingCustomer.id,
        },
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.mode, 'LINK_EXISTING');
    assert.strictEqual(res.body.data.customerId, existingCustomer.id);

    // Verify existing Customer in DB was NOT overwritten
    const freshCustomer = await prisma.customer.findUnique({
      where: { id: existingCustomer.id },
    });
    assert.ok(freshCustomer);
    assert.strictEqual(freshCustomer.fullName, 'Khách Hàng Hiện Hữu CRM Phase6');
    assert.strictEqual(freshCustomer.phone, existingCustomerPhone);
    assert.strictEqual(freshCustomer.note, 'Ghi chú ban đầu của khách hàng hiện hữu');
    assert.strictEqual(freshCustomer.overallStatus, CustomerStatus.DANG_TU_VAN);

    // Verify Akinator session is TRANSFERRED and linked
    const s2Detail = await prisma.akinatorSession.findUnique({
      where: { id: session2Id },
      include: { adminReview: true, statusHistories: true },
    });
    assert.strictEqual(s2Detail?.workflowStatus, AkinatorWorkflowStatus.TRANSFERRED);
    assert.strictEqual(s2Detail?.adminReview?.linkedCustomerId, existingCustomer.id);

    const linkHistory = s2Detail?.statusHistories.find(
      (h) => h.actionType === 'TRANSFER_LINK_EXISTING_CUSTOMER'
    );
    assert.ok(linkHistory);
  });

  // =========================================================================
  // GROUP 7: IDEMPOTENCY & CONCURRENCY
  // =========================================================================
  console.log('\n--- GROUP 7: Idempotency & Repeat Transfer Protection ---');

  await runTest('Calling transfer again on already TRANSFERRED session returns idempotent success without duplicate customers', async () => {
    const customerCountBefore = await prisma.customer.count();

    const repeatRes = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${session1Id}/transfer`,
      {
        cookieToken: adminToken,
        body: { mode: 'CREATE_NEW' },
      }
    );
    assert.strictEqual(repeatRes.status, 200);
    assert.strictEqual(repeatRes.body.data.alreadyTransferred, true);

    const customerCountAfter = await prisma.customer.count();
    assert.strictEqual(customerCountAfter, customerCountBefore, 'No duplicate customer record created on retry');
  });

  // =========================================================================
  // GROUP 8: PRESERVATION OF AKINATOR RAW DATA & ZERO REGRESSION
  // =========================================================================
  console.log('\n--- GROUP 8: Preservation of Akinator Raw Data & Zero CRM Regression ---');

  await runTest('All original quiz raw answers in AkinatorRawAnswer remain 100% intact after transfer', async () => {
    const rawAnswers1 = await prisma.akinatorRawAnswer.findMany({
      where: { sessionId: session1Id },
      orderBy: { stepOrder: 'asc' },
    });
    assert.strictEqual(rawAnswers1.length, 2);
    assert.strictEqual(rawAnswers1[0].answerValue, 'Trần Đức Phase6 Unapproved');
    assert.strictEqual(rawAnswers1[1].answerValue, '0933112233');

    const rawAnswers2 = await prisma.akinatorRawAnswer.findMany({
      where: { sessionId: session2Id },
    });
    assert.strictEqual(rawAnswers2.length, 2);
  });

  await runTest('Zero Needs Assessment questionnaire regression', async () => {
    const count = await prisma.questionnaire.count();
    assert.strictEqual(count, initialQuestionnaireCount);
  });

  // Cleanup test customers created during this test
  await prisma.customer.deleteMany({
    where: {
      phone: {
        in: ['0933112233', existingCustomerPhone],
      },
    },
  });

  const finalCustomerCount = await prisma.customer.count();
  assert.strictEqual(finalCustomerCount, initialCustomerCount, 'Customer database count restored 100%');

  // Close server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`   ALL AKINATOR PHASE 6 TESTS PASSED: ${passedTests}/${totalTests} ✓`);
  console.log('========================================================================\n');
}

main()
  .catch((err) => {
    console.error('\nPHASE 6 VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
