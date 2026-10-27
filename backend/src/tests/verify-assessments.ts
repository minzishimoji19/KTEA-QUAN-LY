import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import { Role, QuestionType } from '@prisma/client';
import { createSessionToken } from '../utils/session.js';
import {
  createAssessmentSchema,
  saveAssessmentAnswersSchema,
  completeAssessmentSchema,
  validateAssessmentAnswers,
  assessmentIdParamSchema,
  QuestionEvalContext,
} from '../validations/assessment.validation.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 3: CUSTOMER NEEDS ASSESSMENT VERIFICATION SUITE     ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log(`  ✓ PASS: ${name}`);
          passedTests++;
        })
        .catch((err) => {
          console.error(`  ✗ FAIL: ${name}`);
          console.error(`    ${err.message}`);
          throw err;
        });
    } else {
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAllTests() {
  console.log('--- SECTION 1: Schema Validation & Lifecycle Checks ---');

  runTest('Create assessment schema requires questionnaireId or questionnaireVersionId', () => {
    // Valid with questionnaireId
    const valid1 = createAssessmentSchema.parse({
      questionnaireId: '11111111-1111-1111-1111-111111111111',
    });
    assert.strictEqual(valid1.questionnaireId, '11111111-1111-1111-1111-111111111111');

    // Valid with questionnaireVersionId
    const valid2 = createAssessmentSchema.parse({
      questionnaireVersionId: '22222222-2222-2222-2222-222222222222',
      notes: 'Khảo sát nhu cầu mở rộng kinh doanh',
    });
    assert.strictEqual(valid2.questionnaireVersionId, '22222222-2222-2222-2222-222222222222');

    // Rejects if neither is provided
    assert.throws(
      () => createAssessmentSchema.parse({ notes: 'Thiếu version ID' }),
      /Phải cung cấp questionnaireId hoặc questionnaireVersionId/
    );
  });

  runTest('Save answers schema validates structure', () => {
    const valid = saveAssessmentAnswersSchema.parse({
      answers: [
        { questionCode: 'q_purpose', answerValue: 'CONSUMER' },
        { questionCode: 'q_amount', answerValue: 50000000 },
      ],
      notes: 'Khách hàng đang cân nhắc hạn mức',
    });
    assert.strictEqual(valid.answers.length, 2);
  });

  runTest('Rejects malformed assessment ID format in URL param', () => {
    const res = assessmentIdParamSchema.safeParse({ assessmentId: 'not-a-uuid' });
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.issues[0].message, 'ID bài đánh giá không hợp lệ');
    }
  });

  console.log('\n--- SECTION 2: Dynamic Answer Validation Engine (All Question Types) ---');

  const testQuestions: QuestionEvalContext[] = [
    {
      id: 'q1',
      code: 'q_purpose',
      questionText: 'Mục đích vay vốn',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      displayOrder: 1,
      options: [
        { id: 'opt_loan', label: 'Vay tiêu dùng', value: 'LOAN', hasTextInput: false },
        { id: 'opt_card', label: 'Mở thẻ tín dụng', value: 'CARD', hasTextInput: false },
      ],
      active: true,
    },
    {
      id: 'q2',
      code: 'q_loan_amount',
      questionText: 'Số tiền cần vay (VND)',
      questionType: QuestionType.CURRENCY,
      isRequired: true,
      displayOrder: 2,
      validationConfig: { min: 10000000, max: 500000000 },
      conditionalLogic: {
        dependsOnQuestionCode: 'q_purpose',
        operator: 'EQUALS',
        value: 'LOAN',
      },
      active: true,
    },
    {
      id: 'q3',
      code: 'q_has_collateral',
      questionText: 'Có tài sản bảo đảm không?',
      questionType: QuestionType.YES_NO,
      isRequired: false,
      displayOrder: 3,
      active: true,
    },
    {
      id: 'q4',
      code: 'q_collateral_types',
      questionText: 'Loại tài sản bảo đảm',
      questionType: QuestionType.MULTIPLE_CHOICE,
      isRequired: true,
      displayOrder: 4,
      options: [
        { id: 'c1', label: 'Bất động sản', value: 'REAL_ESTATE', hasTextInput: false },
        { id: 'c2', label: 'Ô tô', value: 'VEHICLE', hasTextInput: false },
        { id: 'c3', label: 'Sổ tiết kiệm', value: 'SAVINGS_BOOK', hasTextInput: false },
      ],
      validationConfig: { minSelect: 1, maxSelect: 2 },
      conditionalLogic: {
        dependsOnQuestionCode: 'q_has_collateral',
        operator: 'EQUALS',
        value: 'true',
      },
      active: true,
    },
    {
      id: 'q5',
      code: 'q_expected_date',
      questionText: 'Ngày dự kiến giải ngân',
      questionType: QuestionType.DATE,
      isRequired: false,
      displayOrder: 5,
      validationConfig: { minDate: '2026-01-01', maxDate: '2026-12-31' },
      active: true,
    },
    {
      id: 'q6',
      code: 'q_notes',
      questionText: 'Ghi chú thêm',
      questionType: QuestionType.TEXT,
      isRequired: false,
      displayOrder: 6,
      validationConfig: { minLength: 5, maxLength: 100 },
      active: true,
    },
  ];

  runTest('DRAFT mode: allows partial answers and calculates visibility', () => {
    const answers = [{ questionCode: 'q_purpose', answerValue: 'LOAN' }];
    const res = validateAssessmentAnswers(testQuestions, answers, 'DRAFT');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
    // q_loan_amount should be visible because q_purpose == LOAN
    assert.ok(res.visibleQuestionCodes.has('q_loan_amount'));
    // q_collateral_types should be HIDDEN because q_has_collateral is empty
    assert.strictEqual(res.visibleQuestionCodes.has('q_collateral_types'), false);
  });

  runTest('COMPLETE mode: rejects when visible required question is missing', () => {
    // q_purpose is LOAN, making q_loan_amount VISIBLE and REQUIRED. Missing q_loan_amount should fail!
    const answers = [{ questionCode: 'q_purpose', answerValue: 'LOAN' }];
    const res = validateAssessmentAnswers(testQuestions, answers, 'COMPLETE');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((err) => err.includes('q_loan_amount')));
  });

  runTest('COMPLETE mode: passes when hidden question is unanswered even if isRequired is true', () => {
    // q_purpose is CARD. q_loan_amount becomes HIDDEN.
    // Therefore q_loan_amount should NOT cause a required error!
    const answers = [
      { questionCode: 'q_purpose', answerValue: 'CARD' },
      { questionCode: 'q_has_collateral', answerValue: false },
    ];
    const res = validateAssessmentAnswers(testQuestions, answers, 'COMPLETE');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  runTest('Clean answers: strips out stale answers for questions that became hidden', () => {
    // User originally chose LOAN and entered 50,000,000 for q_loan_amount.
    // Later user changed q_purpose to CARD.
    // q_loan_amount is now hidden, so its answer must NOT be included in cleanAnswers!
    const answers = [
      { questionCode: 'q_purpose', answerValue: 'CARD' },
      { questionCode: 'q_loan_amount', answerValue: 50000000 },
    ];
    const res = validateAssessmentAnswers(testQuestions, answers, 'DRAFT');
    assert.strictEqual(res.isValid, true);
    const codesInClean = res.cleanAnswers.map((a) => a.questionCode);
    assert.ok(codesInClean.includes('q_purpose'));
    assert.strictEqual(codesInClean.includes('q_loan_amount'), false);
  });

  runTest('SINGLE_CHOICE: rejects invalid option not in options list', () => {
    const answers = [{ questionCode: 'q_purpose', answerValue: 'UNKNOWN_OPTION' }];
    const res = validateAssessmentAnswers(testQuestions, answers, 'DRAFT');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors[0].includes('không thuộc danh sách'));
  });

  runTest('MULTIPLE_CHOICE: rejects invalid option and enforces min/max select', () => {
    // 1. Invalid option
    const badOpt = [
      { questionCode: 'q_has_collateral', answerValue: true },
      { questionCode: 'q_collateral_types', answerValue: ['INVALID_ASSET'] },
    ];
    const res1 = validateAssessmentAnswers(testQuestions, badOpt, 'DRAFT');
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errors.some((e) => e.includes('không thuộc danh sách')));

    // 2. Exceeds maxSelect (maxSelect is 2, passed 3)
    const tooMany = [
      { questionCode: 'q_has_collateral', answerValue: true },
      { questionCode: 'q_collateral_types', answerValue: ['REAL_ESTATE', 'VEHICLE', 'SAVINGS_BOOK'] },
    ];
    const res2 = validateAssessmentAnswers(testQuestions, tooMany, 'DRAFT');
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errors.some((e) => e.includes('tối đa 2 phương án')));
  });

  runTest('CURRENCY & NUMBER: validates min/max and rejects negative currency', () => {
    // Below min
    const belowMin = [
      { questionCode: 'q_purpose', answerValue: 'LOAN' },
      { questionCode: 'q_loan_amount', answerValue: 5000000 }, // min is 10M
    ];
    const res1 = validateAssessmentAnswers(testQuestions, belowMin, 'DRAFT');
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errors.some((e) => e.includes('không được nhỏ hơn')));

    // Negative currency
    const neg = [
      { questionCode: 'q_purpose', answerValue: 'LOAN' },
      { questionCode: 'q_loan_amount', answerValue: -1000000 },
    ];
    const res2 = validateAssessmentAnswers(testQuestions, neg, 'DRAFT');
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errors.some((e) => e.includes('không được là số âm')));
  });

  runTest('0 and false are considered valid answers (NOT missing or empty)', () => {
    const questions: QuestionEvalContext[] = [
      {
        id: 'qz',
        code: 'q_zero',
        questionText: 'Số lượng người phụ thuộc',
        questionType: QuestionType.NUMBER,
        isRequired: true,
        displayOrder: 1,
        active: true,
      },
      {
        id: 'qf',
        code: 'q_flag',
        questionText: 'Có nợ xấu không',
        questionType: QuestionType.YES_NO,
        isRequired: true,
        displayOrder: 2,
        active: true,
      },
    ];

    const answers = [
      { questionCode: 'q_zero', answerValue: 0 },
      { questionCode: 'q_flag', answerValue: false },
    ];

    const res = validateAssessmentAnswers(questions, answers, 'COMPLETE');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.cleanAnswers.length, 2);
  });

  runTest('DATE: rejects malformed date and dates outside minDate/maxDate', () => {
    // Malformed date
    const malformed = [{ questionCode: 'q_expected_date', answerValue: 'not-a-date' }];
    const res1 = validateAssessmentAnswers(testQuestions, malformed, 'DRAFT');
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errors.some((e) => e.includes('Ngày tháng không hợp lệ')));

    // Date outside range (after 2026-12-31)
    const outOfRange = [{ questionCode: 'q_expected_date', answerValue: '2028-05-01' }];
    const res2 = validateAssessmentAnswers(testQuestions, outOfRange, 'DRAFT');
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errors.some((e) => e.includes('không được sau 2026-12-31')));
  });

  console.log('\n--- SECTION 3: HTTP API & Security / RBAC Protection ---');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { address: string; port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const partnerToken = createSessionToken({
    id: 'partner-test-user-id',
    email: 'partner@kteacrm.test',
    role: Role.PARTNER,
    fullName: 'Partner User',
  });

  async function api(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string;
    } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-KTEA-REQUEST': '1',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  await runTest('Unauthenticated GET /api/customers/:id/assessments returns 401 Unauthorized', async () => {
    const res = await api('/api/customers/11111111-1111-1111-1111-111111111111/assessments');
    assert.strictEqual(res.status, 401);
  });

  await runTest('Unauthenticated POST /api/customers/:id/assessments returns 401 Unauthorized', async () => {
    const res = await api('/api/customers/11111111-1111-1111-1111-111111111111/assessments', {
      method: 'POST',
      body: { questionnaireId: '22222222-2222-2222-2222-222222222222' },
    });
    assert.strictEqual(res.status, 401);
  });

  await runTest('Unauthenticated PUT /api/assessments/:assessmentId/answers returns 401 Unauthorized', async () => {
    const res = await api('/api/assessments/33333333-3333-3333-3333-333333333333/answers', {
      method: 'PUT',
      body: { answers: [] },
    });
    assert.strictEqual(res.status, 401);
  });

  await runTest('Unauthenticated POST /api/assessments/:assessmentId/complete returns 401 Unauthorized', async () => {
    const res = await api('/api/assessments/33333333-3333-3333-3333-333333333333/complete', {
      method: 'POST',
      body: {},
    });
    assert.strictEqual(res.status, 401);
  });

  await runTest('Partner user blocked with 401/404 from unassigned customer assessment', async () => {
    const res = await api('/api/customers/99999999-9999-9999-9999-999999999999/assessments', {
      method: 'GET',
      token: partnerToken,
    });
    // Partner has unverified/unassigned token, blocked by requireAuth (401) or customerAccessService (404)
    assert.ok(res.status === 401 || res.status === 404);
  });

  server.close();

  console.log('\n========================================================================');
  console.log(`   Verification Suite Completed: ${passedTests} Passed, ${totalTests - passedTests} Failed`);
  console.log('========================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
