import { CustomerFeatures, IRecommendationRule, RuleEvaluationResult } from './types.js';
import { DEFAULT_SETTINGS, RuleConfig, RecencyBoostConfig } from '../config/settings.config.js';

const DEFAULT_RULE_A = DEFAULT_SETTINGS.recommendationSettings.rules.ruleA;
const DEFAULT_RULE_B = DEFAULT_SETTINGS.recommendationSettings.rules.ruleB;
const DEFAULT_RULE_C = DEFAULT_SETTINGS.recommendationSettings.rules.ruleC;
const DEFAULT_RULE_D = DEFAULT_SETTINGS.recommendationSettings.rules.ruleD;
const DEFAULT_RULE_E = DEFAULT_SETTINGS.recommendationSettings.rules.ruleE;

// Helper to check if a needType indicates loan
export function isLoanNeed(needType: string): boolean {
  const t = needType.toUpperCase();
  return (
    t.includes('LOAN') ||
    t.includes('WORKING_CAPITAL') ||
    t.includes('MORTGAGE') ||
    t.includes('CAPITAL')
  );
}

// Helper to check if a needType indicates card
export function isCardNeed(needType: string): boolean {
  const t = needType.toUpperCase();
  return t.includes('CARD') || t.includes('CREDIT') || t.includes('CASHBACK');
}

/**
 * RULE A: Active Loan Need
 * IF customer has an active loan need
 * THEN recommend LOAN product.
 */
export const ruleActiveLoanNeed: IRecommendationRule = {
  id: 'RULE_A_ACTIVE_LOAN_NEED',
  name: 'Active Loan Need Match',
  evaluate(features: CustomerFeatures, config?: RuleConfig): RuleEvaluationResult | null {
    if (config && config.enabled === false) return null;
    const baseScore = config?.baseScore ?? DEFAULT_RULE_A.baseScore;

    const loanNeed = features.activeNeeds.find((n) => isLoanNeed(n.needType));
    if (!loanNeed) return null;

    let targetCode = 'LOAN_PERSONAL_UNSECURED';
    let label = 'Personal Unsecured Loan';

    if (loanNeed.needType.includes('SME') || loanNeed.needType.includes('CAPITAL')) {
      targetCode = 'LOAN_SME_WORKING_CAPITAL';
      label = 'SME Working Capital Loan';
    } else if (loanNeed.needType.includes('HOME') || loanNeed.needType.includes('MORTGAGE')) {
      targetCode = 'LOAN_MORTGAGE_RESIDENTIAL';
      label = 'Residential Mortgage Loan';
    }

    const signals = [
      `Active need recorded: ${loanNeed.needType.replace(/_/g, ' ')} (${loanNeed.status})`,
    ];

    let explanation = `Customer has an active recorded ${label} requirement.`;
    if (loanNeed.notes) {
      signals.push(`Note: "${loanNeed.notes}"`);
      explanation += ` Qualification notes indicate customer interest in financing options.`;
    }

    return {
      matched: true,
      ruleId: 'RULE_A_ACTIVE_LOAN_NEED',
      ruleName: 'Active Loan Need Match',
      targetProductMatcher: {
        codePatterns: [targetCode, 'LOAN'],
        fallbackCategory: 'LOAN',
      },
      baseScore,
      reason: explanation,
      signals,
    };
  },
};

/**
 * RULE B: Explicit Card Interest
 * IF customer has explicitly recorded card interest
 * THEN recommend CREDIT_CARD.
 */
export const ruleCardInterest: IRecommendationRule = {
  id: 'RULE_B_EXPLICIT_CARD_INTEREST',
  name: 'Explicit Card Interest Match',
  evaluate(features: CustomerFeatures, config?: RuleConfig): RuleEvaluationResult | null {
    if (config && config.enabled === false) return null;
    const baseScore = config?.baseScore ?? DEFAULT_RULE_B.baseScore;

    const cardNeed = features.activeNeeds.find((n) => isCardNeed(n.needType));
    if (!cardNeed) return null;

    const signals = [
      `Active card need identified: ${cardNeed.needType.replace(/_/g, ' ')}`,
    ];

    let targetCode = 'CC_CASHBACK_TITANIUM';

    if (
      features.priority === 'THANH_KHOAN_TIN_DUNG' ||
      features.priority === 'TIN_DUNG' ||
      features.overallStatus === 'DANG_TU_VAN' ||
      features.overallStatus === 'THANH_CONG'
    ) {
      targetCode = 'CC_MILES_PLATINUM';
    }

    const explanation = `Customer has explicitly recorded interest in credit card products (${cardNeed.needType.replace(/_/g, ' ')}).`;
    if (cardNeed.notes) {
      signals.push(`Note: "${cardNeed.notes}"`);
    }

    return {
      matched: true,
      ruleId: 'RULE_B_EXPLICIT_CARD_INTEREST',
      ruleName: 'Explicit Card Interest Match',
      targetProductMatcher: {
        codePatterns: [targetCode, 'CC_CASHBACK_TITANIUM', 'CC_MILES_PLATINUM', 'CARD'],
        fallbackCategory: 'CARD',
      },
      baseScore,
      reason: explanation,
      signals,
    };
  },
};

