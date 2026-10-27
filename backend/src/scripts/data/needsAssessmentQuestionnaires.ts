/**
 * KTEA CRM — Seed data: 5 bộ khảo sát nhu cầu khách hàng (Needs Assessment).
 *
 * Quy ước thiết kế (đối chiếu với code thực tế Phase 2–4):
 * - Mã câu hỏi (code) viết thường snake_case, ổn định, duy nhất trong từng bộ.
 * - Một số mã được dùng CHUNG với bộ quy tắc gợi ý mặc định `STANDARD_FINANCIAL_RULES`
 *   (backend/src/services/assessmentRecommendation.service.ts):
 *     q_purpose          → PREFERENCE_MATCH 'LOAN' / 'CARD'
 *     q_loan_amount      → NUMERIC_RANGE (số VNĐ)
 *     q_tenure_months    → TENURE_MATCH (số tháng)
 *     q_income_level     → PREFERENCE_MATCH 'ABOVE_10M'
 *     q_card_preference  → ANSWER_VALUE_MATCH 'CASHBACK'
 *     q_has_collateral   → BOOLEAN_FLAG / COLLATERAL_BONUS (YES_NO → boolean)
 * - Conditional logic chỉ dùng các toán tử mà trình biên tập câu hỏi trên UI hỗ trợ
 *   (EQUALS, NOT_EQUALS) để ADMIN có thể mở và chỉnh sửa mà không làm hỏng điều kiện.
 * - Điều kiện trên câu YES_NO so sánh với chuỗi 'true' (form khảo sát lưu giá trị boolean,
 *   backend so sánh String(answer) === String(value)).
 * - Không dùng `hasTextInput` cho phương án "Khác" vì validator SINGLE_CHOICE chỉ nhận chuỗi;
 *   thay vào đó là một câu TEXT tùy chọn hiển thị khi chọn "Khác".
 * - Không thu thập mật khẩu, mã OTP, thông tin đăng nhập ngân hàng hay số tài khoản.
 */
import type { QuestionDefinitionInput } from '../../validations/questionnaire.validation.js';

