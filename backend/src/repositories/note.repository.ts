import BaseRepository from './base.repository.js';

export class NoteRepository extends BaseRepository {
  async findByCustomerId(customerId: string) {
    return this.db.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.customerNote.findUnique({
      where: { id },
    });
  }

  async create(customerId: string, content: string) {
    return this.db.customerNote.create({
      data: {
        customerId,
        content,
      },
    });
  }

  async update(id: string, content: string) {
    return this.db.customerNote.update({
      where: { id },
      data: { content },
    });
  }

  async delete(id: string) {
    return this.db.customerNote.delete({
      where: { id },
    });
  }
}

export const noteRepository = new NoteRepository();
export default noteRepository;
