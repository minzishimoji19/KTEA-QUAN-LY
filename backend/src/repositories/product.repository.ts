import { Prisma } from '@prisma/client';
import BaseRepository from './base.repository.js';
import { FinancialDetailInput } from '../validations/product.validation.js';

export interface CreateProductRepoInput {
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  financialDetail?: FinancialDetailInput | null;
}

export interface UpdateProductRepoInput {
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  financialDetail?: FinancialDetailInput | null;
}

export class ProductRepository extends BaseRepository {
  async findAll(activeOnly = false) {
    return this.db.product.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
        financialDetail: true,
        _count: {
          select: {
            cases: true,
            recommendations: true,
            pushRecords: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.db.product.findUnique({
      where: { id },
      include: {
        financialDetail: true,
        _count: {
          select: {
            cases: true,
            recommendations: true,
            pushRecords: true,
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    return this.db.product.findUnique({
      where: { code },
      include: {
        financialDetail: true,
        _count: {
          select: {
            cases: true,
            recommendations: true,
            pushRecords: true,
          },
        },
      },
    });
  }

  async create(data: CreateProductRepoInput) {
    const { financialDetail, ...productData } = data;

    const createPayload: Prisma.ProductCreateInput = {
      ...productData,
    };

    if (financialDetail) {
      createPayload.financialDetail = {
        create: {
          category: financialDetail.category,
          providerName: financialDetail.providerName || null,
          minAmount: financialDetail.minAmount !== null && financialDetail.minAmount !== undefined ? financialDetail.minAmount : null,
          maxAmount: financialDetail.maxAmount !== null && financialDetail.maxAmount !== undefined ? financialDetail.maxAmount : null,
          minInterestRate: financialDetail.minInterestRate !== null && financialDetail.minInterestRate !== undefined ? financialDetail.minInterestRate : null,
          maxInterestRate: financialDetail.maxInterestRate !== null && financialDetail.maxInterestRate !== undefined ? financialDetail.maxInterestRate : null,
          interestRateUnit: financialDetail.interestRateUnit,
          minTenureMonths: financialDetail.minTenureMonths ?? null,
          maxTenureMonths: financialDetail.maxTenureMonths ?? null,
          feesDescription: financialDetail.feesDescription || null,
          minAge: financialDetail.minAge ?? null,
          maxAge: financialDetail.maxAge ?? null,
          minIncome: financialDetail.minIncome !== null && financialDetail.minIncome !== undefined ? financialDetail.minIncome : null,
          acceptBadDebt: financialDetail.acceptBadDebt ?? false,
          eligibilityCriteria: financialDetail.eligibilityCriteria as Prisma.InputJsonValue ?? Prisma.JsonNull,
          benefits: financialDetail.benefits as Prisma.InputJsonValue ?? Prisma.JsonNull,
          risks: financialDetail.risks as Prisma.InputJsonValue ?? Prisma.JsonNull,
          officialUrl: financialDetail.officialUrl || null,
          effectiveFrom: financialDetail.effectiveFrom ? new Date(financialDetail.effectiveFrom) : null,
          effectiveTo: financialDetail.effectiveTo ? new Date(financialDetail.effectiveTo) : null,
        },
      };
    }

    return this.db.product.create({
      data: createPayload,
      include: {
        financialDetail: true,
      },
    });
  }

  async update(id: string, data: UpdateProductRepoInput) {
    const { financialDetail, ...productData } = data;

    const updatePayload: Prisma.ProductUpdateInput = {
      ...productData,
    };

    if (financialDetail !== undefined) {
      if (financialDetail === null) {
        // Remove financial detail if explicitly set to null
        updatePayload.financialDetail = {
          delete: true,
        };
      } else {
        const detailFields = {
          category: financialDetail.category,
          providerName: financialDetail.providerName || null,
          minAmount: financialDetail.minAmount !== null && financialDetail.minAmount !== undefined ? financialDetail.minAmount : null,
          maxAmount: financialDetail.maxAmount !== null && financialDetail.maxAmount !== undefined ? financialDetail.maxAmount : null,
          minInterestRate: financialDetail.minInterestRate !== null && financialDetail.minInterestRate !== undefined ? financialDetail.minInterestRate : null,
          maxInterestRate: financialDetail.maxInterestRate !== null && financialDetail.maxInterestRate !== undefined ? financialDetail.maxInterestRate : null,
          interestRateUnit: financialDetail.interestRateUnit,
          minTenureMonths: financialDetail.minTenureMonths ?? null,
          maxTenureMonths: financialDetail.maxTenureMonths ?? null,
          feesDescription: financialDetail.feesDescription || null,
          minAge: financialDetail.minAge ?? null,
          maxAge: financialDetail.maxAge ?? null,
          minIncome: financialDetail.minIncome !== null && financialDetail.minIncome !== undefined ? financialDetail.minIncome : null,
          acceptBadDebt: financialDetail.acceptBadDebt ?? false,
          eligibilityCriteria: financialDetail.eligibilityCriteria as Prisma.InputJsonValue ?? Prisma.JsonNull,
          benefits: financialDetail.benefits as Prisma.InputJsonValue ?? Prisma.JsonNull,
          risks: financialDetail.risks as Prisma.InputJsonValue ?? Prisma.JsonNull,
          officialUrl: financialDetail.officialUrl || null,
          effectiveFrom: financialDetail.effectiveFrom ? new Date(financialDetail.effectiveFrom) : null,
          effectiveTo: financialDetail.effectiveTo ? new Date(financialDetail.effectiveTo) : null,
        };

        updatePayload.financialDetail = {
          upsert: {
            create: detailFields,
            update: detailFields,
          },
        };
      }
    }

    return this.db.product.update({
      where: { id },
      data: updatePayload,
      include: {
        financialDetail: true,
      },
    });
  }

  async delete(id: string) {
    return this.db.product.delete({
      where: { id },
    });
  }
}

export const productRepository = new ProductRepository();
export default productRepository;
