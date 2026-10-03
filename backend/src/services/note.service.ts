import { noteRepository } from '../repositories/note.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';

export class NoteService extends BaseService {
  async getNotesByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return noteRepository.findByCustomerId(customerId);
  }

  async getNoteById(id: string) {
    const note = await noteRepository.findById(id);
    if (!note) {
      throw new NotFoundError(`Note with ID '${id}' not found`);
    }
    return note;
  }

  async createNote(customerId: string, content: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return noteRepository.create(customerId, content);
  }

  async updateNote(id: string, content: string) {
    await this.getNoteById(id);
    return noteRepository.update(id, content);
  }

  async deleteNote(id: string) {
    await this.getNoteById(id);
    return noteRepository.delete(id);
  }
}

export const noteService = new NoteService();
export default noteService;
