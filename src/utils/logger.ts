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

export class Logger {
  private readonly prefix: string;
  private minLevel: LogLevel;

  constructor(component: string, minLevel: LogLevel = LogLevel.INFO) {
    this.prefix = `[PDF Reader MCP${component ? ` - ${component}` : ''}]`;
    this.minLevel = minLevel;
  }

  /**
   * Set minimum log level for this logger
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Debug-level logging (verbose, development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      this.log('debug', message, context);
    }
  }

  /**
   * Info-level logging (general information)
   */
  info(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.INFO) {
      this.log('info', message, context);
    }
  }

  /**
   * Warning-level logging (recoverable errors, degraded functionality)
   */
  warn(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.WARN) {
      this.log('warn', message, context);
    }
  }

  /**
   * Error-level logging (serious errors)
   */
  error(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.ERROR) {
      this.log('error', message, context);
    }
  }

  private logWithContext(
    level: string,
    logMessage: string,
    structuredLog: Record<string, unknown>
  ): void {
    if (level === 'error') {
      console.error(logMessage);
      console.error(JSON.stringify(structuredLog));
    } else if (level === 'warn') {
      console.warn(logMessage);
      console.warn(JSON.stringify(structuredLog));
    } else if (level === 'info') {
      console.info(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  private logSimple(level: string, logMessage: string): void {
    if (level === 'error') {
      console.error(logMessage);
    } else if (level === 'warn') {
      console.warn(logMessage);
    } else if (level === 'info') {
      console.info(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  private log(level: string, message: string, context?: LogContext): void {
    const logMessage = `${this.prefix} ${message}`;

    if (context && Object.keys(context).length > 0) {
      const timestamp = new Date().toISOString();
      const structuredLog = {
        timestamp,
        level,
        component: this.prefix,
        message,
        ...context,
      };
      this.logWithContext(level, logMessage, structuredLog);
    } else {
      this.logSimple(level, logMessage);
    }
  }
}

/**
 * Create a logger for a specific component
 */
export const createLogger = (component: string, minLevel?: LogLevel): Logger => {
  return new Logger(component, minLevel);
};

/**
 * Default logger instance
 */
export const logger = new Logger('', LogLevel.WARN);
