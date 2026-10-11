import { z } from 'zod';
import { FollowUpStatus } from '@prisma/client';

export const VALID_CARETAKERS = ['Ktea', 'xoaicaldez', 'mfast'] as const;

export const listFollowUpsQuerySchema = z.object({
  filter: z.enum(['today', 'overdue', 'upcoming', 'completed', 'all']).optional().default('all'),
  status: z.nativeEnum(FollowUpStatus).optional(),
  customerId: z.string().optional(),
});

export const createFollowUpSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  status: z.nativeEnum(FollowUpStatus).optional().default(FollowUpStatus.PENDING),
  assignedTo: z.enum(VALID_CARETAKERS, {
    errorMap: () => ({ message: 'Người chăm sóc không hợp lệ. Vui lòng chọn Ktea, xoaicaldez hoặc mfast.' }),
  }).optional().nullable(),
});

export const createBulkFollowUpSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1, 'Phải chọn ít nhất một khách hàng'),
  title: z.string().min(1, 'Tiêu đề lịch chăm sóc là bắt buộc').max(255),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  status: z.nativeEnum(FollowUpStatus).optional().default(FollowUpStatus.PENDING),
  assignedTo: z.enum(VALID_CARETAKERS, {
    errorMap: () => ({ message: 'Người chăm sóc không hợp lệ. Vui lòng chọn Ktea, xoaicaldez hoặc mfast.' }),
  }).optional().nullable(),
});

export const updateFollowUpSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  status: z.nativeEnum(FollowUpStatus).optional(),
  assignedTo: z.enum(VALID_CARETAKERS, {
    errorMap: () => ({ message: 'Người chăm sóc không hợp lệ. Vui lòng chọn Ktea, xoaicaldez hoặc mfast.' }),
  }).optional().nullable(),
  completedAt: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable()),
});

export const followUpIdParamSchema = z.object({
  id: z.string().min(1, 'Follow-up ID is required'),
});
