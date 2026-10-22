import { Controller, Get, Req } from '@nestjs/common';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SupabaseTokenVerifier } from './supabase-token.verifier';

@Controller('auth')
export class AuthController {
  constructor(private readonly verifier: SupabaseTokenVerifier) {}

  /** The signed-in user and their role. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { data: user };
  }

  /**
   * Temporary debug: reports why the Bearer token fails verification.
   * Remove once login is stable. Public so it works before auth.
   */
  @Public()
  @Get('debug-token')
  async debugToken(@Req() req: { headers: Record<string, string | undefined> }) {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return { ok: false, reason: 'missing Bearer token' };
    return this.verifier.debug(token);
  }
}
