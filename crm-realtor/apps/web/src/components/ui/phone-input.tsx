'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  COUNTRIES,
  defaultCountryForLocale,
  rememberCountry,
  type PhoneCountry,
} from '@/lib/phone-defaults';
import { cn } from '@/lib/utils';

/**
 * Phone input with country-code dropdown.
 *
 * Stores the value as a single E.164 string (e.g. "+380671234567"). The dropdown
 * decides which country prefix to use; the digits-only portion is typed by the
 * realtor. When the value contains a recognized country prefix, the dropdown
 * auto-matches it (paste from chat works).
 *
 * Why custom (not `react-phone-number-input`):
 *   - ~150KB metadata for the library is overkill for a CRM that ships with 5
 *     locales and ~15 target countries.
 *   - We need full styling parity with our `Input` (rounded-xl, surface bg).
 */
export function PhoneInput({
  value,
  onChange,
  locale,
  required,
  placeholder,
  autoFocus,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  locale: string;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  id?: string;
}) {
  const initial = React.useMemo(() => defaultCountryForLocale(locale), [locale]);
  const [country, setCountry] = React.useState<PhoneCountry>(initial);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  // Derive the "digits part" (everything after the prefix) and keep dropdown in
  // sync when value starts with a known prefix (paste from chat / WhatsApp).
  React.useEffect(() => {
    if (!value) return;
    const match = COUNTRIES
      .slice()
      .sort((a, b) => b.prefix.length - a.prefix.length) // longest prefix first
      .find((c) => value.startsWith(c.prefix));
    if (match && match.code !== country.code) setCountry(match);
  }, [value, country.code]);

  const localPart = value.startsWith(country.prefix)
    ? value.slice(country.prefix.length)
    : value;

  function handleLocalChange(raw: string) {
    // Allow digits, spaces, parens, hyphens only after the prefix
    const cleaned = raw.replace(/[^\d\s()-]/g, '');
    onChange(cleaned ? `${country.prefix}${cleaned}` : '');
  }

  function pickCountry(c: PhoneCountry) {
    setCountry(c);
    rememberCountry(c.code);
    setDropdownOpen(false);
    // Keep the digits if they were typed; just swap the prefix.
    onChange(localPart ? `${c.prefix}${localPart}` : c.prefix);
  }

  return (
    <div className={cn('relative flex items-stretch gap-0', className)}>
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 rounded-l-xl border border-r-0 border-border bg-surface px-2.5',
          'shadow-soft hover:bg-muted/40 transition-colors',
          'h-11 sm:h-10 text-sm',
        )}
        aria-label="Виберіть країну"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {country.prefix}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      <input
        id={id}
        type="tel"
        value={localPart}
        onChange={(e) => handleLocalChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder ?? exampleForCountry(country.code)}
        inputMode="tel"
        autoComplete="tel-national"
        className={cn(
          'flex-1 h-11 sm:h-10 rounded-r-xl border border-border bg-surface px-3.5 text-base sm:text-sm shadow-soft transition-all',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus-visible:border-primary focus-visible:shadow-glow',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />

      {dropdownOpen && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface shadow-lift">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCountry(c)}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2 transition-colors',
                  country.code === c.code && 'bg-primary/5 text-primary',
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {c.prefix}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function exampleForCountry(code: string): string {
  switch (code) {
    case 'UA': return '67 123 45 67';
    case 'IT': return '345 123 4567';
    case 'FR': return '6 12 34 56 78';
    case 'ES': return '612 345 678';
    case 'DE': return '171 1234567';
    case 'PT': return '912 345 678';
    case 'PL': return '512 345 678';
    case 'GB': return '7400 123456';
    case 'RU': return '912 345-67-89';
    default:   return '...';
  }
}
