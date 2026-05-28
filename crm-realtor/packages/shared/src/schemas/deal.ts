import { z } from 'zod';
import { DealStatus, PaymentType } from '../enums';

export const createDealSchema = z.object({
  leadId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  amount: z.number().positive(),
  commissionPercent: z.number().min(0).max(100),
  agentId: z.string().uuid().optional(),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = z.object({
  amount: z.number().positive().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(DealStatus).optional(),
  closedAt: z.string().datetime({ offset: true }).optional().nullable(),
});
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const dealFilterSchema = z.object({
  status: z.nativeEnum(DealStatus).optional(),
  agentId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type DealFilter = z.infer<typeof dealFilterSchema>;

export const createPaymentSchema = z.object({
  dealId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  amount: z.number().positive(),
  type: z.nativeEnum(PaymentType).default(PaymentType.COMMISSION),
  paidAt: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
