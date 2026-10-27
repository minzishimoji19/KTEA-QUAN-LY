import { z } from 'zod';
import { ProductCategory } from '@prisma/client';

// =========================================================================
// RULE CONFIGURATION SCHEMAS (ZOD)
// =========================================================================

export const MissingDataPolicySchema = z.enum(['FAIL', 'SKIP', 'WARN_AND_PASS']);
export type MissingDataPolicy = z.infer<typeof MissingDataPolicySchema>;

export const ConstraintOperatorSchema = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_EQUAL',
  'LESS_EQUAL',
  'BETWEEN',
  'IN',
  'NOT_IN',
]);
export type ConstraintOperator = z.infer<typeof ConstraintOperatorSchema>;

export const HardConstraintDefinitionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: z.enum([
    'CATEGORY_MATCH',
    'NUMERIC_RANGE',
    'NUMERIC_MIN',
    'NUMERIC_MAX',
    'BOOLEAN_FLAG',
    'ANSWER_EQUALS',
    'ANSWER_IN',
    'PRODUCT_ACTIVE',
  ]),
  questionCode: z.string().optional().nullable(),
  productField: z
    .enum([
      'minAmount',
      'maxAmount',
      'minInterestRate',
      'maxInterestRate',
      'minTenureMonths',
      'maxTenureMonths',
      'minIncome',
      'minAge',
      'maxAge',
      'acceptBadDebt',
      'category',
      'active',
      'effectiveFrom',
      'effectiveTo',
    ])
    .optional()
    .nullable(),
  operator: ConstraintOperatorSchema.default('EQUALS'),
  expectedValue: z.any().optional(),
  missingDataPolicy: MissingDataPolicySchema.default('SKIP'),
});
export type HardConstraintDefinition = z.infer<typeof HardConstraintDefinitionSchema>;

export const SoftScoringCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().min(1, 'Trọng số phải lớn hơn 0').max(100, 'Trọng số tối đa là 100'),
  type: z.enum([
    'PREFERENCE_MATCH',
    'TENURE_MATCH',
    'COLLATERAL_BONUS',
    'ANSWER_VALUE_MATCH',
    'NUMERIC_PROXIMITY',
  ]),
  questionCode: z.string().optional().nullable(),
  productField: z.string().optional().nullable(),
  operator: z.string().optional().nullable(),
  targetValue: z.any().optional(),
});
export type SoftScoringCriterion = z.infer<typeof SoftScoringCriterionSchema>;

export const RuleDefinitionSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/, 'Mã quy tắc chỉ được chứa chữ hoa, số và dấu gạch dưới'),
  name: z.string().min(1, 'Tên quy tắc không được để trống'),
  description: z.string().optional().nullable(),
  targetCategory: z.nativeEnum(ProductCategory).optional().nullable(),
  hardConstraints: z.array(HardConstraintDefinitionSchema).default([]),
  softScoringCriteria: z.array(SoftScoringCriterionSchema).default([]),
  minScoreThreshold: z.number().min(0).max(100).default(30),
  enabled: z.boolean().default(true),
});
export type RuleDefinition = z.infer<typeof RuleDefinitionSchema>;

export const createRuleSetSchema = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/, 'Mã bộ quy tắc chỉ được chứa chữ hoa, số và dấu gạch dưới'),
  title: z.string().min(1, 'Tiêu đề bộ quy tắc không được để trống'),
  description: z.string().optional().nullable(),
});

export const createRuleVersionSchema = z.object({
  rules: z.array(RuleDefinitionSchema).min(1, 'Bộ quy tắc cần có ít nhất một quy tắc đánh giá'),
  changeLog: z.string().optional().nullable(),
});

export const updateRuleVersionSchema = z.object({
  rules: z.array(RuleDefinitionSchema).min(1, 'Bộ quy tắc cần có ít nhất một quy tắc đánh giá'),
  changeLog: z.string().optional().nullable(),
});

export const simulateRecommendationSchema = z.object({
  answers: z.record(z.any()),
});

export const runRecommendationSchema = z.object({
  notes: z.string().optional().nullable(),
  ruleVersionId: z.string().optional().nullable(), // Optional: if omitted, use current published rule version
});

export const runIdParamSchema = z.object({
  runId: z.string().uuid('ID lượt gợi ý không đúng định dạng UUID'),
});

// =========================================================================
// PURE EVALUATION ENGINE INTERFACES
// =========================================================================

