/**
 * verify-customer-requests-3-features.ts
 *
 * Comprehensive automated verification suite for the 3 customer requirements:
 * 1. Condition Groups (AND / OR) in Condition Configuration (flat + nested groups + IN/NOT_IN parsing + validation).
 * 2. Product Registration Links (`registrationUrl` / `officialUrl` validation & payload preservation).
 * 3. Unlimited Matching Products (5 and 10 matching products returned in priority order across Akinator Engine & CRM Rule Engine).
 *
 * Note: This test suite runs 100% in-memory against the actual production engine & validation schemas
 * without mutating any production database records.
 */

import assert from 'node:assert/strict';
import {
  evaluateSingleCondition,
  evaluateConditionGroup,
  evaluateAkinatorRules,
  validateAkinatorConfigIntegrity,
  parseConditionListValue,
  AkinatorQuestionDef,
  AkinatorRuleDef,
  AkinatorAnsweredRecord,
  AkinatorConditionGroup,
} from '../services/akinatorEngine.service.js';
import {
  akinatorConditionGroupSchema,
  akinatorRuleOutcomePayloadSchema,
  akinatorRuleInputSchema,
} from '../validations/akinator.validation.js';
import { financialDetailInputSchema } from '../validations/product.validation.js';
import { RuleBasedRecommendationEngine } from '../engine/ruleEngine.js';
import { AkinatorQuestionType, PriorityLevel, Product } from '@prisma/client';

let passedCount = 0;
function runTest(name: string, fn: () => void) {
  fn();
  passedCount++;
  console.log(`✅ [PASS] ${name}`);
}

console.log('================================================================================');
console.log('VERIFYING 3 CUSTOMER REQUIREMENTS: CONDITION GROUPS, REGISTRATION URL & UNLIMITED PRODUCTS');
console.log('================================================================================\n');

// ============================================================================
// 1. CONDITION GROUPS (AND / OR) & BACKWARD COMPATIBILITY
// ============================================================================

runTest('1.1 Backward compatibility: Single flat conditions with AND / OR', () => {
  const answers = new Map<string, any>([
    ['Q_INCOME', 12000000],
    ['Q_BAD_DEBT', 'NONE'],
  ]);

  const flatAndMatch: AkinatorConditionGroup = {
    logic: 'AND',
    conditions: [
      { questionCode: 'Q_INCOME', operator: 'GTE', value: 10000000 },
      { questionCode: 'Q_BAD_DEBT', operator: 'EQUALS', value: 'NONE' },
    ],
  };
  assert.equal(evaluateConditionGroup(flatAndMatch, answers), true);

  const flatAndFail: AkinatorConditionGroup = {
    logic: 'AND',
    conditions: [
      { questionCode: 'Q_INCOME', operator: 'GTE', value: 15000000 },
      { questionCode: 'Q_BAD_DEBT', operator: 'EQUALS', value: 'NONE' },
    ],
  };
  assert.equal(evaluateConditionGroup(flatAndFail, answers), false);

  const flatOrMatch: AkinatorConditionGroup = {
    logic: 'OR',
    conditions: [
      { questionCode: 'Q_INCOME', operator: 'GTE', value: 15000000 },
      { questionCode: 'Q_BAD_DEBT', operator: 'EQUALS', value: 'NONE' },
    ],
  };
  assert.equal(evaluateConditionGroup(flatOrMatch, answers), true);
});

runTest('1.2 Single Condition Group with OR and AND', () => {
  const answers = new Map<string, any>([
    ['Q_INCOME_TYPE', 'COMPANY_SALARY_TRANSFER'],
  ]);

  const singleOrGroup: AkinatorConditionGroup = {
    logic: 'AND',
    conditions: [],
    groups: [
      {
        id: 'grp_1',
        logic: 'OR',
        conditions: [
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'COMPANY_SALARY_TRANSFER' },
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'COMPANY_SALARY_CASH' },
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'BUSINESS_HOUSEHOLD' },
        ],
      },
    ],
  };
  assert.equal(evaluateConditionGroup(singleOrGroup, answers), true);

  const answersUnemployed = new Map<string, any>([['Q_INCOME_TYPE', 'UNEMPLOYED']]);
  assert.equal(evaluateConditionGroup(singleOrGroup, answersUnemployed), false);
});

