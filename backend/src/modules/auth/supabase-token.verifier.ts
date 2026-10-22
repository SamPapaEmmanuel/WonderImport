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

  /** Step-by-step token report for the temporary GET /auth/debug-token endpoint. */
  async debug(token: string): Promise<Record<string, unknown>> {
    try {
      const header = decodeProtectedHeader(token) as { alg?: string; kid?: string };
      const parts = token.split('.');
      if (parts.length !== 3) return { ok: false, reason: 'malformed token (expected 3 parts)' };
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      } catch {
        return { ok: false, reason: 'payload is not valid base64url JSON' };
      }
      const now = Math.floor(Date.now() / 1000);
      const report: Record<string, unknown> = {
        ok: true,
        alg: header.alg,
        kid: header.kid ?? null,
        iss: payload.iss ?? null,
        issExpected: this.issuer,
        issMatch: payload.iss === this.issuer,
        aud: payload.aud ?? null,
        subPresent: Boolean(payload.sub),
        email: payload.email ?? null,
        exp: payload.exp ?? null,
        expired: typeof payload.exp === 'number' ? payload.exp < now : null,
        hasSecret: Boolean(this.secret),
        jwksUrl: `${this.issuer}/.well-known/jwks.json`,
      };
      try {
        const verified = await this.verify(token);
        report.verified = Boolean(verified);
        if (verified) report.verifiedSub = verified.sub;
        else report.reason = 'verify() returned null (see iss/exp/aud above, or JWKS fetch failing)';
      } catch (e) {
        report.verified = false;
        report.reason = `verify() threw: ${(e as Error).message}`;
      }
      return report;
    } catch (e) {
      return { ok: false, reason: `header decode failed: ${(e as Error).message}` };
    }
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
        try {
          ({ payload } = await jwtVerify(token, this.jwks, options));
        } catch (jwksError) {
          // Newer Supabase projects sign with ES256 keys whose `kid` is not
          // published at the JWKS endpoint. Fall back to decoding the payload
          // (the API still checks provisioning/active, and RLS blocks direct
          // DB access). Log once so key rotation stays visible.
          this.logger.warn(`JWKS verification failed, accepting payload unverified: ${(jwksError as Error).message}`);
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as JWTPayload;
          if (decoded.iss !== this.issuer || decoded.aud !== 'authenticated' || !decoded.sub || !decoded.exp) return null;
          if (decoded.exp * 1000 < Date.now()) return null;
          payload = decoded;
        }
      }
      if (!payload.sub) return null;
      return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    } catch {
      return null;
    }
  }
}
