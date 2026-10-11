import { Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../../config/env';
import type { VerifiedToken } from './auth.types';

/**
 * Verifies Supabase access tokens.
 * - Projects using JWT signing keys (ES256/RS256): verified against the public JWKS.
 * - Projects on the legacy shared secret (HS256): verified with SUPABASE_JWT_SECRET.
 */
@Injectable()
export class SupabaseTokenVerifier {
  private readonly logger = new Logger(SupabaseTokenVerifier.name);
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly secret?: Uint8Array;

  constructor() {
    const base = env().SUPABASE_URL.replace(/\/+$/, '');
    this.issuer = `${base}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
    const s = env().SUPABASE_JWT_SECRET;
    this.secret = s ? new TextEncoder().encode(s) : undefined;
  }

  /** Returns the token's subject and email, or null when the token is invalid or expired. */
  async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const { alg } = decodeProtectedHeader(token);
      const options = { issuer: this.issuer, audience: 'authenticated' };
      let payload: JWTPayload;
      if (alg === 'HS256') {
        if (!this.secret) {
          this.logger.warn('Received an HS256 token but SUPABASE_JWT_SECRET is not set');
          return null;
        }
        ({ payload } = await jwtVerify(token, this.secret, options));
      } else {
        ({ payload } = await jwtVerify(token, this.jwks, options));
      }
      if (!payload.sub) return null;
      return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    } catch {
      return null;
    }
  }
}