runTest('1.3 Multiple Condition Groups combined with outer AND: (A OR B) AND (C AND D)', () => {
  // Real-world loan rule:
  // Group 1 (OR): Q_INCOME_TYPE = COMPANY_SALARY_TRANSFER OR Q_INCOME_TYPE = BUSINESS_HOUSEHOLD
  // Group 2 (AND): Q_INCOME >= 8000000 AND Q_BAD_DEBT = NONE
  const ruleConditions: AkinatorConditionGroup = {
    logic: 'AND',
    conditions: [
      { questionCode: 'Q_PURPOSE', operator: 'IN', value: 'CONSUMER, BUSINESS' },
    ],
    groups: [
      {
        id: 'grp_income_type',
        logic: 'OR',
        conditions: [
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'COMPANY_SALARY_TRANSFER' },
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'BUSINESS_HOUSEHOLD' },
        ],
      },
      {
        id: 'grp_financial',
        logic: 'AND',
        conditions: [
          { questionCode: 'Q_INCOME', operator: 'GTE', value: 8000000 },
          { questionCode: 'Q_BAD_DEBT', operator: 'EQUALS', value: 'NONE' },
        ],
      },
    ],
  };

  const matchingAnswers = new Map<string, any>([
    ['Q_PURPOSE', 'CONSUMER'],
    ['Q_INCOME_TYPE', 'BUSINESS_HOUSEHOLD'],
    ['Q_INCOME', 10000000],
    ['Q_BAD_DEBT', 'NONE'],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, matchingAnswers), true);

  const failingGroup2Answers = new Map<string, any>([
    ['Q_PURPOSE', 'CONSUMER'],
    ['Q_INCOME_TYPE', 'BUSINESS_HOUSEHOLD'],
    ['Q_INCOME', 5000000], // < 8000000
    ['Q_BAD_DEBT', 'NONE'],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, failingGroup2Answers), false);

  const failingGroup1Answers = new Map<string, any>([
    ['Q_PURPOSE', 'CONSUMER'],
    ['Q_INCOME_TYPE', 'UNEMPLOYED'],
    ['Q_INCOME', 15000000],
    ['Q_BAD_DEBT', 'NONE'],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, failingGroup1Answers), false);
});

runTest('1.4 Multiple Condition Groups combined with outer OR: (A AND B) OR (C AND D)', () => {
  // Path 1 (Group 1 - AND): Salary Transfer >= 6,000,000
  // Path 2 (Group 2 - AND): Credit Card Holder with Limit >= 20,000,000
  const ruleConditions: AkinatorConditionGroup = {
    logic: 'OR',
    conditions: [],
    groups: [
      {
        id: 'grp_salary_path',
        logic: 'AND',
        conditions: [
          { questionCode: 'Q_INCOME_TYPE', operator: 'EQUALS', value: 'COMPANY_SALARY_TRANSFER' },
          { questionCode: 'Q_INCOME', operator: 'GTE', value: 6000000 },
        ],
      },
      {
        id: 'grp_card_path',
        logic: 'AND',
        conditions: [
          { questionCode: 'Q_HAS_CARD', operator: 'EQUALS', value: true },
          { questionCode: 'Q_CARD_LIMIT', operator: 'GTE', value: 20000000 },
        ],
      },
    ],
  };

  // Matches via Group 2 even though Group 1 is false
  const cardHolderAnswers = new Map<string, any>([
    ['Q_INCOME_TYPE', 'FREELANCER'],
    ['Q_INCOME', 4000000],
    ['Q_HAS_CARD', true],
    ['Q_CARD_LIMIT', 30000000],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, cardHolderAnswers), true);

  // Matches via Group 1 even though Group 2 is false
  const salaryAnswers = new Map<string, any>([
    ['Q_INCOME_TYPE', 'COMPANY_SALARY_TRANSFER'],
    ['Q_INCOME', 9000000],
    ['Q_HAS_CARD', false],
    ['Q_CARD_LIMIT', 0],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, salaryAnswers), true);

  // Fails both groups
  const neitherAnswers = new Map<string, any>([
    ['Q_INCOME_TYPE', 'FREELANCER'],
    ['Q_INCOME', 4000000],
    ['Q_HAS_CARD', false],
  ]);
  assert.equal(evaluateConditionGroup(ruleConditions, neitherAnswers), false);
});

