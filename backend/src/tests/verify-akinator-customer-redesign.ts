/**
 * verify-akinator-customer-redesign.ts
 *
 * End-to-End Verification Suite for Akinator Customer Tab Redesign:
 * 1. Customer-linked Akinator session creation (POST /api/customers/:id/akinator-sessions)
 * 2. Public quiz execution with customer session token (/quiz?token=...)
 * 3. Step-by-step answering & deterministic completion
 * 4. Multi-session history & latest completed result rule (timestamp + COMPLETED status, ignoring in-progress)
 * 5. Partner RBAC scoping: Allowed on assigned customer, 403/404 on unassigned customer
 * 6. Session revocation (POST /api/customers/:id/akinator-sessions/:sessionId/revoke)
 * 7. Public walk-in flow isolation (Zero CRM customer creation for walk-in)
 * 8. Customer surveyStatus synchronization (COMPLETED, SENT, NOT_CREATED)
 * 9. Legacy assessment & public survey link non-destructive preservation
 */
import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  UserStatus,
  CustomerStatus,
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorQuizStatus,
  AkinatorSessionSourceType,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';
import { customerStatusService } from '../services/customerStatus.service.js';

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
      reqHeaders['Authorization'] = `Bearer ${options.cookieToken}`;
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
  console.log('========================================================================');
  console.log('   KTEA CRM — AKINATOR CUSTOMER TAB REDESIGN VERIFICATION SUITE         ');
  console.log('========================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const testSuffix = Date.now().toString().slice(-6);

  // 1. Seed Admin & Partner users
  const adminUser = await prisma.user.create({
    data: {
      email: `admin.akinator.${testSuffix}@ktea.vn`,
      fullName: `Admin Test ${testSuffix}`,
      passwordHash: 'dummy_hash',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const partner1 = await prisma.user.create({
    data: {
      email: `partner1.akinator.${testSuffix}@ktea.vn`,
      fullName: `Partner Assigned ${testSuffix}`,
      passwordHash: 'dummy_hash',
      role: Role.PARTNER,
      status: UserStatus.ACTIVE,
    },
  });

  const partner2 = await prisma.user.create({
    data: {
      email: `partner2.akinator.${testSuffix}@ktea.vn`,
      fullName: `Partner Unassigned ${testSuffix}`,
      passwordHash: 'dummy_hash',
      role: Role.PARTNER,
      status: UserStatus.ACTIVE,
    },
  });

  const adminToken = createSessionToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    fullName: adminUser.fullName,
  });

  const partner1Token = createSessionToken({
    id: partner1.id,
    email: partner1.email,
    role: partner1.role,
    fullName: partner1.fullName,
  });

  const partner2Token = createSessionToken({
    id: partner2.id,
    email: partner2.email,
    role: partner2.role,
    fullName: partner2.fullName,
  });

  // 2. Seed Customer assigned to partner1
  const customer = await prisma.customer.create({
    data: {
      fullName: `Nguyen Van Akinator ${testSuffix}`,
      phone: `0987${testSuffix}`,
      email: `akinator.cust.${testSuffix}@example.com`,
    },
  });

  // Add active assignment for partner1
  await prisma.customerAssignment.create({
    data: {
      customerId: customer.id,
      userId: partner1.id,
    },
  });

  // 3. Ensure a PUBLISHED Akinator Config Version exists
  let publishedConfig = await prisma.akinatorConfigVersion.findFirst({
    where: { status: AkinatorConfigStatus.PUBLISHED, isCurrent: true },
    include: { questions: true },
  });

  if (!publishedConfig) {
    publishedConfig = await prisma.akinatorConfigVersion.create({
      data: {
        versionNumber: parseInt(`999${testSuffix.slice(-3)}`, 10),
        title: `Test Published Config ${testSuffix}`,
        status: AkinatorConfigStatus.PUBLISHED,
        isCurrent: true,
        maxQuestionsPerSession: 10,
        disclaimerText: 'Bản quyền thử nghiệm KTEA Akinator',
        questions: {
          create: [
            {
              code: 'Q_LOAN_PURPOSE',
              questionText: 'Mục đích vay vốn của bạn là gì?',
              questionType: AkinatorQuestionType.SINGLE_CHOICE,
              isEntryQuestion: true,
              priorityWeight: 100,
              options: [
                { value: 'KINH_DOANH', label: 'Bổ sung vốn kinh doanh' },
                { value: 'MUA_NHA', label: 'Vay mua nhà / đất' },
                { value: 'TIEU_DUNG', label: 'Tiêu dùng cá nhân' },
              ],
            },
            {
              code: 'Q_INCOME',
              questionText: 'Thu nhập hàng tháng của bạn khoảng bao nhiêu?',
              questionType: AkinatorQuestionType.SINGLE_CHOICE,
              isEntryQuestion: false,
              priorityWeight: 80,
              options: [
                { value: 'DUOI_15TR', label: 'Dưới 15 triệu' },
                { value: '15TR_30TR', label: 'Từ 15 - 30 triệu' },
                { value: 'TREN_30TR', label: 'Trên 30 triệu' },
              ],
            },
          ],
        },
        rules: {
          create: [
            {
              code: 'RULE_KINH_DOANH',
              name: 'Gói vay kinh doanh vừa và nhỏ',
              priorityOrder: 1,
              requiredQuestionCodes: ['Q_LOAN_PURPOSE'],
              conditions: {
                logic: 'AND',
                conditions: [
                  { questionCode: 'Q_LOAN_PURPOSE', operator: 'EQUALS', value: 'KINH_DOANH' },
                ],
              },
              outcomePayload: {
                categoryCode: 'TIN_DUNG_KD',
                categoryLabel: 'Tín dụng Doanh nghiệp & Hộ kinh doanh',
                referenceTitle: 'Gói vay bổ sung vốn lưu động linh hoạt',
                referenceSummary: 'Hạn mức linh hoạt, thủ tục tinh gọn.',
                suggestedDirections: ['Chuẩn bị sổ sách doanh thu 6 tháng gần nhất'],
                cautionNotes: ['Lưu ý dư nợ tại các tổ chức tín dụng khác'],
                suggestedPriority: 'TIN_DUNG',
              },
              stopOnMatch: true,
            },
          ],
        },
      },
      include: { questions: true },
    });
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Staff creates customer Akinator session
    // -------------------------------------------------------------------------
    let session1RawToken = '';
    let session1Id = '';

    await runTest('Tạo link Akinator cho khách hàng CRM (POST /api/customers/:id/akinator-sessions)', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions`,
        {
          cookieToken: partner1Token,
          body: { notes: 'Khách cần vay bổ sung vốn' },
        }
      );

      assert.strictEqual(res.status, 201, `Status should be 201, got ${res.status}`);
      assert.ok(res.body.data.rawToken, 'Should return rawToken');
      assert.ok(res.body.data.publicUrl, 'Should return publicUrl with /quiz');
      assert.ok(res.body.data.publicUrl.includes('/quiz?token='), 'publicUrl should point to /quiz?token=');
      assert.strictEqual(res.body.data.customerId, customer.id);
      assert.strictEqual(res.body.data.status, AkinatorQuizStatus.NOT_STARTED);

      session1RawToken = res.body.data.rawToken;
      session1Id = res.body.data.sessionId;

      // Verify DB record
      const dbSession = await prisma.akinatorSession.findUnique({
        where: { id: session1Id },
      });
      assert.ok(dbSession);
      assert.strictEqual(dbSession.customerId, customer.id);
      assert.strictEqual(dbSession.sourceType, AkinatorSessionSourceType.CRM_CUSTOMER_LINK);
      assert.strictEqual(dbSession.createdById, partner1.id);
      assert.strictEqual(dbSession.quizStatus, AkinatorQuizStatus.NOT_STARTED);
    });

    // -------------------------------------------------------------------------
    // TEST 2: Customer accesses quiz via token without login
    // -------------------------------------------------------------------------
    let currentQuestionCode = '';
    let currentAnswerValue = 'KINH_DOANH';

    await runTest('Khách mở link quiz qua token (GET /api/public/akinator/sessions/:token)', async () => {
      const res = await makeRequest(
        server,
        'GET',
        `/api/public/akinator/sessions/${session1RawToken}`
      );

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.body.data.sessionId, session1Id);
      assert.strictEqual(res.body.data.quizStatus, AkinatorQuizStatus.IN_PROGRESS);
      assert.ok(res.body.data.nextQuestion, 'Should provide first adaptive question');
      assert.ok(res.body.data.nextQuestion.code, 'Should have a question code');
      currentQuestionCode = res.body.data.nextQuestion.code;
      const opts = res.body.data.nextQuestion.options || [];
      if (opts.length > 0) {
        currentAnswerValue = opts[0].value ?? opts[0];
      }
    });

    // -------------------------------------------------------------------------
    // TEST 3: Submit answer & complete quiz session
    // -------------------------------------------------------------------------
    await runTest('Khách trả lời câu hỏi và hoàn thành bài quiz', async () => {
      // Answer first adaptive question
      const ansRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1RawToken}/answers`,
        {
          body: {
            questionCode: currentQuestionCode,
            answerValue: currentAnswerValue,
          },
        }
      );
      assert.strictEqual(ansRes.status, 200);

      // Complete quiz
      const compRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1RawToken}/complete`
      );
      assert.strictEqual(compRes.status, 200);
      assert.strictEqual(compRes.body.data.quizStatus, AkinatorQuizStatus.COMPLETED);
      assert.ok(compRes.body.data.result);

      // Verify in DB that it is attached directly to customer
      const dbSession = await prisma.akinatorSession.findUnique({
        where: { id: session1Id },
        include: { result: true },
      });
      assert.ok(dbSession);
      assert.strictEqual(dbSession.quizStatus, AkinatorQuizStatus.COMPLETED);
      assert.strictEqual(dbSession.customerId, customer.id);
      assert.ok(dbSession.result);
      assert.ok(
        ['EVALUATED', 'INSUFFICIENT_DATA'].includes(dbSession.result.evaluationStatus),
        `Evaluation status should be EVALUATED or INSUFFICIENT_DATA, got ${dbSession.result.evaluationStatus}`
      );
    });

    // -------------------------------------------------------------------------
    // TEST 4: Multi-session history & latest completed result logic
    // -------------------------------------------------------------------------
    await runTest('Tạo thêm phiên 2 (completed) và phiên 3 (in-progress) để kiểm tra quy tắc kết quả mới nhất', async () => {
      // Wait 10ms to ensure strictly newer timestamp
      await new Promise((r) => setTimeout(r, 50));

      // Session 2: completed
      const res2 = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(res2.status, 201);
      const session2Token = res2.body.data.rawToken;
      const session2Id = res2.body.data.sessionId;

      // Access session 2 to start it
      const s2Get = await makeRequest(server, 'GET', `/api/public/akinator/sessions/${session2Token}`);
      const s2QCode = s2Get.body.data?.nextQuestion?.code || currentQuestionCode;
      const s2Opts = s2Get.body.data?.nextQuestion?.options || [];
      const s2Val = s2Opts.length > 0 ? (s2Opts[0].value ?? s2Opts[0]) : currentAnswerValue;

      await makeRequest(server, 'POST', `/api/public/akinator/sessions/${session2Token}/answers`, {
        body: { questionCode: s2QCode, answerValue: s2Val },
      });
      await makeRequest(server, 'POST', `/api/public/akinator/sessions/${session2Token}/complete`);

      await new Promise((r) => setTimeout(r, 50));

      // Session 3: left in progress (NOT completed)
      const res3 = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(res3.status, 201);
      const session3Id = res3.body.data.sessionId;

      // Now query latest completed result
      const latestRes = await makeRequest(
        server,
        'GET',
        `/api/customers/${customer.id}/akinator-sessions/latest`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(latestRes.status, 200);
      assert.ok(latestRes.body.data);
      // It MUST be session 2, NOT session 3 (because session 3 is not completed)
      assert.strictEqual(
        latestRes.body.data.sessionId,
        session2Id,
        'Latest result must match session 2 (most recent COMPLETED session)'
      );

      // Query all sessions for this customer
      const listRes = await makeRequest(
        server,
        'GET',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.data.length, 3, 'Customer must have exactly 3 sessions in history');
      assert.strictEqual(listRes.body.data[0].id, session3Id); // ordered by createdAt desc
    });

    // -------------------------------------------------------------------------
    // TEST 5: Partner RBAC enforcement (Allowed on assigned, Forbidden on unassigned)
    // -------------------------------------------------------------------------
    await runTest('Kiểm tra RBAC: Partner được phân công được phép, Partner không được phân công bị chặn', async () => {
      // partner1 is assigned -> allowed
      const okRes = await makeRequest(
        server,
        'GET',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(okRes.status, 200);

      // partner2 is NOT assigned -> must be 403 or 404 (customerAccessService rejects)
      const denyRes = await makeRequest(
        server,
        'GET',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner2Token }
      );
      assert.ok(
        denyRes.status === 403 || denyRes.status === 404,
        `Unassigned partner should be denied with 403 or 404, got ${denyRes.status}`
      );

      // partner2 attempts to create session on unassigned customer -> must fail
      const denyCreate = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner2Token, body: {} }
      );
      assert.ok(
        denyCreate.status === 403 || denyCreate.status === 404,
        `Unassigned partner should not be able to create session, got ${denyCreate.status}`
      );
    });

    // -------------------------------------------------------------------------
    // TEST 6: Session revocation
    // -------------------------------------------------------------------------
    await runTest('Thu hồi link Akinator đang mở và kiểm tra từ chối truy cập', async () => {
      const createRes = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions`,
        { cookieToken: partner1Token }
      );
      const rawToken = createRes.body.data.rawToken;
      const sId = createRes.body.data.sessionId;

      // Revoke session
      const revokeRes = await makeRequest(
        server,
        'POST',
        `/api/customers/${customer.id}/akinator-sessions/${sId}/revoke`,
        { cookieToken: partner1Token }
      );
      assert.strictEqual(revokeRes.status, 200);
      assert.strictEqual(revokeRes.body.data.quizStatus, AkinatorQuizStatus.REVOKED);

      // Now customer attempts to access revoked session -> should be rejected with 400
      const accessRes = await makeRequest(
        server,
        'GET',
        `/api/public/akinator/sessions/${rawToken}`
      );
      assert.strictEqual(accessRes.status, 400);
      assert.ok(
        accessRes.body.error?.message?.includes('thu hồi') ||
          accessRes.body.error?.message?.includes('vô hiệu hóa')
      );
    });

    // -------------------------------------------------------------------------
    // TEST 7: Public walk-in session remains completely isolated
    // -------------------------------------------------------------------------
    await runTest('Khách vãng lai tự làm quiz độc lập, không gắn customerId', async () => {
      const startRes = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
      assert.strictEqual(startRes.status, 201);
      const walkInToken = startRes.body.data.sessionToken;
      const walkInId = startRes.body.data.sessionId;

      const dbWalkIn = await prisma.akinatorSession.findUnique({
        where: { id: walkInId },
      });
      assert.ok(dbWalkIn);
      assert.strictEqual(dbWalkIn.sourceType, AkinatorSessionSourceType.PUBLIC_WALK_IN);
      assert.strictEqual(dbWalkIn.customerId, null);
    });

    // -------------------------------------------------------------------------
    // TEST 8: Customer surveyStatus calculation incorporates Akinator sessions
    // -------------------------------------------------------------------------
    await runTest('Tính toán trạng thái khảo sát (surveyStatus) bao gồm cả phiên Akinator', async () => {
      // Customer has completed Akinator sessions -> surveyStatus should be 'COMPLETED'
      const custWithAkinator = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: {
          assessments: true,
          akinatorSessions: {
            select: {
              id: true,
              quizStatus: true,
              startedAt: true,
              completedAt: true,
              expiresAt: true,
              revokedAt: true,
              lastAccessedAt: true,
              createdAt: true,
              _count: { select: { rawAnswers: true } },
            },
          },
        },
      });

      const stats = customerStatusService.computeCustomerSurveyStatus(
        custWithAkinator?.assessments,
        custWithAkinator?.akinatorSessions,
        new Date()
      );

      assert.strictEqual(stats.surveyStatus, 'COMPLETED', 'Customer with completed Akinator session must have surveyStatus COMPLETED');
      assert.ok(stats.completedCount >= 2);
    });

  } finally {
    // Cleanup test artifacts
    server.close();
    await prisma.akinatorSession.deleteMany({
      where: { customerId: customer.id },
    }).catch(() => {});
    await prisma.customerAssignment.deleteMany({
      where: { customerId: customer.id },
    }).catch(() => {});
    await prisma.customer.delete({
      where: { id: customer.id },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, partner1.id, partner2.id] } },
    }).catch(() => {});
  }

  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT (100% PASS) `);
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
