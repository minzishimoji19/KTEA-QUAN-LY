import { Product } from '@prisma/client';
import {
  CustomerFeatures,
  IRecommendationEngine,
  RecommendationCandidate,
} from './types.js';
import {
  ruleFailedApplicationRecovery,
  ruleCrossProductNeed,
  ruleActiveLoanNeed,
  ruleCardInterest,
  applyRecencyModifier,
} from './rules.js';
import { DEFAULT_SETTINGS, RecommendationSettings } from '../config/settings.config.js';

export class RuleBasedRecommendationEngine implements IRecommendationEngine {
  evaluate(
    features: CustomerFeatures,
    availableProducts: Product[],
    userConfig?: RecommendationSettings
  ): RecommendationCandidate[] {
    const config = userConfig ?? DEFAULT_SETTINGS.recommendationSettings;

    // RULE F: No Signal Guard
    // Do not recommend a product merely because the customer exists.
    // There must be a real recorded signal in active needs or application history.
    if (config.rules.ruleF.enabled) {
      if (features.activeNeeds.length === 0 && features.applicationHistory.length === 0) {
        return [];
      }
    }

    const candidates: RecommendationCandidate[] = [];
    const recommendedProductIds = new Set<string>();

    // Existing active recommendations to prevent duplicate recommendations
    const existingActiveProductIds = new Set(
      features.existingRecommendations
        .filter((r) => ['NEW', 'REVIEWED', 'ACTIVE'].includes(r.status))
        .map((r) => r.targetProductId)
        .filter(Boolean) as string[]
    );

    // Existing in-flight pushes to avoid recommending something currently in-flight
    const existingInFlightPushProductIds = new Set(
      features.existingPushes
        .filter((p) => ['PENDING', 'IN_PROGRESS'].includes(p.status))
        .map((p) => p.targetProductId)
        .filter(Boolean) as string[]
    );

    const configuredRules = [
      { rule: ruleFailedApplicationRecovery, ruleConfig: config.rules.ruleD },
      { rule: ruleCrossProductNeed, ruleConfig: config.rules.ruleC },
      { rule: ruleActiveLoanNeed, ruleConfig: config.rules.ruleA },
      { rule: ruleCardInterest, ruleConfig: config.rules.ruleB },
    ];

    for (const { rule, ruleConfig } of configuredRules) {
      if (!ruleConfig.enabled) continue;

      const match = rule.evaluate(features, ruleConfig);
      if (!match) continue;

      // Match target product from catalog
      const patterns = match.targetProductMatcher.codePatterns;
      let targetProduct: Product | undefined;

      for (const pattern of patterns) {
        targetProduct = availableProducts.find(
          (p) =>
            p.active &&
            (p.code === pattern ||
              p.code.includes(pattern) ||
              p.name.toLowerCase().includes(pattern.toLowerCase()))
        );
        if (targetProduct) break;
      }

      // Fallback product if pattern didn't match directly
      if (!targetProduct) {
        targetProduct = availableProducts.find((p) => p.active);
      }

      if (!targetProduct) continue;

      // Repeat Recommendation Guard
      if (
        existingActiveProductIds.has(targetProduct.id) ||
        existingInFlightPushProductIds.has(targetProduct.id) ||
        recommendedProductIds.has(targetProduct.id)
      ) {
        continue;
      }

      // RULE E: Interaction Recency Score & Explanation Modifier
      const { finalScore, recencyExplanation, signal } = applyRecencyModifier(
        match.baseScore,
        features,
        config.rules.ruleE
      );

      // Enforce normalized ceiling
      const normalizedScore = Math.min(finalScore, config.maxNormalizedScore);

      // Check min score threshold
      if (normalizedScore < config.minScoreThreshold) {
        continue;
      }

      const allSignals = [...match.signals];
      if (signal) {
        allSignals.push(signal);
      }

      const fullReason = recencyExplanation
        ? `${match.reason}${recencyExplanation}`
        : match.reason;

      candidates.push({
        customerId: features.customerId,
        targetProductId: targetProduct.id,
        targetProductCode: targetProduct.code,
        targetProductName: targetProduct.name,
        recommendationType: match.ruleId,
        score: normalizedScore,
        reason: fullReason,
        signals: allSignals,
        ruleId: match.ruleId,
      });

      recommendedProductIds.add(targetProduct.id);
    }

    // Sort by score descending
    return candidates.sort((a, b) => b.score - a.score);
  }
}

export const recommendationEngine = new RuleBasedRecommendationEngine();
export default recommendationEngine;
