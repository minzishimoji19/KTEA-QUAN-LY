import { z } from 'zod';

export const listCaretakersQuerySchema = z.object({
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  forScheduling: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const createCaretakerSchema = z.object({
  name: z
    .string({ required_error: 'Tên người chăm sóc là bắt buộc' })
    .trim()
    .min(1, 'Tên người chăm sóc không được để trống')
    .max(100, 'Tên người chăm sóc không được vượt quá 100 ký tự'),
  active: z.boolean().optional().default(true),
  userId: z.string().uuid('Mã tài khoản phải là UUID hợp lệ').nullable().optional(),
});

export const updateCaretakerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên người chăm sóc không được để trống')
    .max(100, 'Tên người chăm sóc không được vượt quá 100 ký tự')
    .optional(),
  active: z.boolean().optional(),
  userId: z.string().uuid('Mã tài khoản phải là UUID hợp lệ').nullable().optional(),
});

export const linkCaretakerSchema = z.object({
  userId: z.string({ required_error: 'Vui lòng chọn tài khoản đối tác cần liên kết' }).uuid('Mã tài khoản phải là UUID hợp lệ'),
});

export const caretakerIdParamSchema = z.object({
  id: z.string().min(1, 'Mã người chăm sóc là bắt buộc'),
});