export interface SeedQuestionnaire {
  code: string;
  title: string;
  description: string;
  questions: QuestionDefinitionInput[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Opt = [value: string, label: string];

const options = (items: Opt[]) =>
  items.map(([value, label]) => ({
    id: `opt_${value.toLowerCase()}`,
    value,
    label,
    hasTextInput: false,
  }));

const whenYes = (code: string) => ({ dependsOnQuestionCode: code, operator: 'EQUALS' as const, value: 'true' });
const whenEquals = (code: string, value: string) => ({ dependsOnQuestionCode: code, operator: 'EQUALS' as const, value });
const whenNotEquals = (code: string, value: string) => ({ dependsOnQuestionCode: code, operator: 'NOT_EQUALS' as const, value });

type Q = Omit<QuestionDefinitionInput, 'displayOrder' | 'active' | 'isRequired'> & { isRequired?: boolean };

/** Gán displayOrder theo thứ tự khai báo (1..n) và mặc định active=true. */
const ordered = (qs: Q[]): QuestionDefinitionInput[] =>
  qs.map((q, i) => ({ ...q, isRequired: q.isRequired ?? false, displayOrder: i + 1, active: true }));

const SECURITY_NOTE =
  'Lưu ý bảo mật: không hỏi và không ghi nhận mật khẩu, mã OTP, thông tin đăng nhập ngân hàng hoặc số thẻ của khách hàng.';

// ---------------------------------------------------------------------------
// Câu hỏi dùng chung (factory để mỗi bộ có bản sao độc lập)
// ---------------------------------------------------------------------------
const LOAN_FORM_OPTIONS: Opt[] = [
  ['LOAN', 'Vay tiền (giải ngân một lần)'],
  ['CARD', 'Hạn mức thẻ tín dụng để chi tiêu dần'],
  ['UNDECIDED', 'Chưa xác định, cần tư vấn thêm'],
];

const qPurposeLoanForm = (): Q => ({
  code: 'q_purpose',
  questionText: 'Khách hàng muốn nhận hỗ trợ tài chính theo hình thức nào?',
  description: 'Dùng để hệ thống gợi ý đúng nhóm sản phẩm (khoản vay hay thẻ tín dụng).',
  questionType: 'SINGLE_CHOICE',
  isRequired: true,
  options: options(LOAN_FORM_OPTIONS),
});

const qLoanAmount = (max: number, description?: string): Q => ({
  code: 'q_loan_amount',
  questionText: 'Số tiền dự kiến cần vay (VNĐ)',
  description: description ?? 'Nhập số tiền ước tính bằng VNĐ, ví dụ 200000000 cho 200 triệu.',
  questionType: 'CURRENCY',
  isRequired: true,
  validationConfig: { min: 1_000_000, max },
});

const qDisbursementTiming = (): Q => ({
  code: 'q_disbursement_timing',
  questionText: 'Khi nào khách hàng cần giải ngân?',
  questionType: 'SINGLE_CHOICE',
  isRequired: true,
  options: options([
    ['WITHIN_1_WEEK', 'Trong vòng 1 tuần'],
    ['WITHIN_1_MONTH', 'Trong vòng 1 tháng'],
    ['WITHIN_3_MONTHS', 'Trong 1–3 tháng tới'],
    ['FLEXIBLE', 'Chưa gấp / linh hoạt'],
  ]),
});

const qTenureMonths = (max: number, text = 'Thời hạn vay mong muốn (tháng)'): Q => ({
  code: 'q_tenure_months',
  questionText: text,
  description: 'Ví dụ: 12, 24, 36, 60. Để trống nếu khách hàng chưa xác định.',
  questionType: 'NUMBER',
  validationConfig: { min: 1, max, step: 1 },
});

const qAffordablePayment = (): Q => ({
  code: 'q_affordable_monthly_payment',
  questionText: 'Mức trả góp hàng tháng khách hàng có thể cân nhắc (VNĐ)',
  description: 'Không bắt buộc. Giúp chuyên viên đề xuất thời hạn vay phù hợp.',
  questionType: 'CURRENCY',
  validationConfig: { min: 0 },
});

const qPriorityFactors = (): Q => ({
  code: 'q_priority_factors',
  questionText: 'Khách hàng ưu tiên điều gì nhất khi chọn sản phẩm? (tối đa 2)',
  questionType: 'MULTIPLE_CHOICE',
  options: options([
    ['LOW_INTEREST', 'Lãi suất thấp'],
    ['HIGH_LIMIT', 'Hạn mức cao'],
    ['FAST_DISBURSEMENT', 'Giải ngân nhanh'],
    ['SIMPLE_PROCEDURE', 'Thủ tục đơn giản'],
    ['FLEXIBLE_TENURE', 'Thời hạn linh hoạt'],
    ['NOT_SURE', 'Chưa xác định'],
  ]),
  validationConfig: { maxSelect: 2 },
});

const qOccupation = (): Q => ({
  code: 'q_occupation',
  questionText: 'Nghề nghiệp hiện tại của khách hàng',
  questionType: 'SINGLE_CHOICE',
  isRequired: true,
  options: options([
    ['SALARIED', 'Người lao động hưởng lương (doanh nghiệp)'],
    ['CIVIL_SERVANT', 'Cán bộ, công chức, viên chức, lực lượng vũ trang'],
    ['BUSINESS_OWNER', 'Chủ hộ kinh doanh / chủ doanh nghiệp'],
    ['FREELANCER', 'Lao động tự do'],
    ['RETIREE', 'Hưu trí'],
    ['OTHER', 'Khác'],
  ]),
});

const qOccupationOther = (): Q => ({
  code: 'q_occupation_other',
  questionText: 'Nghề nghiệp khác (ghi rõ)',
  questionType: 'TEXT',
  validationConfig: { maxLength: 255 },
  conditionalLogic: whenEquals('q_occupation', 'OTHER'),
});

const qIncomeLevel = (): Q => ({
  code: 'q_income_level',
  questionText: 'Thu nhập bình quân hàng tháng của khách hàng (khoảng)',
  description: 'Chọn khoảng gần đúng; không cần con số chính xác.',
  questionType: 'SINGLE_CHOICE',
  isRequired: true,
  options: options([
    ['BELOW_5M', 'Dưới 5 triệu'],
    ['5M_TO_10M', 'Từ 5 đến dưới 10 triệu'],
    ['ABOVE_10M', 'Từ 10 triệu trở lên'],
    ['UNDISCLOSED', 'Khách hàng chưa muốn chia sẻ'],
  ]),
});

const qIncomeMethod = (required = false): Q => ({
  code: 'q_income_method',
  questionText: 'Khách hàng nhận thu nhập chủ yếu theo hình thức nào?',
  questionType: 'SINGLE_CHOICE',
  isRequired: required,
  options: options([
    ['BANK_TRANSFER', 'Chuyển khoản qua ngân hàng'],
    ['CASH', 'Tiền mặt'],
    ['MIXED', 'Cả chuyển khoản và tiền mặt'],
  ]),
});

const qIncomeProof = (required = true): Q => ({
  code: 'q_income_proof',
  questionText: 'Khả năng chứng minh thu nhập',
  description: 'Ví dụ chứng từ: sao kê lương, hợp đồng lao động, bảng lương, giấy phép kinh doanh, sổ sách bán hàng.',
  questionType: 'SINGLE_CHOICE',
  isRequired: required,
  options: options([
    ['FULL', 'Có đầy đủ chứng từ'],
    ['PARTIAL', 'Có một phần chứng từ'],
    ['NONE', 'Không có chứng từ'],
    ['NOT_SURE', 'Chưa rõ'],
  ]),
});

const qHasExistingLoans = (): Q => ({
  code: 'q_has_existing_loans',
  questionText: 'Khách hàng hiện có khoản vay hoặc dư nợ thẻ tín dụng đang phải trả không?',
  questionType: 'YES_NO',
  isRequired: true,
});

const qExistingMonthlyDebt = (): Q => ({
  code: 'q_existing_monthly_debt_payment',
  questionText: 'Tổng số tiền đang trả nợ mỗi tháng (VNĐ, ước tính)',
  questionType: 'CURRENCY',
  validationConfig: { min: 0 },
  conditionalLogic: whenYes('q_has_existing_loans'),
});

const qExistingDebtStatus = (): Q => ({
  code: 'q_existing_debt_status',
  questionText: 'Tình hình thanh toán các khoản nợ trong 12 tháng gần đây',
  questionType: 'SINGLE_CHOICE',
  options: options([
    ['ON_TIME', 'Luôn thanh toán đúng hạn'],
    ['LATE_UNDER_10_DAYS', 'Từng chậm dưới 10 ngày'],
    ['LATE_OVER_10_DAYS', 'Từng chậm từ 10 ngày trở lên'],
    ['NOT_SURE', 'Không nhớ rõ / chưa muốn chia sẻ'],
  ]),
  conditionalLogic: whenYes('q_has_existing_loans'),
});

const qCollateralType = (required: boolean, opts: Opt[]): Q => ({
  code: 'q_collateral_type',
  questionText: 'Loại tài sản dự kiến dùng làm tài sản bảo đảm',
  questionType: 'SINGLE_CHOICE',
  isRequired: required,
  options: options(opts),
  conditionalLogic: whenYes('q_has_collateral'),
});

const qCollateralValue = (): Q => ({
  code: 'q_collateral_value',
  questionText: 'Giá trị tài sản ước tính (VNĐ)',
  description: 'Giá trị tham khảo do khách hàng ước tính; giá trị chính thức do đơn vị định giá xác định.',
  questionType: 'CURRENCY',
  validationConfig: { min: 0 },
  conditionalLogic: whenYes('q_has_collateral'),
});

const nextStepOptions = (extra: Opt[] = []): Opt[] => [
  ['CALL_BACK', 'Gọi lại tư vấn chi tiết'],
  ['MEETING', 'Hẹn gặp trực tiếp'],
  ['SEND_INFO', 'Gửi thông tin sản phẩm qua Zalo / email'],
  ['PREPARE_DOCS', 'Hướng dẫn chuẩn bị hồ sơ'],
  ...extra,
  ['NOT_NOW', 'Chưa có nhu cầu ngay, liên hệ lại sau'],
];

const qNextStep = (extra: Opt[] = []): Q => ({
  code: 'q_next_step',
  questionText: 'Bước tiếp theo khách hàng mong muốn',
  questionType: 'SINGLE_CHOICE',
  isRequired: true,
  options: options(nextStepOptions(extra)),
});

const qContactTime = (): Q => ({
  code: 'q_preferred_contact_time',
  questionText: 'Khung giờ thuận tiện để liên hệ',
  questionType: 'SINGLE_CHOICE',
  options: options([
    ['MORNING', 'Buổi sáng'],
    ['AFTERNOON', 'Buổi chiều'],
    ['EVENING', 'Buổi tối'],
    ['ANYTIME', 'Bất kỳ lúc nào'],
  ]),
  conditionalLogic: whenNotEquals('q_next_step', 'NOT_NOW'),
});

const qAdvisorNotes = (): Q => ({
  code: 'q_advisor_notes',
  questionText: 'Ghi chú của chuyên viên tư vấn',
  description: 'Thông tin bổ sung, mong muốn đặc biệt của khách hàng. Không ghi mật khẩu, OTP hay thông tin đăng nhập.',
  questionType: 'LONG_TEXT',
  validationConfig: { maxLength: 2000 },
});

// ---------------------------------------------------------------------------
// BỘ 1 — Khảo sát nhu cầu vay vốn
// ---------------------------------------------------------------------------
const LOAN_GENERAL: SeedQuestionnaire = {
  code: 'KTEA_NEEDS_LOAN_GENERAL',
  title: 'Khảo sát nhu cầu vay vốn',
  description:
    'Bộ khảo sát tổng quát giúp chuyên viên xác định mục đích, số tiền, thời hạn, khả năng tài chính và hồ sơ của khách hàng có nhu cầu vay vốn. ' +
    SECURITY_NOTE,
  questions: ordered([
    // Nhu cầu
    qPurposeLoanForm(),
    {
      code: 'q_loan_purpose',
      questionText: 'Mục đích sử dụng khoản vay chính',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['CONSUMER', 'Tiêu dùng cá nhân / gia đình'],
        ['HOME', 'Mua, xây hoặc sửa chữa nhà'],
        ['VEHICLE', 'Mua xe'],
        ['BUSINESS', 'Kinh doanh / bổ sung vốn lưu động'],
        ['EDUCATION', 'Học tập'],
        ['MEDICAL', 'Chữa bệnh'],
        ['DEBT_REPAYMENT', 'Trả nợ khoản vay khác'],
        ['OTHER', 'Khác'],
      ]),
    },
    {
      code: 'q_loan_purpose_other',
      questionText: 'Mục đích vay khác (ghi rõ)',
      questionType: 'TEXT',
      validationConfig: { maxLength: 255 },
      conditionalLogic: whenEquals('q_loan_purpose', 'OTHER'),
    },
    qLoanAmount(50_000_000_000),
    qDisbursementTiming(),
    qTenureMonths(360),
    qAffordablePayment(),
    qPriorityFactors(),
    // Điều kiện tài chính
    qOccupation(),
    qOccupationOther(),
    {
      code: 'q_income_sources',
      questionText: 'Các nguồn thu nhập của khách hàng',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['SALARY', 'Lương'],
        ['BUSINESS_INCOME', 'Kinh doanh'],
        ['RENTAL', 'Cho thuê tài sản'],
        ['PENSION', 'Lương hưu'],
        ['FREELANCE', 'Thu nhập tự do / dịch vụ'],
        ['OTHER', 'Khác'],
      ]),
    },
    qIncomeLevel(),
    qIncomeProof(),
    qHasExistingLoans(),
    qExistingMonthlyDebt(),
    qExistingDebtStatus(),
    {
      code: 'q_has_collateral',
      questionText: 'Khách hàng có tài sản có thể dùng làm tài sản bảo đảm không?',
      description: 'Ví dụ: nhà đất, căn hộ, ô tô, sổ tiết kiệm. Giúp mở rộng lựa chọn sang các gói vay thế chấp.',
      questionType: 'YES_NO',
      isRequired: true,
      conditionalLogic: whenNotEquals('q_purpose', 'CARD'),
    },
    qCollateralType(false, [
      ['REAL_ESTATE', 'Nhà ở / đất / căn hộ'],
      ['VEHICLE', 'Ô tô'],
      ['SAVINGS', 'Sổ tiết kiệm / giấy tờ có giá'],
      ['OTHER', 'Tài sản khác'],
    ]),
    // Hồ sơ
    {
      code: 'q_prepared_documents',
      questionText: 'Hồ sơ khách hàng đã chuẩn bị',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['ID_CARD', 'CCCD gắn chip'],
        ['RESIDENCE', 'Thông tin cư trú (VNeID / xác nhận cư trú)'],
        ['INCOME_DOCS', 'Chứng từ thu nhập'],
        ['COLLATERAL_DOCS', 'Giấy tờ tài sản bảo đảm'],
        ['BUSINESS_DOCS', 'Giấy phép kinh doanh'],
        ['NONE', 'Chưa chuẩn bị'],
      ]),
    },
    // Bước tiếp theo
    qNextStep(),
    qContactTime(),
    qAdvisorNotes(),
  ]),
};

