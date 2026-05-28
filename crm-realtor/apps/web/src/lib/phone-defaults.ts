/**
 * Country phone code defaults per UI locale.
 *
 * Used by quick-create + client-form to prefill the phone field with the most
 * likely country code. The dropdown allows manual override for cross-border
 * clients.
 *
 * Order in COUNTRIES matters — it's the dropdown order. Top-4 EU markets first.
 */

export interface PhoneCountry {
  code: string;       // ISO 3166-1 alpha-2
  prefix: string;     // E.164 with +
  flag: string;       // emoji
  name: string;
}

export const COUNTRIES: PhoneCountry[] = [
  { code: 'IT', prefix: '+39',  flag: '🇮🇹', name: 'Italia' },
  { code: 'FR', prefix: '+33',  flag: '🇫🇷', name: 'France' },
  { code: 'ES', prefix: '+34',  flag: '🇪🇸', name: 'España' },
  { code: 'DE', prefix: '+49',  flag: '🇩🇪', name: 'Deutschland' },
  { code: 'PT', prefix: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'NL', prefix: '+31',  flag: '🇳🇱', name: 'Nederland' },
  { code: 'AT', prefix: '+43',  flag: '🇦🇹', name: 'Österreich' },
  { code: 'CH', prefix: '+41',  flag: '🇨🇭', name: 'Schweiz' },
  { code: 'BE', prefix: '+32',  flag: '🇧🇪', name: 'België' },
  { code: 'GR', prefix: '+30',  flag: '🇬🇷', name: 'Ελλάδα' },
  { code: 'GB', prefix: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'IE', prefix: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: 'PL', prefix: '+48',  flag: '🇵🇱', name: 'Polska' },
  { code: 'CZ', prefix: '+420', flag: '🇨🇿', name: 'Česko' },
  { code: 'UA', prefix: '+380', flag: '🇺🇦', name: 'Україна' },
];

const LOCALE_TO_COUNTRY: Record<string, string> = {
  fr: 'FR',
  it: 'IT',
  en: 'GB',
  // Russian UI is often used by agencies operating in EU — default to Italy.
  ru: 'IT',
  uk: 'IT',
};

/**
 * Pick default country code from the UI locale.
 * Falls back to Italy (top EU launch market). Realtor can flip the country in
 * the dropdown — choice is remembered via localStorage `crm:lastPhoneCountry`.
 */
export function defaultCountryForLocale(locale: string): PhoneCountry {
  if (typeof window !== 'undefined') {
    const remembered = window.localStorage.getItem('crm:lastPhoneCountry');
    if (remembered) {
      const c = COUNTRIES.find((x) => x.code === remembered);
      if (c) return c;
    }
  }
  const code = LOCALE_TO_COUNTRY[locale] ?? 'IT';
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

export function rememberCountry(code: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('crm:lastPhoneCountry', code);
}
