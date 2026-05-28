import { z } from 'zod';
import { LeadStage, DealIntent } from '../enums';

export const createLeadSchema = z.object({
  clientId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  stage: z.nativeEnum(LeadStage).default(LeadStage.NEW),
  dealIntent: z.nativeEnum(DealIntent).default(DealIntent.BUY),
  interestPropertyId: z.string().uuid().optional().nullable(),
  interestNote: z.string().max(2000).optional().nullable(),
  interestPhotoUrl: z.string().url().max(2000).optional().nullable(),
  priority: z.enum(['hot', 'warm', 'cold']).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  assignedUserId: z.string().uuid().nullable().optional(),
  interestPropertyId: z.string().uuid().nullable().optional(),
  interestNote: z.string().max(2000).nullable().optional(),
  interestPhotoUrl: z.string().url().max(2000).nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  dealIntent: z.nativeEnum(DealIntent).optional(),
  priority: z.enum(['hot', 'warm', 'cold']).optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const updateLeadStageSchema = z.object({
  stage: z.nativeEnum(LeadStage),
  lostReason: z.string().max(500).optional(),
});
export type UpdateLeadStageInput = z.infer<typeof updateLeadStageSchema>;

export const bulkReassignSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
  assignedUserId: z.string().uuid(),
});
export type BulkReassignInput = z.infer<typeof bulkReassignSchema>;
