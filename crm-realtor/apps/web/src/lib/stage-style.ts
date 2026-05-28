import type { LeadStage } from './api';

/**
 * Single source of truth for lead-stage visual treatment.
 * Consumed by /today, /leads (kanban), /leads/[id] (detail), /reports.
 *
 * If you tweak a stage's hue here, all four screens update in lockstep.
 * Do not redeclare STAGE_COLOR / STAGE_ACCENT / STAGE_GRADIENT / STAGE_SOFT
 * elsewhere — import from this module.
 */

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW:         'Новий',
  CONTACTED:   'Контакт',
  QUALIFIED:   'Кваліф.',
  SHOWING:     'Показ',
  NEGOTIATION: 'Переговори',
  WON:         'Виграно',
  LOST:        'Програно',
};

/** Solid dot — used in kanban card priority pip, today funnel, lead-detail right panel. */
export const STAGE_DOT: Record<LeadStage, string> = {
  NEW:         'bg-blue-500',
  CONTACTED:   'bg-sky-500',
  QUALIFIED:   'bg-cyan-500',
  SHOWING:     'bg-amber-500',
  NEGOTIATION: 'bg-violet-500',
  WON:         'bg-emerald-500',
  LOST:        'bg-red-500',
};

/** Header bar gradient (from-color/80 → transparent), used over kanban column headers. */
export const STAGE_BAR: Record<LeadStage, string> = {
  NEW:         'from-blue-500/80 to-blue-500/0',
  CONTACTED:   'from-sky-500/80 to-sky-500/0',
  QUALIFIED:   'from-cyan-500/80 to-cyan-500/0',
  SHOWING:     'from-amber-500/80 to-amber-500/0',
  NEGOTIATION: 'from-violet-500/80 to-violet-500/0',
  WON:         'from-emerald-500/80 to-emerald-500/0',
  LOST:        'from-red-500/80 to-red-500/0',
};

/**
 * Soft chip background + text — used on lead-detail mini cards and the
 * funnel pills in reports. Dark-mode friendly (translucent on dark surface).
 */
export const STAGE_SOFT: Record<LeadStage, string> = {
  NEW:         'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  CONTACTED:   'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  QUALIFIED:   'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  SHOWING:     'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  NEGOTIATION: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  WON:         'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  LOST:        'bg-red-500/10 text-red-700 dark:text-red-300',
};

/**
 * Funnel-bar gradient (from-X to-X/70) used in /reports. Same primary hue as
 * the dot — no more "blue chip / sky bar" mismatch.
 */
export const STAGE_GRADIENT: Record<LeadStage, string> = {
  NEW:         'from-blue-500 to-blue-500/70',
  CONTACTED:   'from-sky-500 to-sky-500/70',
  QUALIFIED:   'from-cyan-500 to-cyan-500/70',
  SHOWING:     'from-amber-500 to-amber-500/70',
  NEGOTIATION: 'from-violet-500 to-violet-500/70',
  WON:         'from-emerald-500 to-emerald-500/70',
  LOST:        'from-red-500 to-red-500/70',
};

export const STAGES_ORDERED: readonly LeadStage[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SHOWING', 'NEGOTIATION', 'WON',
] as const;
