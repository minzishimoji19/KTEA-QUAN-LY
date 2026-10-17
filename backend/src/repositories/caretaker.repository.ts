import BaseRepository from './base.repository.js';

export class CaretakerRepository extends BaseRepository {
  async findAll(activeOnly?: boolean) {
    return this.db.caretaker.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.db.caretaker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
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
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.db.caretaker.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
    });
  }

  async create(data: { name: string; active?: boolean; userId?: string | null }) {
    return this.db.caretaker.create({
      data: {
        name: data.name.trim(),
        active: data.active ?? true,
        userId: data.userId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
    });
  }

  async update(id: string, data: { name?: string; active?: boolean; userId?: string | null }) {
    return this.db.caretaker.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.userId !== undefined ? { userId: data.userId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            phone: true,
          },
        },
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

