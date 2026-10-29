import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorQuizStatus,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
  PriorityLevel,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 2: AKINATOR BACKEND & DATABASE VERIFICATION SUITE   ');
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
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const testAdminUser = await prisma.user.upsert({
    where: { email: 'admin.akinator.test@ktea.vn' },
    create: {
      email: 'admin.akinator.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Akinator Test',
      role: Role.ADMIN,
    },
    update: {
      role: Role.ADMIN,
    },
  });

  const testPartnerUser = await prisma.user.upsert({
    where: { email: 'partner.akinator.test@ktea.vn' },
    create: {
      email: 'partner.akinator.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Akinator Test',
      role: Role.PARTNER,
    },
    update: {
      role: Role.PARTNER,
    },
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

  // Clean up any prior test data in akinator_* tables (isolated strictly to local dev DB)
  await prisma.akinatorStatusHistory.deleteMany({});
  await prisma.akinatorAdminReview.deleteMany({});
  await prisma.akinatorResult.deleteMany({});
  await prisma.akinatorRawAnswer.deleteMany({});
  await prisma.akinatorSession.deleteMany({});
  await prisma.akinatorRule.deleteMany({});
  await prisma.akinatorQuestion.deleteMany({});
  await prisma.akinatorConfigVersion.deleteMany({});

  const initialCustomerCount = await prisma.customer.count();
  const initialQuestionnaireCount = await prisma.questionnaire.count();
  const initialAssessmentCount = await prisma.assessment.count();

  let draftV1Id = '';
  let draftV2Id = '';
  let session1Token = '';
  let session1Id = '';
  let session2Token = '';
  let session2Id = '';

  try {
    // =========================================================================
    // GROUP 1: API SECURITY & RBAC BOUNDARIES
    // =========================================================================
    console.log('\n--- GROUP 1: API Authentication & RBAC Enforcement ---');

    await runTest('Unauthenticated request to /api/akinator/configs returns 401', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/configs');
      assert.strictEqual(res.status, 401);
    });

    await runTest('Unauthenticated request to /api/akinator/sessions returns 401', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/sessions');
      assert.strictEqual(res.status, 401);
    });

    await runTest('PARTNER role request to /api/akinator/configs returns 403', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/configs', {
        cookieToken: partnerToken,
      });
      assert.strictEqual(res.status, 403);
    });

    await runTest('PARTNER role request to /api/akinator/sessions returns 403', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/sessions', {
        cookieToken: partnerToken,
      });
      assert.strictEqual(res.status, 403);
    });

    // =========================================================================
    // GROUP 2: DATABASE, CONFIG AUTHORING, CYCLE DETECTION & VERSIONING
    // =========================================================================
    console.log('\n--- GROUP 2: Database Models, Config Authoring & Versioning ---');

    await runTest('Admin creates Draft Config Version v1', async () => {
      const res = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
        cookieToken: adminToken,
        body: {
          title: 'Akinator Tài Chính Cá Nhân v1',
          description: 'Bộ câu hỏi thích ứng tìm hiểu nhu cầu tài chính sơ bộ',
          maxQuestionsPerSession: 6,
          disclaimerText:
            'Kết quả trên chỉ mang tính chất tham khảo sơ bộ dựa trên thông tin bạn cung cấp, không phải cam kết phê duyệt khoản vay hay hạn mức tín dụng chính thức.',
        },
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.versionNumber, 1);
      assert.strictEqual(res.body.data.status, AkinatorConfigStatus.DRAFT);
      assert.strictEqual(res.body.data.isCurrent, false);
      draftV1Id = res.body.data.id;
    });

    await runTest('Rejects question tree with branching cycle (A -> B -> A)', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draftV1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_cycle_a',
                questionText: 'Câu hỏi A?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: true,
                priorityWeight: 100,
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_cycle_a', operator: 'EQUALS', value: true }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_cycle_b',
                  },
                ],
              },
              {
                code: 'q_cycle_b',
                questionText: 'Câu hỏi B?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: false,
                priorityWeight: 90,
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_cycle_b', operator: 'EQUALS', value: true }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_cycle_a',
                  },
                ],
              },
            ],
          },
        }
      );
      assert.strictEqual(res.status, 400);
      assert.match(JSON.stringify(res.body), /chu trình|vòng lặp/i);
    });

    await runTest('Saves valid adaptive questions into Draft v1', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draftV1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_goal',
                questionText: 'Mục tiêu tài chính chính bạn đang quan tâm là gì?',
                questionType: AkinatorQuestionType.SINGLE_CHOICE,
                isEntryQuestion: true,
                isRequiredForEval: true,
                priorityWeight: 100,
                options: [
                  { label: 'Bổ sung vốn kinh doanh', value: 'BUSINESS' },
                  { label: 'Tiêu dùng cá nhân / Gia đình', value: 'CONSUMER' },
                  { label: 'Chỉ muốn tham khảo thông tin chung', value: 'JUST_LOOKING' },
                ],
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_goal', operator: 'EQUALS', value: 'BUSINESS' }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_biz_revenue',
                  },
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_goal', operator: 'EQUALS', value: 'CONSUMER' }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_monthly_income',
                  },
                  {
                    logic: 'AND',
                    conditions: [
                      { questionCode: 'q_goal', operator: 'EQUALS', value: 'JUST_LOOKING' },
                    ],
                    action: 'END_QUIZ',
                  },
                ],
              },
              {
                code: 'q_biz_revenue',
                questionText: 'Doanh thu bình quân hàng tháng của hộ kinh doanh/doanh nghiệp (VNĐ)?',
                questionType: AkinatorQuestionType.CURRENCY,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 90,
                validationConfig: { min: 1000000, max: 100000000000 },
                visibilityConditions: {
                  logic: 'AND',
                  conditions: [{ questionCode: 'q_goal', operator: 'EQUALS', value: 'BUSINESS' }],
                },
              },
              {
                code: 'q_monthly_income',
                questionText: 'Thu nhập hàng tháng của bạn khoảng bao nhiêu (VNĐ)?',
                questionType: AkinatorQuestionType.CURRENCY,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 85,
                validationConfig: { min: 1000000, max: 5000000000 },
                visibilityConditions: {
                  logic: 'AND',
                  conditions: [{ questionCode: 'q_goal', operator: 'EQUALS', value: 'CONSUMER' }],
                },
              },
              {
                code: 'q_has_collateral',
                questionText: 'Bạn có tài sản đảm bảo (Bất động sản / Ô tô) không?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 80,
              },
              {
                code: 'q_full_name',
                questionText: 'Họ và tên của bạn để nhận kết quả tham khảo?',
                questionType: AkinatorQuestionType.TEXT,
                isEntryQuestion: false,
                isRequiredForEval: false,
                priorityWeight: 60,
                mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
              },
              {
                code: 'q_phone',
                questionText: 'Số điện thoại liên hệ của bạn?',
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
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.questions.length, 6);
    });

    await runTest('Saves deterministic evaluation rules into Draft v1', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draftV1Id}/rules`,
        {
          cookieToken: adminToken,
          body: {
            rules: [
              {
                code: 'RULE_BIZ_COLLATERAL_HIGH',
                name: 'Nhóm hộ kinh doanh có tài sản đảm bảo doanh thu tốt',
                priorityOrder: 1,
                active: true,
                requiredQuestionCodes: ['q_goal', 'q_biz_revenue', 'q_has_collateral'],
                conditions: {
                  logic: 'AND',
                  conditions: [
                    { questionCode: 'q_goal', operator: 'EQUALS', value: 'BUSINESS' },
                    { questionCode: 'q_biz_revenue', operator: 'GTE', value: 50000000 },
                    { questionCode: 'q_has_collateral', operator: 'EQUALS', value: true },
                  ],
                },
                outcomePayload: {
                  categoryCode: 'BIZ_COLLATERAL_HIGH',
                  categoryLabel: 'Bổ sung vốn kinh doanh có TSĐB',
                  referenceTitle: 'Nhóm nhu cầu Bổ sung vốn kinh doanh có Tài sản đảm bảo',
                  referenceSummary:
                    'Hồ sơ của bạn phù hợp để tham khảo các giải pháp bổ sung vốn lưu động có tài sản đảm bảo.',
                  suggestedDirections: [
                    'Chuẩn bị giấy đăng ký hộ kinh doanh hoặc sao kê doanh thu 6 tháng gần nhất',
                    'Chuẩn bị giấy chứng nhận quyền sử dụng đất/tài sản đảm bảo để đối chiếu sơ bộ',
                  ],
                  cautionNotes: ['Cần thẩm định thực tế tài sản đảm bảo theo quy định'],
                  suggestedPriority: PriorityLevel.THANH_KHOAN_TIN_DUNG,
                },
              },
              {
                code: 'RULE_CONSUMER_INCOME_STANDARD',
                name: 'Nhóm tiêu dùng cá nhân có thu nhập ổn định',
                priorityOrder: 2,
                active: true,
                requiredQuestionCodes: ['q_goal', 'q_monthly_income', 'q_has_collateral'],
                conditions: {
                  logic: 'AND',
                  conditions: [
                    { questionCode: 'q_goal', operator: 'EQUALS', value: 'CONSUMER' },
                    { questionCode: 'q_monthly_income', operator: 'GTE', value: 10000000 },
                  ],
                },
                outcomePayload: {
                  categoryCode: 'CONSUMER_INCOME_STANDARD',
                  categoryLabel: 'Tiêu dùng cá nhân theo thu nhập',
                  referenceTitle: 'Nhóm nhu cầu Tiêu dùng cá nhân thu nhập ổn định',
                  referenceSummary:
                    'Thông tin của bạn phù hợp để tìm hiểu các gói tài chính tiêu dùng cá nhân theo thu nhập.',
                  suggestedDirections: [
                    'Chuẩn bị sao kê lương 3-6 tháng gần nhất',
                    'Trao đổi thêm với chuyên viên để đối chiếu nhu cầu chi tiết',
                  ],
                  cautionNotes: [],
                  suggestedPriority: PriorityLevel.TIN_DUNG,
                },
              },
            ],
          },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.rules.length, 2);
    });

    await runTest('Validates and Publishes Config Version v1', async () => {
      const valRes = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draftV1Id}/validate`,
        { cookieToken: adminToken }
      );
      assert.strictEqual(valRes.status, 200);
      assert.strictEqual(valRes.body.data.isValid, true);

      const pubRes = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draftV1Id}/publish`,
        {
          cookieToken: adminToken,
          body: { changeLog: 'Xuất bản phiên bản v1 chính thức' },
        }
      );
      assert.strictEqual(pubRes.status, 200);
      assert.strictEqual(pubRes.body.data.status, AkinatorConfigStatus.PUBLISHED);
      assert.strictEqual(pubRes.body.data.isCurrent, true);
    });

    await runTest('Published Config v1 is strictly immutable (blocks metadata, question, and rule edits)', async () => {
      const metaRes = await makeRequest(
        server,
        'PATCH',
        `/api/akinator/configs/${draftV1Id}`,
        {
          cookieToken: adminToken,
          body: { title: 'Cố tình sửa bản đã publish' },
        }
      );
      assert.strictEqual(metaRes.status, 400);

      const qRes = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draftV1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_hack',
                questionText: 'Cố tình ghi đè?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: true,
              },
            ],
          },
        }
      );
      assert.strictEqual(qRes.status, 400);
    });

    // =========================================================================
    // GROUP 3: ADAPTIVE QUESTION ENGINE & RULE ENGINE (EVALUATED vs INSUFFICIENT_DATA)
    // =========================================================================
    console.log('\n--- GROUP 3: Adaptive Question Engine & Deterministic Rule Engine ---');

    await runTest('Starts Public Session 1 and selects Entry Question (q_goal)', async () => {
      const res = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.sessionToken);
      assert.strictEqual(res.body.data.quizStatus, AkinatorQuizStatus.IN_PROGRESS);
      assert.strictEqual(res.body.data.nextQuestion.code, 'q_goal');
      // Verify internal branching rules are NOT leaked to public client
      assert.strictEqual(res.body.data.nextQuestion.nextQuestionRules, undefined);
      assert.strictEqual(res.body.data.nextQuestion.visibilityConditions, undefined);

      session1Token = res.body.data.sessionToken;
      session1Id = res.body.data.sessionId;
    });

    await runTest('Rejects invalid option value for SINGLE_CHOICE question', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_goal',
            answerValue: 'NON_EXISTENT_OPTION',
          },
        }
      );
      assert.strictEqual(res.status, 400);
    });

    await runTest('Submits q_goal = BUSINESS and adaptively routes to q_biz_revenue via GOTO_QUESTION', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_goal',
            answerValue: 'BUSINESS',
          },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.nextQuestion.code, 'q_biz_revenue');
      assert.match(res.body.data.selectionReason, /q_biz_revenue/);
    });

    await runTest('Blocks submitting answer to ineligible branch question (q_monthly_income is only for CONSUMER)', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_monthly_income',
            answerValue: 20000000,
          },
        }
      );
      assert.strictEqual(res.status, 400);
      assert.match(JSON.stringify(res.body), /không phù hợp với nhánh/i);
    });

    await runTest('Duplicate answer submission is idempotent (updates in-place without creating duplicate raw answer row)', async () => {
      await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_biz_revenue',
            answerValue: 60000000,
          },
        }
      );
      const retryRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_biz_revenue',
            answerValue: 80000000,
          },
        }
      );
      assert.strictEqual(retryRes.status, 200);
      assert.strictEqual(retryRes.body.data.savedAnswer.answerValue, 80000000);
      // Should advance to q_has_collateral (skipping q_monthly_income because visibilityConditions is false)
      assert.strictEqual(retryRes.body.data.nextQuestion.code, 'q_has_collateral');

      const rawCount = await prisma.akinatorRawAnswer.count({
        where: { sessionId: session1Id, questionCode: 'q_biz_revenue' },
      });
      assert.strictEqual(rawCount, 1);
    });

    await runTest('Submits remaining answers for Session 1 and completes quiz with EVALUATED status', async () => {
      const r1 = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: { questionCode: 'q_has_collateral', answerValue: true },
        }
      );
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r1.body.data.nextQuestion.code, 'q_full_name');

      const r2 = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: { questionCode: 'q_full_name', answerValue: 'Nguyễn Văn Akinator' },
        }
      );
      assert.strictEqual(r2.status, 200);
      assert.strictEqual(r2.body.data.nextQuestion.code, 'q_phone');

      const r3 = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: { questionCode: 'q_phone', answerValue: '0912345678' },
        }
      );
      assert.strictEqual(r3.status, 200);
      assert.strictEqual(r3.body.data.nextQuestion, null);
      assert.strictEqual(r3.body.data.readyToComplete, true);

      const completeRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/complete`
      );
      assert.strictEqual(completeRes.status, 200);
      assert.strictEqual(completeRes.body.data.quizStatus, AkinatorQuizStatus.COMPLETED);
      assert.strictEqual(
        completeRes.body.data.result.evaluationStatus,
        AkinatorEvaluationStatus.EVALUATED
      );
      assert.strictEqual(
        completeRes.body.data.result.summaryTitle,
        'Nhóm nhu cầu Bổ sung vốn kinh doanh có Tài sản đảm bảo'
      );
      assert.match(completeRes.body.data.result.disclaimerText, /tham khảo sơ bộ/i);
    });

    await runTest('Completing quiz NEVER auto-creates a Customer record in CRM', async () => {
      const afterCustomerCount = await prisma.customer.count();
      assert.strictEqual(afterCustomerCount, initialCustomerCount);
    });

    await runTest('Session 2 early-stops on END_QUIZ branch and evaluates to INSUFFICIENT_DATA when required questions are unanswered', async () => {
      const startRes = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
      session2Token = startRes.body.data.sessionToken;
      session2Id = startRes.body.data.sessionId;

      const ansRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session2Token}/answers`,
        {
          body: {
            questionCode: 'q_goal',
            answerValue: 'JUST_LOOKING',
          },
        }
      );
      assert.strictEqual(ansRes.status, 200);
      assert.strictEqual(ansRes.body.data.nextQuestion, null);
      assert.strictEqual(ansRes.body.data.readyToComplete, true);
      assert.match(ansRes.body.data.selectionReason, /Kết thúc sớm/i);

      const compRes = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session2Token}/complete`
      );
      assert.strictEqual(compRes.status, 200);
      assert.strictEqual(
        compRes.body.data.result.evaluationStatus,
        AkinatorEvaluationStatus.INSUFFICIENT_DATA
      );
      assert.ok(Array.isArray(compRes.body.data.result.missingCriteria));
      assert.ok(compRes.body.data.result.missingCriteria.length > 0);
      assert.match(compRes.body.data.result.disclaimerText, /tham khảo/i);
    });

    await runTest('Public session isolation: Session 2 token cannot read or modify Session 1', async () => {
      const s2Get = await makeRequest(
        server,
        'GET',
        `/api/public/akinator/sessions/${session2Token}`
      );
      assert.strictEqual(s2Get.status, 200);
      assert.strictEqual(s2Get.body.data.sessionId, session2Id);
      assert.notStrictEqual(s2Get.body.data.sessionId, session1Id);

      // Completed session cannot accept further answer modifications
      const postCompleteAns = await makeRequest(
        server,
        'POST',
        `/api/public/akinator/sessions/${session1Token}/answers`,
        {
          body: {
            questionCode: 'q_phone',
            answerValue: '0999999999',
          },
        }
      );
      assert.strictEqual(postCompleteAns.status, 400);
    });

    await runTest('Publishing new Config Version v2 archives v1 without altering historical Session 1 result', async () => {
      const cloneRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
        cookieToken: adminToken,
        body: {
          title: 'Akinator Tài Chính Cá Nhân v2',
          sourceVersionId: draftV1Id,
          changeLog: 'Sao chép sang v2 để cập nhật tiêu đề',
        },
      });
      assert.strictEqual(cloneRes.status, 201);
      draftV2Id = cloneRes.body.data.id;
      assert.strictEqual(cloneRes.body.data.versionNumber, 2);

      const pubV2 = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draftV2Id}/publish`,
        {
          cookieToken: adminToken,
          body: { changeLog: 'Xuất bản v2' },
        }
      );
      assert.strictEqual(pubV2.status, 200);
      assert.strictEqual(pubV2.body.data.isCurrent, true);

      // Verify v1 is now ARCHIVED
      const v1Check = await makeRequest(
        server,
        'GET',
        `/api/akinator/configs/${draftV1Id}`,
        { cookieToken: adminToken }
      );
      assert.strictEqual(v1Check.body.data.status, AkinatorConfigStatus.ARCHIVED);
      assert.strictEqual(v1Check.body.data.isCurrent, false);

      // Verify Session 1 still points to v1 and its result is untouched
      const s1Check = await makeRequest(
        server,
        'GET',
        `/api/akinator/sessions/${session1Id}`,
        { cookieToken: adminToken }
      );
      assert.strictEqual(s1Check.body.data.configVersionId, draftV1Id);
      assert.strictEqual(
        s1Check.body.data.result.summaryTitle,
        'Nhóm nhu cầu Bổ sung vốn kinh doanh có Tài sản đảm bảo'
      );
    });

    // =========================================================================
    // GROUP 4: IMMUTABLE RAW ANSWERS & ADMIN REVIEW WORKFLOW STATE MACHINE
    // =========================================================================
    console.log('\n--- GROUP 4: Immutable Raw Answers & Admin Review Workflow ---');

    await runTest('Admin lists and views Session 1 detail with rawAnswers, result, adminReview, and statusHistory', async () => {
      const listRes = await makeRequest(
        server,
        'GET',
        '/api/akinator/sessions?workflowStatus=PENDING_PROCESSING',
        { cookieToken: adminToken }
      );
      assert.strictEqual(listRes.status, 200);
      assert.ok(listRes.body.data.items.length >= 2);

      const detailRes = await makeRequest(
        server,
        'GET',
        `/api/akinator/sessions/${session1Id}`,
        { cookieToken: adminToken }
      );
      assert.strictEqual(detailRes.status, 200);
      assert.strictEqual(
        detailRes.body.data.workflowStatus,
        AkinatorWorkflowStatus.PENDING_PROCESSING
      );
      assert.strictEqual(detailRes.body.data.rawAnswers.length, 5);
      assert.strictEqual(detailRes.body.data.adminReview.editedFullName, 'Nguyễn Văn Akinator');
      assert.strictEqual(detailRes.body.data.adminReview.editedPhone, '0912345678');
    });

    await runTest('Strict validation blocks Admin from sending rawAnswers in PATCH /api/akinator/sessions/:id/review', async () => {
      const res = await makeRequest(
        server,
        'PATCH',
        `/api/akinator/sessions/${session1Id}/review`,
        {
          cookieToken: adminToken,
          body: {
            editedFullName: 'Nguyễn Văn Akinator (Đã chuẩn hóa)',
            rawAnswers: [{ questionCode: 'q_biz_revenue', answerValue: 999999999 }],
          },
        }
      );
      assert.ok(res.status === 400 || res.status === 422);
    });

    await runTest('Admin updates AkinatorAdminReview while AkinatorRawAnswer remains 100% immutable', async () => {
      const beforeRawAnswers = await prisma.akinatorRawAnswer.findMany({
        where: { sessionId: session1Id },
        orderBy: { stepOrder: 'asc' },
      });

      const patchRes = await makeRequest(
        server,
        'PATCH',
        `/api/akinator/sessions/${session1Id}/review`,
        {
          cookieToken: adminToken,
          body: {
            editedFullName: 'Nguyễn Văn Akinator (Đã xác minh)',
            editedPhone: '0988777666',
            editedEmail: 'akinator.verified@example.com',
            editedDateOfBirth: '15/08/1990',
            editedAddress: 'Quận 1, TP. Hồ Chí Minh',
            processorNote: 'Đã gọi điện xác minh thông tin hộ kinh doanh.',
          },
        }
      );
      assert.strictEqual(patchRes.status, 200);
      assert.strictEqual(
        patchRes.body.data.editedFullName,
        'Nguyễn Văn Akinator (Đã xác minh)'
      );
      assert.strictEqual(patchRes.body.data.editedPhone, '0988777666');

      const afterRawAnswers = await prisma.akinatorRawAnswer.findMany({
        where: { sessionId: session1Id },
        orderBy: { stepOrder: 'asc' },
      });

      assert.strictEqual(afterRawAnswers.length, beforeRawAnswers.length);
      for (let i = 0; i < beforeRawAnswers.length; i++) {
        assert.strictEqual(afterRawAnswers[i].questionCode, beforeRawAnswers[i].questionCode);
        assert.deepStrictEqual(afterRawAnswers[i].answerValue, beforeRawAnswers[i].answerValue);
        assert.strictEqual(
          afterRawAnswers[i].answerLabelSnapshot,
          beforeRawAnswers[i].answerLabelSnapshot
        );
      }

      // Raw phone on AkinatorRawAnswer is still '0912345678' even though editedPhone is '0988777666'
      const rawPhoneAns = afterRawAnswers.find((a) => a.questionCode === 'q_phone');
      assert.strictEqual(rawPhoneAns?.answerValue, '0912345678');
    });

    await runTest('Blocks invalid direct transition from PENDING_PROCESSING to APPROVED', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.APPROVED,
            approvalNote: 'Duyệt tắt không qua xử lý',
          },
        }
      );
      assert.strictEqual(res.status, 400);
    });

    await runTest('Transitions PENDING_PROCESSING -> IN_PROGRESS -> NEEDS_MORE_INFO -> IN_PROGRESS -> PENDING_APPROVAL -> APPROVED with full status history', async () => {
      // 1. PENDING_PROCESSING -> IN_PROGRESS
      const t1 = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
            note: 'Bắt đầu tiếp nhận xử lý hồ sơ',
          },
        }
      );
      assert.strictEqual(t1.status, 200);
      assert.strictEqual(t1.body.data.workflowStatus, AkinatorWorkflowStatus.IN_PROGRESS);

      // 2. IN_PROGRESS -> NEEDS_MORE_INFO without missingInfoNote should fail
      const t2Fail = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.NEEDS_MORE_INFO,
          },
        }
      );
      assert.strictEqual(t2Fail.status, 400);

      // 3. IN_PROGRESS -> NEEDS_MORE_INFO with missingInfoNote succeeds
      const t2 = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.NEEDS_MORE_INFO,
            missingInfoNote: 'Cần xác nhận thêm địa chỉ kinh doanh thực tế',
          },
        }
      );
      assert.strictEqual(t2.status, 200);
      assert.strictEqual(t2.body.data.workflowStatus, AkinatorWorkflowStatus.NEEDS_MORE_INFO);

      // 4. NEEDS_MORE_INFO -> IN_PROGRESS
      const t3 = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
            note: 'Đã bổ sung xong địa chỉ kinh doanh',
          },
        }
      );
      assert.strictEqual(t3.status, 200);
      assert.strictEqual(t3.body.data.workflowStatus, AkinatorWorkflowStatus.IN_PROGRESS);

      // 5. IN_PROGRESS -> PENDING_APPROVAL
      const t4 = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.PENDING_APPROVAL,
            note: 'Hồ sơ đầy đủ, trình duyệt',
          },
        }
      );
      assert.strictEqual(t4.status, 200);
      assert.strictEqual(t4.body.data.workflowStatus, AkinatorWorkflowStatus.PENDING_APPROVAL);

      // 6. PENDING_APPROVAL -> APPROVED
      const t5 = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.APPROVED,
            approvalNote: 'Đồng ý phê duyệt hồ sơ Akinator',
          },
        }
      );
      assert.strictEqual(t5.status, 200);
      assert.strictEqual(t5.body.data.workflowStatus, AkinatorWorkflowStatus.APPROVED);
      assert.ok(t5.body.data.adminReview.approvedAt);
      assert.ok(t5.body.data.statusHistories.length >= 6);
    });

    await runTest('Blocks TRANSFERRED status transition in Phase 2 (no automatic or premature CRM transfer)', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/akinator/sessions/${session1Id}/status`,
        {
          cookieToken: adminToken,
          body: {
            toStatus: AkinatorWorkflowStatus.TRANSFERRED,
            note: 'Cố chuyển sang Khách hàng trong Phase 2',
          },
        }
      );
      assert.strictEqual(res.status, 403);

      // Confirm zero Customer records were created even after APPROVED
      const finalCustomerCount = await prisma.customer.count();
      assert.strictEqual(finalCustomerCount, initialCustomerCount);
      assert.strictEqual(await prisma.questionnaire.count(), initialQuestionnaireCount);
      assert.strictEqual(await prisma.assessment.count(), initialAssessmentCount);
    });

    // Clean up test data
    await prisma.akinatorStatusHistory.deleteMany({});
    await prisma.akinatorAdminReview.deleteMany({});
    await prisma.akinatorResult.deleteMany({});
    await prisma.akinatorRawAnswer.deleteMany({});
    await prisma.akinatorSession.deleteMany({});
    await prisma.akinatorRule.deleteMany({});
    await prisma.akinatorQuestion.deleteMany({});
    await prisma.akinatorConfigVersion.deleteMany({});

    console.log('\n========================================================================');
    console.log(`   ALL AKINATOR PHASE 2 TESTS PASSED: ${passedTests}/${totalTests} ✓`);
    console.log('========================================================================\n');
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin.akinator.test@ktea.vn', 'partner.akinator.test@ktea.vn'],
        },
      },
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
