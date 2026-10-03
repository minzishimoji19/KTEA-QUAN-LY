import {
  RecommendationStatus,
  PushStatus,
  ActivityType,
} from '@prisma/client';
import {
  recommendationRepository,
  RecommendationQueryFilters,
} from '../repositories/recommendation.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { pushRecordRepository } from '../repositories/pushRecord.repository.js';
import { activityRepository } from '../repositories/activity.repository.js';
import { extractCustomerFeatures } from '../engine/featureExtractor.js';
import { recommendationEngine } from '../engine/ruleEngine.js';
import { IRecommendationEngine } from '../engine/types.js';
import { settingsService } from './settings.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';

export class RecommendationService extends BaseService {
  private engine: IRecommendationEngine;

  constructor(engine: IRecommendationEngine = recommendationEngine) {
    super();
    this.engine = engine;
  }

  // Allows swapping the engine (e.g., future ML scoring model) without altering services or UI
  public setEngine(newEngine: IRecommendationEngine): void {
    this.engine = newEngine;
  }

  async getAllRecommendations(filters?: RecommendationQueryFilters) {
    return recommendationRepository.findAll(filters);
  }

  async getRecommendationsByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return recommendationRepository.findByCustomerId(customerId);
  }

  async getRecommendationById(id: string) {
    const rec = await recommendationRepository.findById(id);
    if (!rec) {
      throw new NotFoundError(`Recommendation with ID '${id}' not found`);
    }
    return rec;
  }

  /**
   * Run recommendation engine for a specific customer
   */
  async generateForCustomer(customerId: string) {
    const customer = await recommendationRepository.findCustomerWithRelations(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    const availableProducts = await productRepository.findAll(true);
    const features = extractCustomerFeatures(customer);
    const recConfig = await settingsService.getRecommendationSettings();
    const candidates = this.engine.evaluate(features, availableProducts, recConfig);

    const createdRecs = [];
    for (const c of candidates) {
      const rec = await recommendationRepository.create({
        customerId: c.customerId,
        targetProductId: c.targetProductId,
        recommendationType: c.recommendationType,
        score: c.score,
        reason: c.reason,
        status: RecommendationStatus.NEW,
      });
      createdRecs.push(rec);
    }

    return {
      customerId,
      generatedCount: createdRecs.length,
      recommendations: createdRecs,
    };
  }

  /**
   * Batch run recommendation engine across all active customers
   */
  async generateForAll() {
    const customers = await recommendationRepository.findAllCustomersWithRelations();
    const availableProducts = await productRepository.findAll(true);
    const recConfig = await settingsService.getRecommendationSettings();

    let totalGenerated = 0;
    const allGenerated = [];

    for (const customer of customers) {
      const features = extractCustomerFeatures(customer);
      const candidates = this.engine.evaluate(features, availableProducts, recConfig);

      for (const c of candidates) {
        const rec = await recommendationRepository.create({
          customerId: c.customerId,
          targetProductId: c.targetProductId,
          recommendationType: c.recommendationType,
          score: c.score,
          reason: c.reason,
          status: RecommendationStatus.NEW,
        });
        allGenerated.push(rec);
        totalGenerated++;
      }
    }

    return {
      evaluatedCustomersCount: customers.length,
      generatedCount: totalGenerated,
      recommendations: allGenerated,
    };
  }

  /**
   * Operator reviews recommendation
   */
  async reviewRecommendation(id: string) {
    const rec = await recommendationRepository.findById(id);
    if (!rec) {
      throw new NotFoundError(`Recommendation with ID '${id}' not found`);
    }

    return recommendationRepository.update(id, {
      status: RecommendationStatus.REVIEWED,
    });
  }

  /**
   * Operator dismisses recommendation
   */
  async dismissRecommendation(id: string) {
    const rec = await recommendationRepository.findById(id);
    if (!rec) {
      throw new NotFoundError(`Recommendation with ID '${id}' not found`);
    }

    return recommendationRepository.update(id, {
      status: RecommendationStatus.DISMISSED,
      dismissedAt: new Date(),
    });
  }

  /**
   * Operator decides to push customer:
   * Recommendation -> PushRecord
   */
  async convertToPush(
    id: string,
    pushData: {
      targetProductId?: string;
      note?: string;
    }
  ) {
    const rec = await recommendationRepository.findById(id);
    if (!rec) {
      throw new NotFoundError(`Recommendation with ID '${id}' not found`);
    }

    if (rec.status === RecommendationStatus.CONVERTED_TO_PUSH) {
      throw new BadRequestError('Recommendation has already been converted to a push record');
    }

    const targetProductId = pushData.targetProductId || rec.targetProductId;

    // 1. Create PushRecord
    const pushRecord = await pushRecordRepository.create(rec.customerId, {
      recommendationId: rec.id,
      targetProductId: targetProductId || undefined,
      status: PushStatus.PENDING,
      note: pushData.note || `Referral generated from recommendation [${rec.recommendationType}]`,
    });

    // 2. Mark Recommendation as CONVERTED_TO_PUSH
    await recommendationRepository.update(rec.id, {
      status: RecommendationStatus.CONVERTED_TO_PUSH,
    });

    // 3. Log Immutable Customer Activity
    await activityRepository.create(rec.customerId, {
      type: ActivityType.PUSH_CREATED,
      title: 'Referral Push Dispatched',
      description: `Operator dispatched push to specialist pipeline. Target: ${
        pushRecord.targetProduct?.name || 'Standard Catalog'
      }. ${pushData.note ? `Note: ${pushData.note}` : ''}`.trim(),
    });

    return pushRecord;
  }
}

export const recommendationService = new RecommendationService();
export default recommendationService;