// ---------------------------------------------------------------------------
// BỘ 2 — Khảo sát vay thế chấp
// ---------------------------------------------------------------------------
const SECURED_LOAN: SeedQuestionnaire = {
  code: 'KTEA_NEEDS_SECURED_LOAN',
  title: 'Khảo sát vay thế chấp',
  description:
    'Khảo sát chuyên sâu cho nhu cầu vay có tài sản bảo đảm: thông tin tài sản, pháp lý, khả năng trả nợ và hồ sơ. ' +
    SECURITY_NOTE,
  questions: ordered([
    // Nhu cầu
    {
      code: 'q_loan_purpose',
      questionText: 'Mục đích vay thế chấp',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['HOME_PURCHASE', 'Mua nhà / căn hộ / đất'],
        ['HOME_CONSTRUCTION', 'Xây dựng / sửa chữa nhà'],
        ['VEHICLE', 'Mua ô tô'],
        ['BUSINESS', 'Kinh doanh / bổ sung vốn'],
        ['CONSUMER', 'Tiêu dùng'],
        ['DEBT_REPAYMENT', 'Trả nợ khoản vay khác'],
        ['OTHER', 'Khác'],
      ]),
    },
    {
      code: 'q_loan_purpose_other',
      questionText: 'Mục đích vay khác (ghi rõ)',
      questionType: 'TEXT',
      validationConfig: { maxLength: 255 },
      conditionalLogic: whenEquals('q_loan_purpose', 'OTHER'),
    },
    qLoanAmount(100_000_000_000),
    qDisbursementTiming(),
    qTenureMonths(360),
    // Tài sản bảo đảm
    {
      code: 'q_has_collateral',
      questionText: 'Khách hàng đã xác định được tài sản dùng để thế chấp chưa?',
      description: 'Chọn "Có" cả khi dự kiến thế chấp chính tài sản mua bằng khoản vay (nhà, xe đang mua).',
      questionType: 'YES_NO',
      isRequired: true,
    },
    qCollateralType(true, [
      ['HOUSE', 'Nhà ở riêng lẻ'],
      ['APARTMENT', 'Căn hộ chung cư'],
      ['LAND', 'Đất nền / đất ở'],
      ['FUTURE_ASSET', 'Tài sản hình thành trong tương lai (nhà / xe đang mua)'],
      ['VEHICLE', 'Ô tô'],
      ['SAVINGS', 'Sổ tiết kiệm / giấy tờ có giá'],
      ['OTHER', 'Tài sản khác'],
    ]),
    {
      code: 'q_collateral_owner',
      questionText: 'Tài sản đang đứng tên ai?',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['SELF', 'Khách hàng'],
        ['SPOUSE', 'Vợ / chồng hoặc đồng sở hữu'],
        ['FAMILY', 'Bố mẹ / người thân (bên thứ ba bảo đảm)'],
        ['COMPANY', 'Doanh nghiệp'],
        ['OTHER', 'Khác'],
      ]),
      conditionalLogic: whenYes('q_has_collateral'),
    },
    {
      code: 'q_collateral_legal_status',
      questionText: 'Tình trạng giấy tờ pháp lý của tài sản',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['FULL_CERTIFICATE', 'Đã có sổ đỏ / sổ hồng / đăng ký xe đầy đủ'],
        ['PENDING_CERTIFICATE', 'Đang làm thủ tục cấp giấy chứng nhận'],
        ['SALE_CONTRACT_ONLY', 'Mới có hợp đồng mua bán / đặt cọc'],
        ['RESTRICTED', 'Đang có tranh chấp hoặc bị hạn chế giao dịch'],
        ['NOT_SURE', 'Chưa rõ'],
      ]),
      conditionalLogic: whenYes('q_has_collateral'),
    },
    qCollateralValue(),
    {
      code: 'q_collateral_province',
      questionText: 'Tỉnh / thành phố nơi có tài sản',
      description: 'Chỉ cần tỉnh / thành phố, không cần địa chỉ chi tiết.',
      questionType: 'TEXT',
      validationConfig: { maxLength: 255 },
      conditionalLogic: whenYes('q_has_collateral'),
    },
    {
      code: 'q_collateral_mortgaged',
      questionText: 'Tài sản hiện có đang được thế chấp tại tổ chức khác không?',
      questionType: 'YES_NO',
      isRequired: true,
      conditionalLogic: whenYes('q_has_collateral'),
    },
    {
      code: 'q_collateral_mortgage_balance',
      questionText: 'Dư nợ còn lại của khoản vay đang thế chấp tài sản này (VNĐ, ước tính)',
      questionType: 'CURRENCY',
      validationConfig: { min: 0 },
      conditionalLogic: whenYes('q_collateral_mortgaged'),
    },
    // Điều kiện tài chính
    qOccupation(),
    qOccupationOther(),
    qIncomeLevel(),
    qIncomeProof(),
    qHasExistingLoans(),
    qExistingMonthlyDebt(),
    qAffordablePayment(),
    // Hồ sơ
    {
      code: 'q_prepared_documents',
      questionText: 'Hồ sơ khách hàng đã có',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['ID_CARD', 'CCCD gắn chip'],
        ['MARITAL_STATUS', 'Giấy tờ tình trạng hôn nhân'],
        ['COLLATERAL_CERTIFICATE', 'Sổ đỏ / sổ hồng / đăng ký xe'],
        ['SALE_CONTRACT', 'Hợp đồng mua bán / đặt cọc'],
        ['INCOME_DOCS', 'Chứng từ thu nhập'],
        ['BUSINESS_DOCS', 'Giấy phép kinh doanh'],
        ['NONE', 'Chưa chuẩn bị'],
      ]),
    },
    // Bước tiếp theo
    qNextStep([['VALUATION', 'Hẹn định giá tài sản']]),
    qContactTime(),
    qAdvisorNotes(),
  ]),
};

