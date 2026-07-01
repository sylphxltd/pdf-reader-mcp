// Structured logging utility

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: unknown;
}

const LEVEL_THRESHOLD: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const LEVEL_METHOD: Record<string, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

export class Logger {
  private readonly prefix: string;
  private minLevel: LogLevel;

  constructor(component: string, minLevel: LogLevel = LogLevel.INFO) {
    this.prefix = `[PDF Reader MCP${component ? ` - ${component}` : ''}]`;
    this.minLevel = minLevel;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  debug(message: string, context?: LogContext): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.emit('error', message, context);
  }

  private emit(level: string, message: string, context?: LogContext): void {
    const threshold = LEVEL_THRESHOLD[level] ?? LogLevel.ERROR;
    if (this.minLevel > threshold) return;

    // Resolve console method at call time so test spies can intercept.
    const method = LEVEL_METHOD[level] ?? 'log';
    const prefixed = `${this.prefix} ${message}`;

    console[method](prefixed);
    if ((level === 'error' || level === 'warn') && context && Object.keys(context).length > 0) {
      console[method](
        JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context })
      );
    }
  }
}

export const createLogger = (component: string, minLevel?: LogLevel): Logger =>
  new Logger(component, minLevel);

export const logger = new Logger('', LogLevel.WARN);
