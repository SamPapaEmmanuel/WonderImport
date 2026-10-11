import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthService } from './auth.service';
import type { AuthedRequest } from './auth.types';
import { IS_PUBLIC } from './decorators/public.decorator';
import { SupabaseTokenVerifier } from './supabase-token.verifier';

/** Global guard: every route requires a valid Supabase access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseTokenVerifier,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(ErrorCode.UNAUTHENTICATED, 'Sign in to continue');
    }

    const verified = await this.verifier.verify(token);
    if (!verified) throw new AppException(ErrorCode.UNAUTHENTICATED, 'Your session has expired. Sign in again.');

    req.user = await this.auth.resolveUser(verified, req.id);
    return true;
  }
}
