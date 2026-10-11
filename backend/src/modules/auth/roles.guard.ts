import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthedRequest } from './auth.types';
import { IS_PUBLIC } from './decorators/public.decorator';
import { ROLES } from './decorators/roles.decorator';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'administrators', STAFF: 'staff', VIEWER: 'viewers' };

/** Global guard that runs after AuthGuard and enforces @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new AppException(ErrorCode.UNAUTHENTICATED, 'Sign in to continue');
    if (!required.includes(user.role)) {
      const who = required.map((r) => ROLE_LABEL[r]).join(' or ');
      throw new AppException(ErrorCode.FORBIDDEN, `Only ${who} can do this`);
    }
    return true;
  }
}