export interface ProductEvaluationCandidate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  financialDetail?: {
    category: ProductCategory;
    providerName?: string | null;
    minAmount?: number | null;
    maxAmount?: number | null;
    minInterestRate?: number | null;
    maxInterestRate?: number | null;
    minTenureMonths?: number | null;
    maxTenureMonths?: number | null;
    feesDescription?: string | null;
    minAge?: number | null;
    maxAge?: number | null;
    minIncome?: number | null;
    acceptBadDebt?: boolean | null;
    effectiveFrom?: Date | string | null;
    effectiveTo?: Date | string | null;
  } | null;
}

export interface EvaluatedRecommendationItem {
  productId: string;
  productName: string;
  productCode: string;
  productCategory: ProductCategory;
  productSnapshot: any;
  score: number;
  confidence: number; // Percentage (0-100) of evaluable soft criteria that had customer data available
  rank: number;
  isEligible: boolean; // Independent of score: true if all hard constraints pass
  matchSummary: string;
  passedCriteria: Array<{ id: string; description: string; details?: string }>;
  failedCriteria: Array<{ id: string; description: string; reason: string }>;
  unassessedCriteria: Array<{ id: string; description: string; missingField: string; reason: string }>;
  warnings: string[];
  answersUsed: Array<{ questionCode: string; answerValue: any }>;
}

export interface EvaluationResult {
  items: EvaluatedRecommendationItem[];
  totalEvaluated: number;
  totalRecommended: number;
  warnings: string[];
}

// =========================================================================
// PURE DETERMINISTIC RECOMMENDATION ENGINE
// =========================================================================

/**
 * Evaluates customer assessment answers against published rule definitions and active products.
 * Guarantees:
 * 1. Deterministic (same answers + same rules + same products = exact same results & rankings)
 * 2. Explainable (every item records passed, failed, unassessed criteria, and answers used)
 * 3. Safe missing data handling (never coerces null/undefined to 0 or false)
 * 4. Independent eligibility & scoring (isEligible reflects hard constraints; score reflects true preference match)
 * 5. Assessment confidence metric indicating data completeness
 */