runTest('1.5 IN and NOT_IN operator parsing for comma-separated strings, JSON arrays, and native arrays', () => {
  assert.deepEqual(parseConditionListValue('LOAN_ONLY, BOTH, ASSESS_BOTH'), [
    'LOAN_ONLY',
    'BOTH',
    'ASSESS_BOTH',
  ]);
  assert.deepEqual(parseConditionListValue('["CARD_ONLY", "BOTH"]'), ['CARD_ONLY', 'BOTH']);
  assert.deepEqual(parseConditionListValue(['A', 'B']), ['A', 'B']);

  const answers = new Map<string, any>([['Q_PRODUCT_NEED', 'BOTH']]);
  assert.equal(
    evaluateSingleCondition(
      { questionCode: 'Q_PRODUCT_NEED', operator: 'IN', value: 'LOAN_ONLY, BOTH, ASSESS_BOTH' },
      answers
    ),
    true
  );
  assert.equal(
    evaluateSingleCondition(
      { questionCode: 'Q_PRODUCT_NEED', operator: 'NOT_IN', value: 'CARD_ONLY, NONE' },
      answers
    ),
    true
  );
});

runTest('1.6 Validation rejects empty condition groups and accepts valid nested groups', () => {
  // Completely empty group object -> rejected
  const emptyResult = akinatorConditionGroupSchema.safeParse({
    logic: 'AND',
    conditions: [],
    groups: [],
  });
  assert.equal(emptyResult.success, false);

  // Sub-group with 0 conditions -> rejected
  const emptySubGroupResult = akinatorConditionGroupSchema.safeParse({
    logic: 'AND',
    conditions: [],
    groups: [{ id: 'g1', logic: 'OR', conditions: [] }],
  });
  assert.equal(emptySubGroupResult.success, false);

  // Valid group with 0 top-level conditions and 2 valid sub-groups -> accepted
  const validGroupsOnly = akinatorConditionGroupSchema.safeParse({
    logic: 'AND',
    conditions: [],
    groups: [
      {
        id: 'g1',
        logic: 'OR',
        conditions: [{ questionCode: 'Q1', operator: 'EQUALS', value: 'A' }],
      },
      {
        id: 'g2',
        logic: 'AND',
        conditions: [{ questionCode: 'Q2', operator: 'GTE', value: 5000000 }],
      },
    ],
  });
  assert.equal(validGroupsOnly.success, true);
});

runTest('1.7 Integrity validator checks question codes inside nested condition groups', () => {
  const integrity = validateAkinatorConfigIntegrity({
    questions: [
      { code: 'Q_ENTRY', active: true, isEntryQuestion: true },
      {
        code: 'Q_SECOND',
        active: true,
        isEntryQuestion: false,
        visibilityConditions: {
          logic: 'AND',
          conditions: [],
          groups: [
            {
              id: 'vg1',
              logic: 'OR',
              conditions: [{ questionCode: 'Q_NON_EXISTENT', operator: 'EQUALS', value: 'YES' }],
            },
          ],
        },
      },
    ],
    rules: [
      {
        code: 'RULE_1',
        active: true,
        conditions: {
          logic: 'AND',
          conditions: [],
          groups: [
            {
              id: 'rg1',
              logic: 'OR',
              conditions: [{ questionCode: 'Q_UNKNOWN_RULE_REF', operator: 'EQUALS', value: '1' }],
            },
          ],
        },
      },
    ],
    requireRules: true,
  });

  assert.equal(integrity.isValid, false);
  assert.equal(
    integrity.errors.some((e) => e.includes('Q_NON_EXISTENT')),
    true
  );
  assert.equal(
    integrity.errors.some((e) => e.includes('Q_UNKNOWN_RULE_REF')),
    true
  );
});

// ============================================================================
// 2. PRODUCT REGISTRATION LINK VALIDATION & PRESERVATION
// ============================================================================

runTest('2.1 Akinator Rule outcomePayload accepts valid http/https registrationUrl and optional empty/null', () => {
  const validHttps = akinatorRuleOutcomePayloadSchema.safeParse({
    categoryCode: 'CAT_SHINHAN',
    categoryLabel: 'Vay tín chấp Shinhan',
    referenceTitle: 'Vay theo lương Shinhan Finance',
    referenceSummary: 'Hạn mức đến 300 triệu VND, giải ngân trong 24h.',
    suggestedDirections: ['Bấm vào nút Đăng ký ngay'],
    cautionNotes: ['Không có nợ xấu'],
    suggestedPriority: PriorityLevel.TIN_DUNG,
    registrationUrl: 'https://shinhanfinance.com.vn/dang-ky-vay',
  });
  assert.equal(validHttps.success, true);
  if (validHttps.success) {
    assert.equal(validHttps.data.registrationUrl, 'https://shinhanfinance.com.vn/dang-ky-vay');
  }

  const validEmpty = akinatorRuleOutcomePayloadSchema.safeParse({
    categoryCode: 'CAT_SHINHAN',
    categoryLabel: 'Vay tín chấp Shinhan',
    referenceTitle: 'Vay theo lương Shinhan Finance',
    referenceSummary: 'Hạn mức đến 300 triệu VND, giải ngân trong 24h.',
    registrationUrl: '',
  });
  assert.equal(validEmpty.success, true);
  if (validEmpty.success) {
    assert.equal(validEmpty.data.registrationUrl, null);
  }
});