// ---------------------------------------------------------------------------
// BỘ 3 — Khảo sát vay tín chấp
// ---------------------------------------------------------------------------
const UNSECURED_LOAN: SeedQuestionnaire = {
  code: 'KTEA_NEEDS_UNSECURED_LOAN',
  title: 'Khảo sát vay tín chấp',
  description:
    'Khảo sát nhu cầu vay không cần tài sản bảo đảm, tập trung vào công việc, thu nhập, nghĩa vụ nợ và hồ sơ. ' +
    SECURITY_NOTE,
  questions: ordered([
    // Nhu cầu
    qPurposeLoanForm(),
    {
      code: 'q_loan_purpose',
      questionText: 'Mục đích sử dụng khoản vay',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['CONSUMER', 'Tiêu dùng cá nhân / gia đình'],
        ['HOME_IMPROVEMENT', 'Sửa chữa, mua sắm nội thất'],
        ['EDUCATION', 'Học tập'],
        ['MEDICAL', 'Chữa bệnh'],
        ['VEHICLE', 'Mua xe máy / ô tô'],
        ['BUSINESS', 'Kinh doanh nhỏ'],
        ['DEBT_REPAYMENT', 'Trả nợ khoản vay khác'],
        ['OTHER', 'Khác'],
      ]),
    },
    {
      code: 'q_loan_purpose_other',
      questionText: 'Mục đích vay khác (ghi rõ)',
      questionType: 'TEXT',
      validationConfig: { maxLength: 255 },
      conditionalLogic: whenEquals('q_loan_purpose', 'OTHER'),
    },
    qLoanAmount(2_000_000_000),
    // Công việc & thu nhập
    qOccupation(),
    qOccupationOther(),
    {
      code: 'q_employment_duration',
      questionText: 'Thời gian làm việc / kinh doanh ở công việc hiện tại',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['UNDER_6M', 'Dưới 6 tháng'],
        ['6M_TO_12M', 'Từ 6 đến 12 tháng'],
        ['1Y_TO_3Y', 'Từ 1 đến 3 năm'],
        ['OVER_3Y', 'Trên 3 năm'],
      ]),
    },
    {
      code: 'q_contract_type',
      questionText: 'Loại hợp đồng lao động hiện tại',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['INDEFINITE', 'Không xác định thời hạn'],
        ['FIXED_12M_PLUS', 'Xác định thời hạn từ 12 tháng trở lên'],
        ['FIXED_UNDER_12M', 'Xác định thời hạn dưới 12 tháng'],
        ['NO_CONTRACT', 'Không có hợp đồng'],
        ['NOT_SURE', 'Chưa rõ'],
      ]),
      conditionalLogic: whenEquals('q_occupation', 'SALARIED'),
    },
    qIncomeLevel(),
    qIncomeMethod(true),
    qIncomeProof(),
    // Nghĩa vụ nợ
    qHasExistingLoans(),
    {
      code: 'q_existing_loan_count',
      questionText: 'Số khoản vay / thẻ tín dụng đang có',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['ONE', '1 khoản'],
        ['TWO', '2 khoản'],
        ['THREE_OR_MORE', 'Từ 3 khoản trở lên'],
      ]),
      conditionalLogic: whenYes('q_has_existing_loans'),
    },
    qExistingMonthlyDebt(),
    qExistingDebtStatus(),
    qAffordablePayment(),
    qTenureMonths(120),
    // Hồ sơ
    {
      code: 'q_prepared_documents',
      questionText: 'Hồ sơ định danh và thu nhập khách hàng đã chuẩn bị',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['ID_CARD', 'CCCD gắn chip'],
        ['RESIDENCE', 'Thông tin cư trú (VNeID / xác nhận cư trú)'],
        ['LABOR_CONTRACT', 'Hợp đồng lao động'],
        ['SALARY_STATEMENT', 'Sao kê lương / bảng lương 3–6 tháng'],
        ['SOCIAL_INSURANCE', 'Thông tin bảo hiểm xã hội'],
        ['BUSINESS_DOCS', 'Giấy phép kinh doanh / sổ sách'],
        ['NONE', 'Chưa chuẩn bị'],
      ]),
    },
    // Thời điểm & ưu tiên
    qDisbursementTiming(),
    qPriorityFactors(),
    qNextStep(),
    qContactTime(),
    qAdvisorNotes(),
  ]),
};

