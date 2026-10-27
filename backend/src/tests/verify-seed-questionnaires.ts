import { NEEDS_ASSESSMENT_QUESTIONNAIRES } from '../scripts/data/needsAssessmentQuestionnaires.js';
import {
  createQuestionnaireSchema,
  validateQuestionnaireDependencyGraph,
} from '../validations/questionnaire.validation.js';
import {
  validateAssessmentAnswers,
  QuestionEvalContext,
} from '../validations/assessment.validation.js';
import { seedNeedsAssessmentQuestionnaires } from '../scripts/seedNeedsAssessmentQuestionnaires.js';
import { QuestionType, QuestionnaireVersionStatus } from '@prisma/client';
import prisma from '../config/database.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runVerification() {
  console.log(`========================================================================`);
  console.log(`   KTEA CRM — KIỂM THỬ 5 BỘ CÂU HỎI KHẢO SÁT NHU CẦU KHÁCH HÀNG        `);
  console.log(`========================================================================\n`);

  // -------------------------------------------------------------------------
  // SECTION 1: Cấu trúc, Loại câu hỏi, Phương án & DAG Chu trình phụ thuộc
  // -------------------------------------------------------------------------
  console.log(`--- PHẦN 1: Xác thực cấu trúc 5 bộ câu hỏi & Tính toàn vẹn DAG ---`);
  assert(NEEDS_ASSESSMENT_QUESTIONNAIRES.length === 5, 'Có đủ đúng 5 bộ câu hỏi khảo sát');

  const expectedQuestionnaires = [
    { code: 'KTEA_NEEDS_LOAN_GENERAL', minQuestions: 15 },
    { code: 'KTEA_NEEDS_SECURED_LOAN', minQuestions: 18 },
    { code: 'KTEA_NEEDS_UNSECURED_LOAN', minQuestions: 16 },
    { code: 'KTEA_NEEDS_CREDIT_CARD', minQuestions: 14 },
    { code: 'KTEA_NEEDS_REFINANCE', minQuestions: 20 },
  ];

  for (const expected of expectedQuestionnaires) {
    const qData = NEEDS_ASSESSMENT_QUESTIONNAIRES.find((q) => q.code === expected.code);
    assert(Boolean(qData), `Bộ câu hỏi '${expected.code}' tồn tại trong cấu hình`);
    if (!qData) continue;

    assert(
      qData.questions.length >= expected.minQuestions,
      `'${qData.title}' [${qData.code}] có ${qData.questions.length} câu hỏi (>= ${expected.minQuestions})`
    );

    // Zod schema validation
    const parsed = createQuestionnaireSchema.safeParse({
      code: qData.code,
      title: qData.title,
      description: qData.description,
      active: true,
      initialQuestions: qData.questions,
    });
    assert(parsed.success, `Bộ câu hỏi '${qData.code}' hợp lệ hoàn toàn với createQuestionnaireSchema`);

    // DAG check
    const graphCheck = validateQuestionnaireDependencyGraph(qData.questions);
    assert(graphCheck.isValid, `Bộ câu hỏi '${qData.code}' không có chu trình phụ thuộc vòng quanh (DAG hợp lệ)`);

    // Kiểm tra từng câu hỏi
    const codeOrderMap = new Map<string, number>();
    for (const [idx, q] of qData.questions.entries()) {
      codeOrderMap.set(q.code, idx);

      // Nếu là SINGLE_CHOICE hoặc MULTIPLE_CHOICE: phải có ít nhất 2 options và không trùng lặp value
      if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.MULTIPLE_CHOICE) {
        assert(
          Boolean(q.options && q.options.length >= 2),
          `[${qData.code}] Câu hỏi lựa chọn '${q.code}' có tối thiểu 2 phương án (hiện có ${q.options?.length})`
        );
        const vals = (q.options || []).map((o) => o.value);
        const unique = new Set(vals);
        assert(unique.size === vals.length, `[${qData.code}] Phương án câu hỏi '${q.code}' không có giá trị trùng lặp`);
      }

      // Nếu có conditionalLogic: câu hỏi phụ thuộc phải nằm TRƯỚC câu hỏi hiện tại trong danh sách
      if (q.conditionalLogic?.dependsOnQuestionCode) {
        const parentIdx = codeOrderMap.get(q.conditionalLogic.dependsOnQuestionCode);
        assert(
          parentIdx !== undefined && parentIdx < idx,
          `[${qData.code}] Câu hỏi điều kiện '${q.code}' phụ thuộc vào câu đứng trước '${q.conditionalLogic.dependsOnQuestionCode}'`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Kiểm thử Luồng Khảo sát (Visibility & Answer Validation)
  // -------------------------------------------------------------------------
  console.log(`\n--- PHẦN 2: Kiểm thử Luồng Khảo sát Động (Conditional Visibility & Validation) ---`);

  // Thử nghiệm Bộ 2 (Vay thế chấp):
  // Khi q_has_collateral = true: các câu hỏi về tài sản (q_collateral_type, q_collateral_owner, q_collateral_value...) phải hiện
  // Khi q_has_collateral = false: các câu hỏi về tài sản phải ẩn
  const securedQ = NEEDS_ASSESSMENT_QUESTIONNAIRES.find((q) => q.code === 'KTEA_NEEDS_SECURED_LOAN')!;
  const evalQuestions: QuestionEvalContext[] = securedQ.questions.map((q, idx) => ({
    id: `qid_${idx}`,
    code: q.code,
    questionText: q.questionText,
    questionType: q.questionType,
    isRequired: q.isRequired ?? false,
    displayOrder: q.displayOrder ?? idx + 1,
    options: q.options as any,
    validationConfig: q.validationConfig as any,
    conditionalLogic: q.conditionalLogic as any,
    active: q.active ?? true,
  }));

  // Kịch bản A: Khách hàng chưa có tài sản (q_has_collateral = false)
  const answersNoCollateral = [
    { questionCode: 'q_loan_purpose', answerValue: 'HOME_PURCHASE' },
    { questionCode: 'q_loan_amount', answerValue: 2_000_000_000 },
    { questionCode: 'q_disbursement_timing', answerValue: 'WITHIN_1_MONTH' },
    { questionCode: 'q_tenure_months', answerValue: 240 },
    { questionCode: 'q_has_collateral', answerValue: false },
    { questionCode: 'q_occupation', answerValue: 'SALARIED' },
    { questionCode: 'q_income_level', answerValue: 'ABOVE_10M' },
    { questionCode: 'q_income_proof', answerValue: 'FULL' },
    { questionCode: 'q_has_existing_loans', answerValue: false },
    { questionCode: 'q_next_step', answerValue: 'CALL_BACK' },
  ];

  const valNoCollateral = validateAssessmentAnswers(evalQuestions, answersNoCollateral, 'COMPLETE');
  assert(valNoCollateral.isValid, 'Vay thế chấp (chưa có tài sản): hoàn thành hợp lệ khi các câu tài sản bị ẩn');
  assert(
    !valNoCollateral.visibleQuestionCodes.has('q_collateral_type'),
    'Câu hỏi loại tài sản (q_collateral_type) bị ẩn chính xác khi q_has_collateral = false'
  );
  assert(
    !valNoCollateral.visibleQuestionCodes.has('q_collateral_value'),
    'Câu hỏi giá trị tài sản (q_collateral_value) bị ẩn chính xác khi q_has_collateral = false'
  );

  // Kịch bản B: Khách hàng có tài sản (q_has_collateral = true) nhưng chưa điền thông tin tài sản bắt buộc
  const answersCollateralMissing = [
    ...answersNoCollateral.filter((a) => a.questionCode !== 'q_has_collateral'),
    { questionCode: 'q_has_collateral', answerValue: true },
  ];
  const valCollateralMissing = validateAssessmentAnswers(evalQuestions, answersCollateralMissing, 'COMPLETE');
  assert(
    !valCollateralMissing.isValid,
    'COMPLETE mode chặn thành công khi có tài sản nhưng thiếu thông tin bắt buộc (q_collateral_type/owner)'
  );
  assert(
    valCollateralMissing.visibleQuestionCodes.has('q_collateral_type'),
    'Câu hỏi loại tài sản (q_collateral_type) tự động hiển thị khi q_has_collateral = true'
  );

  // Kịch bản C: Điền đầy đủ thông tin tài sản
  const answersCollateralFull = [
    ...answersCollateralMissing,
    { questionCode: 'q_collateral_type', answerValue: 'HOUSE' },
    { questionCode: 'q_collateral_owner', answerValue: 'SELF' },
    { questionCode: 'q_collateral_legal_status', answerValue: 'FULL_CERTIFICATE' },
    { questionCode: 'q_collateral_value', answerValue: 4_000_000_000 },
    { questionCode: 'q_collateral_mortgaged', answerValue: false },
  ];
  const valCollateralFull = validateAssessmentAnswers(evalQuestions, answersCollateralFull, 'COMPLETE');
  assert(valCollateralFull.isValid, 'Vay thế chấp: hoàn thành thành công khi điền đủ nhánh tài sản');

  // Kịch bản D: DRAFT mode cho phép lưu một phần (không bị chặn)
  const valDraftPartial = validateAssessmentAnswers(
    evalQuestions,
    [{ questionCode: 'q_loan_purpose', answerValue: 'HOME_PURCHASE' }],
    'DRAFT'
  );
  assert(valDraftPartial.isValid, 'DRAFT mode cho phép lưu tiến trình tạm thời chỉ với 1 câu trả lời');

  // -------------------------------------------------------------------------
  // SECTION 3: Tương thích với Recommendation Engine (Standard Rules)
  // -------------------------------------------------------------------------
  console.log(`\n--- PHẦN 3: Tương thích với Recommendation Engine KTEA ---`);
  // Kiểm tra Bộ 1 và Bộ 3 có các mã và giá trị chuẩn tương thích với STANDARD_FINANCIAL_RULES:
  // q_purpose -> 'LOAN', 'CARD'
  // q_has_collateral -> YES_NO
  // q_income_level -> 'ABOVE_10M'
  // q_card_preference -> 'CASHBACK'
  const loanGeneral = NEEDS_ASSESSMENT_QUESTIONNAIRES.find((q) => q.code === 'KTEA_NEEDS_LOAN_GENERAL')!;
  const purposeQ = loanGeneral.questions.find((q) => q.code === 'q_purpose');
  assert(Boolean(purposeQ), 'Bộ vay vốn tổng quát có mã q_purpose');
  const purposeValues = (purposeQ?.options || []).map((o) => o.value);
  assert(purposeValues.includes('LOAN') && purposeValues.includes('CARD'), 'q_purpose chứa giá trị LOAN và CARD');

  const cardQ = NEEDS_ASSESSMENT_QUESTIONNAIRES.find((q) => q.code === 'KTEA_NEEDS_CREDIT_CARD')!;
  const cardPrefQ = cardQ.questions.find((q) => q.code === 'q_card_preference');
  assert(Boolean(cardPrefQ), 'Bộ thẻ tín dụng có mã q_card_preference');
  const cardPrefValues = (cardPrefQ?.options || []).map((o) => o.value);
  assert(cardPrefValues.includes('CASHBACK'), 'q_card_preference có lựa chọn CASHBACK cho rule engine');

  // -------------------------------------------------------------------------
  // SECTION 4: Kiểm thử Khởi tạo Thực tế & Tính Lũy Tiến (Idempotency) trong Database
  // -------------------------------------------------------------------------
  console.log(`\n--- PHẦN 4: Kiểm thử Khởi tạo Database & Tính Lũy Tiến (Idempotent) ---`);

  // Chạy lần 1: Tạo mới 5 bộ câu hỏi
  const seedRun1 = await seedNeedsAssessmentQuestionnaires({ dryRun: false, verbose: false });
  assert(seedRun1.length === 5, 'Khởi tạo lần 1 trả về kết quả cho cả 5 bộ câu hỏi');

  for (const item of seedRun1) {
    assert(
      item.action === 'CREATED' || item.action === 'SKIPPED_EXISTING',
      `Bộ câu hỏi '${item.code}': trạng thái ${item.action}`
    );
    assert(item.status === QuestionnaireVersionStatus.DRAFT, `'${item.code}' khởi tạo ở trạng thái DRAFT an toàn`);
  }

  // Chạy lần 2: Phải nhận diện đã tồn tại và BỎ QUA (không nhân bản / không ghi đè)
  const seedRun2 = await seedNeedsAssessmentQuestionnaires({ dryRun: false, verbose: false });
  assert(seedRun2.length === 5, 'Khởi tạo lần 2 trả về kết quả cho cả 5 bộ');
  const allSkipped = seedRun2.every((item) => item.action === 'SKIPPED_EXISTING');
  assert(allSkipped, 'Tính lũy tiến (idempotent): Chạy lần 2 tự động bỏ qua toàn bộ 5 bộ đã có, không sinh bản ghi trùng');

  // Kiểm tra trong database: mỗi bộ câu hỏi chỉ có đúng 1 bản ghi và 1 version DRAFT
  for (const item of seedRun1) {
    const qFromDb = await prisma.questionnaire.findUnique({
      where: { code: item.code },
      include: {
        versions: {
          include: {
            questions: true,
          },
        },
      },
    });

    assert(Boolean(qFromDb), `Truy vấn DB thành công bộ câu hỏi '${item.code}'`);
    assert(qFromDb?.versions.length === 1, `Bộ câu hỏi '${item.code}' có duy nhất 1 phiên bản khởi tạo`);
    assert(
      qFromDb?.versions[0].status === QuestionnaireVersionStatus.DRAFT,
      `Phiên bản bộ '${item.code}' trong DB là DRAFT (chưa publish lên người dùng)`
    );
    assert(
      qFromDb?.versions[0].isCurrent === false,
      `Phiên bản bộ '${item.code}' chưa kích hoạt isCurrent (chờ Admin duyệt)`
    );
    assert(
      (qFromDb?.versions[0].questions.length ?? 0) >= 14,
      `Số lượng câu hỏi lưu trong DB cho '${item.code}' đạt chuẩn (${qFromDb?.versions[0].questions.length} câu)`
    );
  }

  console.log(`\n========================================================================`);
  console.log(`   KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} Passed (100% Hoàn thành)`);
  console.log(`========================================================================\n`);
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Kiểm thử thất bại:', err);
    process.exit(1);
  });
