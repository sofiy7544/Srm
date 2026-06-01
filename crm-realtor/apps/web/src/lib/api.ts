'use client';

// TODO(architecture): split this 700-line file into lib/api/{client,types,endpoints/*}
// once the team grows past one developer. Keep `import { ... } from '@/lib/api'`
// working as the public surface — extract into a barrel index.ts.

// Same-origin ВСЕГДА: клиент ходит на относительный /api, который Next rewrites
// проксирует на бэкенд (см. next.config.ts, target = API_PROXY_TARGET или
// NEXT_PUBLIC_API_URL). first-party cookie → работает в т.ч. в мобильном Safari
// (ITP режет cross-site cookie). Прямые cross-site запросы из браузера убраны.
const API_BASE = '';

export type UserBrief = { id: string; email: string; role: string };

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
};

/**
 * Tokens now live in httpOnly cookies (set by the API).
 * We only mark a non-httpOnly flag cookie `crm_auth=1` for the Next.js
 * middleware to gate protected routes; the real auth is the JWT cookie.
 */
export function setLoggedIn() {
  if (typeof document === 'undefined') return;
  document.cookie = `crm_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearLoggedIn() {
  if (typeof document === 'undefined') return;
  document.cookie = 'crm_auth=; path=/; max-age=0; samesite=lax';
}

// kept for backwards compatibility with login/page.tsx — does nothing useful
// because tokens come via cookies, but mark "logged in" cookie for middleware.
export function setTokens(_access: string, _refresh: string) {
  setLoggedIn();
}
export function clearTokens() {
  clearLoggedIn();
}
export function getAccessToken(): string | null {
  return null; // tokens in httpOnly cookies are not readable from JS
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  // 401 на самих auth-эндпоинтах (login/refresh/logout) — это просто неверные
  // данные, НЕ истёкшая сессия. Не пытаемся рефрешить и не трогаем cookie,
  // иначе на странице логина возникает побочный ре-рендер и ошибка «мелькает».
  const isAuthCall = path.startsWith('/api/auth/');
  if (res.status === 401 && !retried && !isAuthCall) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return api<T>(path, init, true);
    clearLoggedIn();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data?.message as string) ?? res.statusText, data);
  }
  return data as T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientContact {
  id?: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM' | 'VIBER' | 'EMAIL' | 'PHONE';
  identifier: string;
  isPrimary: boolean;
}

export interface ClientPreferences {
  propertyType?: 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'LAND';
  dealIntent?: 'BUY' | 'RENT' | null;
  currency?: string | null;
  districts?: string[];
  roomsMin?: number;
  roomsMax?: number;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
}

export interface ClientDetailed {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  avatarUrl: string | null;
  sourceId: string | null;
  assignedUserId: string | null;
  notes: string | null;
  isArchived: boolean;
  isBlacklisted: boolean;
  marketingConsent: boolean;
  consentTimestamp: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  source?: { id: string; name: string; type: string } | null;
  assignedUser?: { id: string; fullName: string; email: string } | null;
  contacts: ClientContact[];
  preferences: (ClientPreferences & { clientId: string }) | null;
}

export interface PropertyPhoto {
  id: string;
  url: string;
  kind: 'PHOTO' | 'VIDEO';
  order: number;
  isCover: boolean;
}

export type DealIntent = 'BUY' | 'RENT';

export interface PropertyDetailed {
  id: string;
  type: 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'LAND';
  dealIntent: DealIntent;
  district: string;
  address: string;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  area: string | number;
  price: string | number;
  currency: string;
  status: 'AVAILABLE' | 'IN_SHOWING' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  ownerUserId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; fullName: string; email: string } | null;
  photos: PropertyPhoto[];
}

export interface Source {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface ClientPayload {
  fullName?: string;
  primaryPhone?: string;
  email?: string;
  avatarUrl?: string | null;
  sourceId?: string;
  assignedUserId?: string | null;
  notes?: string;
  isArchived?: boolean;
  isBlacklisted?: boolean;
  marketingConsent?: boolean;
  contacts?: ClientContact[];
  preferences?: {
    propertyType?: string;
    dealIntent?: 'BUY' | 'RENT';
    currency?: string;
    districts?: string[];
    roomsMin?: number;
    roomsMax?: number;
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
  };
}

export const clients = {
  list: (params: {
    search?: string;
    status?: 'active' | 'archived' | 'blacklisted';
    page?: number;
    pageSize?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    return api<Paginated<ClientDetailed>>(`/api/clients?${q.toString()}`);
  },
  get: (id: string) => api<ClientDetailed>(`/api/clients/${id}`),
  create: (body: ClientPayload) =>
    api<ClientDetailed>('/api/clients', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: ClientPayload) =>
    api<ClientDetailed>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/clients/${id}`, { method: 'DELETE' }),
  merge: (winnerId: string, loserId: string) =>
    api<ClientDetailed>(`/api/clients/${winnerId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ loserId }),
    }),
};

export interface PropertyPayload {
  type?: 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'LAND';
  dealIntent?: DealIntent;
  status?: 'AVAILABLE' | 'IN_SHOWING' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  district?: string;
  address?: string;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  area?: number;
  price?: number;
  currency?: string;
  description?: string;
  ownerUserId?: string;
}

export const properties = {
  list: (params: {
    search?: string;
    type?: string;
    dealIntent?: DealIntent;
    status?: string;
    district?: string;
    priceMin?: number;
    priceMax?: number;
    roomsMin?: number;
    roomsMax?: number;
    mine?: boolean;
    ownerUserId?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '' && v !== null && v !== false) q.set(k, String(v));
    }
    return api<Paginated<PropertyDetailed>>(`/api/properties?${q.toString()}`);
  },
  get: (id: string) => api<PropertyDetailed>(`/api/properties/${id}`),
  create: (body: PropertyPayload) =>
    api<PropertyDetailed>('/api/properties', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: PropertyPayload) =>
    api<PropertyDetailed>(`/api/properties/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/properties/${id}`, { method: 'DELETE' }),
  addPhoto: (id: string, url: string, isCover = false, kind: 'PHOTO' | 'VIDEO' = 'PHOTO') =>
    api<PropertyPhoto>(`/api/properties/${id}/photos`, {
      method: 'POST',
      body: JSON.stringify({ url, isCover, kind }),
    }),
  removePhoto: (id: string, photoId: string) =>
    api<{ ok: true }>(`/api/properties/${id}/photos/${photoId}`, { method: 'DELETE' }),
};

export const sources = {
  list: () => api<Source[]>('/api/sources'),
};

export const uploads = {
  image: async (file: File): Promise<{ key: string; url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/uploads/image`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.json();
  },
  /** Универсальная загрузка: image/* или video/*. Сервер сам решает kind. */
  media: async (
    file: File,
  ): Promise<{ key: string; url: string; kind: 'PHOTO' | 'VIDEO' }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/uploads/media`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.json();
  },
  /** Загрузка голосовой заметки (audio/webm от MediaRecorder в Chrome/Firefox,
   *  audio/mp4 в Safari/iOS). Сервер кладёт в `voice-notes/` и возвращает URL. */
  audio: async (
    blob: Blob,
    filename?: string,
  ): Promise<{ key: string; url: string; size: number; contentType: string }> => {
    const form = new FormData();
    // По умолчанию ext = тип blob'a после "/" (webm/mp4/...). Безопасный fallback.
    const ext = (blob.type.split('/')[1] || 'webm').replace(/[^a-z0-9]/g, '');
    const file = new File([blob], filename ?? `voice-note.${ext}`, { type: blob.type });
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/uploads/audio`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.json();
  },
};

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'SHOWING'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export interface LeadDetailed {
  id: string;
  clientId: string;
  sourceId: string | null;
  assignedUserId: string | null;
  stage: LeadStage;
  dealIntent: DealIntent;
  interestPropertyId: string | null;
  interestNote: string | null;
  interestPhotoUrl: string | null;
  lostReason: string | null;
  priority: 'hot' | 'warm' | 'cold' | null;
  stageChangedAt: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; fullName: string; primaryPhone: string };
  source: { id: string; name: string; type: string } | null;
  assignedUser: { id: string; fullName: string; email: string } | null;
  interestProperty: {
    id: string;
    address: string;
    district: string;
    price: string | number;
    currency: string;
    status?: 'AVAILABLE' | 'IN_SHOWING' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  } | null;
}

