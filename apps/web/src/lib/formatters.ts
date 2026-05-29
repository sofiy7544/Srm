export function formatPrice(value: number | string, currency = 'EUR', locale = 'en'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num} ${currency}`;
  }
}

export function formatArea(value: number | string, locale = 'en'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  const formatted = new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(num);
  return `${formatted} m²`;
}

export function formatDate(value: string | Date, locale = 'en'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB');
}

export function formatDateTime(value: string | Date, locale = 'en'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
