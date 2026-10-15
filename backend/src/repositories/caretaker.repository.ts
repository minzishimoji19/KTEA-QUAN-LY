import BaseRepository from './base.repository.js';

export class CaretakerRepository extends BaseRepository {
  async findAll(activeOnly?: boolean) {
    return this.db.caretaker.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.db.caretaker.findUnique({
      where: { id },
    });
  }

  async findByName(name: string) {
    const trimmed = name.trim();
    return this.db.caretaker.findFirst({
      where: {
        name: {
          equals: trimmed,
        },
      },
    });
  }

  async create(data: { name: string; active?: boolean }) {
    return this.db.caretaker.create({
      data: {
        name: data.name.trim(),
        active: data.active ?? true,
      },
    });
  }

  async update(id: string, data: { name?: string; active?: boolean }) {
    return this.db.caretaker.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async countFollowUpsUsingName(name: string) {
    return this.db.followUp.count({
      where: {
        assignedTo: name.trim(),
      },
    });
  }

  async delete(id: string) {
    return this.db.caretaker.delete({
      where: { id },
    });
  }
}

export const caretakerRepository = new CaretakerRepository();
export default caretakerRepository;
