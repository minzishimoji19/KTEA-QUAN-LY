import { Prisma } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class ProductRepository extends BaseRepository {
  async findAll(activeOnly = false) {
    return this.db.product.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
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
    });
  }

  async findByCode(code: string) {
    return this.db.product.findUnique({
      where: { code },
    });
  }

  async create(data: {
    code: string;
    name: string;
    description?: string | null;
    active?: boolean;
  }) {
    return this.db.product.create({
      data,
    });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return this.db.product.update({
      where: { id },
      data,
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
