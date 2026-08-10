import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Shape attached to `request.user` by JwtStrategy#validate. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  email: string;
}

/** `@CurrentUser() user: AuthenticatedUser` in a controller method. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
