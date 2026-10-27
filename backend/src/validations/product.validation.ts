import { z } from 'zod';

export const productCategoryEnum = z.enum([
  'LOAN_UNSECURED',
  'LOAN_SECURED',
  'CREDIT_CARD',
  'INSURANCE',
  'SAVINGS',
  'OTHER',
]);

export const interestRateUnitEnum = z.enum([
  'PERCENT_PER_YEAR',
  'PERCENT_PER_MONTH',
]);

export const financialDetailInputSchema = z
  .object({
    category: productCategoryEnum.optional().default('OTHER'),
    providerName: z.string().max(100).optional().nullable(),
    minAmount: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val)))
      .refine((val) => val === null || val >= 0, {
        message: 'Hạn mức tối thiểu không được là số âm',
      }),
    maxAmount: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val)))
      .refine((val) => val === null || val >= 0, {
        message: 'Hạn mức tối đa không được là số âm',
      }),
    minInterestRate: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val)))
      .refine((val) => val === null || (val >= 0 && val <= 100), {
        message: 'Lãi suất tối thiểu phải từ 0% đến 100%',
      }),
    maxInterestRate: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val)))
      .refine((val) => val === null || (val >= 0 && val <= 100), {
        message: 'Lãi suất tối đa phải từ 0% đến 100%',
      }),
    interestRateUnit: interestRateUnitEnum.optional().default('PERCENT_PER_YEAR'),
    minTenureMonths: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : parseInt(String(val), 10)))
      .refine((val) => val === null || val > 0, {
        message: 'Kỳ hạn tối thiểu phải lớn hơn 0',
      }),
    maxTenureMonths: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : parseInt(String(val), 10)))
      .refine((val) => val === null || val > 0, {
        message: 'Kỳ hạn tối đa phải lớn hơn 0',
      }),
    feesDescription: z.string().max(2000).optional().nullable(),
    minAge: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : parseInt(String(val), 10)))
      .refine((val) => val === null || (val >= 18 && val <= 100), {
        message: 'Độ tuổi tối thiểu phải từ 18 trở lên',
      }),
    maxAge: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : parseInt(String(val), 10)))
      .refine((val) => val === null || (val >= 18 && val <= 100), {
        message: 'Độ tuổi tối đa phải hợp lệ (từ 18 đến 100)',
      }),
    minIncome: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => (val === '' || val === null || val === undefined ? null : Number(val)))
      .refine((val) => val === null || val >= 0, {
        message: 'Thu nhập tối thiểu không được là số âm',
      }),
    acceptBadDebt: z.boolean().optional().default(false),
    eligibilityCriteria: z
      .union([z.array(z.string()), z.record(z.unknown()), z.null()])
      .optional(),
    benefits: z.array(z.string().max(255)).optional().nullable(),
    risks: z.array(z.string().max(255)).optional().nullable(),
    officialUrl: z
      .string()
      .url('Đường dẫn thông tin chính thức phải là URL hợp lệ (http/https)')
      .max(500)
      .optional()
      .nullable()
      .or(z.literal('')),
    effectiveFrom: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Ngày bắt đầu hiệu lực không hợp lệ',
      }),
    effectiveTo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Ngày kết thúc hiệu lực không hợp lệ',
      }),
  })
  .superRefine((data, ctx) => {
    // Constraint minAmount <= maxAmount
    if (
      data.minAmount !== null &&
      data.maxAmount !== null &&
      data.minAmount !== undefined &&
      data.maxAmount !== undefined
    ) {
      if (data.maxAmount < data.minAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Hạn mức tối đa phải lớn hơn hoặc bằng hạn mức tối thiểu',
          path: ['maxAmount'],
        });
      }
    }
    // Constraint minInterestRate <= maxInterestRate
    if (
      data.minInterestRate !== null &&
      data.maxInterestRate !== null &&
      data.minInterestRate !== undefined &&
      data.maxInterestRate !== undefined
    ) {
      if (data.maxInterestRate < data.minInterestRate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Lãi suất tối đa phải lớn hơn hoặc bằng lãi suất tối thiểu',
          path: ['maxInterestRate'],
        });
      }
    }
    // Constraint minTenureMonths <= maxTenureMonths
    if (
      data.minTenureMonths !== null &&
      data.maxTenureMonths !== null &&
      data.minTenureMonths !== undefined &&
      data.maxTenureMonths !== undefined
    ) {
      if (data.maxTenureMonths < data.minTenureMonths) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kỳ hạn tối đa phải lớn hơn hoặc bằng kỳ hạn tối thiểu',
          path: ['maxTenureMonths'],
        });
      }
    }
    // Constraint minAge <= maxAge
    if (
      data.minAge !== null &&
      data.maxAge !== null &&
      data.minAge !== undefined &&
      data.maxAge !== undefined
    ) {
      if (data.maxAge < data.minAge) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Độ tuổi tối đa phải lớn hơn hoặc bằng độ tuổi tối thiểu',
          path: ['maxAge'],
        });
      }
    }
    // Constraint effectiveFrom <= effectiveTo
    if (data.effectiveFrom && data.effectiveTo) {
      const from = new Date(data.effectiveFrom).getTime();
      const to = new Date(data.effectiveTo).getTime();
      if (!isNaN(from) && !isNaN(to) && to < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ngày kết thúc hiệu lực phải sau ngày bắt đầu hiệu lực',
          path: ['effectiveTo'],
        });
      }
    }
  });

export const createProductSchema = z.object({
  code: z
    .string()
    .min(1, 'Mã sản phẩm không được để trống')
    .max(50, 'Mã sản phẩm tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã sản phẩm chỉ được chứa chữ cái, số, gạch dưới và gạch ngang'),
  name: z.string().min(1, 'Tên sản phẩm không được để trống').max(255, 'Tên sản phẩm tối đa 255 ký tự'),
  description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional().nullable(),
  active: z.boolean().optional().default(true),
  financialDetail: financialDetailInputSchema.optional().nullable(),
});

export const updateProductSchema = z.object({
  code: z
    .string()
    .min(1, 'Mã sản phẩm không được để trống')
    .max(50, 'Mã sản phẩm tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã sản phẩm chỉ được chứa chữ cái, số, gạch dưới và gạch ngang')
    .optional(),
  name: z.string().min(1, 'Tên sản phẩm không được để trống').max(255, 'Tên sản phẩm tối đa 255 ký tự').optional(),
  description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional().nullable(),
  active: z.boolean().optional(),
  financialDetail: financialDetailInputSchema.optional().nullable(),
});

export const productIdParamSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type FinancialDetailInput = z.infer<typeof financialDetailInputSchema>;
