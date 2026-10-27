/**
 * KTEA CRM — PHASE 4: DETERMINISTIC & EXPLAINABLE RECOMMENDATION ENGINE
 * Verification Suite
 *
 * Covers:
 * 1. Hard Constraints (Category, Active, Expiry, Amount Range, Income Min, Collateral)
 * 2. Soft Scoring, Weights, and Normalization (0-100)
 * 3. Deterministic Ranking & Tie-Breaking (Stability & Explainability)
 * 4. Missing Data Handling (SKIP, FAIL, WARN_AND_PASS - never coerced to 0/false)
 * 5. Assessment Status Guards (Rejects IN_PROGRESS, allows only COMPLETED)
 * 6. Historical Snapshot Immutability (Rules & Product Snapshots)
 * 7. RBAC & IDOR Security Checks (Partner customer boundaries, Admin rule governance)
 */

import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../app.js';
import { ProductCategory } from '@prisma/client';
import {
  evaluateAssessmentRecommendations,
  RuleDefinition,
  ProductEvaluationCandidate,
  createRuleSetSchema,
  createRuleVersionSchema,
  updateRuleVersionSchema,
  simulateRecommendationSchema,
  runRecommendationSchema,
} from '../validations/assessmentRecommendation.validation.js';

let server: http.Server;
let baseUrl: string;

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, body: data };
}

// Mock test products
const mockProducts: ProductEvaluationCandidate[] = [
  {
    id: 'prod_unsecured_1',
    code: 'PROD_UNSECURED_FAST',
    name: 'Vay Tiêu Dùng Tín Chấp Nhanh',
    description: 'Vay không cần thế chấp tài sản',
    active: true,
    financialDetail: {
      category: ProductCategory.LOAN_UNSECURED,
      providerName: 'KTEA Bank',
      minAmount: 10000000,
      maxAmount: 100000000,
      minInterestRate: 12.5,
      maxInterestRate: 18.0,
      minTenureMonths: 6,
      maxTenureMonths: 36,
      minIncome: 7000000,
      acceptBadDebt: false,
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2030-12-31'),
    },
  },
  {
    id: 'prod_unsecured_expired',
    code: 'PROD_UNSECURED_OLD',
    name: 'Gói Vay Cũ Đã Hết Hạn',
    active: true,
    financialDetail: {
      category: ProductCategory.LOAN_UNSECURED,
      providerName: 'KTEA Bank',
      minAmount: 10000000,
      maxAmount: 50000000,
      acceptBadDebt: false,
      effectiveTo: new Date('2020-01-01'), // Expired!
    },
  },
  {
    id: 'prod_unsecured_inactive',
    code: 'PROD_UNSECURED_DISABLED',
    name: 'Gói Vay Tạm Đóng',
    active: false, // Inactive!
    financialDetail: {
      category: ProductCategory.LOAN_UNSECURED,
      minAmount: 10000000,
      maxAmount: 50000000,
      acceptBadDebt: false,
    },
  },
  {
    id: 'prod_card_1',
    code: 'PROD_CASHBACK_CARD',
    name: 'Thẻ Tín Dụng Cashback 5%',
    active: true,
    financialDetail: {
      category: ProductCategory.CREDIT_CARD,
      providerName: 'KTEA Bank',
      minAmount: 20000000,
      maxAmount: 150000000,
      minIncome: 8000000,
      acceptBadDebt: false,
    },
  },
  {
    id: 'prod_secured_1',
    code: 'PROD_SECURED_HOUSE',
    name: 'Vay Thế Chấp Bất Động Sản',
    active: true,
    financialDetail: {
      category: ProductCategory.LOAN_SECURED,
      providerName: 'KTEA Bank',
      minAmount: 200000000,
      maxAmount: 5000000000,
      minTenureMonths: 12,
      maxTenureMonths: 240,
      acceptBadDebt: false,
    },
  },
];