// ---------------------------------------------------------------------------
// BỘ 4 — Khảo sát thẻ tín dụng
// ---------------------------------------------------------------------------
const CREDIT_CARD: SeedQuestionnaire = {
  code: 'KTEA_NEEDS_CREDIT_CARD',
  title: 'Khảo sát thẻ tín dụng',
  description:
    'Khảo sát nhu cầu mở thẻ tín dụng: mục đích sử dụng, hạn mức, thói quen chi tiêu, ưu đãi quan tâm và hồ sơ. ' +
    SECURITY_NOTE,
  questions: ordered([
    // Nhu cầu
    {
      code: 'q_purpose',
      questionText: 'Nhu cầu chính của khách hàng',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['CARD', 'Mở thẻ tín dụng mới / thêm thẻ'],
        ['LOAN', 'Thực tế cần khoản vay tiền mặt hơn là thẻ'],
        ['UNDECIDED', 'Chưa xác định, cần tư vấn thêm'],
      ]),
    },
    {
      code: 'q_card_usage_purposes',
      questionText: 'Khách hàng dự định dùng thẻ cho mục đích nào?',
      questionType: 'MULTIPLE_CHOICE',
      isRequired: true,
      options: options([
        ['DAILY_SPENDING', 'Chi tiêu hằng ngày'],
        ['ONLINE_SHOPPING', 'Mua sắm / thanh toán trực tuyến'],
        ['TRAVEL', 'Du lịch, đi lại, đặt vé'],
        ['INSTALLMENT_PURCHASE', 'Mua sắm trả góp'],
        ['BILL_PAYMENT', 'Thanh toán hóa đơn định kỳ'],
        ['EMERGENCY', 'Dự phòng khi cần'],
        ['BUSINESS_EXPENSE', 'Chi phí công việc / kinh doanh'],
        ['OTHER', 'Khác'],
      ]),
      validationConfig: { minSelect: 1 },
    },
    {
      code: 'q_desired_credit_limit',
      questionText: 'Hạn mức thẻ mong muốn',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['UNDER_20M', 'Dưới 20 triệu'],
        ['20M_TO_50M', 'Từ 20 đến 50 triệu'],
        ['50M_TO_100M', 'Từ 50 đến 100 triệu'],
        ['ABOVE_100M', 'Trên 100 triệu'],
        ['NOT_SURE', 'Chưa xác định'],
      ]),
    },
    {
      code: 'q_monthly_card_spending',
      questionText: 'Mức chi tiêu dự kiến qua thẻ mỗi tháng',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['UNDER_5M', 'Dưới 5 triệu'],
        ['5M_TO_15M', 'Từ 5 đến 15 triệu'],
        ['15M_TO_30M', 'Từ 15 đến 30 triệu'],
        ['ABOVE_30M', 'Trên 30 triệu'],
        ['NOT_SURE', 'Chưa xác định'],
      ]),
    },
    {
      code: 'q_card_preference',
      questionText: 'Ưu đãi khách hàng quan tâm nhất',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['CASHBACK', 'Hoàn tiền khi chi tiêu'],
        ['INSTALLMENT', 'Trả góp 0% lãi suất'],
        ['TRAVEL_MILES', 'Tích dặm bay / phòng chờ sân bay'],
        ['LOW_FEE', 'Miễn / giảm phí thường niên'],
        ['SHOPPING_DEALS', 'Ưu đãi mua sắm, ẩm thực'],
        ['NOT_SURE', 'Chưa xác định'],
      ]),
    },
    // Thẻ hiện có
    {
      code: 'q_has_credit_card',
      questionText: 'Khách hàng hiện đã có thẻ tín dụng chưa?',
      questionType: 'YES_NO',
      isRequired: true,
    },
    {
      code: 'q_existing_card_count',
      questionText: 'Số thẻ tín dụng đang sử dụng',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['ONE', '1 thẻ'],
        ['TWO', '2 thẻ'],
        ['THREE_OR_MORE', 'Từ 3 thẻ trở lên'],
      ]),
      conditionalLogic: whenYes('q_has_credit_card'),
    },
    {
      code: 'q_existing_card_total_limit',
      questionText: 'Tổng hạn mức các thẻ hiện có (khoảng)',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['UNDER_20M', 'Dưới 20 triệu'],
        ['20M_TO_50M', 'Từ 20 đến 50 triệu'],
        ['50M_TO_100M', 'Từ 50 đến 100 triệu'],
        ['ABOVE_100M', 'Trên 100 triệu'],
        ['NOT_SURE', 'Không nhớ rõ'],
      ]),
      conditionalLogic: whenYes('q_has_credit_card'),
    },
    {
      code: 'q_existing_card_payment_habit',
      questionText: 'Thói quen thanh toán dư nợ thẻ hiện tại',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['FULL_PAYMENT', 'Thanh toán toàn bộ dư nợ mỗi kỳ'],
        ['MINIMUM_PAYMENT', 'Thường thanh toán mức tối thiểu'],
        ['SOMETIMES_LATE', 'Đôi khi thanh toán trễ hạn'],
        ['NOT_SURE', 'Chưa muốn chia sẻ'],
      ]),
      conditionalLogic: whenYes('q_has_credit_card'),
    },
    // Điều kiện tài chính
    qOccupation(),
    qOccupationOther(),
    qIncomeLevel(),
    qIncomeMethod(false),
    qIncomeProof(),
    // Hồ sơ
    {
      code: 'q_prepared_documents',
      questionText: 'Hồ sơ khách hàng có thể chuẩn bị',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['ID_CARD', 'CCCD gắn chip'],
        ['RESIDENCE', 'Thông tin cư trú (VNeID / xác nhận cư trú)'],
        ['INCOME_DOCS', 'Chứng từ thu nhập (sao kê lương, HĐLĐ)'],
        ['EXISTING_CARD_STATEMENT', 'Sao kê thẻ tín dụng hiện có (mở thẻ theo thẻ)'],
        ['BUSINESS_DOCS', 'Giấy phép kinh doanh'],
        ['NONE', 'Chưa chuẩn bị'],
      ]),
    },
    {
      code: 'q_card_opening_timing',
      questionText: 'Khách hàng muốn mở thẻ khi nào?',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['WITHIN_1_WEEK', 'Trong vòng 1 tuần'],
        ['WITHIN_1_MONTH', 'Trong vòng 1 tháng'],
        ['FLEXIBLE', 'Chưa gấp / linh hoạt'],
      ]),
    },
    qNextStep(),
    qContactTime(),
    qAdvisorNotes(),
  ]),
};

