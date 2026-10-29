/**
 * verify-akinator-phase3.ts
 *
 * Comprehensive Verification Suite for Phase 3:
 * 1. Frontend Architecture & Routing Integrity (Akinator tab, Quiz routes, Navigation isolation)
 * 2. Full Adaptive Quiz User Journey via Public APIs (Start, Step-by-step adaptive answering, Completion)
 * 3. Idempotency, Session Resume on Refresh, Double-click protection
 * 4. Insufficient Data scenario & Mandatory Reference Disclaimer verification
 * 5. Zero Customer CRM mutation & Zero Needs Assessment regression
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorEvaluationStatus,
  PriorityLevel,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 3: AKINATOR UI & QUIZ FLOW VERIFICATION SUITE       ');
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
            // keep raw
          }
          resolve({
            status: res.statusCode || 0,
            body: parsed,
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
  const rootDir = path.resolve(process.cwd(), '..');
  const frontendDir = path.join(rootDir, 'frontend');

  // =========================================================================
  // GROUP 1: FRONTEND CODE STRUCTURE & ROUTING INTEGRITY
  // =========================================================================
  console.log('--- GROUP 1: Frontend Code Structure & Routing Verification ---');

  await runTest('Akinator TypeScript definitions exist and match contracts', () => {
    const typesPath = path.join(frontendDir, 'src', 'types', 'akinator.ts');
    assert.ok(fs.existsSync(typesPath), 'frontend/src/types/akinator.ts must exist');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert.match(content, /export type AkinatorQuestionType/);
    assert.match(content, /export type AkinatorEvaluationStatus/);
    assert.match(content, /export interface AkinatorPublicQuestion/);
    assert.match(content, /export interface AkinatorPublicResult/);
  });

  await runTest('Akinator frontend API service exports public and admin clients', () => {
    const servicePath = path.join(frontendDir, 'src', 'services', 'akinatorService.ts');
    assert.ok(fs.existsSync(servicePath), 'frontend/src/services/akinatorService.ts must exist');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.match(content, /export const akinatorPublicApi/);
    assert.match(content, /export const akinatorAdminApi/);
    assert.match(content, /\/public\/akinator\/sessions/);
    assert.match(content, /\/akinator\/configs\/current/);
  });

  await runTest('Akinator public quiz page and admin tab page components exist', () => {
    const quizPagePath = path.join(frontendDir, 'src', 'pages', 'AkinatorQuizPage.tsx');
    const adminPagePath = path.join(frontendDir, 'src', 'pages', 'AkinatorPage.tsx');
    assert.ok(fs.existsSync(quizPagePath), 'AkinatorQuizPage.tsx must exist');
    assert.ok(fs.existsSync(adminPagePath), 'AkinatorPage.tsx must exist');

    const quizContent = fs.readFileSync(quizPagePath, 'utf8');
    // Verify mandatory reference disclaimer is embedded in the quiz page
    assert.match(quizContent, /không phải cam kết phê duyệt khoản vay/i);
    // Verify double-click submission guard exists
    assert.match(quizContent, /isSubmitting/);
    // Verify all question types are handled
    assert.match(quizContent, /SINGLE_CHOICE/);
    assert.match(quizContent, /MULTIPLE_CHOICE/);
    assert.match(quizContent, /YES_NO/);
    assert.match(quizContent, /CURRENCY/);
    assert.match(quizContent, /DATE/);
  });

  await runTest('App.tsx mounts public quiz routes and protected admin route', () => {
    const appPath = path.join(frontendDir, 'src', 'App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /path="\/akinator\/quiz"/);
    assert.match(appContent, /path="\/akinator\/quiz\/:token"/);
    assert.match(appContent, /path="akinator"/);
    assert.match(appContent, /allowedRoles=\{\['ADMIN'\]\}/);
  });

  await runTest('Sidebar.tsx includes Akinator in ADMIN nav and excludes it from PARTNER', () => {
    const sidebarPath = path.join(frontendDir, 'src', 'layouts', 'Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    // Extract navItems for PARTNER vs ADMIN
    const partnerSection = content.slice(
      content.indexOf("role === 'PARTNER'"),
      content.indexOf('// Brand Header')
    );
    assert.ok(
      !partnerSection.slice(0, partnerSection.indexOf(': [')).includes('/akinator'),
      'PARTNER navigation must NOT include /akinator'
    );
    assert.ok(
      partnerSection.slice(partnerSection.indexOf(': [')).includes('/akinator'),
      'ADMIN navigation must include /akinator'
    );
  });

  // =========================================================================
  // GROUP 2: PUBLIC QUIZ USER JOURNEY & ADAPTIVE BACKEND FLOW
  // =========================================================================
  console.log('\n--- GROUP 2: Public Quiz User Journey & Adaptive Flow ---');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const testAdminUser = await prisma.user.upsert({
    where: { email: 'admin.phase3.test@ktea.vn' },
    create: {
      email: 'admin.phase3.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Phase 3 Test',
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  const testPartnerUser = await prisma.user.upsert({
    where: { email: 'partner.phase3.test@ktea.vn' },
    create: {
      email: 'partner.phase3.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Phase 3 Test',
      role: Role.PARTNER,
    },
    update: { role: Role.PARTNER },
  });

  const adminToken = createSessionToken({
    id: testAdminUser.id,
    email: testAdminUser.email,
    role: Role.ADMIN,
    fullName: testAdminUser.fullName,
  });

  const partnerToken = createSessionToken({
    id: testPartnerUser.id,
    email: testPartnerUser.email,
    role: Role.PARTNER,
    fullName: testPartnerUser.fullName,
  });

  // Clean prior akinator records
  await prisma.akinatorStatusHistory.deleteMany({});
  await prisma.akinatorAdminReview.deleteMany({});
  await prisma.akinatorResult.deleteMany({});
  await prisma.akinatorRawAnswer.deleteMany({});
  await prisma.akinatorSession.deleteMany({});
  await prisma.akinatorRule.deleteMany({});
  await prisma.akinatorQuestion.deleteMany({});
  await prisma.akinatorConfigVersion.deleteMany({});

  const initialCustomerCount = await prisma.customer.count();
  const initialAssessmentCount = await prisma.assessment.count();

  // Create & Publish a Standard Akinator Configuration for testing the frontend quiz journey
  const createDraftRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
    cookieToken: adminToken,
    body: {
      title: 'Akinator Tư Vấn Tài Chính Thích Ứng v1',
      description: 'Hệ thống hỗ trợ tìm hiểu nhu cầu tài chính cá nhân & hộ kinh doanh',
      maxQuestionsPerSession: 8,
      disclaimerText:
        'Kết quả trên chỉ mang tính chất tham khảo sơ bộ dựa trên thông tin bạn cung cấp, không phải cam kết phê duyệt khoản vay hay hạn mức tín dụng chính thức.',
    },
  });
  const configVersionId = createDraftRes.body.data.id;

  // Add questions
  await makeRequest(
    server,
    'PUT',
    `/api/akinator/configs/${configVersionId}/questions`,
    {
      cookieToken: adminToken,
      body: {
        questions: [
          {
            code: 'q_primary_purpose',
            questionText: 'Nhu cầu tài chính chính của bạn trong 3 tháng tới là gì?',
            description: 'Chọn mục tiêu phù hợp nhất để hệ thống định hướng câu hỏi kế tiếp',
            questionType: AkinatorQuestionType.SINGLE_CHOICE,
            isEntryQuestion: true,
            isRequiredForEval: true,
            priorityWeight: 100,
            options: [
              { label: 'Bổ sung vốn kinh doanh', value: 'BUSINESS_CAPITAL' },
              { label: 'Tiêu dùng cá nhân / Mua sắm', value: 'CONSUMER_LOAN' },
              { label: 'Chỉ tìm hiểu thông tin sơ bộ', value: 'INFO_ONLY' },
            ],
            nextQuestionRules: [
              {
                logic: 'AND',
                conditions: [
                  { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'BUSINESS_CAPITAL' },
                ],
                action: 'GOTO_QUESTION',
                targetQuestionCode: 'q_biz_revenue',
              },
              {
                logic: 'AND',
                conditions: [
                  { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'CONSUMER_LOAN' },
                ],
                action: 'GOTO_QUESTION',
                targetQuestionCode: 'q_monthly_income',
              },
              {
                logic: 'AND',
                conditions: [
                  { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'INFO_ONLY' },
                ],
                action: 'END_QUIZ',
              },
            ],
          },
          {
            code: 'q_biz_revenue',
            questionText: 'Doanh thu trung bình hàng tháng của bạn khoảng bao nhiêu?',
            questionType: AkinatorQuestionType.CURRENCY,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 90,
            validationConfig: { min: 1000000, max: 100000000000 },
            visibilityConditions: {
              logic: 'AND',
              conditions: [
                { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'BUSINESS_CAPITAL' },
              ],
            },
          },
          {
            code: 'q_monthly_income',
            questionText: 'Thu nhập thực nhận hàng tháng qua tài khoản hoặc tiền mặt?',
            questionType: AkinatorQuestionType.CURRENCY,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 85,
            validationConfig: { min: 1000000, max: 5000000000 },
            visibilityConditions: {
              logic: 'AND',
              conditions: [
                { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'CONSUMER_LOAN' },
              ],
            },
          },
          {
            code: 'q_collateral',
            questionText: 'Bạn hoặc người thân có tài sản đảm bảo (bất động sản, ô tô) không?',
            questionType: AkinatorQuestionType.YES_NO,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 80,
          },
          {
            code: 'q_contact_name',
            questionText: 'Họ và tên của bạn để nhận kết quả tham khảo?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: false,
            isRequiredForEval: false,
            priorityWeight: 60,
            mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
          },
          {
            code: 'q_contact_phone',
            questionText: 'Số điện thoại liên hệ thuận tiện nhất?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: false,
            isRequiredForEval: false,
            priorityWeight: 50,
            mapsToCustomerField: AkinatorCustomerFieldMapping.PHONE,
          },
        ],
      },
    }
  );

  // Add rules
  await makeRequest(
    server,
    'PUT',
    `/api/akinator/configs/${configVersionId}/rules`,
    {
      cookieToken: adminToken,
      body: {
        rules: [
          {
            code: 'RULE_SME_COLLATERAL',
            name: 'Vốn kinh doanh có tài sản đảm bảo',
            priorityOrder: 1,
            active: true,
            requiredQuestionCodes: ['q_primary_purpose', 'q_biz_revenue', 'q_collateral'],
            conditions: {
              logic: 'AND',
              conditions: [
                { questionCode: 'q_primary_purpose', operator: 'EQUALS', value: 'BUSINESS_CAPITAL' },
                { questionCode: 'q_biz_revenue', operator: 'GTE', value: 30000000 },
                { questionCode: 'q_collateral', operator: 'EQUALS', value: true },
              ],
            },
            outcomePayload: {
              categoryCode: 'BUSINESS_COLLATERAL',
              categoryLabel: 'Vốn kinh doanh có TSĐB',
              referenceTitle: 'Giải pháp Bổ sung vốn kinh doanh có Tài sản đảm bảo',
              referenceSummary:
                'Phương án đề xuất phù hợp cho hộ kinh doanh có doanh thu ổn định và có tài sản thế chấp.',
              suggestedDirections: [
                'Chuẩn bị sổ sách/sao kê doanh thu 6 tháng gần nhất',
                'Chuẩn bị giấy tờ chứng minh quyền sở hữu tài sản đảm bảo',
              ],
              cautionNotes: ['Cần thẩm định thực tế thực địa kinh doanh và tài sản đảm bảo'],
              suggestedPriority: PriorityLevel.THANH_KHOAN_TIN_DUNG,
            },
          },
        ],
      },
    }
  );

  // Publish
  await makeRequest(server, 'POST', `/api/akinator/configs/${configVersionId}/publish`, {
    cookieToken: adminToken,
  });

  try {
    let quizToken = '';
    let quizSessionId = '';

    await runTest('Public participant starts new quiz session via /api/public/akinator/sessions', async () => {
      const res = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.sessionToken);
      assert.strictEqual(res.body.data.nextQuestion.code, 'q_primary_purpose');
      assert.strictEqual(res.body.data.nextQuestion.questionType, 'SINGLE_CHOICE');
      // Verify no internal rules are leaked
      assert.strictEqual(res.body.data.nextQuestion.nextQuestionRules, undefined);
      assert.strictEqual(res.body.data.nextQuestion.visibilityConditions, undefined);
      quizToken = res.body.data.sessionToken;
      quizSessionId = res.body.data.sessionId;
    });

    await runTest('Submitting answer dynamically routes to next question from Backend', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/answers`,
        {
          body: {
            questionCode: 'q_primary_purpose',
            answerValue: 'BUSINESS_CAPITAL',
          },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.nextQuestion.code, 'q_biz_revenue');
      assert.strictEqual(res.body.data.savedAnswer.questionCode, 'q_primary_purpose');
      assert.strictEqual(res.body.data.progress.answeredCount, 1);
    });

    await runTest('Simulated rapid double-clicks on submit answer are handled idempotently', async () => {
      // First click
      const req1 = makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/answers`,
        {
          body: {
            questionCode: 'q_biz_revenue',
            answerValue: 50000000,
          },
        }
      );
      // Rapid retry click
      const req2 = makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/answers`,
        {
          body: {
            questionCode: 'q_biz_revenue',
            answerValue: 50000000,
          },
        }
      );

      const [res1, res2] = await Promise.all([req1, req2]);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);

      const answerCount = await prisma.akinatorRawAnswer.count({
        where: { sessionId: quizSessionId, questionCode: 'q_biz_revenue' },
      });
      assert.strictEqual(answerCount, 1, 'Only one raw answer record must exist per question code');
    });

    await runTest('Page refresh / Reconnect: getSessionByToken restores ongoing progress', async () => {
      const res = await makeRequest(server, 'GET', `/api/public/akinator/sessions/${quizToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.quizStatus, 'IN_PROGRESS');
      assert.strictEqual(res.body.data.answeredQuestions.length, 2);
      assert.strictEqual(res.body.data.nextQuestion.code, 'q_collateral');
    });

    await runTest('Submits remaining questions and completes quiz with EVALUATED result & disclaimer', async () => {
      await makeRequest(server, 'POST', `/api/public/akinator/sessions/${quizToken}/answers`, {
        body: { questionCode: 'q_collateral', answerValue: true },
      });
      await makeRequest(server, 'POST', `/api/public/akinator/sessions/${quizToken}/answers`, {
        body: { questionCode: 'q_contact_name', answerValue: 'Trần Văn Khảo Sát' },
      });
      const lastAns = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/answers`,
        {
          body: { questionCode: 'q_contact_phone', answerValue: '0901234567' },
        }
      );
      assert.strictEqual(lastAns.body.data.readyToComplete, true);
      assert.strictEqual(lastAns.body.data.nextQuestion, null);

      const completeRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/complete`
      );
      assert.strictEqual(completeRes.status, 200);
      assert.strictEqual(completeRes.body.data.quizStatus, 'COMPLETED');
      assert.strictEqual(
        completeRes.body.data.result.evaluationStatus,
        AkinatorEvaluationStatus.EVALUATED
      );
      assert.match(
        completeRes.body.data.result.disclaimerText,
        /tham khảo sơ bộ.*không phải cam kết/i
      );
      assert.ok(completeRes.body.data.result.outcomeData.categories.length > 0);
    });

    await runTest('Calling completeSession again is idempotent (returns existing result)', async () => {
      const retryComplete = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${quizToken}/complete`
      );
      assert.strictEqual(retryComplete.status, 200);
      assert.strictEqual(retryComplete.body.data.alreadyCompleted, true);
      assert.strictEqual(retryComplete.body.data.quizStatus, 'COMPLETED');
    });

    await runTest('Early-stop session with insufficient data returns INSUFFICIENT_DATA and missingCriteria', async () => {
      const s2 = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
      const token2 = s2.body.data.sessionToken;

      // Select INFO_ONLY which triggers END_QUIZ
      const ansRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${token2}/answers`,
        {
          body: {
            questionCode: 'q_primary_purpose',
            answerValue: 'INFO_ONLY',
          },
        }
      );
      assert.strictEqual(ansRes.body.data.readyToComplete, true);
      assert.strictEqual(ansRes.body.data.nextQuestion, null);

      const compRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${token2}/complete`
      );
      assert.strictEqual(compRes.status, 200);
      assert.strictEqual(
        compRes.body.data.result.evaluationStatus,
        AkinatorEvaluationStatus.INSUFFICIENT_DATA
      );
      assert.ok(compRes.body.data.result.missingCriteria.length > 0);
      assert.match(compRes.body.data.result.disclaimerText, /tham khảo sơ bộ/i);
    });

    // =========================================================================
    // GROUP 3: ADMIN TAB & CONFIG API INTEGRATION
    // =========================================================================
    console.log('\n--- GROUP 3: Admin Tab & Config API Integration ---');

    await runTest('Admin accesses /api/akinator/configs/current to populate AkinatorPage status', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/configs/current', {
        cookieToken: adminToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, AkinatorConfigStatus.PUBLISHED);
      assert.strictEqual(res.body.data.isCurrent, true);
      assert.strictEqual(res.body.data.questions.length, 6);
      assert.strictEqual(res.body.data.rules.length, 1);
    });

    await runTest('Partner is blocked from accessing /api/akinator/configs/current with 403', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/configs/current', {
        cookieToken: partnerToken,
      });
      assert.strictEqual(res.status, 403);
    });

    // =========================================================================
    // GROUP 4: ZERO SYSTEM REGRESSION
    // =========================================================================
    console.log('\n--- GROUP 4: Zero CRM & Needs Assessment Regression ---');

    await runTest('Completing Akinator quizzes creates 0 Customer records in CRM', async () => {
      const currentCustomerCount = await prisma.customer.count();
      assert.strictEqual(
        currentCustomerCount,
        initialCustomerCount,
        'Customer count must remain exactly unchanged'
      );
    });

    await runTest('Zero Needs Assessment records mutated during Akinator quiz sessions', async () => {
      const currentAssessmentCount = await prisma.assessment.count();
      assert.strictEqual(
        currentAssessmentCount,
        initialAssessmentCount,
        'Assessment count must remain exactly unchanged'
      );
    });

    console.log('\n========================================================================');
    console.log(`   ALL AKINATOR PHASE 3 TESTS PASSED: ${passedTests}/${totalTests} ✓`);
    console.log('========================================================================\n');
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin.phase3.test@ktea.vn', 'partner.phase3.test@ktea.vn'],
        },
      },
    });
    // Clean up test records
    await prisma.akinatorStatusHistory.deleteMany({});
    await prisma.akinatorAdminReview.deleteMany({});
    await prisma.akinatorResult.deleteMany({});
    await prisma.akinatorRawAnswer.deleteMany({});
    await prisma.akinatorSession.deleteMany({});
    await prisma.akinatorRule.deleteMany({});
    await prisma.akinatorQuestion.deleteMany({});
    await prisma.akinatorConfigVersion.deleteMany({});

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nPHASE 3 VERIFICATION FAILED:', err);
  process.exit(1);
});