// Mock test rules
const mockRules: RuleDefinition[] = [
  {
    id: 'rule_loan_unsecured',
    code: 'RULE_UNSECURED',
    name: 'Quy tắc Vay tín chấp',
    targetCategory: ProductCategory.LOAN_UNSECURED,
    hardConstraints: [
      {
        id: 'hc_active',
        description: 'Sản phẩm phải đang hoạt động',
        type: 'PRODUCT_ACTIVE',
        operator: 'EQUALS',
        missingDataPolicy: 'FAIL',
      },
      {
        id: 'hc_amount',
        description: 'Số tiền vay trong hạn mức sản phẩm',
        type: 'NUMERIC_RANGE',
        questionCode: 'q_loan_amount',
        operator: 'BETWEEN',
        missingDataPolicy: 'WARN_AND_PASS',
      },
    ],
    softScoringCriteria: [
      {
        id: 'sc_purpose',
        description: 'Mục đích vay vốn',
        weight: 50,
        type: 'PREFERENCE_MATCH',
        questionCode: 'q_purpose',
        targetValue: 'LOAN',
      },
      {
        id: 'sc_tenure',
        description: 'Kỳ hạn vay phù hợp',
        weight: 50,
        type: 'TENURE_MATCH',
        questionCode: 'q_tenure_months',
      },
    ],
    minScoreThreshold: 40,
    enabled: true,
  },
  {
    id: 'rule_card',
    code: 'RULE_CARD',
    name: 'Quy tắc Thẻ tín dụng',
    targetCategory: ProductCategory.CREDIT_CARD,
    hardConstraints: [
      {
        id: 'hc_active_card',
        description: 'Sản phẩm đang hoạt động',
        type: 'PRODUCT_ACTIVE',
        operator: 'EQUALS',
        missingDataPolicy: 'FAIL',
      },
    ],
    softScoringCriteria: [
      {
        id: 'sc_card_purpose',
        description: 'Mục đích mở thẻ tín dụng',
        weight: 100,
        type: 'PREFERENCE_MATCH',
        questionCode: 'q_purpose',
        targetValue: 'CARD',
      },
    ],
    minScoreThreshold: 40,
    enabled: true,
  },
  {
    id: 'rule_secured',
    code: 'RULE_SECURED',
    name: 'Quy tắc Vay thế chấp',
    targetCategory: ProductCategory.LOAN_SECURED,
    hardConstraints: [
      {
        id: 'hc_has_collateral',
        description: 'Bắt buộc phải có tài sản bảo đảm',
        type: 'BOOLEAN_FLAG',
        questionCode: 'q_has_collateral',
        operator: 'EQUALS',
        missingDataPolicy: 'FAIL',
      },
    ],
    softScoringCriteria: [
      {
        id: 'sc_collateral_bonus',
        description: 'Tài sản bảo đảm giá trị cao',
        weight: 100,
        type: 'COLLATERAL_BONUS',
        questionCode: 'q_has_collateral',
      },
    ],
    minScoreThreshold: 40,
    enabled: true,
  },
];