export interface UserBriefList {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  locale?: string;
  isActive: boolean;
  managerId?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  manager?: { id: string; fullName: string; email: string } | null;
}

export interface UserActivity {
  counts: { deals: number; tasks: number; leads: number };
  recentTasks: Array<{
    id: string;
    title: string;
    status: 'PENDING' | 'DONE' | 'OVERDUE';
    dueAt: string;
    completedAt: string | null;
    updatedAt: string;
  }>;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: string;
  managerId?: string | null;
  locale?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  phone?: string | null;
  role?: string;
  managerId?: string | null;
  locale?: string;
  isActive?: boolean;
}

export interface ActivityRow {
  id: string;
  clientId: string;
  leadId: string | null;
  userId: string | null;
  type: string;
  direction: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  client?: { id: string; fullName: string } | null;
}

export interface TaskRow {
  id: string;
  userId: string;
  clientId: string | null;
  leadId: string | null;
  title: string;
  description: string | null;
  type: string;
  dueAt: string;
  status: 'PENDING' | 'DONE' | 'OVERDUE';
  completedAt: string | null;
  user?: { id: string; fullName: string } | null;
  client?: { id: string; fullName: string } | null;
  lead?: { id: string; stage: string } | null;
}

export interface ShowingRow {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  scheduledAt: string;
  durationMin: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  feedback: string | null;
  property: { id: string; address: string; district: string };
  client: { id: string; fullName: string; primaryPhone: string };
  agent: { id: string; fullName: string };
}