/**
 * RULE C: Cross-Product Need Transition
 * IF customer previously interacted with or applied for one product type
 * BUT currently expresses a different product need
 * THEN recommend the new product.
 */
export const ruleCrossProductNeed: IRecommendationRule = {
  id: 'RULE_C_CROSS_PRODUCT_TRANSITION',
  name: 'Cross-Product Need Transition',
  evaluate(features: CustomerFeatures, config?: RuleConfig): RuleEvaluationResult | null {
    if (config && config.enabled === false) return null;
    const baseScore = config?.baseScore ?? DEFAULT_RULE_C.baseScore;

    if (features.applicationHistory.length === 0 || features.activeNeeds.length === 0) {
      return null;
    }

    // Past products applied for
    const pastProductCodes = features.applicationHistory.map((c) => c.productCode);
    const hadCard = pastProductCodes.some((code) => code.startsWith('CC_'));
    const hadLoan = pastProductCodes.some((code) => code.startsWith('LOAN_'));

    // Check if there is an active need for a different product class
    const activeLoanNeed = features.activeNeeds.find((n) => isLoanNeed(n.needType));
    const activeCardNeed = features.activeNeeds.find((n) => isCardNeed(n.needType));

    if (hadCard && activeLoanNeed) {
      const signals = [
        `Historical engagement with Credit Card catalog (${pastProductCodes.filter((c) => c.startsWith('CC_')).join(', ')})`,
        `New active intent declared for ${activeLoanNeed.needType.replace(/_/g, ' ')}`,
      ];
      return {
        matched: true,
        ruleId: 'RULE_C_CROSS_PRODUCT_TRANSITION',
        ruleName: 'Cross-Product Need Transition',
        targetProductMatcher: {
          codePatterns: ['LOAN_PERSONAL_UNSECURED', 'LOAN'],
          fallbackCategory: 'LOAN',
        },
        baseScore,
        reason: `Customer previously engaged with Credit Card facilities, but currently expresses a separate requirement for ${activeLoanNeed.needType.replace(/_/g, ' ')}.`,
        signals,
      };
    }

    if (hadLoan && activeCardNeed) {
      const signals = [
        `Historical loan application record on file (${pastProductCodes.filter((c) => c.startsWith('LOAN_')).join(', ')})`,
        `New active intent declared for ${activeCardNeed.needType.replace(/_/g, ' ')}`,
      ];
      return {
        matched: true,
        ruleId: 'RULE_C_CROSS_PRODUCT_TRANSITION',
        ruleName: 'Cross-Product Need Transition',
        targetProductMatcher: {
          codePatterns: ['CC_CASHBACK_TITANIUM', 'CC_MILES_PLATINUM', 'CARD'],
          fallbackCategory: 'CARD',
        },
        baseScore,
        reason: `Customer previously engaged with Loan facilities, but currently expresses a new distinct interest in credit card services.`,
        signals,
      };
    }

    return null;
  },
};

/**
 * RULE D: Failed Application Recovery
 * IF an application failed (REJECTED) AND the customer has another explicitly recorded need
 * THEN recommend the product associated with that alternate need.
 */