runTest('2.2 Akinator Rule outcomePayload and Product Catalog reject invalid/unsafe registration URLs', () => {
  const unsafeJsUrl = akinatorRuleOutcomePayloadSchema.safeParse({
    categoryCode: 'CAT_1',
    categoryLabel: 'Nhóm 1',
    referenceTitle: 'Sản phẩm 1',
    referenceSummary: 'Mô tả sản phẩm 1',
    registrationUrl: 'javascript:alert(1)',
  });
  assert.equal(unsafeJsUrl.success, false);

  const malformedUrl = akinatorRuleOutcomePayloadSchema.safeParse({
    categoryCode: 'CAT_1',
    categoryLabel: 'Nhóm 1',
    referenceTitle: 'Sản phẩm 1',
    referenceSummary: 'Mô tả sản phẩm 1',
    registrationUrl: 'not-a-valid-url',
  });
  assert.equal(malformedUrl.success, false);

  const catalogUnsafeUrl = financialDetailInputSchema.safeParse({
    category: 'LOAN_UNSECURED',
    officialUrl: 'javascript:void(0)',
  });
  assert.equal(catalogUnsafeUrl.success, false);

  const catalogValidUrl = financialDetailInputSchema.safeParse({
    category: 'LOAN_UNSECURED',
    officialUrl: 'https://vpbank.com.vn/vay-tin-chap',
  });
  assert.equal(catalogValidUrl.success, true);
});

// ============================================================================
// 3. UNLIMITED MATCHING PRODUCTS (5 AND 10 PRODUCTS IN PRIORITY ORDER)
// ============================================================================

const mockQuestions: AkinatorQuestionDef[] = [
  {
    id: 'q1',
    code: 'Q_PRODUCT_NEED',
    questionText: 'Nhu cầu sản phẩm',
    questionType: AkinatorQuestionType.SINGLE_CHOICE,
    isEntryQuestion: true,
    isRequiredForEval: true,
    priorityWeight: 100,
    active: true,
  },
  {
    id: 'q2',
    code: 'Q_INCOME_TYPE',
    questionText: 'Nguồn thu nhập',
    questionType: AkinatorQuestionType.SINGLE_CHOICE,
    isEntryQuestion: false,
    isRequiredForEval: true,
    priorityWeight: 90,
    active: true,
  },
  {
    id: 'q3',
    code: 'Q_MONTHLY_INCOME',
    questionText: 'Thu nhập hàng tháng',
    questionType: AkinatorQuestionType.CURRENCY,
    isEntryQuestion: false,
    isRequiredForEval: true,
    priorityWeight: 80,
    active: true,
  },
];

const mockAnsweredRecords: AkinatorAnsweredRecord[] = [
  { questionId: 'q1', questionCode: 'Q_PRODUCT_NEED', answerValue: 'BOTH', stepOrder: 1 },
  {
    questionId: 'q2',
    questionCode: 'Q_INCOME_TYPE',
    answerValue: 'COMPANY_SALARY_TRANSFER',
    stepOrder: 2,
  },
  { questionId: 'q3', questionCode: 'Q_MONTHLY_INCOME', answerValue: 15000000, stepOrder: 3 },
];

