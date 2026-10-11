import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/enums';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, VerifiedToken } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Maps a verified Supabase identity to a WonderImport user.
   * People are provisioned by email first (invite); the Supabase id is linked on first sign-in.
   */
  async resolveUser(token: VerifiedToken, requestId?: string): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({ where: { authId: token.sub } });

    if (!user && token.email) {
      const invited = await this.prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
      if (invited && !invited.authId) {
        user = await this.prisma.$transaction(async (tx) => {
          const linked = await tx.user.update({ where: { id: invited.id }, data: { authId: token.sub } });
          await this.audit.record(
            { entity: 'User', entityId: linked.id, action: AuditAction.ACCOUNT_LINK, actorId: linked.id, before: { authId: null }, after: { authId: token.sub }, requestId },
            tx,
          );
          return linked;
        });
      }
    }

    if (!user) {
      throw new AppException(ErrorCode.ACCOUNT_NOT_PROVISIONED, 'Your sign-in worked, but this email has not been added to WonderImport. Ask an administrator to add you.');
    }
    if (!user.active) {
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, 'This account has been deactivated. Ask an administrator to restore access.');
    }
    return { id: user.id, authId: user.authId as string, email: user.email, name: user.name, role: user.role };
  }
}
