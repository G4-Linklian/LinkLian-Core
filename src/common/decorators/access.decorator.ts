import { SetMetadata } from '@nestjs/common';

export const ACCESS_KEY = 'access_permission';

export const Access = (
  resource: string,
  action: 'read' | 'create' | 'update' | 'delete',
) => SetMetadata(ACCESS_KEY, { resource, action });