export function evaluateAssessmentRecommendations(
  answersMap: Record<string, any>,
  rules: RuleDefinition[],
  products: ProductEvaluationCandidate[]
): EvaluationResult {
  const evaluatedItems: EvaluatedRecommendationItem[] = [];
  const globalWarnings: string[] = [];

  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length === 0) {
    globalWarnings.push('Không có quy tắc gợi ý nào đang hoạt động.');
    return { items: [], totalEvaluated: products.length, totalRecommended: 0, warnings: globalWarnings };
  }

  for (const product of products) {
    const fin = product.financialDetail;
    const productCategory = fin?.category || ProductCategory.OTHER;

    // Filter rules applicable to this product category
    const applicableRules = activeRules.filter((r) => {
      if (!r.targetCategory) return true; // applies to all categories
      return r.targetCategory === productCategory;
    });

    if (applicableRules.length === 0) {
      continue;
    }

    // Evaluate product against the most specific applicable rule
    const rule = applicableRules[0];

    const passedCriteria: Array<{ id: string; description: string; details?: string }> = [];
    const failedCriteria: Array<{ id: string; description: string; reason: string }> = [];
    const unassessedCriteria: Array<{ id: string; description: string; missingField: string; reason: string }> = [];
    const warnings: string[] = [];
    const answersUsedMap = new Map<string, any>();

    let isEligible = true;

    // 1. HARD CONSTRAINTS EVALUATION
    for (const hc of rule.hardConstraints) {
      const qVal = hc.questionCode ? answersMap[hc.questionCode] : undefined;
      if (hc.questionCode && qVal !== undefined && qVal !== null) {
        answersUsedMap.set(hc.questionCode, qVal);
      }

      // Check product active status and effective date range
      if (hc.type === 'PRODUCT_ACTIVE') {
        if (!product.active) {
          isEligible = false;
          failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Sản phẩm đang tạm ngưng hoạt động' });
          continue;
        }

        const now = new Date();

        // Check if effectiveFrom > effectiveTo (invalid date configuration)
        if (fin?.effectiveFrom && fin?.effectiveTo && new Date(fin.effectiveFrom) > new Date(fin.effectiveTo)) {
          isEligible = false;
          failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Khoảng thời gian hiệu lực của sản phẩm không hợp lệ (ngày bắt đầu lớn hơn ngày kết thúc)' });
          continue;
        }

        // Check if effectiveFrom is in the future
        if (fin?.effectiveFrom && new Date(fin.effectiveFrom) > now) {
          isEligible = false;
          failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Sản phẩm chưa đến ngày có hiệu lực áp dụng' });
          continue;
        }

        // Check if effectiveTo has passed
        if (fin?.effectiveTo && new Date(fin.effectiveTo) < now) {
          isEligible = false;
          failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Sản phẩm đã hết thời hạn hiệu lực' });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: 'Sản phẩm đang hoạt động và có hiệu lực' });
        continue;
      }

      // Check category match
      if (hc.type === 'CATEGORY_MATCH') {
        if (hc.expectedValue && productCategory !== hc.expectedValue) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Danh mục sản phẩm (${productCategory}) không khớp danh mục yêu cầu (${hc.expectedValue})`,
          });
          continue;
        }
        passedCriteria.push({ id: hc.id, description: hc.description, details: `Khớp danh mục ${productCategory}` });
        continue;
      }

      // Check Numeric Range (e.g. loan amount requested vs product min/max amount)
      if (hc.type === 'NUMERIC_RANGE') {
        const amount = typeof qVal === 'number' ? qVal : Number(qVal);
        if (qVal === undefined || qVal === null || isNaN(amount)) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Khách hàng chưa cung cấp số tiền mong muốn' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'amount',
              reason: 'Chưa có thông tin số tiền mong muốn trong khảo sát',
            });
            if (hc.missingDataPolicy === 'WARN_AND_PASS') {
              warnings.push('Chưa xác định số tiền mong muốn; cần kiểm tra hạn mức thực tế');
            }
          }
          continue;
        }

        const minAmt = fin?.minAmount ? Number(fin.minAmount) : null;
        const maxAmt = fin?.maxAmount ? Number(fin.maxAmount) : null;

        if (minAmt !== null && amount < minAmt) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Số tiền yêu cầu (${amount.toLocaleString('vi-VN')} đ) nhỏ hơn hạn mức tối thiểu (${minAmt.toLocaleString('vi-VN')} đ)`,
          });
          continue;
        }

        if (maxAmt !== null && amount > maxAmt) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Số tiền yêu cầu (${amount.toLocaleString('vi-VN')} đ) vượt quá hạn mức tối đa (${maxAmt.toLocaleString('vi-VN')} đ)`,
          });
          continue;
        }

        passedCriteria.push({
          id: hc.id,
          description: hc.description,
          details: `Số tiền ${amount.toLocaleString('vi-VN')} đ nằm trong hạn mức (${minAmt ? minAmt.toLocaleString('vi-VN') : '0'} - ${maxAmt ? maxAmt.toLocaleString('vi-VN') : '∞'} đ)`,
        });
        continue;
      }

      // Check Numeric Min (e.g. income requirement)
      if (hc.type === 'NUMERIC_MIN') {
        const val = typeof qVal === 'number' ? qVal : Number(qVal);
        const reqMin = hc.productField && fin ? Number((fin as any)[hc.productField]) : Number(hc.expectedValue);

        if (isNaN(reqMin)) {
          unassessedCriteria.push({
            id: hc.id,
            description: hc.description,
            missingField: hc.productField || 'min',
            reason: 'Sản phẩm chưa cấu hình tiêu chuẩn tối thiểu',
          });
          continue;
        }

        if (qVal === undefined || qVal === null || isNaN(val)) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Chưa có thông tin khảo sát tương ứng' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'min',
              reason: 'Chưa có dữ liệu khảo sát để xác minh điều kiện tối thiểu',
            });
            if (hc.missingDataPolicy === 'WARN_AND_PASS') {
              warnings.push(`Chưa xác minh ${hc.description}; chuyên viên cần kiểm tra hồ sơ thu nhập`);
            }
          }
          continue;
        }

        if (val < reqMin) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Dữ liệu khảo sát (${val}) không đạt yêu cầu tối thiểu (${reqMin})`,
          });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: `Đạt yêu cầu (${val} >= ${reqMin})` });
        continue;
      }

      // Check Numeric Max (e.g. max age requirement)
      if (hc.type === 'NUMERIC_MAX') {
        const val = typeof qVal === 'number' ? qVal : Number(qVal);
        const reqMax = hc.productField && fin ? Number((fin as any)[hc.productField]) : Number(hc.expectedValue);

        if (isNaN(reqMax)) {
          unassessedCriteria.push({
            id: hc.id,
            description: hc.description,
            missingField: hc.productField || 'max',
            reason: 'Sản phẩm chưa cấu hình tiêu chuẩn tối đa',
          });
          continue;
        }

        if (qVal === undefined || qVal === null || isNaN(val)) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Chưa có thông tin khảo sát tương ứng' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'max',
              reason: 'Chưa có dữ liệu khảo sát để xác minh điều kiện tối đa',
            });
            if (hc.missingDataPolicy === 'WARN_AND_PASS') {
              warnings.push(`Chưa xác minh ${hc.description}; chuyên viên cần kiểm tra`);
            }
          }
          continue;
        }

        if (val > reqMax) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Dữ liệu khảo sát (${val}) vượt quá mức tối đa cho phép (${reqMax})`,
          });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: `Đạt yêu cầu (${val} <= ${reqMax})` });
        continue;
      }

      // Check Boolean Flag (e.g. q_has_collateral, acceptBadDebt)
      if (hc.type === 'BOOLEAN_FLAG') {
        if (qVal === undefined || qVal === null) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Chưa có thông tin xác nhận tiêu chí' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'flag',
              reason: 'Dữ liệu cờ khảo sát chưa được cung cấp',
            });
            if (hc.missingDataPolicy === 'WARN_AND_PASS') {
              warnings.push(`Chưa xác minh ${hc.description}`);
            }
          }
          continue;
        }

        const boolVal = Boolean(qVal);
        const targetExpected = hc.expectedValue !== undefined ? Boolean(hc.expectedValue) : true;

        if (boolVal !== targetExpected) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Tiêu chí không đáp ứng: cần ${targetExpected ? 'Có' : 'Không'} nhưng khảo sát ghi nhận ${boolVal ? 'Có' : 'Không'}`,
          });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: 'Phù hợp tiêu chuẩn điều kiện' });
        continue;
      }

      // Check Answer Equals
      if (hc.type === 'ANSWER_EQUALS') {
        if (qVal === undefined || qVal === null) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Câu hỏi chưa được trả lời' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'answer',
              reason: 'Chưa trả lời câu hỏi',
            });
          }
          continue;
        }

        if (String(qVal) !== String(hc.expectedValue)) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Câu trả lời (${qVal}) không khớp với giá trị yêu cầu (${hc.expectedValue})`,
          });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: `Khớp câu trả lời: ${qVal}` });
        continue;
      }

      // Check Answer In
      if (hc.type === 'ANSWER_IN') {
        if (qVal === undefined || qVal === null) {
          if (hc.missingDataPolicy === 'FAIL') {
            isEligible = false;
            failedCriteria.push({ id: hc.id, description: hc.description, reason: 'Câu hỏi chưa được trả lời' });
          } else {
            unassessedCriteria.push({
              id: hc.id,
              description: hc.description,
              missingField: hc.questionCode || 'answer',
              reason: 'Chưa trả lời câu hỏi',
            });
          }
          continue;
        }

        const allowed = Array.isArray(hc.expectedValue) ? hc.expectedValue : [hc.expectedValue];
        const inList = allowed.map(String).includes(String(qVal));

        if (!inList) {
          isEligible = false;
          failedCriteria.push({
            id: hc.id,
            description: hc.description,
            reason: `Câu trả lời (${qVal}) không nằm trong danh sách được chấp nhận`,
          });
          continue;
        }

        passedCriteria.push({ id: hc.id, description: hc.description, details: `Giá trị (${qVal}) hợp lệ` });
        continue;
      }
    }

    // 2. SOFT SCORING CRITERIA EVALUATION
    let rawScore = 0;
    let totalPossibleWeight = 0;
    let evaluatedWeight = 0;

    for (const sc of rule.softScoringCriteria) {
      totalPossibleWeight += sc.weight;
      const qVal = sc.questionCode ? answersMap[sc.questionCode] : undefined;
      const hasAnswer = qVal !== undefined && qVal !== null;

      if (hasAnswer && sc.questionCode) {
        answersUsedMap.set(sc.questionCode, qVal);
        evaluatedWeight += sc.weight;
      }

      if (sc.type === 'PREFERENCE_MATCH') {
        if (hasAnswer) {
          const match = Array.isArray(qVal)
            ? qVal.includes(sc.targetValue)
            : String(qVal) === String(sc.targetValue);

          if (match) {
            rawScore += sc.weight;
            passedCriteria.push({
              id: sc.id,
              description: sc.description,
              details: `+${sc.weight} điểm: Nhu cầu của khách hàng hoàn toàn khớp đặc tính sản phẩm`,
            });
          } else {
            failedCriteria.push({
              id: sc.id,
              description: sc.description,
              reason: `Không khớp ưu tiên lựa chọn (${qVal} khác ${sc.targetValue})`,
            });
          }
        } else {
          unassessedCriteria.push({
            id: sc.id,
            description: sc.description,
            missingField: sc.questionCode || 'preference',
            reason: 'Khách hàng không nêu ưu tiên này trong khảo sát',
          });
        }
        continue;
      }

      if (sc.type === 'COLLATERAL_BONUS') {
        if (hasAnswer) {
          const hasCollateral = Boolean(qVal);
          if (hasCollateral) {
            rawScore += sc.weight;
            passedCriteria.push({
              id: sc.id,
              description: sc.description,
              details: `+${sc.weight} điểm: Có tài sản bảo đảm tăng tính an toàn và khả năng tiếp cận gói vay ưu đãi`,
            });
          } else {
            failedCriteria.push({
              id: sc.id,
              description: sc.description,
              reason: 'Không có tài sản bảo đảm để áp dụng ưu đãi cộng điểm',
            });
          }
        } else {
          unassessedCriteria.push({
            id: sc.id,
            description: sc.description,
            missingField: sc.questionCode || 'collateral',
            reason: 'Chưa có thông tin về tài sản bảo đảm',
          });
        }
        continue;
      }

      if (sc.type === 'TENURE_MATCH') {
        if (hasAnswer) {
          const tenureMonths = Number(qVal);
          const minT = fin?.minTenureMonths ?? 0;
          const maxT = fin?.maxTenureMonths ?? 120;

          if (!isNaN(tenureMonths) && tenureMonths >= minT && tenureMonths <= maxT) {
            rawScore += sc.weight;
            passedCriteria.push({
              id: sc.id,
              description: sc.description,
              details: `+${sc.weight} điểm: Kỳ hạn mong muốn (${tenureMonths} tháng) nằm trong khung sản phẩm (${minT}-${maxT} tháng)`,
            });
          } else {
            failedCriteria.push({
              id: sc.id,
              description: sc.description,
              reason: `Kỳ hạn mong muốn (${tenureMonths} tháng) không khớp khung sản phẩm (${minT}-${maxT} tháng)`,
            });
          }
        } else {
          unassessedCriteria.push({
            id: sc.id,
            description: sc.description,
            missingField: sc.questionCode || 'tenure',
            reason: 'Chưa có thông tin kỳ hạn mong muốn',
          });
        }
        continue;
      }

      if (sc.type === 'ANSWER_VALUE_MATCH') {
        if (hasAnswer) {
          if (String(qVal) === String(sc.targetValue)) {
            rawScore += sc.weight;
            passedCriteria.push({
              id: sc.id,
              description: sc.description,
              details: `+${sc.weight} điểm: Khớp tiêu chí câu trả lời (${sc.targetValue})`,
            });
          } else {
            failedCriteria.push({
              id: sc.id,
              description: sc.description,
              reason: `Câu trả lời (${qVal}) khác giá trị ưu tiên (${sc.targetValue})`,
            });
          }
        } else {
          unassessedCriteria.push({
            id: sc.id,
            description: sc.description,
            missingField: sc.questionCode || 'answer',
            reason: 'Chưa có câu trả lời cho tiêu chí này',
          });
        }
        continue;
      }

      if (sc.type === 'NUMERIC_PROXIMITY') {
        if (hasAnswer) {
          const numVal = Number(qVal);
          const target = Number(
            sc.targetValue ??
            (sc.productField && fin ? (fin as any)[sc.productField] : (fin?.minAmount ?? (fin as any)?.maxAmount ?? NaN))
          );
          if (!isNaN(numVal) && !isNaN(target) && target > 0) {
            const diffRatio = Math.abs(numVal - target) / target;
            if (diffRatio <= 0.1) {
              rawScore += sc.weight;
              passedCriteria.push({
                id: sc.id,
                description: sc.description,
                details: `+${sc.weight} điểm: Rất gần mức mục tiêu (chênh lệch <= 10%)`,
              });
            } else if (diffRatio <= 0.3) {
              const partial = Math.round(sc.weight * 0.6);
              rawScore += partial;
              passedCriteria.push({
                id: sc.id,
                description: sc.description,
                details: `+${partial} điểm: Gần mức mục tiêu (chênh lệch <= 30%)`,
              });
            } else {
              failedCriteria.push({
                id: sc.id,
                description: sc.description,
                reason: `Chênh lệch quá lớn so với mục tiêu (${numVal} so với ${target})`,
              });
            }
          } else {
            unassessedCriteria.push({
              id: sc.id,
              description: sc.description,
              missingField: sc.questionCode || 'numeric',
              reason: 'Chưa có thông số chuẩn để đánh giá khoảng cách',
            });
          }
        } else {
          unassessedCriteria.push({
            id: sc.id,
            description: sc.description,
            missingField: sc.questionCode || 'numeric',
            reason: 'Chưa có câu trả lời số liệu',
          });
        }
        continue;
      }
    }

    // 3. SCORE & CONFIDENCE CALCULATION (Zero magic numbers, no artificial floors/ceilings)
    let finalScore = 0;
    let confidence = 100;

    if (totalPossibleWeight === 0) {
      // Rule has no soft criteria: Score is 100 if all hard constraints pass, 0 if not
      finalScore = isEligible ? 100 : 0;
      confidence = 100;
    } else if (evaluatedWeight > 0) {
      // Normalize score based on evaluated criteria weight
      finalScore = Math.min(100, Math.max(0, Math.round((rawScore / evaluatedWeight) * 100)));
      confidence = Math.min(100, Math.max(0, Math.round((evaluatedWeight / totalPossibleWeight) * 100)));
    } else {
      // Total weight > 0 but none of the questions were answered
      finalScore = 0;
      confidence = 0;
      warnings.push('Chưa có thông tin sở thích/nhu cầu chi tiết để chấm điểm mức độ phù hợp');
    }

    // Build human-readable match summary
    const summaryParts: string[] = [];
    if (isEligible) {
      if (finalScore >= 70) {
        summaryParts.push(`Sản phẩm rất phù hợp nhu cầu (Điểm phù hợp: ${finalScore}%, Độ tin cậy: ${confidence}%).`);
      } else if (finalScore >= 40) {
        summaryParts.push(`Sản phẩm đáp ứng điều kiện cơ bản (Điểm phù hợp: ${finalScore}%, Độ tin cậy: ${confidence}%).`);
      } else {
        summaryParts.push(`Sản phẩm đủ điều kiện tiên quyết nhưng ít điểm tương đồng về sở thích (Điểm: ${finalScore}%).`);
      }

      if (passedCriteria.length > 0) {
        summaryParts.push(passedCriteria.map((c) => c.details || c.description).slice(0, 2).join('; ') + '.');
      }
      if (warnings.length > 0) {
        summaryParts.push(`Lưu ý: ${warnings.join(', ')}.`);
      }
    } else {
      summaryParts.push('Sản phẩm chưa đáp ứng một số điều kiện bắt buộc:');
      summaryParts.push(failedCriteria.map((c) => c.reason).join('; ') + '.');
    }

    const answersUsedArray = Array.from(answersUsedMap.entries()).map(([questionCode, answerValue]) => ({
      questionCode,
      answerValue,
    }));

    evaluatedItems.push({
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      productCategory,
      productSnapshot: {
        id: product.id,
        code: product.code,
        name: product.name,
        description: product.description,
        active: product.active,
        financialDetail: fin ? { ...fin } : null,
      },
      score: finalScore,
      confidence,
      rank: 1, // assigned after sorting
      isEligible,
      matchSummary: summaryParts.join(' '),
      passedCriteria,
      failedCriteria,
      unassessedCriteria,
      warnings,
      answersUsed: answersUsedArray,
    });
  }

  // 4. DETERMINISTIC SORTING & RANKING
  // Primary: isEligible DESC (eligible first)
  // Secondary: score DESC
  // Tertiary: confidence DESC (more complete data first)
  // Quaternary: productName ASC (deterministic tie-break)
  // Quinary: productId ASC (absolute stability)
  evaluatedItems.sort((a, b) => {
    if (a.isEligible !== b.isEligible) {
      return a.isEligible ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    const nameCmp = a.productName.localeCompare(b.productName);
    if (nameCmp !== 0) return nameCmp;
    return a.productId.localeCompare(b.productId);
  });

  // Assign ranks
  evaluatedItems.forEach((item, index) => {
    item.rank = index + 1;
  });

  const totalRecommended = evaluatedItems.filter((item) => item.isEligible && item.score >= 40).length;

  return {
    items: evaluatedItems,
    totalEvaluated: products.length,
    totalRecommended,
    warnings: globalWarnings,
  };
}
