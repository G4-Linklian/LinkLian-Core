import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable()
export class AppLogger implements LoggerService {
  private formatDate(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').split('.')[0];
  }

  private print(
    level: LogLevel,
    from: string,
    title: string,
    detail?: any,
  ) {
    const timestamp = this.formatDate();

    const header = `${timestamp} ${level} [${from}] ${title}`;

    if (detail) {
      console.log(
        `${header} ${JSON.stringify(detail, null, 2)}`,
      );
    } else {
      console.log(header);
    }
  }

  log(message: string, from = 'System', detail?: any) {
    console.log('\n');
    this.print('log', from, message, detail);
  }

  error(message: string, from = 'System', detail?: any) {
    console.log('\n');
    this.print('error', from, message, detail);
  }

  warn(message: string, from = 'System', detail?: any) {
    console.log('\n');
    this.print('warn', from, message, detail);
  }

  debug(message: string, from = 'System', detail?: any) {
    console.log('\n');
    this.print('debug', from, message, detail);
  }

  verbose(message: string, from = 'System', detail?: any) {
    console.log('\n');
    this.print('verbose', from, message, detail);
  }
}
