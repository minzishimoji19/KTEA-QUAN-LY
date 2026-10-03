import { productRepository } from '../repositories/product.repository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import BaseService from './base.service.js';

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
    await this.getProductById(id);
    return productRepository.delete(id);
  }
}

export const productService = new ProductService();
export default productService;
