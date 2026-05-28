import { z } from 'zod';
import { ContactChannel, PropertyType } from '../enums';

export const phoneSchema = z
  .string()
  .min(6)
  .max(32)
  .regex(/^[+0-9()\-\s]+$/, 'Invalid phone format');

export const clientContactSchema = z.object({
  channel: z.nativeEnum(ContactChannel),
  identifier: z.string().min(1).max(255),
  isPrimary: z.boolean().default(false),
});

export const clientPreferencesSchema = z.object({
  propertyType: z.nativeEnum(PropertyType).optional(),
  dealIntent: z.enum(['BUY', 'RENT']).optional(),
  currency: z.string().length(3).optional(),
  districts: z.array(z.string()).default([]),
  roomsMin: z.number().int().min(0).optional(),
  roomsMax: z.number().int().min(0).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  areaMin: z.number().nonnegative().optional(),
  areaMax: z.number().nonnegative().optional(),
});

export const createClientSchema = z.object({
  fullName: z.string().min(2).max(200),
  primaryPhone: phoneSchema,
  email: z.string().email().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  sourceId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
  marketingConsent: z.boolean().optional(),
  contacts: z.array(clientContactSchema).default([]),
  preferences: clientPreferencesSchema.optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  isArchived: z.boolean().optional(),
  isBlacklisted: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientFilterSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(['active', 'archived', 'blacklisted']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type ClientFilter = z.infer<typeof clientFilterSchema>;
