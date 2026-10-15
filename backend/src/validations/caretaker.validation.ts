import { z } from 'zod';

export const listCaretakersQuerySchema = z.object({
  activeOnly: z
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
});

export const updateCaretakerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên người chăm sóc không được để trống')
    .max(100, 'Tên người chăm sóc không được vượt quá 100 ký tự')
    .optional(),
  active: z.boolean().optional(),
});

export const caretakerIdParamSchema = z.object({
  id: z.string().min(1, 'Mã người chăm sóc là bắt buộc'),
});
