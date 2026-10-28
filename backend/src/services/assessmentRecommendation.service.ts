import { AssessmentStatus, RuleVersionStatus, RecommendationRunStatus, ProductCategory, Role } from '@prisma/client';
import { assessmentRecommendationRepository } from '../repositories/assessmentRecommendation.repository.js';
import { assessmentRepository } from '../repositories/assessment.repository.js';
import { customerAccessService } from './customerAccess.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import {
  evaluateAssessmentRecommendations,
  ProductEvaluationCandidate,
  RuleDefinition,
} from '../validations/assessmentRecommendation.validation.js';
import prisma from '../config/database.js';

export interface UserContext {
  id: string;
  role: Role;
  email?: string;
  fullName?: string;
}

export const assessmentRecommendationService = {
  // =========================================================================
  // RUN RECOMMENDATIONS FOR COMPLETED ASSESSMENT
  // =========================================================================

  async generateForAssessment(
    assessmentId: string,
    user: UserContext,
    input?: { notes?: string | null; ruleVersionId?: string | null }
  ) {
    const startTime = Date.now();

    // 1. Fetch assessment
    const assessment = await assessmentRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(`Không tìm thấy khảo sát nhu cầu với ID '${assessmentId}'`);
    }

    // 2. IDOR / RBAC Write Check on customer
    await customerAccessService.assertCustomerWriteAccess(user, assessment.customerId);

    // 3. Status Guard: Must be COMPLETED
    if (assessment.status !== AssessmentStatus.COMPLETED) {
      throw new BadRequestError(
        `Chỉ có thể chạy gợi ý sản phẩm cho khảo sát đã hoàn thành (COMPLETED). Trạng thái hiện tại: ${assessment.status}`
      );
    }

    // 4. Resolve Rule Version
    let ruleVersion = null;
    if (input?.ruleVersionId) {
      ruleVersion = await assessmentRecommendationRepository.findRuleVersionById(input.ruleVersionId);
      if (!ruleVersion) {
        throw new NotFoundError(`Không tìm thấy phiên bản quy tắc với ID '${input.ruleVersionId}'`);
      }
      if (ruleVersion.status !== RuleVersionStatus.PUBLISHED && user.role !== 'ADMIN') {
        throw new BadRequestError('Chỉ có thể áp dụng các phiên bản quy tắc đã được xuất bản chính thức (PUBLISHED)');
      }
    } else {
      ruleVersion = await assessmentRecommendationRepository.findCurrentPublishedRuleVersion();
      if (!ruleVersion) {
        // Auto-seed standard rule set if none exists yet
        ruleVersion = await this.ensureDefaultRuleSetExists(user.id);
      }
    }

    if (!ruleVersion) {
      throw new BadRequestError('Hệ thống chưa có bộ quy tắc gợi ý sản phẩm nào được xuất bản (PUBLISHED)');
    }

    const rules = (ruleVersion.rules as any as RuleDefinition[]) || [];

    // 5. Build Answers Map
    const answersMap: Record<string, any> = {};
    for (const a of assessment.answers || []) {
      answersMap[a.questionCode] = a.answerValue;
    }

    // 6. Fetch all active products with financial details
    const rawProducts = await prisma.product.findMany({
      where: { active: true },
      include: { financialDetail: true },
    });

    const candidates: ProductEvaluationCandidate[] = rawProducts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      active: p.active,
      financialDetail: p.financialDetail
        ? {
            category: p.financialDetail.category,
            providerName: p.financialDetail.providerName,
            minAmount: p.financialDetail.minAmount ? Number(p.financialDetail.minAmount) : null,
            maxAmount: p.financialDetail.maxAmount ? Number(p.financialDetail.maxAmount) : null,
            minInterestRate: p.financialDetail.minInterestRate ? Number(p.financialDetail.minInterestRate) : null,
            maxInterestRate: p.financialDetail.maxInterestRate ? Number(p.financialDetail.maxInterestRate) : null,
            minTenureMonths: p.financialDetail.minTenureMonths,
            maxTenureMonths: p.financialDetail.maxTenureMonths,
            feesDescription: p.financialDetail.feesDescription,
            minAge: p.financialDetail.minAge,
            maxAge: p.financialDetail.maxAge,
            minIncome: p.financialDetail.minIncome ? Number(p.financialDetail.minIncome) : null,
            acceptBadDebt: p.financialDetail.acceptBadDebt,
            effectiveFrom: p.financialDetail.effectiveFrom,
            effectiveTo: p.financialDetail.effectiveTo,
          }
        : null,
    }));

    // 7. Pure Evaluation
    const evaluation = evaluateAssessmentRecommendations(answersMap, rules, candidates);
    const executionTimeMs = Date.now() - startTime;

    // 8. Persist Run and Items Snapshot atomically
    const run = await assessmentRecommendationRepository.createRecommendationRun({
      customerId: assessment.customerId,
      assessmentId: assessment.id,
      ruleVersionId: ruleVersion.id,
      performedById: user.id,
      status: RecommendationRunStatus.COMPLETED,
      answersSnapshot: answersMap,
      rulesSnapshot: rules as any,
      totalCandidatesEvaluated: evaluation.totalEvaluated,
      totalRecommended: evaluation.totalRecommended,
      executionTimeMs,
      notes: input?.notes,
      items: evaluation.items,
    });

    return run;
  },

  // =========================================================================
  // QUERY RUN HISTORY
  // =========================================================================

  async getRunsByCustomerId(customerId: string, user: UserContext) {
    await customerAccessService.assertCustomerAccess(user, customerId);
    return assessmentRecommendationRepository.findRunsByCustomerId(customerId);
  },

  async getRunsByAssessmentId(assessmentId: string, user: UserContext) {
    const assessment = await assessmentRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(`Không tìm thấy khảo sát với ID '${assessmentId}'`);
    }
    await customerAccessService.assertCustomerAccess(user, assessment.customerId);
    return assessmentRecommendationRepository.findRunsByAssessmentId(assessmentId);
  },

  async getRunById(runId: string, user: UserContext) {
    const run = await assessmentRecommendationRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundError(`Không tìm thấy lượt gợi ý sản phẩm với ID '${runId}'`);
    }
    await customerAccessService.assertCustomerAccess(user, run.customerId);
    return run;
  },

  // =========================================================================
  // ADMIN RULE SET & VERSION MANAGEMENT
  // =========================================================================

  async getAllRuleSets() {
    return assessmentRecommendationRepository.findAllRuleSets();
  },

  async getRuleSetById(id: string) {
    const set = await assessmentRecommendationRepository.findRuleSetById(id);
    if (!set) {
      throw new NotFoundError(`Không tìm thấy bộ quy tắc với ID '${id}'`);
    }
    return set;
  },

  async createRuleSet(data: { code: string; title: string; description?: string | null }) {
    const existing = await assessmentRecommendationRepository.findRuleSetByCode(data.code);
    if (existing) {
      throw new BadRequestError(`Mã bộ quy tắc '${data.code}' đã tồn tại`);
    }
    return assessmentRecommendationRepository.createRuleSet(data);
  },

  async createRuleVersion(data: {
    ruleSetId: string;
    rules: RuleDefinition[];
    changeLog?: string | null;
    createdBy?: string | null;
  }) {
    const set = await assessmentRecommendationRepository.findRuleSetById(data.ruleSetId);
    if (!set) {
      throw new NotFoundError(`Không tìm thấy bộ quy tắc với ID '${data.ruleSetId}'`);
    }

    return assessmentRecommendationRepository.createRuleVersion({
      ruleSetId: data.ruleSetId,
      rules: data.rules as any,
      changeLog: data.changeLog,
      createdBy: data.createdBy,
    });
  },

  async updateRuleVersion(
    versionId: string,
    user: UserContext,
    data: { rules: RuleDefinition[]; changeLog?: string | null }
  ) {
    if (user.role !== 'ADMIN') {
      throw new BadRequestError('Chỉ quản trị viên (ADMIN) mới có quyền chỉnh sửa quy tắc.');
    }

    const version = await assessmentRecommendationRepository.findRuleVersionById(versionId);
    if (!version) {
      throw new NotFoundError(`Không tìm thấy phiên bản quy tắc với ID '${versionId}'`);
    }

    if (version.status !== RuleVersionStatus.DRAFT) {
      throw new BadRequestError(
        `Không thể chỉnh sửa phiên bản quy tắc đã ở trạng thái ${version.status}. Chỉ có thể chỉnh sửa bản nháp (DRAFT).`
      );
    }

    return assessmentRecommendationRepository.updateRuleVersion(versionId, {
      rules: data.rules as any,
      changeLog: data.changeLog,
    });
  },

  async simulateRecommendations(
    versionId: string,
    user: UserContext,
    answers: Record<string, any>
  ) {
    if (user.role !== 'ADMIN') {
      throw new BadRequestError('Chỉ quản trị viên (ADMIN) mới có quyền thử nghiệm mô phỏng quy tắc.');
    }

    const version = await assessmentRecommendationRepository.findRuleVersionById(versionId);
    if (!version) {
      throw new NotFoundError(`Không tìm thấy phiên bản quy tắc với ID '${versionId}'`);
    }

    const rules = (version.rules as any as RuleDefinition[]) || [];

    const rawProducts = await prisma.product.findMany({
      where: { active: true },
      include: { financialDetail: true },
    });

    const candidates: ProductEvaluationCandidate[] = rawProducts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      active: p.active,
      financialDetail: p.financialDetail
        ? {
            category: p.financialDetail.category,
            providerName: p.financialDetail.providerName,
            minAmount: p.financialDetail.minAmount ? Number(p.financialDetail.minAmount) : null,
            maxAmount: p.financialDetail.maxAmount ? Number(p.financialDetail.maxAmount) : null,
            minInterestRate: p.financialDetail.minInterestRate ? Number(p.financialDetail.minInterestRate) : null,
            maxInterestRate: p.financialDetail.maxInterestRate ? Number(p.financialDetail.maxInterestRate) : null,
            minTenureMonths: p.financialDetail.minTenureMonths,
            maxTenureMonths: p.financialDetail.maxTenureMonths,
            feesDescription: p.financialDetail.feesDescription,
            minAge: p.financialDetail.minAge,
            maxAge: p.financialDetail.maxAge,
            minIncome: p.financialDetail.minIncome ? Number(p.financialDetail.minIncome) : null,
            acceptBadDebt: p.financialDetail.acceptBadDebt,
            effectiveFrom: p.financialDetail.effectiveFrom,
            effectiveTo: p.financialDetail.effectiveTo,
          }
        : null,
    }));

    const result = evaluateAssessmentRecommendations(answers, rules, candidates);

    return {
      simulation: true,
      ruleVersionId: version.id,
      ruleVersionNumber: version.versionNumber,
      totalCandidatesEvaluated: result.totalEvaluated,
      totalRecommended: result.totalRecommended,
      items: result.items,
      warnings: result.warnings,
    };
  },

  async publishRuleVersion(versionId: string, publishedBy?: string | null) {
    const version = await assessmentRecommendationRepository.findRuleVersionById(versionId);
    if (!version) {
      throw new NotFoundError(`Không tìm thấy phiên bản quy tắc với ID '${versionId}'`);
    }

    if (version.status === RuleVersionStatus.PUBLISHED) {
      return version; // Idempotent
    }

    if (version.status === RuleVersionStatus.ARCHIVED) {
      throw new BadRequestError('Không thể xuất bản lại phiên bản quy tắc đã lưu trữ (ARCHIVED).');
    }

    const rules = (version.rules as any as RuleDefinition[]) || [];
    if (rules.length === 0) {
      throw new BadRequestError('Không thể xuất bản phiên bản quy tắc không có quy tắc nào.');
    }

    return assessmentRecommendationRepository.publishRuleVersion(versionId, publishedBy);
  },

  // =========================================================================
  // AUTO-SEED DEFAULT RULE SET (STANDARDIZED OUT-OF-THE-BOX RULES)
  // =========================================================================

  async ensureDefaultRuleSetExists(adminUserId?: string) {
    let set = await assessmentRecommendationRepository.findRuleSetByCode('STANDARD_FINANCIAL_RULES');
    if (!set) {
      const created = await assessmentRecommendationRepository.createRuleSet({
        code: 'STANDARD_FINANCIAL_RULES',
        title: 'Bộ quy tắc gợi ý sản phẩm tài chính chuẩn KTEA',
        description: 'Tập quy tắc đánh giá nhu cầu vay, mở thẻ tín dụng và vay thế chấp xác định theo khảo sát khách hàng',
      });
      set = await assessmentRecommendationRepository.findRuleSetById(created.id);
    }

    if (!set) {
      throw new Error('Không thể khởi tạo bộ quy tắc mặc định');
    }

    const current = await assessmentRecommendationRepository.findCurrentPublishedRuleVersion('STANDARD_FINANCIAL_RULES');
    if (current) return current;

    const defaultRules: RuleDefinition[] = [
      {
        id: 'rule_loan_unsecured',
        code: 'RULE_LOAN_UNSECURED',
        name: 'Gợi ý Vay tiêu dùng tín chấp',
        description: 'Đánh giá hạn mức và khả năng vay tín chấp dựa trên số tiền và thu nhập',
        targetCategory: ProductCategory.LOAN_UNSECURED,
        hardConstraints: [
          {
            id: 'hc_prod_active_unsecured',
            description: 'Sản phẩm phải đang hoạt động và trong thời hạn',
            type: 'PRODUCT_ACTIVE',
            operator: 'EQUALS',
            missingDataPolicy: 'FAIL',
          },
          {
            id: 'hc_loan_amount_range',
            description: 'Số tiền vay mong muốn phải nằm trong hạn mức sản phẩm',
            type: 'NUMERIC_RANGE',
            questionCode: 'q_loan_amount',
            operator: 'BETWEEN',
            missingDataPolicy: 'WARN_AND_PASS',
          },
        ],
        softScoringCriteria: [
          {
            id: 'sc_purpose_loan',
            description: 'Nhu cầu vay tiêu dùng hoặc mở rộng kinh doanh',
            weight: 40,
            type: 'PREFERENCE_MATCH',
            questionCode: 'q_purpose',
            targetValue: 'LOAN',
          },
          {
            id: 'sc_tenure_preference',
            description: 'Kỳ hạn mong muốn phù hợp',
            weight: 30,
            type: 'TENURE_MATCH',
            questionCode: 'q_tenure_months',
          },
          {
            id: 'sc_income_stability',
            description: 'Có thu nhập ổn định trên 10 triệu/tháng',
            weight: 30,
            type: 'PREFERENCE_MATCH',
            questionCode: 'q_income_level',
            targetValue: 'ABOVE_10M',
          },
        ],
        minScoreThreshold: 40,
        enabled: true,
      },
      {
        id: 'rule_credit_card',
        code: 'RULE_CREDIT_CARD',
        name: 'Gợi ý Thẻ tín dụng & Cashback',
        description: 'Đánh giá điều kiện phát hành thẻ tín dụng chi tiêu linh hoạt',
        targetCategory: ProductCategory.CREDIT_CARD,
        hardConstraints: [
          {
            id: 'hc_prod_active_card',
            description: 'Sản phẩm phải đang hoạt động',
            type: 'PRODUCT_ACTIVE',
            operator: 'EQUALS',
            missingDataPolicy: 'FAIL',
          },
        ],
        softScoringCriteria: [
          {
            id: 'sc_purpose_card',
            description: 'Khách hàng có mong muốn mở thẻ tín dụng',
            weight: 50,
            type: 'PREFERENCE_MATCH',
            questionCode: 'q_purpose',
            targetValue: 'CARD',
          },
          {
            id: 'sc_card_lifestyle',
            description: 'Nhu cầu mua sắm và thanh toán không tiền mặt',
            weight: 50,
            type: 'ANSWER_VALUE_MATCH',
            questionCode: 'q_card_preference',
            targetValue: 'CASHBACK',
          },
        ],
        minScoreThreshold: 40,
        enabled: true,
      },
      {
        id: 'rule_loan_secured',
        code: 'RULE_LOAN_SECURED',
        name: 'Gợi ý Vay thế chấp tài sản bảo đảm',
        description: 'Dành cho khách hàng có tài sản bảo đảm (bất động sản, ô tô, sổ tiết kiệm)',
        targetCategory: ProductCategory.LOAN_SECURED,
        hardConstraints: [
          {
            id: 'hc_prod_active_secured',
            description: 'Sản phẩm đang hoạt động',
            type: 'PRODUCT_ACTIVE',
            operator: 'EQUALS',
            missingDataPolicy: 'FAIL',
          },
          {
            id: 'hc_has_collateral',
            description: 'Khách hàng phải có tài sản bảo đảm',
            type: 'BOOLEAN_FLAG',
            questionCode: 'q_has_collateral',
            operator: 'EQUALS',
            missingDataPolicy: 'FAIL',
          },
        ],
        softScoringCriteria: [
          {
            id: 'sc_collateral_bonus',
            description: 'Ưu tiên khách hàng có bất động sản hoặc sổ tiết kiệm',
            weight: 60,
            type: 'COLLATERAL_BONUS',
            questionCode: 'q_has_collateral',
          },
          {
            id: 'sc_large_amount',
            description: 'Khách hàng có nhu cầu vay trên 200 triệu VND',
            weight: 40,
            type: 'PREFERENCE_MATCH',
            questionCode: 'q_loan_amount_tier',
            targetValue: 'HIGH',
          },
        ],
        minScoreThreshold: 40,
        enabled: true,
      },
    ];

    const version = await assessmentRecommendationRepository.createRuleVersion({
      ruleSetId: set.id,
      rules: defaultRules as any,
      changeLog: 'Phiên bản khởi tạo hệ thống quy tắc đánh giá nhu cầu KTEA CRM',
      createdBy: adminUserId || 'Hệ thống',
    });

    return assessmentRecommendationRepository.publishRuleVersion(version.id, adminUserId || 'Hệ thống');
  },
};
