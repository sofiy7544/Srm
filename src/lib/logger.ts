type Level = 'debug' | 'info' | 'warn' | 'error';

function line(level: Level, msg: string, meta?: unknown): string {
  // No Date.now()/new Date() restriction in the target runtime; timestamps
  // help correlate browser actions with SMS dispatch.
  const ts = new Date().toISOString();
  const suffix = meta === undefined ? '' : ` ${safe(meta)}`;
  return `${ts} [${level.toUpperCase()}] ${msg}${suffix}`;
}

function safe(meta: unknown): string {
  try {
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

export const log = {
  debug: (msg: string, meta?: unknown) => console.debug(line('debug', msg, meta)),
  info: (msg: string, meta?: unknown) => console.info(line('info', msg, meta)),
  warn: (msg: string, meta?: unknown) => console.warn(line('warn', msg, meta)),
  error: (msg: string, meta?: unknown) => console.error(line('error', msg, meta)),
};
