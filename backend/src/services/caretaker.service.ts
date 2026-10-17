import { caretakerRepository } from '../repositories/caretaker.repository.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';
import { auditLogService } from './auditLog.service.js';

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

  async getAllCaretakers(options?: boolean | { activeOnly?: boolean; forScheduling?: boolean }) {
    await this.ensureDefaultCaretakers();
    const activeOnly = typeof options === 'boolean' ? options : options?.activeOnly;
    const forScheduling = typeof options === 'object' ? options?.forScheduling : false;
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

    if (forScheduling) {
      // 1. Filter out inactive caretakers
      let filtered = enriched.filter((c) => c.active);

      // 2. Filter out caretakers linked to suspended/inactive user accounts
      filtered = filtered.filter((c) => {
        if (c.user && c.user.status !== 'ACTIVE') {
          return false;
        }
        return true;
      });

      // 3. Find active PARTNER accounts not yet linked to any caretaker
      const activePartners = await prisma.user.findMany({
        where: {
          role: 'PARTNER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          phone: true,
        },
      });

      const linkedUserIds = new Set(filtered.map((c) => c.userId).filter(Boolean));
      const existingNames = new Set(filtered.map((c) => c.name.toLowerCase()));

      for (const partner of activePartners) {
        if (!linkedUserIds.has(partner.id) && !existingNames.has(partner.fullName.toLowerCase())) {
          filtered.push({
            id: `user:${partner.id}`,
            name: partner.fullName,
            active: true,
            userId: partner.id,
            user: partner,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: {
              followUps: 0,
            },
          } as any);
        }
      }

      return filtered;
    }

    return enriched;
  }

  /**
   * ADMIN only: List all PARTNER accounts available for linking to caregivers.
   * Strictly excludes ADMIN users to prevent privilege confusion.
   */
  async getAvailablePartners() {
    const partners = await prisma.user.findMany({
      where: {
        role: 'PARTNER',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        caretaker: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return partners.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      status: p.status,
      phone: p.phone,
      createdAt: p.createdAt,
      isLinked: Boolean(p.caretaker),
      linkedCaretaker: p.caretaker || null,
    }));
  }

  /**
   * ADMIN only: Link a caregiver to a specific PARTNER account.
   */
  async linkCaretakerToUser(
    actor: { id: string; email: string },
    caretakerId: string,
    userId: string
  ) {
    const caretaker = await caretakerRepository.findById(caretakerId);
    if (!caretaker) {
      throw new NotFoundError(`Người chăm sóc với ID '${caretakerId}' không tồn tại`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundError(`Tài khoản người dùng với ID '${userId}' không tồn tại`);
    }

    if (user.role !== 'PARTNER') {
      throw new BadRequestError('Chỉ có thể liên kết người chăm sóc với tài khoản có vai trò ĐỐI TÁC (PARTNER)');
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestError(`Tài khoản '${user.fullName}' đang ở trạng thái '${user.status}' (không hoạt động) và không thể liên kết`);
    }

    // Check if this user is already linked to another caretaker
    const existingCaretakerForUser = await caretakerRepository.findByUserId(userId);
    if (existingCaretakerForUser && existingCaretakerForUser.id !== caretakerId) {
      throw new ConflictError(
        `Tài khoản '${user.fullName}' (${user.email}) đã được liên kết với người chăm sóc '${existingCaretakerForUser.name}'`
      );
    }

    const previousUserId = caretaker.userId;

    const updated = await caretakerRepository.update(caretakerId, {
      userId,
    });

    const inUseCount = await caretakerRepository.countFollowUpsUsingName(updated.name);

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'LINK_CARETAKER_USER',
      entityType: 'Caretaker',
      entityId: caretakerId,
      details: {
        caretakerId,
        caretakerName: updated.name,
        linkedUserId: user.id,
        linkedUserEmail: user.email,
        linkedUserFullName: user.fullName,
        previousUserId,
      },
    });

    return {
      ...updated,
      _count: {
        followUps: inUseCount,
      },
    };
  }

  /**
   * ADMIN only: Unlink a caregiver from their associated user account.
   */
  async unlinkCaretakerFromUser(
    actor: { id: string; email: string },
    caretakerId: string
  ) {
    const caretaker = await caretakerRepository.findById(caretakerId);
    if (!caretaker) {
      throw new NotFoundError(`Người chăm sóc với ID '${caretakerId}' không tồn tại`);
    }

    if (!caretaker.userId) {
      const inUseCount = await caretakerRepository.countFollowUpsUsingName(caretaker.name);
      return {
        ...caretaker,
        _count: { followUps: inUseCount },
      };
    }

    const previousUserId = caretaker.userId;
    const previousUser = caretaker.user;

    const updated = await caretakerRepository.update(caretakerId, {
      userId: null,
    });

    const inUseCount = await caretakerRepository.countFollowUpsUsingName(updated.name);

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UNLINK_CARETAKER_USER',
      entityType: 'Caretaker',
      entityId: caretakerId,
      details: {
        caretakerId,
        caretakerName: updated.name,
        unlinkedUserId: previousUserId,
        unlinkedUserEmail: previousUser?.email,
      },
    });

    return {
      ...updated,
      _count: {
        followUps: inUseCount,
      },
    };
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

  async createCaretaker(data: { name: string; active?: boolean; userId?: string | null }) {
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

    if (data.userId) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
      });
      if (!user) {
        throw new NotFoundError(`Tài khoản người dùng với ID '${data.userId}' không tồn tại`);
      }
      if (user.role !== 'PARTNER') {
        throw new BadRequestError('Chỉ có thể liên kết người chăm sóc với tài khoản có vai trò ĐỐI TÁC (PARTNER)');
      }
      if (user.status !== 'ACTIVE') {
        throw new BadRequestError(`Tài khoản '${user.fullName}' đang ở trạng thái không hoạt động`);
      }
      const existingLink = await caretakerRepository.findByUserId(data.userId);
      if (existingLink) {
        throw new ConflictError(`Tài khoản '${user.fullName}' đã được liên kết với người chăm sóc khác`);
      }
    }

    return caretakerRepository.create({
      name: trimmed,
      active: data.active ?? true,
      userId: data.userId || null,
    });
  }

  async updateCaretaker(id: string, data: { name?: string; active?: boolean; userId?: string | null }) {
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
