import { customerSourceRepository } from '../repositories/customerSource.repository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import BaseService from './base.service.js';

export class CustomerSourceService extends BaseService {
  async getAllSources(activeOnly?: boolean) {
    return customerSourceRepository.findAll(activeOnly);
  }

  async getSourceById(id: string) {
    const source = await customerSourceRepository.findById(id);
    if (!source) {
      throw new NotFoundError(`Customer source with ID '${id}' not found`);
    }
    return source;
  }

  async createSource(data: { name: string; active?: boolean }) {
    const trimmed = data.name.trim();
    const existing = await customerSourceRepository.findByName(trimmed);
    if (existing) {
      throw new ConflictError(`Customer source with name '${trimmed}' already exists`);
    }
    return customerSourceRepository.create({
      name: trimmed,
      active: data.active ?? true,
    });
  }

  async updateSource(id: string, data: { name?: string; active?: boolean }) {
    await this.getSourceById(id);
    if (data.name) {
      const trimmed = data.name.trim();
      const existing = await customerSourceRepository.findByName(trimmed);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Customer source with name '${trimmed}' already exists`);
      }
    }
    return customerSourceRepository.update(id, data);
  }

  async deactivateSource(id: string) {
    await this.getSourceById(id);
    return customerSourceRepository.update(id, { active: false });
  }

  async deleteSource(id: string) {
    await this.getSourceById(id);
    const inUseCount = await customerSourceRepository.countCustomersUsingSource(id);
    if (inUseCount > 0) {
      throw new ConflictError(
        `Cannot delete source that is associated with ${inUseCount} customer(s). Please deactivate it instead.`
      );
    }
    return customerSourceRepository.delete(id);
  }
}

export const customerSourceService = new CustomerSourceService();
export default customerSourceService;
