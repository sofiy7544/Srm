import { z } from 'zod';
import { LeadStage, DealIntent, LeadPurpose, LeadUrgency } from '../enums';

// Поля «цель обращения / срочность / бюджет / следующий контакт» — общие для
// create и update. Все опциональны (обратная совместимость со старыми лидами).
const leadGoalFields = {
  purpose: z.nativeEnum(LeadPurpose).nullable().optional(),
  urgency: z.nativeEnum(LeadUrgency).nullable().optional(),
  budgetMin: z.number().nonnegative().nullable().optional(),
  budgetMax: z.number().nonnegative().nullable().optional(),
  budgetCurrency: z.string().length(3).nullable().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
};

export const createLeadSchema = z.object({
  clientId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  // null = явно создать unclaimed-лид (попадёт в /pool для admin assign).
  // undefined = дефолтное назначение (на ответственного клиента/создателя).
  assignedUserId: z.string().uuid().nullable().optional(),
  stage: z.nativeEnum(LeadStage).default(LeadStage.NEW),
  dealIntent: z.nativeEnum(DealIntent).default(DealIntent.BUY),
  interestPropertyId: z.string().uuid().optional().nullable(),
  interestNote: z.string().max(2000).optional().nullable(),
  interestPhotoUrl: z.string().url().max(2000).optional().nullable(),
  priority: z.enum(['hot', 'warm', 'cold']).optional(),
  ...leadGoalFields,
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
  ...leadGoalFields,
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
