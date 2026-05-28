import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function buildPagination(q: PaginationQuery) {
  return {
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  };
}
