import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums';
import { AppException } from '../../common/errors/app-exception';
import type { AuthUser } from './auth.types';
import { IS_PUBLIC } from './decorators/public.decorator';
import { ROLES } from './decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function ctxFor(user: AuthUser | undefined, meta: Record<string, unknown>) {
  const reflector = { getAllAndOverride: jest.fn((key: string) => meta[key]) } as unknown as Reflector;
  const ctx = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), ctx };
}

const user = (role: Role): AuthUser => ({ id: 'u1', authId: 'a1', email: 'x@y.z', name: 'X', role });

describe('RolesGuard', () => {
  it('allows any signed-in user when no roles are required', () => {
    const { guard, ctx } = ctxFor(user(Role.VIEWER), {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    const { guard, ctx } = ctxFor(user(Role.ADMIN), { [ROLES]: [Role.ADMIN] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it.each([Role.STAFF, Role.VIEWER])('rejects %s on an admin-only route with FORBIDDEN', (role) => {
    const { guard, ctx } = ctxFor(user(role), { [ROLES]: [Role.ADMIN] });
    try {
      guard.canActivate(ctx);
      fail('expected FORBIDDEN');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('FORBIDDEN');
      expect((e as AppException).getStatus()).toBe(403);
    }
  });

  it('allows staff and admin on a staff route, but not viewers', () => {
    const meta = { [ROLES]: [Role.ADMIN, Role.STAFF] };
    expect(ctxFor(user(Role.STAFF), meta).guard.canActivate(ctxFor(user(Role.STAFF), meta).ctx)).toBe(true);
    const v = ctxFor(user(Role.VIEWER), meta);
    expect(() => v.guard.canActivate(v.ctx)).toThrow(AppException);
  });

  it('skips checks on public routes', () => {
    const { guard, ctx } = ctxFor(undefined, { [IS_PUBLIC]: true, [ROLES]: [Role.ADMIN] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
