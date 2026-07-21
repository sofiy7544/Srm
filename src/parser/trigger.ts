import { config } from '../config/index.js';

export interface SmsRequest {
  phone: string;
  text: string;
  from: string;
}

const regex = new RegExp(config.TRIGGER_REGEX, 'i');

/** Normalise a phone into +digits form; returns null if it doesn't look like one. */
function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return (hadPlus ? '+' : '') + digits;
}

/**
 * Turn a raw group message into an SmsRequest, or null if it isn't a valid
 * trigger. Gated first on the keyword so we ignore ordinary chatter cheaply.
 */
export function parseTrigger(message: string): SmsRequest | null {
  if (!message.toLowerCase().includes(config.TRIGGER_KEYWORD.toLowerCase())) {
    return null;
  }
  const match = regex.exec(message);
  const groups = match?.groups;
  if (!groups?.['phone'] || !groups['text'] || !groups['from']) return null;

  const phone = normalisePhone(groups['phone']);
  if (!phone) return null;

  return {
    phone,
    text: groups['text'].trim(),
    from: groups['from'].trim(),
  };
}
