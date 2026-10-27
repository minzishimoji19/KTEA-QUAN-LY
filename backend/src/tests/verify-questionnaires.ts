import assert from 'assert';
import http from 'http';
import { createApp } from '../app.js';
import { Role } from '@prisma/client';
import { createSessionToken } from '../utils/session.js';
import {
  createQuestionnaireSchema,
  questionDefinitionInputSchema,
  saveDraftQuestionsSchema,
  validateQuestionnaireDependencyGraph,
  QuestionDefinitionInput,
  questionnaireIdParamSchema,
} from '../validations/questionnaire.validation.js';
import { QuestionType, QuestionnaireVersionStatus } from '@prisma/client';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 2: DYNAMIC QUESTIONNAIRE VERIFICATION SUITE         ');
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
  console.log('--- SECTION 1: Question Type Validations & Configurations ---');

  runTest('Create valid questionnaire schema', () => {
    const valid = createQuestionnaireSchema.parse({
      code: 'KTEA_LOAN_ASSESSMENT',
      title: 'Khảo sát nhu cầu vay vốn & giải pháp tài chính',
      description: 'Dành cho khách hàng có nhu cầu vay tiêu dùng hoặc thế chấp',
    });
    assert.strictEqual(valid.code, 'KTEA_LOAN_ASSESSMENT');
  });

  runTest('Rejects questionnaire code with lowercase or special chars', () => {
    assert.throws(
      () =>
        createQuestionnaireSchema.parse({
          code: 'loan assessment!@#',
          title: 'Khảo sát',
        }),
      /Mã bộ câu hỏi viết HOA/
    );
  });

  runTest('Valid SINGLE_CHOICE question with 2+ options', () => {
    const valid = questionDefinitionInputSchema.parse({
      code: 'q_purpose',
      questionText: 'Mục đích vay vốn chính của bạn là gì?',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      displayOrder: 1,
      options: [
        { id: 'opt_1', label: 'Mua sắm tiêu dùng', value: 'CONSUMER' },
        { id: 'opt_2', label: 'Kinh doanh / Sản xuất', value: 'BUSINESS' },
        { id: 'opt_3', label: 'Mua bất động sản', value: 'REAL_ESTATE', hasTextInput: true },
      ],
    });
    assert.strictEqual(valid.code, 'q_purpose');
    assert.strictEqual(valid.options?.length, 3);
  });

  runTest('Rejects SINGLE_CHOICE with less than 2 options', () => {
    assert.throws(
      () =>
        questionDefinitionInputSchema.parse({
          code: 'q_purpose',
          questionText: 'Mục đích vay vốn?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [{ id: 'opt_1', label: 'Duy nhất', value: 'ONLY' }],
        }),
      /phải có ít nhất 2 phương án/
    );
  });

  runTest('Rejects SINGLE_CHOICE with duplicate option values', () => {
    assert.throws(
      () =>
        questionDefinitionInputSchema.parse({
          code: 'q_purpose',
          questionText: 'Mục đích vay vốn?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [
            { id: 'opt_1', label: 'Lựa chọn A', value: 'SAME_VAL' },
            { id: 'opt_2', label: 'Lựa chọn B', value: 'SAME_VAL' },
          ],
        }),
      /không được trùng nhau/
    );
  });

  runTest('Valid MULTIPLE_CHOICE question', () => {
    const valid = questionDefinitionInputSchema.parse({
      code: 'q_collateral',
      questionText: 'Bạn đang sở hữu các loại tài sản bảo đảm nào?',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: [
        { id: 'opt_house', label: 'Nhà / Đất sổ đỏ', value: 'REAL_ESTATE' },
        { id: 'opt_car', label: 'Ô tô chính chủ', value: 'VEHICLE' },
        { id: 'opt_none', label: 'Không có tài sản bảo đảm', value: 'NONE' },
      ],
    });
    assert.strictEqual(valid.options?.length, 3);
  });

  runTest('Valid YES_NO question', () => {
    const valid = questionDefinitionInputSchema.parse({
      code: 'q_has_bad_debt',
      questionText: 'Bạn từng có lịch sử trả chậm hoặc nợ chú ý tại CIC chưa?',
      questionType: QuestionType.YES_NO,
      isRequired: true,
    });
    assert.strictEqual(valid.questionType, QuestionType.YES_NO);
  });

  runTest('Valid NUMBER and CURRENCY questions with min/max', () => {
    const numberQ = questionDefinitionInputSchema.parse({
      code: 'q_income_monthly',
      questionText: 'Thu nhập thực nhận bình quân hàng tháng (VND)?',
      questionType: QuestionType.CURRENCY,
      isRequired: true,
      validationConfig: {
        min: 5000000,
        max: 500000000,
        step: 500000,
      },
    });
    assert.strictEqual(numberQ.validationConfig?.min, 5000000);

    // Rejects max < min
    assert.throws(
      () =>
        questionDefinitionInputSchema.parse({
          code: 'q_invalid_num',
          questionText: 'Số tiền không hợp lệ',
          questionType: QuestionType.CURRENCY,
          validationConfig: { min: 10000000, max: 2000000 },
        }),
      /Max phải lớn hơn hoặc bằng Min/
    );
  });

  runTest('Valid TEXT, LONG_TEXT, and DATE questions', () => {
    const textQ = questionDefinitionInputSchema.parse({
      code: 'q_employer_name',
      questionText: 'Tên cơ quan / doanh nghiệp đang công tác?',
      questionType: QuestionType.TEXT,
      validationConfig: { minLength: 2, maxLength: 200 },
    });
    assert.strictEqual(textQ.questionType, QuestionType.TEXT);

    const dateQ = questionDefinitionInputSchema.parse({
      code: 'q_disbursement_date',
      questionText: 'Dự kiến thời điểm cần giải ngân?',
      questionType: QuestionType.DATE,
      validationConfig: { minDate: '2026-01-01', maxDate: '2026-12-31' },
    });
    assert.strictEqual(dateQ.questionType, QuestionType.DATE);
  });

  console.log('\n--- SECTION 2: Conditional Logic & Cycle Detection ---');

  runTest('Valid conditional logic pointing to preceding question', () => {
    const valid = questionDefinitionInputSchema.parse({
      code: 'q_loan_amount',
      questionText: 'Số tiền bạn cần vay là bao nhiêu?',
      questionType: QuestionType.CURRENCY,
      conditionalLogic: {
        dependsOnQuestionCode: 'q_purpose',
        operator: 'EQUALS',
        value: 'CONSUMER',
      },
    });
    assert.strictEqual(valid.conditionalLogic?.dependsOnQuestionCode, 'q_purpose');
  });

  runTest('Rejects self-referencing conditional logic', () => {
    assert.throws(
      () =>
        questionDefinitionInputSchema.parse({
          code: 'q_recursive',
          questionText: 'Tự phụ thuộc?',
          questionType: QuestionType.TEXT,
          conditionalLogic: {
            dependsOnQuestionCode: 'q_recursive',
            operator: 'EQUALS',
            value: 'YES',
          },
        }),
      /không thể tự tham chiếu/
    );
  });

  runTest('DAG Cycle Detector: Valid linear dependencies pass', () => {
    const questions = [
      { code: 'q_1', conditionalLogic: null },
      { code: 'q_2', conditionalLogic: { dependsOnQuestionCode: 'q_1', operator: 'EQUALS' as const, value: 'A' } },
      { code: 'q_3', conditionalLogic: { dependsOnQuestionCode: 'q_2', operator: 'EQUALS' as const, value: 'B' } },
    ];
    const res = validateQuestionnaireDependencyGraph(questions);
    assert.strictEqual(res.isValid, true);
  });

  runTest('DAG Cycle Detector: Detects 2-node circular cycle (A -> B -> A)', () => {
    const questions = [
      { code: 'q_a', conditionalLogic: { dependsOnQuestionCode: 'q_b', operator: 'EQUALS' as const, value: '1' } },
      { code: 'q_b', conditionalLogic: { dependsOnQuestionCode: 'q_a', operator: 'EQUALS' as const, value: '2' } },
    ];
    const res = validateQuestionnaireDependencyGraph(questions);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /chu trình điều kiện phụ thuộc/);
  });

  runTest('DAG Cycle Detector: Detects 3-node circular cycle (A -> B -> C -> A)', () => {
    const questions = [
      { code: 'q_a', conditionalLogic: { dependsOnQuestionCode: 'q_c', operator: 'EQUALS' as const, value: '1' } },
      { code: 'q_b', conditionalLogic: { dependsOnQuestionCode: 'q_a', operator: 'EQUALS' as const, value: '2' } },
      { code: 'q_c', conditionalLogic: { dependsOnQuestionCode: 'q_b', operator: 'EQUALS' as const, value: '3' } },
    ];
    const res = validateQuestionnaireDependencyGraph(questions);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /chu trình điều kiện phụ thuộc/);
  });

  runTest('DAG Cycle Detector: Detects reference to non-existent question code', () => {
    const questions = [
      { code: 'q_1', conditionalLogic: { dependsOnQuestionCode: 'q_phantom_ghost', operator: 'EQUALS' as const, value: '1' } },
    ];
    const res = validateQuestionnaireDependencyGraph(questions);
    assert.strictEqual(res.isValid, false);
    assert.match(res.error || '', /tham chiếu đến câu hỏi không tồn tại/);
  });

  runTest('saveDraftQuestionsSchema rejects duplicate question codes in version', () => {
    assert.throws(
      () =>
        saveDraftQuestionsSchema.parse({
          questions: [
            { code: 'q_dup', questionText: 'Câu 1', questionType: QuestionType.TEXT, isRequired: false, displayOrder: 1, active: true },
            { code: 'q_dup', questionText: 'Câu 2 trùng code', questionType: QuestionType.TEXT, isRequired: false, displayOrder: 2, active: true },
          ],
        }),
      /trùng lặp/
    );
  });

  console.log('\n--- SECTION 3: HTTP API & Security / RBAC Protection ---');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { address: string; port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const adminToken = createSessionToken({
    id: 'admin-test-user-id',
    email: 'admin@kteacrm.test',
    role: Role.ADMIN,
    fullName: 'System Administrator',
  });

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

  await runTest('Unauthenticated GET /api/questionnaires returns 401 Unauthorized', async () => {
    const res = await api('/api/questionnaires');
    assert.strictEqual(res.status, 401);
  });

  await runTest('Unauthenticated POST /api/questionnaires returns 401 Unauthorized', async () => {
    const res = await api('/api/questionnaires', {
      method: 'POST',
      body: { code: 'TEST_UNAUTH', title: 'Test Title' },
    });
    assert.strictEqual(res.status, 401);
  });

  await runTest('Partner user blocked from POST /api/questionnaires (Status: 401/403)', async () => {
    const res = await api('/api/questionnaires', {
      method: 'POST',
      token: partnerToken,
      body: { code: 'TEST_PARTNER', title: 'Partner Attempt' },
    });
    assert.ok(res.status === 401 || res.status === 403);
  });

  await runTest('Partner user blocked from publishing version (Status: 401/403)', async () => {
    const res = await api('/api/questionnaires/11111111-1111-1111-1111-111111111111/versions/22222222-2222-2222-2222-222222222222/publish', {
      method: 'POST',
      token: partnerToken,
      body: { changeLog: 'Partner try to publish' },
    });
    assert.ok(res.status === 401 || res.status === 403);
  });

  await runTest('Partner user blocked from deleting draft version (Status: 401/403)', async () => {
    const res = await api('/api/questionnaires/11111111-1111-1111-1111-111111111111/versions/22222222-2222-2222-2222-222222222222', {
      method: 'DELETE',
      token: partnerToken,
    });
    assert.ok(res.status === 401 || res.status === 403);
  });

  runTest('Rejects malformed questionnaire ID format with Zod validation failure', () => {
    const parseRes = questionnaireIdParamSchema.safeParse({ id: 'invalid-non-uuid-id' });
    assert.strictEqual(parseRes.success, false);
    if (!parseRes.success) {
      assert.strictEqual(parseRes.error.issues[0].message, 'ID bộ câu hỏi không hợp lệ');
    }
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
