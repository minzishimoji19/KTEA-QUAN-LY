import { productRepository } from '../repositories/product.repository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class ProductService extends BaseService {
  async getAllProducts(activeOnly = false) {
    return productRepository.findAll(activeOnly);
  }

  async getProductById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }
    return product;
  }

  async createProduct(data: {
    code: string;
    name: string;
    description?: string | null;
    active?: boolean;
  }) {
    const existing = await productRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictError(`Product with code '${data.code}' already exists`);
    }
    return productRepository.create(data);
  }

  async updateProduct(id: string, data: {
    code?: string;
    name?: string;
    description?: string | null;
    active?: boolean;
  }) {
    await this.getProductById(id);
    if (data.code) {
      const existing = await productRepository.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Product with code '${data.code}' already exists`);
      }
    }
    return productRepository.update(id, data);
  }

  async deleteProduct(id: string) {
    const product = await this.getProductById(id);

    const counts = await prisma.product.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            cases: true,
            recommendations: true,
            pushRecords: true,
          },
        },
      },
    });

    const caseCount = counts?._count.cases ?? 0;
    const recCount = counts?._count.recommendations ?? 0;
    const pushCount = counts?._count.pushRecords ?? 0;
    const totalRefs = caseCount + recCount + pushCount;

    if (totalRefs > 0) {
      const details: string[] = [];
      if (caseCount > 0) details.push(`${caseCount} hồ sơ khách hàng`);
      if (recCount > 0) details.push(`${recCount} đề xuất sản phẩm`);
      if (pushCount > 0) details.push(`${pushCount} lượt chuyển khách`);
      throw new ConflictError(
        `Không thể xóa sản phẩm "${product.name}" do đang được liên kết với ${details.join(', ')}. Vui lòng tắt kích hoạt (Deactivate) sản phẩm thay vì xóa.`
      );
    }

    return productRepository.delete(id);
  }
}

export const productService = new ProductService();
export default productService;