export const ruleFailedApplicationRecovery: IRecommendationRule = {
  id: 'RULE_D_FAILED_APP_RECOVERY',
  name: 'Failed Application Recovery Opportunity',
  evaluate(features: CustomerFeatures, config?: RuleConfig): RuleEvaluationResult | null {
    if (config && config.enabled === false) return null;
    const baseScore = config?.baseScore ?? DEFAULT_RULE_D.baseScore;

    const rejectedApp = features.applicationHistory.find((c) => c.status === 'REJECTED');
    if (!rejectedApp) return null;

    // Check if customer has another active need that is NOT the same failed product category
    const failedIsCard = rejectedApp.productCode.startsWith('CC_');
    const failedIsLoan = rejectedApp.productCode.startsWith('LOAN_');

    const alternativeNeed = features.activeNeeds.find((n) => {
      if (failedIsCard && isLoanNeed(n.needType)) return true;
      if (failedIsLoan && isCardNeed(n.needType)) return true;
      if (!isLoanNeed(n.needType) && !isCardNeed(n.needType)) return true;
      return false;
    });

    if (!alternativeNeed) return null;

    let targetCode = 'LOAN_PERSONAL_UNSECURED';
    let targetLabel = 'Flexi Personal Loan';
    if (isCardNeed(alternativeNeed.needType)) {
      targetCode = 'CC_CASHBACK_TITANIUM';
      targetLabel = 'Titanium Cashback Card';
    } else if (alternativeNeed.needType.includes('SME')) {
      targetCode = 'LOAN_SME_WORKING_CAPITAL';
      targetLabel = 'SME Revolving Credit Line';
    } else if (alternativeNeed.needType.includes('SAVINGS') || alternativeNeed.needType.includes('DEPOSIT')) {
      targetCode = 'WEALTH_TERM_DEPOSIT_PLUS';
      targetLabel = 'Wealth Horizon Term Deposit';
    }

    const signals = [
      `Prior application for ${rejectedApp.productName || rejectedApp.productCode} was REJECTED${rejectedApp.failureReason ? ` (Reason: "${rejectedApp.failureReason}")` : ''}`,
      `Active alternate requirement identified: ${alternativeNeed.needType.replace(/_/g, ' ')}`,
    ];

    const explanation = `Prior application for ${rejectedApp.productName || rejectedApp.productCode} was declined, but customer has an active alternate need for ${alternativeNeed.needType.replace(/_/g, ' ')}. Recommended recovery product: ${targetLabel}.`;

    return {
      matched: true,
      ruleId: 'RULE_D_FAILED_APP_RECOVERY',
      ruleName: 'Failed Application Recovery Opportunity',
      targetProductMatcher: {
        codePatterns: [targetCode, 'LOAN', 'CARD'],
        fallbackCategory: 'RECOVERY',
      },
      baseScore,
      reason: explanation,
      signals,
    };
  },
};

/**
 * RULE E Modifier: Recent Meaningful Interaction Boost
 * Increases score when actual recent activity occurred.
 * Configured dynamically: boost1 if within recencyDays1, boost2 if within recencyDays2.
 * Only applies when actual recorded activity data exists.
 */
export function applyRecencyModifier(
  baseScore: number,
  features: CustomerFeatures,
  config?: RecencyBoostConfig
): { finalScore: number; recencyExplanation: string | null; signal: string | null } {
  const conf = config ?? DEFAULT_RULE_E;
  if (!conf.enabled) {
    return { finalScore: baseScore, recencyExplanation: null, signal: null };
  }

  if (features.daysSinceLastActivity === null || features.recentActivities.length === 0) {
    return { finalScore: baseScore, recencyExplanation: null, signal: null };
  }

  const days = features.daysSinceLastActivity;
  const latestAct = features.recentActivities[0];

  if (days <= conf.recencyDays1) {
    const boost = conf.boost1;
    const finalScore = Math.min(100, baseScore + boost);
    return {
      finalScore,
      recencyExplanation: ` Customer has engaged recently (${latestAct.title}, logged ${days === 0 ? 'today' : `${days} day(s) ago`}).`,
      signal: `Recent interaction: "${latestAct.title}" (${latestAct.type}, ${days}d ago) [Score +${boost}]`,
    };
  }

  if (days <= conf.recencyDays2) {
    const boost = conf.boost2;
    const finalScore = Math.min(100, baseScore + boost);
    return {
      finalScore,
      recencyExplanation: ` Customer had interaction within the past 2 weeks (${latestAct.title}).`,
      signal: `Recent interaction: "${latestAct.title}" (${latestAct.type}, ${days}d ago) [Score +${boost}]`,
    };
  }

  return { finalScore: baseScore, recencyExplanation: null, signal: null };
}

/**
 * All active rules for evaluation
 */
export const ALL_RULES: IRecommendationRule[] = [
  ruleFailedApplicationRecovery, // Highest priority recovery rule
  ruleCrossProductNeed,          // Cross-sell rule
  ruleActiveLoanNeed,            // Direct loan rule
  ruleCardInterest,              // Direct card rule
];
