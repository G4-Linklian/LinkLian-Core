import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { JwtPayload } from '../interface/payload.interface';
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: AppLogger,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing authorization header', 'AuthMiddleware', {
        url: req.originalUrl,
        ip: req.ip,
      });
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      let from: 'user' | 'institution' | 'unknown';

      if ('username' in payload) {
        from = 'user';
      } else if ('institution' in payload) {
        from = 'institution';
      } else {
        from = 'unknown';
      }

      req['user'] = payload;
      req['req_from'] = from;

      let userId: string | number | undefined;

      if ('user_id' in payload) {
        userId = payload.user_id;
      } else if ('institution' in payload) {
        userId = payload.institution.inst_id;
      }

      this.logger.debug('Token validated', 'AuthMiddleware', {
        userId,
        url: req.originalUrl,
        durationMs: Date.now() - startTime,
        from,
      });

      next();
    } catch (error: unknown) {
      let message = 'Unknown error';

      if (error instanceof Error) {
        message = error.message;
      }

      this.logger.error('Invalid token', 'AuthMiddleware', {
        url: req.originalUrl,
        ip: req.ip,
        error: message,
      });

      throw new UnauthorizedException('Invalid token');
    }
  }
}
