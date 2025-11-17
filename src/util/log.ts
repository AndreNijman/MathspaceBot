export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const COLOR: Record<LogLevel, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[35m'
};

const RESET = '\x1b[0m';

export interface Logger {
  info: (message: string, ...meta: unknown[]) => void;
  warn: (message: string, ...meta: unknown[]) => void;
  error: (message: string, ...meta: unknown[]) => void;
  debug: (message: string, ...meta: unknown[]) => void;
}

function log(level: LogLevel, message: string, meta: unknown[]): void {
  const timestamp = new Date().toISOString();
  const color = COLOR[level];
  const formattedMeta = meta.length ? ` ${meta.map((entry) => JSON.stringify(entry)).join(' ')}` : '';
  // eslint-disable-next-line no-console
  console.log(`${color}[${level.toUpperCase()}]${RESET} ${timestamp} ${message}${formattedMeta}`);
}

export const logger: Logger = {
  info: (message, ...meta) => log('info', message, meta),
  warn: (message, ...meta) => log('warn', message, meta),
  error: (message, ...meta) => log('error', message, meta),
  debug: (message, ...meta) => log('debug', message, meta)
};