export const leads = {
  list: () => api<LeadDetailed[]>('/api/leads'),
  get: (id: string) => api<LeadDetailed>(`/api/leads/${id}`),
  stats: () => api<Record<string, number>>('/api/leads/stats'),
  create: (body: {
    clientId: string;
    sourceId?: string;
    assignedUserId?: string | null;
    dealIntent?: DealIntent;
    interestPropertyId?: string | null;
    interestNote?: string | null;
    interestPhotoUrl?: string | null;
    priority?: 'hot' | 'warm' | 'cold';
  }) => api<LeadDetailed>('/api/leads', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: {
    assignedUserId?: string | null;
    interestPropertyId?: string | null;
    interestNote?: string | null;
    interestPhotoUrl?: string | null;
    sourceId?: string | null;
    dealIntent?: DealIntent;
    priority?: 'hot' | 'warm' | 'cold';
  }) => api<LeadDetailed>(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  changeStage: (id: string, stage: LeadStage, lostReason?: string) =>
    api<LeadDetailed>(`/api/leads/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, lostReason }),
    }),
  bulkReassign: (leadIds: string[], assignedUserId: string) =>
    api<{ reassigned: number }>('/api/leads/bulk-reassign', {
      method: 'POST',
      body: JSON.stringify({ leadIds, assignedUserId }),
    }),
  remove: (id: string) => api<{ ok: true }>(`/api/leads/${id}`, { method: 'DELETE' }),
  pool: () => api<LeadDetailed[]>('/api/leads/pool'),
  claim: (id: string) => api<LeadDetailed>(`/api/leads/${id}/claim`, { method: 'POST' }),
};

export const tasks = {
  list: (filter: { status?: string; userId?: string; leadId?: string; clientId?: string } = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) q.set(k, String(v));
    return api<Paginated<TaskRow>>(`/api/tasks?${q.toString()}`);
  },
  create: (body: {
    title: string;
    type: string;
    dueAt: string;
    clientId?: string;
    leadId?: string;
    description?: string;
    userId?: string;
  }) => api<TaskRow>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<TaskRow> & { dueAt?: string }) =>
    api<TaskRow>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  complete: (id: string) => api<TaskRow>(`/api/tasks/${id}/complete`, { method: 'POST' }),
  remove: (id: string) => api<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

export const showings = {
  list: (filter: { from?: string; to?: string; agentId?: string } = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) q.set(k, String(v));
    return api<ShowingRow[]>(`/api/showings?${q.toString()}`);
  },
  create: (body: {
    propertyId: string;
    clientId: string;
    scheduledAt: string;
    durationMin?: number;
    agentId?: string;
  }) => api<ShowingRow>('/api/showings', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<ShowingRow> & { scheduledAt?: string }) =>
    api<ShowingRow>(`/api/showings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/showings/${id}`, { method: 'DELETE' }),
};

export interface ActivityPage {
  items: ActivityRow[];
  nextCursor: string | null;
}

export const activities = {
  byClient: (clientId: string, cursor?: string, types?: string[]) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (types && types.length) params.set('types', types.join(','));
    const qs = params.toString();
    return api<ActivityPage>(`/api/activities/client/${clientId}${qs ? '?' + qs : ''}`);
  },
  byLead: (leadId: string, cursor?: string, types?: string[]) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (types && types.length) params.set('types', types.join(','));
    const qs = params.toString();
    return api<ActivityPage>(`/api/activities/lead/${leadId}${qs ? '?' + qs : ''}`);
  },
  create: (body: {
    clientId: string;
    leadId?: string;
    type: string;
    direction: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) => api<ActivityRow>('/api/activities', { method: 'POST', body: JSON.stringify(body) }),
};

export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  language: 'ru' | 'uk';
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const notifications = {
  list: (unread = false) => api<NotificationRow[]>(`/api/notifications${unread ? '?unread=1' : ''}`),
  unreadCount: () => api<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: string) => api<{ ok: true }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api<{ ok: true }>('/api/notifications/read-all', { method: 'POST' }),
};

export const templates = {
  list: () => api<TemplateRow[]>('/api/templates'),
  get: (id: string) => api<TemplateRow>(`/api/templates/${id}`),
  create: (body: Pick<TemplateRow, 'name' | 'language' | 'content'> & { isActive?: boolean }) =>
    api<TemplateRow>('/api/templates', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<TemplateRow>) =>
    api<TemplateRow>(`/api/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/templates/${id}`, { method: 'DELETE' }),
};

export const clientActions = {
  logCall: (clientId: string, body: { outcome: 'ANSWERED' | 'NO_ANSWER' | 'BUSY'; note?: string }) =>
    api<ActivityRow>(`/api/clients/${clientId}/log-call`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addNote: (
    clientId: string,
    content: string,
    voice?: { audioUrl: string; durationMs: number; mime?: string },
  ) =>
    api<ActivityRow>(`/api/clients/${clientId}/note`, {
      method: 'POST',
      body: JSON.stringify(voice ? { content, voice } : { content }),
    }),
  sendEmail: (clientId: string, body: { subject: string; templateId?: string; body?: string }) =>
    api<{ sent: true }>(`/api/clients/${clientId}/send-email`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface AutomationRuleRow {
  id: string;
  name: string;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const automationRules = {
  list: () => api<AutomationRuleRow[]>('/api/automation-rules'),
  create: (body: Omit<AutomationRuleRow, 'id' | 'createdAt' | 'updatedAt'>) =>
    api<AutomationRuleRow>('/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<AutomationRuleRow>) =>
    api<AutomationRuleRow>(`/api/automation-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    api<{ ok: true }>(`/api/automation-rules/${id}`, { method: 'DELETE' }),
};

export interface MessageRow {
  id: string;
  activityId: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM' | 'VIBER' | 'EMAIL' | 'PHONE';
  externalId: string | null;
  from: string | null;
  to: string | null;
  body: string | null;
  attachments: unknown;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  activity?: { id: string; direction: string; userId: string | null; createdAt: string };
}

export const messages = {
  list: (clientId: string, channel?: string) => {
    const q = channel ? `?channel=${channel}` : '';
    return api<MessageRow[]>(`/api/clients/${clientId}/messages${q}`);
  },
  send: (clientId: string, body: { channel: string; body: string }) =>
    api<{ message: MessageRow; delivered: boolean; note: string | null }>(
      `/api/clients/${clientId}/messages`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
};

export const presentations = {
  send: (propertyId: string, clientId: string) =>
    api<{ sent: true }>(`/api/properties/${propertyId}/presentation/send`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    }),
  url: (propertyId: string) => `${API_BASE}/api/properties/${propertyId}/presentation`,
};

export const users = {
  list: () => api<UserBriefList[]>('/api/users'),
  get: (id: string) => api<UserBriefList>(`/api/users/${id}`),
  activity: (id: string) => api<UserActivity>(`/api/users/${id}/activity`),
  create: (body: CreateUserPayload) =>
    api<UserBriefList>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateUserPayload) =>
    api<UserBriefList>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  activate: (id: string) =>
    api<UserBriefList>(`/api/users/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) =>
    api<UserBriefList>(`/api/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, body: { newPassword?: string; oldPassword?: string } = {}) =>
    api<{ password?: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface DealRow {
  id: string;
  leadId: string;
  clientId: string;
  propertyId: string;
  agentId: string;
  dealIntent: DealIntent;
  amount: string | number;
  commissionPercent: string | number;
  commissionAmount: string | number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: string; stage: string };
  client: { id: string; fullName: string; primaryPhone: string };
  property: { id: string; address: string; district: string };
  agent: { id: string; fullName: string; email: string };
  payments: PaymentRow[];
}

export interface PaymentRow {
  id: string;
  dealId: string;
  userId: string;
  amount: string | number;
  type: 'COMMISSION' | 'BONUS' | 'ADJUSTMENT';
  paidAt: string;
  note: string | null;
  createdAt: string;
  user?: { id: string; fullName: string };
}

export interface DocumentRow {
  id: string;
  type: 'PASSPORT' | 'CONTRACT' | 'RECEIPT' | 'OTHER';
  fileUrl: string;
  originalName: string;
  mime: string;
  clientId: string | null;
  dealId: string | null;
  propertyId: string | null;
  createdAt: string;
  uploadedBy: { id: string; fullName: string };
}

export const deals = {
  list: (filter: { status?: string; agentId?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) q.set(k, String(v));
    return api<Paginated<DealRow>>(`/api/deals?${q.toString()}`);
  },
  get: (id: string) => api<DealRow>(`/api/deals/${id}`),
  create: (body: {
    leadId: string;
    propertyId?: string;
    amount: number;
    commissionPercent: number;
    agentId?: string;
  }) => api<DealRow>('/api/deals', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { amount?: number; commissionPercent?: number; status?: string; closedAt?: string | null }) =>
    api<DealRow>(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/deals/${id}`, { method: 'DELETE' }),
};

export const payments = {
  byDeal: (dealId: string) => api<PaymentRow[]>(`/api/payments/deal/${dealId}`),
  create: (body: { dealId: string; amount: number; type: string; paidAt: string; userId?: string; note?: string }) =>
    api<PaymentRow>('/api/payments', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => api<{ ok: true }>(`/api/payments/${id}`, { method: 'DELETE' }),
};

export const documents = {
  list: (filter: { clientId?: string; dealId?: string; propertyId?: string }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) q.set(k, String(v));
    return api<DocumentRow[]>(`/api/documents?${q.toString()}`);
  },
  upload: async (
    file: File,
    meta: { type: string; clientId?: string; dealId?: string; propertyId?: string },
  ): Promise<DocumentRow> => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', meta.type);
    if (meta.clientId) form.append('clientId', meta.clientId);
    if (meta.dealId) form.append('dealId', meta.dealId);
    if (meta.propertyId) form.append('propertyId', meta.propertyId);
    const res = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.json();
  },
  remove: (id: string) => api<{ ok: true }>(`/api/documents/${id}`, { method: 'DELETE' }),
};

export interface ReportDashboard {
  totalClients: number;
  totalProperties: number;
  activeLeads: number;
  completedDeals: number;
  totalAmount: number;
  totalCommission: number;
}
export interface ChannelStat {
  sourceId: string | null;
  sourceName: string;
  count: number;
}
export interface AgentStat {
  userId: string;
  fullName: string;
  leads: number;
  calls: number;
  showings: number;
  deals: number;
  commission: number;
}
export interface SourceRoi {
  sourceId: string;
  sourceName: string;
  leads: number;
  deals: number;
  revenue: number;
  commission: number;
  conversion: number;
}

export interface TeamWorkloadRow {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  isAvailable: boolean;
  activeLeads: number;
  overdueTasks: number;
  todayTasks: number;
  lastActivityAt: string | null;
}

export const reports = {
  dashboard: () => api<ReportDashboard>('/api/reports/dashboard'),
  leadsByChannel: () => api<ChannelStat[]>('/api/reports/leads-by-channel'),
  funnel: () => api<Record<string, number>>('/api/reports/funnel'),
  agents: () => api<AgentStat[]>('/api/reports/agents'),
  teamWorkload: () => api<TeamWorkloadRow[]>('/api/reports/team-workload'),
  sourceRoi: () => api<SourceRoi[]>('/api/reports/source-roi'),
  recentActivity: () => api<ActivityRow[]>('/api/reports/recent-activity'),
  upcomingShowings: () => api<ShowingRow[]>('/api/reports/upcoming-showings'),
  recentLeads: () => api<LeadDetailed[]>('/api/reports/recent-leads'),
  leadHealth: () => api<Array<{ id: string; clientName: string; stage: string; priority: string; daysSinceStageChange: number; isStale: boolean; activityCount: number; sourceType: string | null }>>('/api/reports/lead-health'),
  todayTasks: () => api<TaskRow[]>('/api/reports/today-tasks'),
};

export const auth = {
  login: (email: string, password: string) =>
    api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(
      () => undefined,
    );
    clearLoggedIn();
  },
  me: () =>
    api<{
      id: string;
      email: string;
      fullName: string;
      phone: string | null;
      role: string;
      locale: string;
      isActive: boolean;
      createdAt: string;
    }>('/api/users/me'),
};
