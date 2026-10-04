import BaseRepository from './base.repository.js';

export class CustomerSourceRepository extends BaseRepository {
  async findAll(activeOnly?: boolean) {
    return this.db.customerSource.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });
  }

  async findById(id: string) {
    return this.db.customerSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });
  }

  async findByName(name: string) {
    return this.db.customerSource.findFirst({
      where: {
        name: {
          equals: name.trim(),
        },
      },
    });
  }

  async create(data: { name: string; active?: boolean }) {
    return this.db.customerSource.create({
      data: {
        name: data.name.trim(),
        active: data.active ?? true,
      },
    });
  }

  async update(id: string, data: { name?: string; active?: boolean }) {
    return this.db.customerSource.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async countCustomersUsingSource(id: string) {
    return this.db.customer.count({
      where: { sourceId: id },
    });
  }

  async delete(id: string) {
    return this.db.customerSource.delete({
      where: { id },
    });
  }
}

export const customerSourceRepository = new CustomerSourceRepository();
export default customerSourceRepository;