// ---------------------------------------------------------------------------
// BỘ 5 — Khảo sát đáo hạn, tái cấp vốn và gom nợ
// ---------------------------------------------------------------------------
const REFINANCE: SeedQuestionnaire = {
  code: 'KTEA_NEEDS_REFINANCE',
  title: 'Khảo sát đáo hạn, tái cấp vốn và gom nợ',
  description:
    'Khảo sát tình hình các khoản vay hiện tại để tư vấn phương án đáo hạn, chuyển khoản vay, gom nợ hoặc cơ cấu lại kỳ hạn phù hợp. ' +
    SECURITY_NOTE,
  questions: ordered([
    // Nhu cầu
    {
      code: 'q_support_need',
      questionText: 'Khách hàng cần hỗ trợ điều gì?',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['MATURITY', 'Đáo hạn khoản vay sắp đến hạn'],
        ['REFINANCE_LOWER_RATE', 'Chuyển khoản vay sang nơi có lãi suất tốt hơn'],
        ['DEBT_CONSOLIDATION', 'Gom nhiều khoản nợ thành một khoản'],
        ['REDUCE_PAYMENT', 'Giảm số tiền trả hàng tháng (kéo dài thời hạn)'],
        ['TOP_UP', 'Vay thêm trên tài sản đang thế chấp'],
        ['NOT_SURE', 'Chưa xác định, cần tư vấn'],
      ]),
    },
    // Khoản vay hiện tại
    {
      code: 'q_current_loan_types',
      questionText: 'Loại khoản vay khách hàng đang có',
      questionType: 'MULTIPLE_CHOICE',
      isRequired: true,
      options: options([
        ['SECURED_PROPERTY', 'Vay thế chấp nhà đất'],
        ['SECURED_VEHICLE', 'Vay mua / thế chấp ô tô'],
        ['UNSECURED_BANK', 'Vay tín chấp ngân hàng'],
        ['CONSUMER_FINANCE', 'Vay công ty tài chính tiêu dùng'],
        ['CREDIT_CARD', 'Dư nợ thẻ tín dụng'],
        ['OTHER', 'Khác'],
      ]),
      validationConfig: { minSelect: 1 },
    },
    {
      code: 'q_current_lender_types',
      questionText: 'Đơn vị cho vay hiện tại thuộc loại nào?',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['BANK', 'Ngân hàng'],
        ['FINANCE_COMPANY', 'Công ty tài chính'],
        ['OTHER_INSTITUTION', 'Tổ chức tín dụng khác'],
        ['OTHER', 'Khác'],
      ]),
    },
    {
      code: 'q_current_lender_names',
      questionText: 'Tên ngân hàng / công ty tài chính đang vay (nếu khách hàng tiện chia sẻ)',
      description: 'Chỉ ghi tên đơn vị. Không ghi số tài khoản, số hợp đồng hay thông tin đăng nhập.',
      questionType: 'TEXT',
      validationConfig: { maxLength: 255 },
    },
    {
      code: 'q_current_debt_count',
      questionText: 'Số khoản nợ cần gom',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['TWO', '2 khoản'],
        ['THREE_TO_FOUR', '3–4 khoản'],
        ['FIVE_OR_MORE', 'Từ 5 khoản trở lên'],
      ]),
      conditionalLogic: whenEquals('q_support_need', 'DEBT_CONSOLIDATION'),
    },
    {
      code: 'q_outstanding_balance',
      questionText: 'Tổng dư nợ hiện tại (VNĐ, ước tính)',
      description: 'Không bắt buộc; có thể để trống nếu khách hàng chưa nắm rõ.',
      questionType: 'CURRENCY',
      validationConfig: { min: 0 },
    },
    {
      code: 'q_current_monthly_payment',
      questionText: 'Tổng số tiền đang phải trả mỗi tháng (VNĐ, ước tính)',
      questionType: 'CURRENCY',
      validationConfig: { min: 0 },
    },
    {
      code: 'q_current_interest_rate',
      questionText: 'Lãi suất hiện tại (%/năm, nếu biết)',
      questionType: 'NUMBER',
      validationConfig: { min: 0, max: 100, step: 0.01 },
    },
    {
      code: 'q_maturity_timing',
      questionText: 'Thời điểm đến hạn của khoản vay cần xử lý',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['OVERDUE', 'Đã quá hạn'],
        ['WITHIN_7_DAYS', 'Trong 7 ngày tới'],
        ['WITHIN_30_DAYS', 'Trong 30 ngày tới'],
        ['WITHIN_3_MONTHS', 'Trong 1–3 tháng tới'],
        ['OVER_3_MONTHS', 'Sau 3 tháng'],
        ['NO_FIXED_DATE', 'Trả góp hàng tháng, không có ngày đáo hạn cụ thể'],
      ]),
    },
    {
      code: 'q_maturity_date',
      questionText: 'Ngày đến hạn cụ thể (nếu biết)',
      questionType: 'DATE',
      conditionalLogic: whenNotEquals('q_maturity_timing', 'NO_FIXED_DATE'),
    },
    // Khả năng trả nợ
    {
      code: 'q_repayment_ability',
      questionText: 'Khả năng trả nợ hiện tại của khách hàng',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: options([
        ['STABLE', 'Vẫn trả đúng hạn, ổn định'],
        ['STRAINED', 'Trả được nhưng áp lực tài chính lớn'],
        ['AT_RISK', 'Có nguy cơ trễ hạn trong thời gian tới'],
        ['LATE', 'Đang trễ hạn'],
      ]),
    },
    {
      code: 'q_overdue_days',
      questionText: 'Số ngày đang trễ hạn',
      questionType: 'SINGLE_CHOICE',
      options: options([
        ['UNDER_10', 'Dưới 10 ngày'],
        ['10_TO_30', 'Từ 10 đến 30 ngày'],
        ['31_TO_90', 'Từ 31 đến 90 ngày'],
        ['OVER_90', 'Trên 90 ngày'],
      ]),
      conditionalLogic: whenEquals('q_repayment_ability', 'LATE'),
    },
    qOccupation(),
    qOccupationOther(),
    qIncomeLevel(),
    qIncomeProof(false),
    {
      code: 'q_difficulties',
      questionText: 'Khó khăn khách hàng đang gặp phải',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['HIGH_INTEREST', 'Lãi suất cao'],
        ['HIGH_MONTHLY_PAYMENT', 'Số tiền trả hàng tháng quá lớn'],
        ['SHORT_MATURITY', 'Sắp đến hạn nhưng chưa thu xếp đủ tiền'],
        ['INCOME_DECREASED', 'Thu nhập giảm'],
        ['TOO_MANY_LOANS', 'Có quá nhiều khoản vay, khó quản lý'],
        ['CREDIT_HISTORY', 'Lịch sử tín dụng (CIC) bị ảnh hưởng'],
        ['OTHER', 'Khác'],
        ['NONE', 'Không có khó khăn đáng kể'],
      ]),
    },
    // Tài sản bảo đảm
    {
      code: 'q_has_collateral',
      questionText: 'Khách hàng có tài sản bảo đảm (đang thế chấp hoặc có thể dùng để thế chấp) không?',
      questionType: 'YES_NO',
      isRequired: true,
    },
    qCollateralType(false, [
      ['REAL_ESTATE', 'Nhà ở / đất / căn hộ'],
      ['VEHICLE', 'Ô tô'],
      ['SAVINGS', 'Sổ tiết kiệm / giấy tờ có giá'],
      ['OTHER', 'Tài sản khác'],
    ]),
    qCollateralValue(),
    qTenureMonths(360, 'Thời hạn mong muốn cho khoản vay mới (tháng)'),
    // Hồ sơ
    {
      code: 'q_prepared_documents',
      questionText: 'Giấy tờ khách hàng có thể cung cấp',
      questionType: 'MULTIPLE_CHOICE',
      options: options([
        ['ID_CARD', 'CCCD gắn chip'],
        ['LOAN_CONTRACT', 'Hợp đồng tín dụng hiện tại'],
        ['REPAYMENT_SCHEDULE', 'Lịch trả nợ / xác nhận dư nợ'],
        ['INCOME_DOCS', 'Chứng từ thu nhập'],
        ['COLLATERAL_DOCS', 'Giấy tờ tài sản bảo đảm'],
        ['NONE', 'Chưa chuẩn bị'],
      ]),
    },
    // Bước tiếp theo
    {
      code: 'q_wants_alternative_advice',
      questionText: 'Khách hàng có muốn được tư vấn phương án thay thế phù hợp (tái cấp vốn, gom nợ, cơ cấu lại kỳ hạn) không?',
      questionType: 'YES_NO',
      isRequired: true,
    },
    qNextStep(),
    qContactTime(),
    qAdvisorNotes(),
  ]),
};

export const NEEDS_ASSESSMENT_QUESTIONNAIRES: SeedQuestionnaire[] = [
  LOAN_GENERAL,
  SECURED_LOAN,
  UNSECURED_LOAN,
  CREDIT_CARD,
  REFINANCE,
];
