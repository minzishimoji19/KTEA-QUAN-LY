import { tagRepository } from '../repositories/tag.repository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import BaseService from './base.service.js';

export class TagService extends BaseService {
  async getAllTags() {
    return tagRepository.findAll();
  }

  async getTagById(id: string) {
    const tag = await tagRepository.findById(id);
    if (!tag) {
      throw new NotFoundError(`Tag with ID '${id}' not found`);
    }
    return tag;
  }

  async createTag(data: { name: string; color?: string | null }) {
    const existing = await tagRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError(`Tag with name '${data.name}' already exists`);
    }
    return tagRepository.create(data);
  }

  async updateTag(id: string, data: { name?: string; color?: string | null }) {
    await this.getTagById(id);
    if (data.name) {
      const existing = await tagRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Tag with name '${data.name}' already exists`);
      }
    }
    return tagRepository.update(id, data);
  }

  async deleteTag(id: string) {
    await this.getTagById(id);
    return tagRepository.delete(id);
  }
}

export const tagService = new TagService();
export default tagService;
