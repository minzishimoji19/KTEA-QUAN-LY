import { caretakerRepository } from '../repositories/caretaker.repository.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class CaretakerService extends BaseService {
  /**
   * Initializes default caregivers and imports any distinct caregiver names
   * already present in follow_ups to guarantee 100% backward compatibility.
   */
  async ensureDefaultCaretakers(): Promise<void> {
    const defaults = ['Ktea', 'xoaicaldez', 'mfast'];
    for (const name of defaults) {
      const existing = await caretakerRepository.findByName(name);
      if (!existing) {
        try {
          await caretakerRepository.create({ name, active: true });
        } catch (_) {
          // Ignore unique race condition
        }
      }
    }

    // Scan for any legacy caregiver names assigned to follow-ups
    const legacyAssigned = await prisma.followUp.findMany({
      where: {
        assignedTo: { not: null },
      },
      select: { assignedTo: true },
      distinct: ['assignedTo'],
    });

    for (const row of legacyAssigned) {
      if (row.assignedTo && row.assignedTo.trim()) {
        const trimmed = row.assignedTo.trim();
        const existing = await caretakerRepository.findByName(trimmed);
        if (!existing) {
          try {
            await caretakerRepository.create({ name: trimmed, active: true });
          } catch (_) {
            // Ignore race condition
          }
        }
      }
    }
  }

  async getAllCaretakers(activeOnly?: boolean) {
    await this.ensureDefaultCaretakers();
    const caretakers = await caretakerRepository.findAll(activeOnly);

    // Attach usage count for each caregiver
    const enriched = await Promise.all(
      caretakers.map(async (c) => {
        const inUseCount = await caretakerRepository.countFollowUpsUsingName(c.name);
        return {
          ...c,
          _count: {
            followUps: inUseCount,
          },
        };
      })
    );

    return enriched;
  }

  async getCaretakerById(id: string) {
    const caretaker = await caretakerRepository.findById(id);
    if (!caretaker) {
      throw new NotFoundError(`Người chăm sóc với ID '${id}' không tồn tại`);
    }
    const inUseCount = await caretakerRepository.countFollowUpsUsingName(caretaker.name);
    return {
      ...caretaker,
      _count: {
        followUps: inUseCount,
      },
    };
  }

  async createCaretaker(data: { name: string; active?: boolean }) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestError('Tên người chăm sóc không được để trống hoặc chỉ chứa khoảng trắng');
    }
    const trimmed = data.name.trim();

    // Check case-insensitive duplicate
    const all = await caretakerRepository.findAll();
    const existing = all.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      throw new ConflictError(`Người chăm sóc với tên "${trimmed}" đã tồn tại trong hệ thống`);
    }

    return caretakerRepository.create({
      name: trimmed,
      active: data.active ?? true,
    });
  }

  async updateCaretaker(id: string, data: { name?: string; active?: boolean }) {
    const current = await this.getCaretakerById(id);

    let newName: string | undefined = undefined;

    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new BadRequestError('Tên người chăm sóc không được để trống hoặc chỉ chứa khoảng trắng');
      }
      const trimmed = data.name.trim();
      if (trimmed !== current.name) {
        const all = await caretakerRepository.findAll();
        const conflict = all.find(
          (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (conflict) {
          throw new ConflictError(`Người chăm sóc với tên "${trimmed}" đã tồn tại trong hệ thống`);
        }
        newName = trimmed;
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.caretaker.update({
        where: { id },
        data: {
          ...(newName ? { name: newName } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });

      // If name changed, synchronously propagate to all existing follow-up records
      if (newName && newName !== current.name) {
        await tx.followUp.updateMany({
          where: { assignedTo: current.name },
          data: { assignedTo: newName },
        });
      }

      return updated;
    });
  }

  async deleteCaretaker(id: string) {
    const caretaker = await this.getCaretakerById(id);
    const inUseCount = await caretakerRepository.countFollowUpsUsingName(caretaker.name);
    if (inUseCount > 0) {
      throw new ConflictError(
        `Không thể xóa người chăm sóc "${caretaker.name}" do đang được liên kết với ${inUseCount} lịch chăm sóc. Vui lòng chuyển sang trạng thái ngừng hoạt động thay vì xóa.`
      );
    }
    return caretakerRepository.delete(id);
  }
}

export const caretakerService = new CaretakerService();
export default caretakerService;