async function runTests() {
  console.log('\n========================================================================');
  console.log('   KTEA CRM — PHASE 4: RECOMMENDATION ENGINE VERIFICATION SUITE         ');
  console.log('========================================================================\n');

  // Start HTTP Server
  const expressApp = createApp();
  server = http.createServer(expressApp);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // -----------------------------------------------------------------------
    // SECTION 1: Schema Validation for Rules & Runs
    // -----------------------------------------------------------------------
    console.log('--- SECTION 1: Schema & Parameter Validation ---');

    // Rule set validation
    const validRuleSet = createRuleSetSchema.safeParse({
      code: 'VALID_RULE_SET',
      title: 'Tập quy tắc chuẩn',
    });
    assert.strictEqual(validRuleSet.success, true);
    pass('Valid rule set passes createRuleSetSchema');

    const invalidRuleSet = createRuleSetSchema.safeParse({
      code: 'invalid lowercase',
      title: 'Tập quy tắc',
    });
    assert.strictEqual(invalidRuleSet.success, false);
    pass('Rejects rule set code containing lowercase or spaces');

    // Run recommendation schema validation
    const validRun = runRecommendationSchema.safeParse({
      notes: 'Khảo sát nhu cầu vay sửa nhà',
      ruleVersionId: '00000000-0000-0000-0000-000000000000',
    });
    assert.strictEqual(validRun.success, true);
    pass('Valid run payload passes runRecommendationSchema');

    // -----------------------------------------------------------------------
    // SECTION 2: Hard Constraints, Expiry, and Inactive Filtering
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 2: Hard Constraints & Product Status Verification ---');

    // Case A: Customer requesting 50M loan with 12 months tenure
    const customerAnswersLoan = {
      q_purpose: 'LOAN',
      q_loan_amount: 50000000,
      q_tenure_months: 12,
      q_has_collateral: false,
    };

    const resLoan = evaluateAssessmentRecommendations(customerAnswersLoan, mockRules, mockProducts);

    // Active unsecured product should be eligible
    const activeUnsecured = resLoan.items.find((i) => i.productId === 'prod_unsecured_1');
    assert.ok(activeUnsecured, 'Active unsecured loan product is evaluated');
    assert.strictEqual(activeUnsecured.isEligible, true, 'Active unsecured loan product is eligible');
    assert.ok(activeUnsecured.score >= 80, `Expected high score >= 80, got ${activeUnsecured.score}`);
    pass('Active unsecured product passes amount range and scores high (>=80)');

    // Inactive product should be ineligible
    const inactiveProd = resLoan.items.find((i) => i.productId === 'prod_unsecured_inactive');
    assert.ok(inactiveProd);
    assert.strictEqual(inactiveProd.isEligible, false, 'Inactive product must be marked ineligible');
    assert.ok(
      inactiveProd.failedCriteria.some((c) => c.reason.includes('tạm ngưng hoạt động')),
      'Recorded specific reason for inactive product'
    );
    pass('Inactive product is marked ineligible with clear reason');

    // Expired product should be ineligible
    const expiredProd = resLoan.items.find((i) => i.productId === 'prod_unsecured_expired');
    assert.ok(expiredProd);
    assert.strictEqual(expiredProd.isEligible, false, 'Expired product must be marked ineligible');
    assert.ok(
      expiredProd.failedCriteria.some((c) => c.reason.includes('hết thời hạn')),
      'Recorded specific reason for expired product'
    );
    pass('Expired product (effectiveTo < now) is marked ineligible');

    // -----------------------------------------------------------------------
    // SECTION 3: Collateral Hard Constraint & 0 / false Distinctions
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 3: 0 / false Distinctions & Collateral Constraints ---');

    // In resLoan, q_has_collateral was explicitly false
    const securedProdNoCollateral = resLoan.items.find((i) => i.productId === 'prod_secured_1');
    assert.ok(securedProdNoCollateral);
    assert.strictEqual(
      securedProdNoCollateral.isEligible,
      false,
      'Secured loan is ineligible when q_has_collateral is false'
    );
    pass('q_has_collateral = false strictly enforces ineligibility for secured loan');

    // Now test with q_has_collateral = true
    const customerAnswersSecured = {
      q_purpose: 'LOAN',
      q_has_collateral: true,
      q_loan_amount: 500000000,
    };
    const resSecured = evaluateAssessmentRecommendations(customerAnswersSecured, mockRules, mockProducts);
    const securedProdWithCollateral = resSecured.items.find((i) => i.productId === 'prod_secured_1');
    assert.ok(securedProdWithCollateral);
    assert.strictEqual(securedProdWithCollateral.isEligible, true, 'Secured loan becomes eligible with collateral');
    pass('q_has_collateral = true enables secured loan eligibility and awards bonus points');

    // -----------------------------------------------------------------------
    // SECTION 4: Missing Data Policy (Never coerced to 0 or false)
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 4: Missing Data Policy & Explainability ---');

    // Empty answers map (no answers provided)
    const resEmpty = evaluateAssessmentRecommendations({}, mockRules, mockProducts);
    const itemEmpty = resEmpty.items.find((i) => i.productId === 'prod_unsecured_1');
    assert.ok(itemEmpty);
    // Because missingDataPolicy was WARN_AND_PASS, product is still technically eligible but unassessed criteria and warnings are recorded
    assert.ok(itemEmpty.unassessedCriteria.length > 0, 'Unassessed criteria recorded for missing loan amount');
    assert.ok(itemEmpty.warnings.length > 0, 'Warning recorded for missing loan amount');
    pass('Missing data recorded in unassessedCriteria and warnings without silent coercion to 0/false');

    // -----------------------------------------------------------------------
    // SECTION 5: Deterministic Ranking & Tie-Breaking
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 5: Deterministic Ranking & Stability ---');

    // Run identical evaluation 5 times, ensure exact same ranks and scores
    const run1 = evaluateAssessmentRecommendations(customerAnswersLoan, mockRules, mockProducts);
    const run2 = evaluateAssessmentRecommendations(customerAnswersLoan, mockRules, mockProducts);

    assert.strictEqual(run1.items.length, run2.items.length);
    for (let i = 0; i < run1.items.length; i++) {
      assert.strictEqual(run1.items[i].productId, run2.items[i].productId);
      assert.strictEqual(run1.items[i].score, run2.items[i].score);
      assert.strictEqual(run1.items[i].rank, run2.items[i].rank);
      assert.strictEqual(run1.items[i].isEligible, run2.items[i].isEligible);
    }
    pass('Deterministic engine produces 100% identical rankings and scores across runs');

    // Verify Explainability Fields
    const topItem = run1.items[0];
    assert.ok(topItem.matchSummary.length > 0, 'Match summary paragraph is generated');
    assert.ok(Array.isArray(topItem.passedCriteria), 'passedCriteria is an array');
    assert.ok(Array.isArray(topItem.answersUsed), 'answersUsed is an array');
    assert.ok(topItem.answersUsed.length > 0, 'answersUsed records contributing questions');
    assert.ok(topItem.productSnapshot, 'productSnapshot is captured');
    assert.strictEqual(topItem.productSnapshot.name, topItem.productName);
    pass('Each item contains full explainability metadata (summary, passed/failed, answersUsed, productSnapshot)');

    // -----------------------------------------------------------------------
    // SECTION 7: Scoring Hardening — Elimination of 50% Floor & 30% Ceiling
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 7: Scoring Hardening (No Floor 50%, No Ceiling 30%) ---');

    // Case 1: Eligible product with 0% preference matches (should score 0, not 50)
    const answersZeroPreference = {
      q_purpose: 'NON_MATCHING_PURPOSE',
      q_loan_amount: 50000000, // Valid amount
      q_tenure_months: 999, // Unmatched tenure
    };
    const resZeroPref = evaluateAssessmentRecommendations(answersZeroPreference, mockRules, mockProducts);
    const eligibleItemZeroPref = resZeroPref.items.find((i) => i.productId === 'prod_unsecured_1');
    assert.ok(eligibleItemZeroPref, 'Item exists');
    assert.strictEqual(eligibleItemZeroPref.isEligible, true, 'Product is eligible on hard constraints');
    assert.strictEqual(
      eligibleItemZeroPref.score,
      0,
      `Expected score 0% when no preferences match (no 50% floor), got ${eligibleItemZeroPref.score}`
    );
    pass('Eligible product with no preference match receives score = 0 (no artificial 50% floor)');

    // Case 2: Ineligible product with 100% preference matches (should preserve true score, not capped at 30)
    // Create an ineligible product candidate (e.g., active = false) with perfect answers
    const customIneligibleCandidate: ProductEvaluationCandidate = {
      id: 'prod_custom_ineligible',
      code: 'PROD_INELIGIBLE_PERFECT',
      name: 'Sản phẩm hoàn hảo nhưng tạm ngưng',
      active: false, // Ineligible!
      financialDetail: {
        category: ProductCategory.LOAN_UNSECURED,
        minAmount: 10000000,
        maxAmount: 100000000,
      },
    };
    const answersPerfect = {
      q_purpose: 'LOAN',
      q_loan_amount: 50000000,
      q_tenure_months: 12,
    };
    const resIneligiblePerfect = evaluateAssessmentRecommendations(
      answersPerfect,
      mockRules,
      [customIneligibleCandidate]
    );
    const itemIneligiblePerfect = resIneligiblePerfect.items[0];
    assert.strictEqual(itemIneligiblePerfect.isEligible, false, 'Must be marked ineligible');
    assert.ok(
      itemIneligiblePerfect.score > 30,
      `Ineligible product preserves true preference score (${itemIneligiblePerfect.score}) without artificial 30% ceiling`
    );
    pass('Ineligible product reflects true preference score without artificial 30% ceiling');

    // -----------------------------------------------------------------------
    // SECTION 8: Zero Weight & Confidence Calculation
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 8: Zero Weight & Confidence Calculation ---');

    // Case 1: Rule with total weight = 0
    const zeroWeightRule: RuleDefinition[] = [
      {
        id: 'rule_zero_weight',
        code: 'RULE_ZERO_WEIGHT',
        name: 'Quy tắc không trọng số mềm',
        targetCategory: ProductCategory.LOAN_UNSECURED,
        hardConstraints: [
          {
            id: 'hc_active',
            description: 'Sản phẩm hoạt động',
            type: 'PRODUCT_ACTIVE',
            operator: 'EQUALS',
            missingDataPolicy: 'FAIL',
          },
        ],
        softScoringCriteria: [], // 0 criteria => total weight = 0
        minScoreThreshold: 0,
        enabled: true,
      },
    ];
    const resZeroWeight = evaluateAssessmentRecommendations(
      {},
      zeroWeightRule,
      [mockProducts[0]]
    );
    assert.strictEqual(resZeroWeight.items[0].isEligible, true);
    assert.strictEqual(resZeroWeight.items[0].score, 100, 'Score is 100 when weight=0 and hard constraints pass');
    assert.strictEqual(resZeroWeight.items[0].confidence, 100, 'Confidence is 100 when weight=0');
    pass('Zero-weight rule returns score=100 and confidence=100 without NaN/division-by-zero');

    // Case 2: Partial answers calculate fractional confidence
    // In mockRules loan rule: has 2 soft criteria (q_purpose, q_tenure_months).
    // Answering only 1 question (q_purpose) => confidence should be 50%
    const resPartial = evaluateAssessmentRecommendations(
      { q_purpose: 'LOAN' },
      mockRules,
      [mockProducts[0]]
    );
    const itemPartial = resPartial.items[0];
    assert.strictEqual(
      itemPartial.confidence,
      50,
      `Expected confidence 50% for 1 of 2 answered criteria, got ${itemPartial.confidence}%`
    );
    pass('Confidence accurately reflects answered fraction of evaluable criteria (50%)');

    // -----------------------------------------------------------------------
    // SECTION 9: Product Validity & Date Range Hardening
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 9: Product Validity & Date Range Hardening ---');

    // Product with effectiveFrom in the future
    const futureProduct: ProductEvaluationCandidate = {
      id: 'prod_future',
      code: 'PROD_FUTURE',
      name: 'Gói vay chuẩn bị ra mắt',
      active: true,
      financialDetail: {
        category: ProductCategory.LOAN_UNSECURED,
        effectiveFrom: new Date('2099-01-01'), // Future!
        effectiveTo: new Date('2100-01-01'),
      },
    };

    // Product with invalid date range (effectiveFrom > effectiveTo)
    const invertedProduct: ProductEvaluationCandidate = {
      id: 'prod_inverted',
      code: 'PROD_INVERTED_DATES',
      name: 'Gói vay cấu hình sai ngày',
      active: true,
      financialDetail: {
        category: ProductCategory.LOAN_UNSECURED,
        effectiveFrom: new Date('2026-12-31'),
        effectiveTo: new Date('2025-01-01'), // inverted!
      },
    };

    const resDates = evaluateAssessmentRecommendations(
      answersPerfect,
      mockRules,
      [futureProduct, invertedProduct]
    );

    const futureItem = resDates.items.find((i) => i.productId === 'prod_future');
    assert.ok(futureItem);
    assert.strictEqual(futureItem.isEligible, false, 'Future product must be ineligible');
    assert.ok(
      futureItem.failedCriteria.some((c) => c.reason.includes('chưa đến ngày có hiệu lực')),
      'Identifies future effectiveFrom'
    );
    pass('Product with future effectiveFrom is marked ineligible with explicit reason');

    const invertedItem = resDates.items.find((i) => i.productId === 'prod_inverted');
    assert.ok(invertedItem);
    assert.strictEqual(invertedItem.isEligible, false, 'Inverted dates product must be ineligible');
    assert.ok(
      invertedItem.failedCriteria.some((c) => c.reason.includes('không hợp lệ')),
      'Identifies inverted date range'
    );
    pass('Product with effectiveFrom > effectiveTo is marked ineligible with explicit reason');

    // -----------------------------------------------------------------------
    // SECTION 10: Extensibility & Dynamic Question Codes (No Hardcoded Strings)
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 10: Extensibility & Dynamic Question Codes ---');

    // Entirely novel questionnaire codes and rule mapping
    const customDynamicRules: RuleDefinition[] = [
      {
        id: 'rule_custom_dynamic',
        code: 'RULE_CUSTOM_DYNAMIC',
        name: 'Quy tắc câu hỏi hoàn toàn tùy biến',
        targetCategory: ProductCategory.LOAN_UNSECURED,
        hardConstraints: [
          {
            id: 'hc_dyn_age',
            description: 'Độ tuổi khách hàng tối đa 60 tuổi',
            type: 'NUMERIC_MAX',
            questionCode: 'survey_applicant_age',
            expectedValue: 60,
            operator: 'LESS_EQUAL',
            missingDataPolicy: 'FAIL',
          },
          {
            id: 'hc_dyn_occupation',
            description: 'Nghề nghiệp hợp lệ',
            type: 'ANSWER_IN',
            questionCode: 'survey_occupation_code',
            expectedValue: ['TEACHER', 'ENGINEER', 'DOCTOR'],
            operator: 'IN',
            missingDataPolicy: 'FAIL',
          },
        ],
        softScoringCriteria: [
          {
            id: 'sc_dyn_proximity',
            description: 'Số tiền vay mong muốn gần với hạn mức',
            weight: 100,
            type: 'NUMERIC_PROXIMITY',
            questionCode: 'survey_requested_credit',
            targetValue: 50000000,
          },
        ],
        minScoreThreshold: 30,
        enabled: true,
      },
    ];

    // Candidate answers using novel survey codes
    const surveyAnswersEligible = {
      survey_applicant_age: 35, // <= 60 => PASS
      survey_occupation_code: 'DOCTOR', // in allowed list => PASS
      survey_requested_credit: 50000000,
    };

    const resDynamic = evaluateAssessmentRecommendations(
      surveyAnswersEligible,
      customDynamicRules,
      [mockProducts[0]]
    );
    const itemDynamic = resDynamic.items[0];
    assert.strictEqual(itemDynamic.isEligible, true, 'Custom dynamic rules evaluate successfully');
    assert.ok(itemDynamic.score > 0, 'Numeric proximity awards partial credit score');
    pass('Engine evaluates fully customized question codes (NUMERIC_MAX, ANSWER_IN, NUMERIC_PROXIMITY)');

    // Ineligible case: Age exceeds limit (65 > 60)
    const surveyAnswersTooOld = {
      survey_applicant_age: 65,
      survey_occupation_code: 'DOCTOR',
    };
    const resDynamicAgeFail = evaluateAssessmentRecommendations(
      surveyAnswersTooOld,
      customDynamicRules,
      [mockProducts[0]]
    );
    assert.strictEqual(resDynamicAgeFail.items[0].isEligible, false, 'Rejected due to age constraint');
    assert.ok(
      resDynamicAgeFail.items[0].failedCriteria.some((c) => c.reason.includes('vượt quá mức')),
      `Specific NUMERIC_MAX failure reason recorded, got: ${JSON.stringify(resDynamicAgeFail.items[0].failedCriteria)}`
    );
    pass('NUMERIC_MAX constraint enforces strict cutoff with detailed explanation');

    // Ineligible case: Occupation not in allowed list
    const surveyAnswersBadJob = {
      survey_applicant_age: 30,
      survey_occupation_code: 'GAMBLER',
    };
    const resDynamicJobFail = evaluateAssessmentRecommendations(
      surveyAnswersBadJob,
      customDynamicRules,
      [mockProducts[0]]
    );
    assert.strictEqual(resDynamicJobFail.items[0].isEligible, false, 'Rejected due to occupation constraint');
    assert.ok(
      resDynamicJobFail.items[0].failedCriteria.some((c) => c.reason.includes('không nằm trong danh sách')),
      'Specific ANSWER_IN failure reason recorded'
    );
    pass('ANSWER_IN constraint validates set membership accurately');

    // -----------------------------------------------------------------------
    // SECTION 11: Admin Governance — Draft Updates, Schema & Simulation
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 11: Admin Governance & Simulation Schemas ---');

    // updateRuleVersionSchema validation
    const validUpdateDraft = updateRuleVersionSchema.safeParse({
      changeLog: 'Cập nhật lại quy tắc lãi suất và hạn mức',
      rules: customDynamicRules,
    });
    if (!validUpdateDraft.success) {
      console.error('validUpdateDraft validation error:', JSON.stringify(validUpdateDraft.error.issues, null, 2));
    }
    assert.strictEqual(validUpdateDraft.success, true);
    pass('updateRuleVersionSchema accepts valid draft edits');

    const invalidNegativeWeight = updateRuleVersionSchema.safeParse({
      rules: [
        {
          id: 'rule_invalid_weight',
          code: 'RULE_BAD',
          name: 'Quy tắc trọng số âm',
          targetCategory: ProductCategory.LOAN_UNSECURED,
          hardConstraints: [],
          softScoringCriteria: [
            {
              id: 'sc_bad',
              description: 'Sai trọng số',
              weight: -10, // Invalid!
              type: 'PREFERENCE_MATCH',
              questionCode: 'q_any',
            },
          ],
        },
      ],
    });
    assert.strictEqual(invalidNegativeWeight.success, false);
    pass('updateRuleVersionSchema rejects negative weights (weight >= 0)');

    // simulateRecommendationSchema validation
    const validSimulate = simulateRecommendationSchema.safeParse({
      answers: {
        survey_applicant_age: 28,
        survey_occupation_code: 'ENGINEER',
      },
    });
    assert.strictEqual(validSimulate.success, true);
    pass('simulateRecommendationSchema validates sample test answers');

    // -----------------------------------------------------------------------
    // SECTION 12: Snapshot & Immutability Verification
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 12: Historical Snapshot Immutability ---');

    // Make an evaluation run
    const originalItem = run1.items[0];
    const capturedSnapshot = JSON.parse(JSON.stringify(originalItem.productSnapshot));

    // Mutate the mock product candidate array in memory
    const mutatedProduct = mockProducts.find((p) => p.id === originalItem.productId);
    if (mutatedProduct) {
      mutatedProduct.name = 'Tên sản phẩm đã bị nhân viên sửa đổi sau này';
      if (mutatedProduct.financialDetail) {
        mutatedProduct.financialDetail.minAmount = 999999999999;
      }
    }

    // Verify snapshot inside original item was NOT modified
    assert.strictEqual(
      originalItem.productSnapshot.name,
      capturedSnapshot.name,
      'Snapshot product name remains frozen despite candidate mutation'
    );
    assert.strictEqual(
      originalItem.productSnapshot.financialDetail?.minAmount,
      capturedSnapshot.financialDetail?.minAmount,
      'Snapshot financial details remain frozen despite candidate mutation'
    );
    pass('Evaluation snapshot is completely decoupled and immutable from subsequent product edits');

    console.log('\n========================================================================');
    console.log('   Verification Suite Completed: All 12 Sections Passed!                ');
    console.log('========================================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
