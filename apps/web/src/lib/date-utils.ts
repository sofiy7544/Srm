/**
 * Утилиты дат для календаря.
 * Без зависимостей — нативный Date + Intl.
 * Неделя начинается с понедельника (для рынка СНГ/Украины).
 */

export const MS_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Понедельник недели, к которой относится дата. */
export function startOfWeek(d: Date): Date {
  const sd = startOfDay(d);
  const day = sd.getDay(); // 0=вс
  const diff = day === 0 ? -6 : 1 - day; // к понедельнику
  return addDays(sd, diff);
}

export function endOfWeek(d: Date): Date {
  return endOfDay(addDays(startOfWeek(d), 6));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Диапазон, который реально нужно показать в сетке месяца — с понедельника
 *  той недели, где 1-е число, по воскресенье недели последнего числа. */
export function monthGridRange(d: Date): { from: Date; to: Date } {
  return {
    from: startOfWeek(startOfMonth(d)),
    to: endOfWeek(endOfMonth(d)),
  };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/** Окрутить дату до ближайшего N-минутного интервала. */
export function snapToMinutes(d: Date, step: number): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const mins = out.getHours() * 60 + out.getMinutes();
  const snapped = Math.round(mins / step) * step;
  out.setHours(0, snapped, 0, 0);
  return out;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayLong(d: Date, locale = 'en'): string {
  return d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Возвращает массив из N дат подряд начиная с from. */
export function daysRange(from: Date, count: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(from, i));
  return out;
}
