import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

export type InviteResult = 'sent' | 'already_registered' | 'not_configured' | 'failed';

/**
 * Minimal Supabase Auth admin client (server-side only, uses the service-role key).
 * Without SUPABASE_SERVICE_ROLE_KEY, invitations are sent from the Supabase dashboard instead.
 */
@Injectable()
export class SupabaseAdmin {
  private readonly logger = new Logger(SupabaseAdmin.name);

  get configured() {
    return Boolean(env().SUPABASE_SERVICE_ROLE_KEY);
  }

  async invite(email: string, name: string): Promise<InviteResult> {
    const key = env().SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return 'not_configured';
    const origin = env().WEB_ORIGIN.split(',')[0].trim();
    const url = `${env().SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/invite?redirect_to=${encodeURIComponent(`${origin}/auth/confirm`)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, data: { name } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return 'sent';
      const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string; error_code?: string };
      const text = `${body.error_code ?? ''} ${body.msg ?? body.message ?? ''}`.toLowerCase();
      if (res.status === 422 || text.includes('already') || text.includes('email_exists')) return 'already_registered';
      this.logger.warn(`Supabase invite failed (${res.status}): ${text.trim()}`);
      return 'failed';
    } catch (e) {
      this.logger.warn(`Supabase invite failed: ${(e as Error).message}`);
      return 'failed';
    }
  }
}
