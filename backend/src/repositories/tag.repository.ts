import BaseRepository from './base.repository.js';

export class TagRepository extends BaseRepository {
  async findAll() {
    return this.db.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { customerTags: true },
        },
      },
    });
  }

  async findById(id: string) {
    return this.db.tag.findUnique({
      where: { id },
    });
  }

  async findByName(name: string) {
    return this.db.tag.findUnique({
      where: { name },
    });
  }

  async create(data: { name: string; color?: string | null }) {
    return this.db.tag.create({
      data,
    });
  }

  async update(id: string, data: { name?: string; color?: string | null }) {
    return this.db.tag.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.tag.delete({
      where: { id },
    });
  }
}

export const tagRepository = new TagRepository();
export default tagRepository;
