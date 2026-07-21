import 'dotenv/config';
import { z } from 'zod';

const boolish = z
  .string()
  .transform((v) => v.toLowerCase() === 'true' || v === '1')
  .pipe(z.boolean());

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),

  USER_DATA_DIR: z.string().min(1).default('.chrome-profile'),
  HEADLESS: boolish.default('false'),
  SLOW_MO: z.coerce.number().int().nonnegative().default(0),

  TG_GROUP_TITLE: z.string().min(1),
  TG_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),

  TRIGGER_KEYWORD: z.string().min(1).default('SMS'),
  TRIGGER_REGEX: z.string().min(1),

  SMS_PANEL_URL: z.string().url(),
  SMS_SEL_PHONE: z.string().min(1),
  SMS_SEL_FROM: z.string().min(1),
  SMS_SEL_TEXT: z.string().min(1),
  SMS_SEL_SUBMIT: z.string().min(1),
  SMS_SEL_SUCCESS: z.string().default(''),

  DRY_RUN: boolish.default('true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
