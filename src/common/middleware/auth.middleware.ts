import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly logger: AppLogger,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const startTime = Date.now();
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            this.logger.warn(
                'Missing authorization header',
                'AuthMiddleware',
                {
                    url: req.originalUrl,
                    ip: req.ip,
                },
            );
            throw new UnauthorizedException('Missing token');
        }

        const token = authHeader.split(' ')[1];

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
            });

            let from : string;

            if (payload.username) {
                from = 'user';
            } else if (payload.institution) {
                from = 'institution';
            } else {
                from = 'unknown';
            }

            req['user'] = payload;
            req['req_from'] = from;

            this.logger.debug(
                'Token validated',
                'AuthMiddleware',
                {
                    userId: payload?.sub,
                    url: req.originalUrl,
                    durationMs: Date.now() - startTime,
                    from: from,
                },
            );

            next();
        } catch (error: any) {
            this.logger.error(
                'Invalid token',
                'AuthMiddleware',
                {
                    url: req.originalUrl,
                    ip: req.ip,
                    error: error.message,
                },
            );

            throw new UnauthorizedException('Invalid token');
        }
    }
}
