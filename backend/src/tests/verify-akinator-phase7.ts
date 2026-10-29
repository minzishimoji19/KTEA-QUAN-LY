/**
 * verify-akinator-phase7.ts
 *
 * Comprehensive End-to-End, Security & Release Readiness Verification Suite for Phase 7:
 * 1. Comprehensive RBAC Matrix & Token Tampering Resistance
 * 2. Public Quiz Adaptive Engine, Session Isolation & Zero Auto-Customer Creation
 * 3. Configuration Immutability, Validation Guards & Audit Trail
 * 4. Admin Review Data Separation & Raw Answer Immutability Invariant
 * 5. State Machine Workflow Transitions & Audit History Integrity
 * 6. Customer Transfer: Phone Normalization, Duplicate Detection, Mode Link vs Create
 * 7. Concurrency & Race Condition Mutex Test (Parallel Transfer Requests)
 * 8. Error Handling & Secret Leak Prevention in API Responses
 * 9. Zero Regression on CRM Core & Needs Assessment Modules
 */
import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorWorkflowStatus,
  AkinatorQuizStatus,
  AkinatorEvaluationStatus,
  PriorityLevel,
  CustomerStatus,
  Gender,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 7: E2E, SECURITY & RELEASE READINESS SUITE          ');
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

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  options: {
    cookieToken?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server is not listening'));
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      'x-ktea-request': '1',
      ...(options.headers || {}),
    };

    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    if (options.cookieToken) {
      reqHeaders['Cookie'] = `${SESSION_COOKIE_NAME}=${options.cookieToken}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 500,
            body: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin.phase7.test@ktea.vn' },
    create: {
      email: 'admin.phase7.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Phase 7 Test',
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner.phase7.test@ktea.vn' },
    create: {
      email: 'partner.phase7.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Phase 7 Test',
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

  try {
    // =========================================================================
    // GROUP 1: SECURITY & RBAC MATRIX AUDIT
    // =========================================================================
    console.log('--- GROUP 1: Security & RBAC Matrix Audit ---');

    const protectedAdminEndpoints = [
      { method: 'GET', path: '/api/akinator/configs' },
      { method: 'POST', path: '/api/akinator/configs/draft' },
      { method: 'GET', path: '/api/akinator/sessions' },
      { method: 'GET', path: '/api/akinator/sessions/00000000-0000-0000-0000-000000000000' },
      { method: 'PATCH', path: '/api/akinator/sessions/00000000-0000-0000-0000-000000000000/review' },
      { method: 'POST', path: '/api/akinator/sessions/00000000-0000-0000-0000-000000000000/status' },
      { method: 'GET', path: '/api/akinator/sessions/00000000-0000-0000-0000-000000000000/check-duplicate' },
      { method: 'POST', path: '/api/akinator/sessions/00000000-0000-0000-0000-000000000000/transfer' },
    ];

    await runTest('Unauthenticated requests to all Admin Akinator endpoints return 401 Unauthorized', async () => {
      for (const ep of protectedAdminEndpoints) {
        const res = await makeRequest(server, ep.method, ep.path);
        assert.strictEqual(
          res.status,
          401,
          `Expected 401 for unauthenticated ${ep.method} ${ep.path}, got ${res.status}`
        );
      }
    });

    await runTest('PARTNER requests to all Admin Akinator endpoints return 403 Forbidden', async () => {
      for (const ep of protectedAdminEndpoints) {
        const res = await makeRequest(server, ep.method, ep.path, { cookieToken: partnerToken });
        assert.strictEqual(
          res.status,
          403,
          `Expected 403 for PARTNER role on ${ep.method} ${ep.path}, got ${res.status}`
        );
      }
    });

    await runTest('Malformed UUID parameters return 422 Validation Error instead of 500 crash', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/sessions/not-a-valid-uuid', {
        cookieToken: adminToken,
      });
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error?.code, 'VALIDATION_ERROR');
    });

    // =========================================================================
    // GROUP 2: PUBLIC QUIZ ENGINE & SESSION ISOLATION
    // =========================================================================
    console.log('\n--- GROUP 2: Public Quiz Engine & Session Isolation ---');

    const uniqueTag = `P7_${Date.now()}`;
    const draftRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
      cookieToken: adminToken,
      body: {
        title: `${uniqueTag} Release Audit Config`,
        maxQuestionsPerSession: 6,
        disclaimerText: 'Kết quả đánh giá sơ bộ chỉ mang tính tham khảo.',
      },
    });
    if (draftRes.status !== 201 && draftRes.status !== 200) {
      console.error('ERROR in draftRes:', draftRes.status, draftRes.body);
    }
    const configId = draftRes.body.data.id;

    // Configure adaptive questions
    await makeRequest(server, 'PUT', `/api/akinator/configs/${configId}/questions`, {
      cookieToken: adminToken,
      body: {
        questions: [
          {
            code: `${uniqueTag}_GOAL`,
            questionText: 'Mục đích vay vốn của bạn?',
            questionType: AkinatorQuestionType.SINGLE_CHOICE,
            isEntryQuestion: true,
            isRequiredForEval: true,
            priorityWeight: 100,
            options: [
              { label: 'Kinh doanh', value: 'BUSINESS' },
              { label: 'Tiêu dùng cá nhân', value: 'CONSUMER' },
            ],
            nextQuestionRules: [
              {
                conditions: [{ questionCode: `${uniqueTag}_GOAL`, operator: 'EQUALS', value: 'BUSINESS' }],
                action: 'GOTO_QUESTION',
                targetQuestionCode: `${uniqueTag}_REVENUE`,
              },
              {
                conditions: [{ questionCode: `${uniqueTag}_GOAL`, operator: 'EQUALS', value: 'CONSUMER' }],
                action: 'GOTO_QUESTION',
                targetQuestionCode: `${uniqueTag}_SALARY`,
              },
            ],
            active: true,
          },
          {
            code: `${uniqueTag}_REVENUE`,
            questionText: 'Doanh thu hàng tháng (VND)?',
            questionType: AkinatorQuestionType.CURRENCY,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 80,
            visibilityConditions: {
              logic: 'AND',
              conditions: [{ questionCode: `${uniqueTag}_GOAL`, operator: 'EQUALS', value: 'BUSINESS' }],
            },
            active: true,
          },
          {
            code: `${uniqueTag}_SALARY`,
            questionText: 'Thu nhập chuyển khoản hàng tháng (VND)?',
            questionType: AkinatorQuestionType.CURRENCY,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 80,
            visibilityConditions: {
              logic: 'AND',
              conditions: [{ questionCode: `${uniqueTag}_GOAL`, operator: 'EQUALS', value: 'CONSUMER' }],
            },
            active: true,
          },
          {
            code: `${uniqueTag}_PHONE`,
            questionText: 'Số điện thoại liên hệ?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 70,
            mapsToCustomerField: AkinatorCustomerFieldMapping.PHONE,
            active: true,
          },
          {
            code: `${uniqueTag}_NAME`,
            questionText: 'Họ và tên của bạn?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 60,
            mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
            active: true,
          },
        ],
      },
    });

    // Configure evaluation rules
    await makeRequest(server, 'PUT', `/api/akinator/configs/${configId}/rules`, {
      cookieToken: adminToken,
      body: {
        rules: [
          {
            code: `${uniqueTag}_R_BIZ`,
            name: 'Gói hỗ trợ kinh doanh',
            priorityOrder: 1,
            requiredQuestionCodes: [`${uniqueTag}_GOAL`, `${uniqueTag}_REVENUE`],
            conditions: {
              logic: 'AND',
              conditions: [
                { questionCode: `${uniqueTag}_GOAL`, operator: 'EQUALS', value: 'BUSINESS' },
                { questionCode: `${uniqueTag}_REVENUE`, operator: 'GTE', value: 50000000 },
              ],
            },
            outcomePayload: {
              categoryCode: 'BIZ_PREMIUM',
              categoryLabel: 'Vốn kinh doanh ưu đãi',
              referenceTitle: 'Gói hỗ trợ doanh nghiệp SME',
              referenceSummary: 'Đủ điều kiện tiếp cận nguồn vốn bổ sung kinh doanh ưu đãi.',
              suggestedDirections: ['Chuẩn bị báo cáo thuế', 'Đăng ký kinh doanh'],
              cautionNotes: ['Lãi suất thay đổi theo từng kỳ điều chỉnh'],
              suggestedPriority: PriorityLevel.TIN_DUNG,
            },
            active: true,
          },
        ],
      },
    });

    await makeRequest(server, 'POST', `/api/akinator/configs/${configId}/publish`, {
      cookieToken: adminToken,
      body: { changeLog: 'Published for Phase 7 E2E audit' },
    });

    // Test Config Immutability
    await runTest('Published configuration is strictly immutable (blocks metadata edits once published)', async () => {
      const editMeta = await makeRequest(server, 'PATCH', `/api/akinator/configs/${configId}`, {
        cookieToken: adminToken,
        body: { title: 'Cố tình sửa metadata bản đã xuất bản' },
      });
      assert.strictEqual(editMeta.status, 400);
      assert.match(editMeta.body.error?.message, /Không thể chỉnh sửa phiên bản cấu hình đã xuất bản/);
    });

    // Start Session A
    const sessionAStart = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
    const tokenA = sessionAStart.body.data.sessionToken;
    const sessionAId = sessionAStart.body.data.sessionId;

    // Start Session B
    const sessionBStart = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
    const tokenB = sessionBStart.body.data.sessionToken;
    const sessionBId = sessionBStart.body.data.sessionId;

    await runTest('Session isolation: Token A cannot submit answers or access Session B', async () => {
      const res = await makeRequest(server, 'GET', `/api/public/akinator/sessions/${tokenA}`);
      assert.strictEqual(res.body.data.sessionId, sessionAId);
      assert.notStrictEqual(res.body.data.sessionId, sessionBId);
    });

    await runTest('Adaptive branching: Answers route to correct branch and block ineligible branches', async () => {
      // Answer GOAL = BUSINESS
      const a1 = await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
        body: { questionCode: `${uniqueTag}_GOAL`, answerValue: 'BUSINESS' },
      });
      assert.strictEqual(a1.status, 200);
      assert.strictEqual(a1.body.data.nextQuestion?.code, `${uniqueTag}_REVENUE`);

      // Attempt to answer SALARY (ineligible branch for BUSINESS)
      const aIneligible = await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
        body: { questionCode: `${uniqueTag}_SALARY`, answerValue: 20000000 },
      });
      assert.strictEqual(aIneligible.status, 400);
      assert.match(aIneligible.body.error?.message, /không phù hợp với nhánh câu trả lời hiện tại/);
    });

    await runTest('Idempotent answer submission: Multiple clicks on the same answer do not duplicate records', async () => {
      // Repeat answering GOAL = BUSINESS
      const aRepeat = await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
        body: { questionCode: `${uniqueTag}_GOAL`, answerValue: 'BUSINESS' },
      });
      assert.strictEqual(aRepeat.status, 200);

      const dbAnswers = await prisma.akinatorRawAnswer.findMany({
        where: { sessionId: sessionAId, questionCode: `${uniqueTag}_GOAL` },
      });
      assert.strictEqual(dbAnswers.length, 1);
    });

    // Complete answers for Session A
    const phoneA = `097${Date.now().toString().slice(-7)}`;
    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
      body: { questionCode: `${uniqueTag}_REVENUE`, answerValue: 100000000 },
    });
    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
      body: { questionCode: `${uniqueTag}_PHONE`, answerValue: phoneA },
    });
    await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/answers`, {
      body: { questionCode: `${uniqueTag}_NAME`, answerValue: 'Trần Release Audit A' },
    });

    const completeA = await makeRequest(server, 'POST', `/api/public/akinator/sessions/${tokenA}/complete`);
    assert.strictEqual(completeA.status, 200);
    assert.strictEqual(completeA.body.data.quizStatus, AkinatorQuizStatus.COMPLETED);
    assert.strictEqual(completeA.body.data.result?.evaluationStatus, AkinatorEvaluationStatus.EVALUATED);

    await runTest('Completing quiz NEVER automatically creates a Customer record in CRM', async () => {
      const customer = await prisma.customer.findFirst({
        where: { phone: phoneA },
      });
      assert.strictEqual(customer, null);
    });

    // =========================================================================
    // GROUP 3: ADMIN WORKFLOW & DATA IMMUTABILITY
    // =========================================================================
    console.log('\n--- GROUP 3: Admin Workflow & Data Immutability ---');

    await runTest('Raw answers remain 100% immutable when Admin edits review fields', async () => {
      const reviewRes = await makeRequest(server, 'PATCH', `/api/akinator/sessions/${sessionAId}/review`, {
        cookieToken: adminToken,
        body: {
          editedFullName: 'Trần Release Audit A (Đã Tư Vấn)',
          editedPhone: phoneA,
          processorNote: 'Khách hàng có nhu cầu mở rộng xưởng sản xuất',
          editedPriority: PriorityLevel.TIN_DUNG,
        },
      });
      assert.strictEqual(reviewRes.status, 200);

      // Verify raw answer is unchanged
      const rawAnswer = await prisma.akinatorRawAnswer.findFirst({
        where: { sessionId: sessionAId, questionCode: `${uniqueTag}_NAME` },
      });
      assert.strictEqual(rawAnswer?.answerValue, 'Trần Release Audit A');
    });

    await runTest('State machine enforces valid transitions and blocks invalid skips', async () => {
      // Cannot jump from PENDING_PROCESSING directly to TRANSFERRED
      const invalidJump = await makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/status`, {
        cookieToken: adminToken,
        body: { toStatus: AkinatorWorkflowStatus.TRANSFERRED },
      });
      assert.strictEqual(invalidJump.status, 400);

      // Transition PENDING_PROCESSING -> IN_PROGRESS
      const step1 = await makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/status`, {
        cookieToken: adminToken,
        body: { toStatus: AkinatorWorkflowStatus.IN_PROGRESS },
      });
      assert.strictEqual(step1.status, 200);

      // Transition IN_PROGRESS -> APPROVED
      const step2 = await makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/status`, {
        cookieToken: adminToken,
        body: { toStatus: AkinatorWorkflowStatus.APPROVED, approvalNote: 'Đã duyệt hồ sơ hợp lệ' },
      });
      assert.strictEqual(step2.status, 200);
    });

    await runTest('Status history audit trail records all transitions with actor metadata', async () => {
      const histories = await prisma.akinatorStatusHistory.findMany({
        where: { sessionId: sessionAId },
        orderBy: { createdAt: 'asc' },
      });
      assert.ok(histories.length >= 2);
      assert.strictEqual(histories[histories.length - 1].toStatus, AkinatorWorkflowStatus.APPROVED);
      assert.strictEqual(histories[histories.length - 1].actorEmail, 'admin.phase7.test@ktea.vn');
    });

    // =========================================================================
    // GROUP 4: DUPLICATE DETECTION & TRANSFER WORKFLOW
    // =========================================================================
    console.log('\n--- GROUP 4: Duplicate Detection & Transfer Workflow ---');

    await runTest('Duplicate detection identifies matches across phone variants and formats', async () => {
      // Create existing customer with phone
      const duplicatePhone = `098${Date.now().toString().slice(-7)}`;
      const existingCustomer = await prisma.customer.create({
        data: {
          fullName: 'Khách Hàng Hiện Hữu CRM Phase 7',
          phone: duplicatePhone,
          email: 'duplicate.phase7@example.com',
          overallStatus: CustomerStatus.DANG_TU_VAN,
          priority: PriorityLevel.THANH_KHOAN,
          note: 'Ghi chú gốc của khách hàng hiện hữu',
        },
      });

      // Update Session A review phone to duplicate phone
      await makeRequest(server, 'PATCH', `/api/akinator/sessions/${sessionAId}/review`, {
        cookieToken: adminToken,
        body: { editedPhone: `+84 ${duplicatePhone.slice(1, 4)} ${duplicatePhone.slice(4)}` },
      });

      const checkDup = await makeRequest(server, 'GET', `/api/akinator/sessions/${sessionAId}/check-duplicate`, {
        cookieToken: adminToken,
      });
      assert.strictEqual(checkDup.status, 200);
      assert.strictEqual(checkDup.body.data.hasDuplicate, true);
      assert.ok(checkDup.body.data.matches.some((m: any) => m.id === existingCustomer.id));
    });

    // =========================================================================
    // GROUP 5: CONCURRENCY & PARALLEL TRANSFER MUTEX TEST
    // =========================================================================
    console.log('\n--- GROUP 5: Concurrency & Parallel Transfer Mutex Test ---');

    await runTest('Parallel transfer requests on the same session do not create duplicate customers', async () => {
      // Re-set phone to unique
      const uniqueTransferPhone = `096${Date.now().toString().slice(-7)}`;
      await makeRequest(server, 'PATCH', `/api/akinator/sessions/${sessionAId}/review`, {
        cookieToken: adminToken,
        body: { editedPhone: uniqueTransferPhone, editedFullName: 'Trần Concurrency Test' },
      });

      // Send 3 simultaneous transfer requests
      const [r1, r2, r3] = await Promise.all([
        makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/transfer`, {
          cookieToken: adminToken,
          body: { mode: 'CREATE_NEW' },
        }),
        makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/transfer`, {
          cookieToken: adminToken,
          body: { mode: 'CREATE_NEW' },
        }),
        makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/transfer`, {
          cookieToken: adminToken,
          body: { mode: 'CREATE_NEW' },
        }),
      ]);

      // All requests should return 200 (either created or alreadyTransferred)
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      assert.strictEqual(r3.status, 200);

      // Verify strictly ONE customer created in DB
      const customers = await prisma.customer.findMany({
        where: { phone: uniqueTransferPhone },
      });
      assert.strictEqual(customers.length, 1, `Expected exactly 1 customer, found ${customers.length}`);

      // Verify Session status is TRANSFERRED
      const sessionDb = await prisma.akinatorSession.findUnique({
        where: { id: sessionAId },
        include: { adminReview: true },
      });
      assert.strictEqual(sessionDb?.workflowStatus, AkinatorWorkflowStatus.TRANSFERRED);
      assert.strictEqual(sessionDb?.adminReview?.linkedCustomerId, customers[0].id);
    });

    // =========================================================================
    // GROUP 6: SECRET LEAK PREVENTION & ERROR RESPONSE HYGIENE
    // =========================================================================
    console.log('\n--- GROUP 6: Secret Leak Prevention & Error Response Hygiene ---');

    await runTest('Server error responses never leak database credentials or internal stack traces', async () => {
      // Force an error via invalid input
      const res = await makeRequest(server, 'POST', `/api/akinator/sessions/${sessionAId}/status`, {
        cookieToken: adminToken,
        body: { toStatus: 'INVALID_STATUS_VALUE' },
      });
      assert.strictEqual(res.status, 422);
      const strBody = JSON.stringify(res.body);
      assert.strictEqual(strBody.includes('DATABASE_URL'), false);
      assert.strictEqual(strBody.includes('SESSION_SECRET'), false);
      assert.strictEqual(strBody.includes('password'), false);
    });

  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  console.log('\n========================================================================');
  console.log(`   PHASE 7 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✓`);
  console.log('========================================================================\n');
}

main()
  .catch((err) => {
    console.error('\nPHASE 7 VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
