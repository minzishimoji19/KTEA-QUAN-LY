import {
  ruleActiveLoanNeed,
  ruleCardInterest,
  ruleCrossProductNeed,
  ruleFailedApplicationRecovery,
  applyRecencyModifier,
} from '../engine/rules.js';
import { RuleBasedRecommendationEngine } from '../engine/ruleEngine.js';
import { CustomerFeatures } from '../engine/types.js';
import { Product, CustomerStatus, NeedStatus, CaseStatus, ActivityType } from '@prisma/client';

function buildMockFeatures(overrides: Partial<CustomerFeatures> = {}): CustomerFeatures {
  return {
    customerId: 'cust-mock-01',
    fullName: 'Test Customer',
    phone: '0901234567',
    overallStatus: CustomerStatus.DANG_TU_VAN,
    priority: null,
    activeNeeds: [],
    resolvedNeeds: [],
    applicationHistory: [],
    recentActivities: [],
    daysSinceLastActivity: null,
    existingPushes: [],
    existingRecommendations: [],
    ...overrides,
  };
}

const mockProducts: Product[] = [
  {
    id: 'prod-cc-titanium',
    code: 'CC_CASHBACK_TITANIUM',
    name: 'Titanium Cashback Credit Card',
    description: 'Cashback card',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-cc-platinum',
    code: 'CC_MILES_PLATINUM',
    name: 'Platinum Travel Miles Card',
    description: 'Travel card',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-loan-personal',
    code: 'LOAN_PERSONAL_UNSECURED',
    name: 'Flexi Personal Unsecured Loan',
    description: 'Personal loan',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-loan-sme',
    code: 'LOAN_SME_WORKING_CAPITAL',
    name: 'SME Revolving Credit Line',
    description: 'SME loan',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function runRuleEngineTests() {
  console.log('🧪 Starting Recommendation Engine Rule Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: unknown) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`, detail ? JSON.stringify(detail) : '');
      failed++;
    }
  }

  const engine = new RuleBasedRecommendationEngine();

  // ========================================================
  // TEST 1: RULE A - Matching Customer (Active Loan Need)
  // ========================================================
  console.log('\n--- Test 1: Rule A (Active Loan Need) ---');
  const loanFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-1',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: 'Needs 100M VND for home improvement',
        detectedAt: new Date(),
      },
    ],
  });
  const ruleAMatch = ruleActiveLoanNeed.evaluate(loanFeatures);
  assert(ruleAMatch !== null && ruleAMatch.matched, 'Rule A matches customer with PERSONAL_LOAN need');
  assert(
    ruleAMatch?.targetProductMatcher.codePatterns.includes('LOAN_PERSONAL_UNSECURED') === true,
    'Rule A targets LOAN_PERSONAL_UNSECURED'
  );
  assert(
    ruleAMatch?.reason.includes('Personal Unsecured Loan') === true,
    'Rule A provides transparent, human-readable reason'
  );

  // Non-matching
  const nonLoanFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-2',
        needType: 'SAVINGS_YIELD',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
  });
  assert(ruleActiveLoanNeed.evaluate(nonLoanFeatures) === null, 'Rule A rejects non-loan need');

  // ========================================================
  // TEST 2: RULE B - Matching Customer (Explicit Card Interest)
  // ========================================================
  console.log('\n--- Test 2: Rule B (Explicit Card Interest) ---');
  const cardFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-card',
        needType: 'CREDIT_CARD',
        status: NeedStatus.OPEN,
        notes: 'Frequent flyer looking for lounge perks',
        detectedAt: new Date(),
      },
    ],
  });
  const ruleBMatch = ruleCardInterest.evaluate(cardFeatures);
  assert(ruleBMatch !== null && ruleBMatch.matched, 'Rule B matches customer with CREDIT_CARD need');
  assert(
    ruleBMatch?.reason.includes('credit card products') === true,
    'Rule B reason mentions credit card interest'
  );

  // ========================================================
  // TEST 3: RULE C - Cross-Product Need Transition
  // ========================================================
  console.log('\n--- Test 3: Rule C (Cross-Product Transition) ---');
  const crossProductFeatures = buildMockFeatures({
    applicationHistory: [
      {
        id: 'case-card',
        productId: 'prod-cc-titanium',
        productCode: 'CC_CASHBACK_TITANIUM',
        productName: 'Titanium Cashback Credit Card',
        status: CaseStatus.APPROVED,
        failureReason: null,
        createdAt: new Date('2026-05-01'),
      },
    ],
    activeNeeds: [
      {
        id: 'need-loan',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
  });
  const ruleCMatch = ruleCrossProductNeed.evaluate(crossProductFeatures);
  assert(ruleCMatch !== null && ruleCMatch.matched, 'Rule C matches card customer now expressing loan need');
  assert(ruleCMatch?.baseScore === 80, 'Rule C baseScore is 80');
  assert(
    ruleCMatch?.reason.includes('previously engaged with Credit Card facilities') === true,
    'Rule C explains transition from prior card to new loan need'
  );

  // ========================================================
  // TEST 4: RULE D - Failed Application Recovery
  // ========================================================
  console.log('\n--- Test 4: Rule D (Failed Application Recovery) ---');
  const failedAppFeatures = buildMockFeatures({
    applicationHistory: [
      {
        id: 'case-declined-card',
        productId: 'prod-cc-platinum',
        productCode: 'CC_MILES_PLATINUM',
        productName: 'Platinum Travel Miles Card',
        status: CaseStatus.REJECTED,
        failureReason: 'Debt-to-income ratio exceeded 45%',
        createdAt: new Date('2026-06-01'),
      },
    ],
    activeNeeds: [
      {
        id: 'need-recovery-loan',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
  });
  const ruleDMatch = ruleFailedApplicationRecovery.evaluate(failedAppFeatures);
  assert(ruleDMatch !== null && ruleDMatch.matched, 'Rule D matches rejected customer with alternate need');
  assert(ruleDMatch?.baseScore === 85, 'Rule D baseScore is 85');
  assert(
    ruleDMatch?.reason.includes('declined, but customer has an active alternate need') === true,
    'Rule D explicitly mentions prior decline and alternate need'
  );

  // ========================================================
  // TEST 5: RULE E - Meaningful Interaction Recency Modifier
  // ========================================================
  console.log('\n--- Test 5: Rule E (Recent Interaction Modifier) ---');
  const recentFeatures = buildMockFeatures({
    daysSinceLastActivity: 2,
    recentActivities: [
      {
        id: 'act-1',
        type: ActivityType.CALL,
        title: 'Qualification Phone Call',
        occurredAt: new Date(Date.now() - 2 * 86400000),
      },
    ],
  });
  const recencyBoosted = applyRecencyModifier(70, recentFeatures);
  assert(recencyBoosted.finalScore === 80, `Recent interaction boosts score from 70 to 80 (Actual: ${recencyBoosted.finalScore})`);
  assert(
    recencyBoosted.recencyExplanation?.includes('Qualification Phone Call') === true,
    'Recency explanation cites actual activity title'
  );

  const staleFeatures = buildMockFeatures({
    daysSinceLastActivity: 45,
    recentActivities: [
      {
        id: 'act-old',
        type: ActivityType.MEETING,
        title: 'Initial Consultation',
        occurredAt: new Date(Date.now() - 45 * 86400000),
      },
    ],
  });
  const staleResult = applyRecencyModifier(70, staleFeatures);
  assert(staleResult.finalScore === 70, 'Stale activity (45d) does not boost score');
  assert(staleResult.recencyExplanation === null, 'No recency explanation for stale interaction');

  // ========================================================
  // TEST 6: RULE F - No Signal Guard
  // ========================================================
  console.log('\n--- Test 6: Rule F (No Signal Guard) ---');
  const noSignalFeatures = buildMockFeatures({
    activeNeeds: [],
    applicationHistory: [],
    recentActivities: [],
  });
  const noSignalCandidates = engine.evaluate(noSignalFeatures, mockProducts);
  assert(
    noSignalCandidates.length === 0,
    `No signal guard: customer with no needs/history produces 0 recommendations (Actual: ${noSignalCandidates.length})`
  );

  // ========================================================
  // TEST 7: Multiple Needs & Conflicting Signals Prioritization
  // ========================================================
  console.log('\n--- Test 7: Multiple Needs & Prioritization ---');
  const multiNeedFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-1',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
      {
        id: 'need-2',
        needType: 'CREDIT_CARD',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
    applicationHistory: [
      {
        id: 'case-card-rejected',
        productId: 'prod-cc-titanium',
        productCode: 'CC_CASHBACK_TITANIUM',
        productName: 'Titanium Cashback Credit Card',
        status: CaseStatus.REJECTED,
        failureReason: 'Documents missing',
        createdAt: new Date('2026-07-01'),
      },
    ],
    daysSinceLastActivity: 1,
    recentActivities: [
      {
        id: 'act-recent',
        type: ActivityType.CALL,
        title: 'Discovery Call',
        occurredAt: new Date(),
      },
    ],
  });
  const multiCandidates = engine.evaluate(multiNeedFeatures, mockProducts);
  assert(multiCandidates.length >= 1, `Multiple needs produced recommendations (Count: ${multiCandidates.length})`);
  // Top recommendation should be the recovery rule (Rule D base 85 + 10 = 95)
  assert(
    multiCandidates[0].ruleId === 'RULE_D_FAILED_APP_RECOVERY',
    `Top recommendation is Rule D recovery (RuleId: ${multiCandidates[0].ruleId}, Score: ${multiCandidates[0].score})`
  );
  assert(multiCandidates[0].score === 95, `Normalized score correctly capped at 95 (Actual: ${multiCandidates[0].score})`);

  // ========================================================
  // TEST 8: Repeat Recommendation Prevention
  // ========================================================
  console.log('\n--- Test 8: Repeat Recommendation Prevention ---');
  const repeatFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-loan',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
    existingRecommendations: [
      {
        id: 'rec-active-loan',
        targetProductId: 'prod-loan-personal', // Already recommended!
        status: 'NEW' as any,
        generatedAt: new Date(),
      },
    ],
  });
  const repeatCandidates = engine.evaluate(repeatFeatures, mockProducts);
  assert(
    repeatCandidates.length === 0,
    `Repeat prevention: active existing recommendation suppresses duplicate candidate (Count: ${repeatCandidates.length})`
  );

  // In-flight push suppression
  const inFlightFeatures = buildMockFeatures({
    activeNeeds: [
      {
        id: 'need-loan',
        needType: 'PERSONAL_LOAN',
        status: NeedStatus.OPEN,
        notes: null,
        detectedAt: new Date(),
      },
    ],
    existingPushes: [
      {
        id: 'push-inflight',
        targetProductId: 'prod-loan-personal',
        status: 'PENDING' as any,
        pushedAt: new Date(),
      },
    ],
  });
  const inFlightCandidates = engine.evaluate(inFlightFeatures, mockProducts);
  assert(
    inFlightCandidates.length === 0,
    `In-flight push suppression: pending referral suppresses new recommendation (Count: ${inFlightCandidates.length})`
  );

  // ========================================================
  // TEST 9: Human-Readable Explanation Integrity
  // ========================================================
  console.log('\n--- Test 9: Human-Readable Explanation Integrity ---');
  for (const c of multiCandidates) {
    assert(
      !c.reason.toLowerCase().includes('ai recommends') &&
        !c.reason.toLowerCase().includes('model predicts'),
      `Explanation does not contain generic AI buzzwords: "${c.reason}"`
    );
    assert(c.signals.length > 0, `Signals array is populated: ${c.signals.length} signals`);
  }

  console.log(`\n========================================`);
  console.log(`Rule Engine Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRuleEngineTests();
