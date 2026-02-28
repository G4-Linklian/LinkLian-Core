import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_KEY } from '../decorators/access.decorator';
import { AppLogger } from '../logger/app-logger.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAccess = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredAccess) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const reqForm = request.req_from;

    if (reqForm === 'institution') {
      this.logger.debug(
        'Institution bypass permission check',
        'AccessGuard',
        { resource: requiredAccess.resource },
      );
      return true;
    }

    if (!user?.access) {
      throw new ForbiddenException('Access denied');
    }

    const { resource, action } = requiredAccess;

    const hasPermission =
      user.access?.[resource]?.[action] === true;

    if (!hasPermission) {
      this.logger.warn(
        'Permission denied',
        'AccessGuard',
        {
          userId: user.user_id,
          resource,
          action,
        },
      );

      throw new ForbiddenException('Permission denied');
    }

    this.logger.debug(
      'Permission granted',
      'AccessGuard',
      {
        userId: user.user_id,
        resource,
        action,
      },
    );

    return true;
  }
}
