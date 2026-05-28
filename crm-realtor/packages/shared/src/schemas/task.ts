import { z } from 'zod';
import { TaskType, TaskStatus } from '../enums';

export const createTaskSchema = z.object({
  userId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(TaskType).default(TaskType.CUSTOM),
  dueAt: z.string().datetime({ offset: true }),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.nativeEnum(TaskStatus).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  userId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  dueFrom: z.string().datetime({ offset: true }).optional(),
  dueTo: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;
