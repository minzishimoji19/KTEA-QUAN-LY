import { z } from 'zod';
import { CustomerStatus, Gender, PriorityLevel } from '@prisma/client';

export const listCustomersQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  pageSize: z.string().optional().default('25').transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 25))),
  search: z.string().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  product: z.string().optional(),
  need: z.string().optional(),
  tag: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  sortBy: z.enum(['createdAt', 'updatedAt', 'fullName', 'overallStatus']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').max(20),
  email: z.string().email('Invalid email address').optional().nullable(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  address: z.string().max(500).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  sourceId: z.string().optional().nullable(),
  overallStatus: z.nativeEnum(CustomerStatus).optional().default(CustomerStatus.LEAD),
  priority: z.nativeEnum(PriorityLevel).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerIdParamSchema = z.object({
  id: z.string().min(1, 'Customer ID is required'),
});

export const customerTagParamSchema = z.object({
  id: z.string().min(1, 'Customer ID is required'),
  tagId: z.string().min(1, 'Tag ID is required'),
});
