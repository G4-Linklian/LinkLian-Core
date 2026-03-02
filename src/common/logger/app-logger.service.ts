import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable()
export class AppLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'debug',
      levels: {
        error: 0,
        warn: 1,
        log: 2,
        verbose: 3,
        debug: 4,
      },
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.printf(({ timestamp, level, message, from, detail }) => {
          let output = `${timestamp} ${level} [${from || 'System'}] ${message}`;

          if (detail) {
            output += ` ${JSON.stringify(detail, null, 2)}`;
          }

          return output;
        }),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  private write(
    level: LogLevel,
    message: string,
    from = 'System',
    detail?: any,
  ) {
    this.logger.log({
      level,
      message,
      from,
      detail,
    });
  }

  log(message: string, from = 'System', detail?: any) {
    this.write('log', message, from, detail);
  }

  error(message: string, from = 'System', detail?: any) {
    this.write('error', message, from, detail);
  }

  warn(message: string, from = 'System', detail?: any) {
    this.write('warn', message, from, detail);
  }

  debug(message: string, from = 'System', detail?: any) {
    this.write('debug', message, from, detail);
  }

  verbose(message: string, from = 'System', detail?: any) {
    this.write('verbose', message, from, detail);
  }
}
