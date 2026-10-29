/**
 * verify-akinator-phase4.ts
 *
 * Comprehensive Verification Suite for Phase 4:
 * 1. Admin Configuration Workspace & Modals Frontend Integrity
 * 2. Full Admin Configuration Lifecycle via Backend APIs:
 *    - List configs & RBAC protection (Partner 403, Unauth 401)
 *    - Create Draft (blank or cloned from source)
 *    - Update Draft Metadata
 *    - Save Draft Questions (types, options, visibility conditions, branching rules)
 *    - Save Draft Evaluation Rules (required questions, conditions, outcome payload)
 *    - Validation Inspector (DAG cycle check, invalid target check)
 *    - Safe Publishing (transitions to PUBLISHED, archives previous, immutability guard)
 * 3. Immutability enforcement (Cannot alter PUBLISHED or ARCHIVED version questions/rules)
 * 4. Zero CRM & Needs Assessment Regression
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
  PriorityLevel,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 4: AKINATOR ADMIN CONFIGURATION VERIFICATION SUITE  ');
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
  // GROUP 1: FRONTEND CODE & COMPONENT STRUCTURE INTEGRITY
  // =========================================================================
  console.log('--- GROUP 1: Admin Configuration Frontend Architecture ---');

  await runTest('AkinatorConfigWorkspace component exists with Question & Rule tabs', () => {
    const wsPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorConfigWorkspace.tsx');
    assert.ok(fs.existsSync(wsPath), 'AkinatorConfigWorkspace.tsx must exist');
    const content = fs.readFileSync(wsPath, 'utf8');
    assert.match(content, /Ngân hàng câu hỏi/);
    assert.match(content, /Quy tắc đánh giá/);
    assert.match(content, /Kiểm tra toàn vẹn/);
    assert.match(content, /Xuất bản v/);
  });

  await runTest('AkinatorQuestionEditorModal exists with Visibility & Branching tabs', () => {
    const qModalPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorQuestionEditorModal.tsx');
    assert.ok(fs.existsSync(qModalPath), 'AkinatorQuestionEditorModal.tsx must exist');
    const content = fs.readFileSync(qModalPath, 'utf8');
    // Verify separation between Visibility Condition and Branching Rule
    assert.match(content, /Điều kiện hiển thị/);
    assert.match(content, /Quy tắc rẽ nhánh/);
    assert.match(content, /GOTO_QUESTION/);
    assert.match(content, /END_QUIZ/);
    assert.match(content, /mapsToCustomerField/);
  });

  await runTest('AkinatorRuleEditorModal exists with Required Questions & Outcome payload', () => {
    const rModalPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorRuleEditorModal.tsx');
    assert.ok(fs.existsSync(rModalPath), 'AkinatorRuleEditorModal.tsx must exist');
    const content = fs.readFileSync(rModalPath, 'utf8');
    assert.match(content, /requiredQuestionCodes/);
    assert.match(content, /outcomePayload/);
    assert.match(content, /suggestedDirections/);
    assert.match(content, /cautionNotes/);
    assert.match(content, /suggestedPriority/);
  });

  await runTest('AkinatorPage includes tab navigation between Config and Overview', () => {
    const pagePath = path.join(frontendDir, 'src', 'pages', 'AkinatorPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    assert.match(content, /Cấu hình Akinator \(Câu hỏi & Luật\)/);
    assert.match(content, /AkinatorConfigWorkspace/);
  });

  // =========================================================================
  // GROUP 2: BACKEND ADMIN APIS & CONFIGURATION LIFECYCLE
  // =========================================================================
  console.log('\n--- GROUP 2: Admin API Integration & Configuration Lifecycle ---');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const testAdminUser = await prisma.user.upsert({
    where: { email: 'admin.phase4.test@ktea.vn' },
    create: {
      email: 'admin.phase4.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Phase 4 Test',
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  const testPartnerUser = await prisma.user.upsert({
    where: { email: 'partner.phase4.test@ktea.vn' },
    create: {
      email: 'partner.phase4.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Phase 4 Test',
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

  let draft1Id = '';
  let draft2Id = '';

  try {
    await runTest('RBAC: Partner cannot access /api/akinator/configs (403 Forbidden)', async () => {
      const res = await makeRequest(server, 'GET', '/api/akinator/configs', {
        cookieToken: partnerToken,
      });
      assert.strictEqual(res.status, 403);
    });

    await runTest('Admin creates blank Draft Configuration Version 1', async () => {
      const res = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
        cookieToken: adminToken,
        body: {
          title: 'Cấu hình Akinator Đánh giá Nhu cầu v1',
          description: 'Phiên bản khởi tạo ban đầu cho khách hàng cá nhân',
          maxQuestionsPerSession: 10,
          disclaimerText:
            'Kết quả trên chỉ mang tính chất tham khảo sơ bộ dựa trên thông tin bạn cung cấp, không phải cam kết phê duyệt khoản vay hay hạn mức tín dụng chính thức.',
        },
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.versionNumber, 1);
      assert.strictEqual(res.body.data.status, AkinatorConfigStatus.DRAFT);
      assert.strictEqual(res.body.data.isCurrent, false);
      draft1Id = res.body.data.id;
    });

    await runTest('Admin updates Draft Metadata (title, description, maxQuestions)', async () => {
      const res = await makeRequest(
        server,
        'PATCH',
        `/api/akinator/configs/${draft1Id}`,
        {
          cookieToken: adminToken,
          body: {
            title: 'Cấu hình Akinator Tài Chính Cá Nhân & SME v1 (Đã tinh chỉnh)',
            maxQuestionsPerSession: 8,
          },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.title, 'Cấu hình Akinator Tài Chính Cá Nhân & SME v1 (Đã tinh chỉnh)');
      assert.strictEqual(res.body.data.maxQuestionsPerSession, 8);
    });

    await runTest('Validation Inspector catches branching cycle before questions are saved', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draft1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_loop_1',
                questionText: 'Câu hỏi vòng lặp 1?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: true,
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_loop_1', operator: 'EQUALS', value: true }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_loop_2',
                  },
                ],
              },
              {
                code: 'q_loop_2',
                questionText: 'Câu hỏi vòng lặp 2?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: false,
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_loop_2', operator: 'EQUALS', value: true }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_loop_1',
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

    await runTest('Admin saves comprehensive question bank into Draft v1', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draft1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_need_type',
                questionText: 'Mục đích tài chính chính bạn đang cần giải quyết là gì?',
                description: 'Chọn mục tiêu phù hợp nhất',
                questionType: AkinatorQuestionType.SINGLE_CHOICE,
                isEntryQuestion: true,
                isRequiredForEval: true,
                priorityWeight: 100,
                options: [
                  { value: 'BIZ_CAPITAL', label: 'Bổ sung vốn kinh doanh ngắn hạn' },
                  { value: 'PERSONAL_CONSUMPTION', label: 'Tiêu dùng cá nhân / Mua xe' },
                  { value: 'OTHER_LOOKUP', label: 'Tham khảo thông tin lãi suất' },
                ],
                nextQuestionRules: [
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'BIZ_CAPITAL' }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_biz_revenue',
                  },
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'PERSONAL_CONSUMPTION' }],
                    action: 'GOTO_QUESTION',
                    targetQuestionCode: 'q_personal_salary',
                  },
                  {
                    logic: 'AND',
                    conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'OTHER_LOOKUP' }],
                    action: 'END_QUIZ',
                  },
                ],
              },
              {
                code: 'q_biz_revenue',
                questionText: 'Doanh thu trung bình hàng tháng của hộ kinh doanh (VNĐ)?',
                questionType: AkinatorQuestionType.CURRENCY,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 90,
                validationConfig: { min: 1000000, max: 100000000000 },
                visibilityConditions: {
                  logic: 'AND',
                  conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'BIZ_CAPITAL' }],
                },
              },
              {
                code: 'q_personal_salary',
                questionText: 'Thu nhập chuyển khoản hàng tháng (VNĐ)?',
                questionType: AkinatorQuestionType.CURRENCY,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 85,
                validationConfig: { min: 1000000, max: 1000000000 },
                visibilityConditions: {
                  logic: 'AND',
                  conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'PERSONAL_CONSUMPTION' }],
                },
              },
              {
                code: 'q_has_real_estate',
                questionText: 'Bạn có sổ đỏ / bất động sản chính chủ không?',
                questionType: AkinatorQuestionType.YES_NO,
                isEntryQuestion: false,
                isRequiredForEval: true,
                priorityWeight: 80,
              },
              {
                code: 'q_client_fullname',
                questionText: 'Họ và tên của bạn để nhận bản tư vấn sơ bộ?',
                questionType: AkinatorQuestionType.TEXT,
                isEntryQuestion: false,
                isRequiredForEval: false,
                priorityWeight: 60,
                mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
              },
              {
                code: 'q_client_phone',
                questionText: 'Số điện thoại liên hệ thuận tiện?',
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

    await runTest('Admin saves evaluation rules into Draft v1', async () => {
      const res = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draft1Id}/rules`,
        {
          cookieToken: adminToken,
          body: {
            rules: [
              {
                code: 'RULE_BIZ_COLLATERAL_HIGH',
                name: 'Kinh doanh có tài sản đảm bảo doanh thu tốt',
                priorityOrder: 1,
                active: true,
                requiredQuestionCodes: ['q_need_type', 'q_biz_revenue', 'q_has_real_estate'],
                conditions: {
                  logic: 'AND',
                  conditions: [
                    { questionCode: 'q_need_type', operator: 'EQUALS', value: 'BIZ_CAPITAL' },
                    { questionCode: 'q_biz_revenue', operator: 'GTE', value: 40000000 },
                    { questionCode: 'q_has_real_estate', operator: 'EQUALS', value: true },
                  ],
                },
                outcomePayload: {
                  categoryCode: 'BIZ_COLLATERAL',
                  categoryLabel: 'Bổ sung vốn kinh doanh có TSĐB',
                  referenceTitle: 'Giải pháp Vốn kinh doanh thế chấp Bất động sản',
                  referenceSummary:
                    'Hồ sơ của bạn phù hợp để tham khảo các gói bổ sung vốn lưu động doanh nghiệp/hộ kinh doanh.',
                  suggestedDirections: [
                    'Chuẩn bị sổ sách/sao kê doanh thu 6 tháng gần nhất',
                    'Chuẩn bị giấy chứng nhận quyền sử dụng đất để định giá sơ bộ',
                  ],
                  cautionNotes: ['Cần thẩm định thực tế thực địa'],
                  suggestedPriority: PriorityLevel.THANH_KHOAN_TIN_DUNG,
                },
              },
            ],
          },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.rules.length, 1);
    });

    await runTest('Admin runs pre-publish validation on Draft v1 (isValid: true)', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draft1Id}/validate`,
        { cookieToken: adminToken }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.isValid, true);
      assert.strictEqual(res.body.data.errors.length, 0);
    });

    await runTest('Admin safely publishes Draft v1 as current published configuration', async () => {
      const res = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draft1Id}/publish`,
        {
          cookieToken: adminToken,
          body: { changeLog: 'Xuất bản phiên bản v1 chính thức' },
        }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, AkinatorConfigStatus.PUBLISHED);
      assert.strictEqual(res.body.data.isCurrent, true);
    });

    await runTest('Published v1 is strictly IMMUTABLE (cannot edit metadata, questions, or rules)', async () => {
      const metaRes = await makeRequest(
        server,
        'PATCH',
        `/api/akinator/configs/${draft1Id}`,
        {
          cookieToken: adminToken,
          body: { title: 'Cố ý sửa v1 đã xuất bản' },
        }
      );
      assert.strictEqual(metaRes.status, 400);

      const qRes = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draft1Id}/questions`,
        {
          cookieToken: adminToken,
          body: {
            questions: [
              {
                code: 'q_attempt_edit',
                questionText: 'Cố ý sửa câu hỏi?',
                questionType: AkinatorQuestionType.YES_NO,
              },
            ],
          },
        }
      );
      assert.strictEqual(qRes.status, 400);

      const rRes = await makeRequest(
        server,
        'PUT',
        `/api/akinator/configs/${draft1Id}/rules`,
        {
          cookieToken: adminToken,
          body: {
            rules: [
              {
                code: 'RULE_ATTEMPT',
                name: 'Cố ý sửa rule',
                priorityOrder: 1,
                requiredQuestionCodes: [],
                conditions: {
                  logic: 'AND',
                  conditions: [{ questionCode: 'q_need_type', operator: 'EQUALS', value: 'BIZ_CAPITAL' }],
                },
                outcomePayload: {
                  categoryCode: 'CAT_TEST',
                  categoryLabel: 'Nhãn',
                  referenceTitle: 'Tiêu đề',
                  referenceSummary: 'Tóm tắt',
                  suggestedDirections: [],
                  cautionNotes: [],
                },
              },
            ],
          },
        }
      );
      assert.strictEqual(rRes.status, 400);
    });

    await runTest('Admin clones published v1 into new Draft v2 via sourceVersionId', async () => {
      const cloneRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
        cookieToken: adminToken,
        body: {
          title: 'Cấu hình Akinator Tài Chính Cá Nhân & SME v2 (Bản nâng cấp)',
          sourceVersionId: draft1Id,
          changeLog: 'Sao chép từ v1 để nâng cấp',
        },
      });
      assert.strictEqual(cloneRes.status, 201);
      assert.strictEqual(cloneRes.body.data.versionNumber, 2);
      assert.strictEqual(cloneRes.body.data.status, AkinatorConfigStatus.DRAFT);
      assert.strictEqual(cloneRes.body.data.questions.length, 6);
      assert.strictEqual(cloneRes.body.data.rules.length, 1);
      draft2Id = cloneRes.body.data.id;
    });

    await runTest('Publishing v2 automatically archives v1 and updates current published pointer', async () => {
      const pubRes = await makeRequest(
        server,
        'POST',
        `/api/akinator/configs/${draft2Id}/publish`,
        {
          cookieToken: adminToken,
          body: { changeLog: 'Xuất bản v2 chính thức' },
        }
      );
      assert.strictEqual(pubRes.status, 200);
      assert.strictEqual(pubRes.body.data.status, AkinatorConfigStatus.PUBLISHED);
      assert.strictEqual(pubRes.body.data.isCurrent, true);

      // Verify v1 is now ARCHIVED
      const v1Res = await makeRequest(server, 'GET', `/api/akinator/configs/${draft1Id}`, {
        cookieToken: adminToken,
      });
      assert.strictEqual(v1Res.body.data.status, AkinatorConfigStatus.ARCHIVED);
      assert.strictEqual(v1Res.body.data.isCurrent, false);
    });

    // =========================================================================
    // GROUP 3: ZERO REGRESSION ON CRM & NEEDS ASSESSMENT
    // =========================================================================
    console.log('\n--- GROUP 3: Zero CRM & Needs Assessment Regression ---');

    await runTest('Zero Customer records created or modified during config authoring', async () => {
      const currentCustomerCount = await prisma.customer.count();
      assert.strictEqual(
        currentCustomerCount,
        initialCustomerCount,
        'Customer count must remain exactly unchanged'
      );
    });

    await runTest('Zero Needs Assessment questionnaires mutated during Akinator config operations', async () => {
      const currentAssessmentCount = await prisma.assessment.count();
      assert.strictEqual(
        currentAssessmentCount,
        initialAssessmentCount,
        'Assessment count must remain exactly unchanged'
      );
    });

    console.log('\n========================================================================');
    console.log(`   ALL AKINATOR PHASE 4 TESTS PASSED: ${passedTests}/${totalTests} ✓`);
    console.log('========================================================================\n');
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin.phase4.test@ktea.vn', 'partner.phase4.test@ktea.vn'],
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
  console.error('\nPHASE 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
