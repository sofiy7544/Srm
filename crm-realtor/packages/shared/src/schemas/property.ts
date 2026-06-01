import { z } from 'zod';
import { PropertyType, PropertyStatus, DealIntent } from '../enums';

export const createPropertySchema = z.object({
  type: z.nativeEnum(PropertyType),
  dealIntent: z.nativeEnum(DealIntent).default(DealIntent.BUY),
  district: z.string().min(1).max(120),
  address: z.string().min(1).max(300),
  rooms: z.number().int().min(0).max(50).optional(),
  floor: z.number().int().min(0).max(200).optional(),
  totalFloors: z.number().int().min(0).max(200).optional(),
  area: z.number().positive().max(100000),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default('EUR'),
  status: z.nativeEnum(PropertyStatus).default(PropertyStatus.AVAILABLE),
  ownerUserId: z.string().uuid().optional(),
  // Собственник-продавец (клиент агентства), чей объект выставлен.
  sellerClientId: z.string().uuid().optional().nullable(),
  description: z.string().max(10000).optional(),
  features: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = createPropertySchema.partial();
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const propertyFilterSchema = z.object({
  type: z.nativeEnum(PropertyType).optional(),
  dealIntent: z.nativeEnum(DealIntent).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  district: z.string().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  roomsMin: z.coerce.number().int().min(0).optional(),
  roomsMax: z.coerce.number().int().min(0).optional(),
  // "mine=1" filters to the caller's own properties (no shared catalog mode).
  // Useful for agencies where each agent maintains their own listings.
  ownerUserId: z.string().uuid().optional(),
  mine: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PropertyFilter = z.infer<typeof propertyFilterSchema>;
