import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  role: UserRoleEnum;
  side: 'platform' | 'tenant';
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Expected to be injected by JwtAuthGuard
  },
);
