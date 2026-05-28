import { z } from 'zod';
import { ShowingStatus } from '../enums';

export const createShowingSchema = z.object({
  propertyId: z.string().uuid(),
  clientId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(5).max(480).default(60),
});
export type CreateShowingInput = z.infer<typeof createShowingSchema>;

export const updateShowingSchema = createShowingSchema.partial().extend({
  status: z.nativeEnum(ShowingStatus).optional(),
  feedback: z.string().max(2000).optional(),
});
export type UpdateShowingInput = z.infer<typeof updateShowingSchema>;

export const showingFilterSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  agentId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.nativeEnum(ShowingStatus).optional(),
});
export type ShowingFilter = z.infer<typeof showingFilterSchema>;
