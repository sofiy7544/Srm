export const UserRole = {
  ADMIN: 'ADMIN',
  REALTOR: 'REALTOR',
  ASSISTANT: 'ASSISTANT',
  ANALYST: 'ANALYST',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Locale = {
  UK: 'uk',
  RU: 'ru',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

// ---------------------------------------------------------------------------
// LeadStage — 7 values, 6 kanban columns.
//
// Sprint 1.2 collapsed the old 9-stage enum:
//   FIRST_CONTACT + DIALOG  → CONTACTED
//   SELECTION               → QUALIFIED
//   DEAL                    → NEGOTIATION  (DEAL was a phantom stage)
//   CLOSED_WON              → WON
//   CLOSED_LOST             → LOST
//
// Kanban order (for STAGES_ORDERED below):
//   NEW → CONTACTED → QUALIFIED → SHOWING → NEGOTIATION → WON
// LOST is a sibling terminal stage rendered as a drag target, not a column.
// ---------------------------------------------------------------------------
export const LeadStage = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  SHOWING: 'SHOWING',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

/** Ordered active stages — what the kanban renders left-to-right. */
export const STAGES_ORDERED: readonly LeadStage[] = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.QUALIFIED,
  LeadStage.SHOWING,
  LeadStage.NEGOTIATION,
  LeadStage.WON,
] as const;

/** Terminal stages — not eligible for "stale" alerts. */
export const TERMINAL_STAGES: readonly LeadStage[] = [LeadStage.WON, LeadStage.LOST] as const;

export const PropertyType = {
  APARTMENT: 'APARTMENT',
  HOUSE: 'HOUSE',
  COMMERCIAL: 'COMMERCIAL',
  LAND: 'LAND',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const DealIntent = {
  BUY: 'BUY',
  RENT: 'RENT',
} as const;
export type DealIntent = (typeof DealIntent)[keyof typeof DealIntent];

export const ClientType = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  BOTH: 'BOTH',
} as const;
export type ClientType = (typeof ClientType)[keyof typeof ClientType];

export const PropertyStatus = {
  AVAILABLE: 'AVAILABLE',
  IN_SHOWING: 'IN_SHOWING',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PropertyStatus = (typeof PropertyStatus)[keyof typeof PropertyStatus];

export const SourceType = {
  FB_LEAD_ADS: 'FB_LEAD_ADS',
  INSTAGRAM: 'INSTAGRAM',
  WHATSAPP: 'WHATSAPP',
  TELEGRAM: 'TELEGRAM',
  WEBSITE: 'WEBSITE',
  MANUAL: 'MANUAL',
  CSV_IMPORT: 'CSV_IMPORT',
  REFERRAL: 'REFERRAL',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const ContactChannel = {
  WHATSAPP: 'WHATSAPP',
  TELEGRAM: 'TELEGRAM',
  INSTAGRAM: 'INSTAGRAM',
  VIBER: 'VIBER',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
} as const;
export type ContactChannel = (typeof ContactChannel)[keyof typeof ContactChannel];

export const ActivityType = {
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  TELEGRAM: 'TELEGRAM',
  INSTAGRAM: 'INSTAGRAM',
  NOTE: 'NOTE',
  SHOWING: 'SHOWING',
  STAGE_CHANGE: 'STAGE_CHANGE',
  ASSIGNMENT: 'ASSIGNMENT',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const TaskType = {
  CALL: 'CALL',
  SHOWING: 'SHOWING',
  FOLLOWUP: 'FOLLOWUP',
  CUSTOM: 'CUSTOM',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const TaskStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  OVERDUE: 'OVERDUE',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const DealStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const DealStage = {
  OFFER: 'OFFER',
  DOCS_REVIEW: 'DOCS_REVIEW',
  DUE_DILIGENCE: 'DUE_DILIGENCE',
  CONTRACT: 'CONTRACT',
  CLOSED_WON: 'CLOSED_WON',
  CLOSED_LOST: 'CLOSED_LOST',
} as const;
export type DealStage = (typeof DealStage)[keyof typeof DealStage];

export const DEAL_STAGES_ORDERED: readonly DealStage[] = [
  DealStage.OFFER,
  DealStage.DOCS_REVIEW,
  DealStage.DUE_DILIGENCE,
  DealStage.CONTRACT,
  DealStage.CLOSED_WON,
  DealStage.CLOSED_LOST,
] as const;
export type DealStageOrdered = (typeof DEAL_STAGES_ORDERED)[number];

/**
 * Applicable deal stages depend on intent:
 *   BUY  — full sales pipeline (OFFER → DOCS → DUE_DILIGENCE → CONTRACT → WON/LOST)
 *   RENT — short rental pipeline (DEPOSIT (= OFFER) → CONTRACT → WON/LOST), DOCS_REVIEW and
 *          DUE_DILIGENCE are hidden because a rental has no title search / mortgage docs.
 *
 * The UI uses these arrays to render the deal board / detail page; the DB column
 * stays the same enum to keep BUY/RENT compatible at the storage layer.
 */
export const DEAL_STAGES_BUY: readonly DealStage[] = [
  DealStage.OFFER,
  DealStage.DOCS_REVIEW,
  DealStage.DUE_DILIGENCE,
  DealStage.CONTRACT,
  DealStage.CLOSED_WON,
] as const;

export const DEAL_STAGES_RENT: readonly DealStage[] = [
  DealStage.OFFER,
  DealStage.CONTRACT,
  DealStage.CLOSED_WON,
] as const;

/** Human label for a deal stage with intent context (BUY/RENT). */
export function dealStageLabel(stage: DealStage, intent: 'BUY' | 'RENT'): string {
  if (stage === DealStage.OFFER && intent === 'RENT') return 'Депозит';
  if (stage === DealStage.CONTRACT && intent === 'RENT') return 'Підписання';
  if (stage === DealStage.OFFER) return 'Пропозиція';
  if (stage === DealStage.DOCS_REVIEW) return 'Перевірка документів';
  if (stage === DealStage.DUE_DILIGENCE) return 'Due Diligence';
  if (stage === DealStage.CONTRACT) return 'Договір';
  if (stage === DealStage.CLOSED_WON) return 'Закрита';
  return 'Скасована';
}

export const PaymentType = {
  COMMISSION: 'COMMISSION',
  BONUS: 'BONUS',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const ShowingStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type ShowingStatus = (typeof ShowingStatus)[keyof typeof ShowingStatus];

export const LeadPriority = {
  HOT:  'hot',
  WARM: 'warm',
  COLD: 'cold',
} as const;
export type LeadPriority = (typeof LeadPriority)[keyof typeof LeadPriority];
