import apiClient from './apiClient';
import { Product, ProductFinancialDetail } from '../types/models';

export interface CreateProductInput {
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  financialDetail?: Partial<ProductFinancialDetail> | null;
}

export interface UpdateProductInput {
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  financialDetail?: Partial<ProductFinancialDetail> | null;
}

export const productService = {
  getProducts: async (activeOnly = false): Promise<Product[]> => {
    return apiClient.get<Product[]>(`/products${activeOnly ? '?active=true' : ''}`);
  },

  getProductById: async (id: string): Promise<Product> => {
    return apiClient.get<Product>(`/products/${id}`);
  },

  createProduct: async (data: CreateProductInput): Promise<Product> => {
    return apiClient.post<Product>('/products', data);
  },

  updateProduct: async (id: string, data: UpdateProductInput): Promise<Product> => {
    return apiClient.patch<Product>(`/products/${id}`, data);
  },

  deleteProduct: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/products/${id}`);
  },
};

export default productService;
