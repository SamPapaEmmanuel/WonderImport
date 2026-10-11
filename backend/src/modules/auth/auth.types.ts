import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums';

/** The signed-in person, resolved from the Supabase token and the users table. */
export interface AuthUser {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: Role;
}

export interface VerifiedToken {
  sub: string;
  email?: string;
}

export type AuthedRequest = Request & { user?: AuthUser; id?: string };