function buildMockRules(count: number): AkinatorRuleDef[] {
  const rules: AkinatorRuleDef[] = [];
  for (let i = 1; i <= count; i++) {
    rules.push({
      id: `rule_${i}`,
      code: `RULE_PRODUCT_${i}`,
      name: `Sản phẩm vay ưu tiên #${i}`,
      priorityOrder: i,
      requiredQuestionCodes: ['Q_PRODUCT_NEED', 'Q_INCOME_TYPE', 'Q_MONTHLY_INCOME'],
      conditions: {
        logic: 'AND',
        conditions: [
          {
            questionCode: 'Q_PRODUCT_NEED',
            operator: 'IN',
            value: 'LOAN_ONLY, BOTH, ASSESS_BOTH',
          },
        ],
        groups: [
          {
            id: `grp_inc_${i}`,
            logic: 'OR',
            conditions: [
              {
                questionCode: 'Q_INCOME_TYPE',
                operator: 'EQUALS',
                value: 'COMPANY_SALARY_TRANSFER',
              },
              {
                questionCode: 'Q_INCOME_TYPE',
                operator: 'EQUALS',
                value: 'COMPANY_SALARY_CASH',
              },
            ],
          },
          {
            id: `grp_amt_${i}`,
            logic: 'AND',
            conditions: [
              {
                questionCode: 'Q_MONTHLY_INCOME',
                operator: 'GTE',
                value: 5000000 + i * 500000,
              },
            ],
          },
        ],
      },
      outcomePayload: {
        categoryCode: `CAT_PROD_${i}`,
        categoryLabel: `Gói vay #${i}`,
        referenceTitle: `Sản phẩm vay ngân hàng đối tác #${i}`,
        referenceSummary: `Mô tả gói vay #${i}`,
        suggestedDirections: [`Bước 1: Đăng ký gói vay #${i}`],
        cautionNotes: [],
        suggestedPriority: PriorityLevel.TIN_DUNG,
        registrationUrl: i % 2 === 1 ? `https://partner-bank.vn/apply/product-${i}` : null,
      },
      stopOnMatch: true, // Even if stopOnMatch was true on legacy rules, all matching products must be returned!
      active: true,
    });
  }
  return rules;
}

runTest('3.1 Evaluating 5 matching products returns ALL 5 products in priorityOrder with registrationUrl', () => {
  const rules5 = buildMockRules(5);
  const eval5 = evaluateAkinatorRules({
    questions: mockQuestions,
    rules: rules5,
    answeredRecords: mockAnsweredRecords,
  });

  assert.equal(eval5.evaluationStatus, 'EVALUATED');
  assert.equal(eval5.outcomeData.categories.length, 5);
  assert.equal(eval5.matchedRulesSnapshot.length, 5);
  assert.deepEqual(
    eval5.outcomeData.categories.map((c) => c.ruleCode),
    ['RULE_PRODUCT_1', 'RULE_PRODUCT_2', 'RULE_PRODUCT_3', 'RULE_PRODUCT_4', 'RULE_PRODUCT_5']
  );
  assert.equal(
    eval5.outcomeData.categories[0].registrationUrl,
    'https://partner-bank.vn/apply/product-1'
  );
  assert.equal(eval5.outcomeData.categories[1].registrationUrl, null);
});

runTest('3.2 Evaluating 10 matching products returns ALL 10 products in priorityOrder without any 2-product cap', () => {
  const rules10 = buildMockRules(10);
  const eval10 = evaluateAkinatorRules({
    questions: mockQuestions,
    rules: rules10,
    answeredRecords: mockAnsweredRecords,
  });

  assert.equal(eval10.evaluationStatus, 'EVALUATED');
  assert.equal(eval10.outcomeData.categories.length, 10);
  assert.equal(eval10.matchedRulesSnapshot.length, 10);
  assert.equal(eval10.outcomeData.categories[0].ruleCode, 'RULE_PRODUCT_1');
  assert.equal(eval10.outcomeData.categories[9].ruleCode, 'RULE_PRODUCT_10');
});

runTest('3.3 CRM RuleBasedRecommendationEngine returns all matching catalog products (6 products) without 1-per-rule limit', () => {
  const engine = new RuleBasedRecommendationEngine();
  const catalogProducts: Product[] = Array.from({ length: 6 }, (_, idx) => ({
    id: `prod_${idx + 1}`,
    code: `VAY_TIN_CHAP_${idx + 1}`,
    name: `Vay tín chấp gói #${idx + 1}`,
    description: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const candidates = engine.evaluate(
    {
      customerId: 'cust_1',
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      overallStatus: 'DANG_TU_VAN',
      priority: 'TIN_DUNG',
      activeNeeds: [
        {
          id: 'need_1',
          needType: 'VAY_TIN_CHAP',
          status: 'OPEN',
          notes: 'Cần vay 50 triệu',
          detectedAt: new Date(),
        },
      ],
      resolvedNeeds: [],
      applicationHistory: [],
      recentActivities: [],
      daysSinceLastActivity: null,
      existingRecommendations: [],
      existingPushes: [],
    },
    catalogProducts
  );

  assert.equal(candidates.length, 6);
  assert.deepEqual(
    candidates.map((c) => c.targetProductCode),
    [
      'VAY_TIN_CHAP_1',
      'VAY_TIN_CHAP_2',
      'VAY_TIN_CHAP_3',
      'VAY_TIN_CHAP_4',
      'VAY_TIN_CHAP_5',
      'VAY_TIN_CHAP_6',
    ]
  );
});

console.log(`\n🎉 ALL ${passedCount} AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!`);
