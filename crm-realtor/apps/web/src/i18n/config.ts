export const locales = ['en', 'uk', 'ru', 'fr', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  fr: 'Français',
  it: 'Italiano',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  uk: '🇺🇦',
  ru: '🇷🇺',
  fr: '🇫🇷',
  it: '🇮🇹',
};
