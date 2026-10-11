import { Injectable } from '@nestjs/common';
import { AuditAction, Role } from '../../generated/prisma/enums';
import type { User } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, changedFields } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { SupabaseAdmin, type InviteResult } from './supabase-admin';
import type { CreateUserDto, UpdateUserDto } from './users.dto';

const view = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  active: u.active,
  /** True once the person has signed in at least once. */
  linked: Boolean(u.authId),
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseAdmin,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    return { users: users.map(view), invitesEnabled: this.supabase.configured };
  }

  async create(dto: CreateUserDto, actor: AuthUser, requestId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw AppException.validation([{ field: 'email', code: 'unique', message: 'Someone with this email is already in WonderImport' }]);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: dto.email, name: dto.name.trim(), role: dto.role } });
      await this.audit.record({ entity: 'User', entityId: u.id, action: AuditAction.CREATE, actorId: actor.id, after: { email: u.email, name: u.name, role: u.role }, requestId }, tx);
      return u;
    });
    const invite: InviteResult | null = dto.sendInvite ? await this.supabase.invite(user.email, user.name) : null;
    return { user: view(user), invite };
  }

  async resendInvite(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw AppException.notFound('User');
    if (!u.active) throw new AppException(ErrorCode.CONFLICT, 'Reactivate this person before inviting them.');
    return { invite: await this.supabase.invite(u.email, u.name) };
  }

  /** Role and access changes. The last active administrator can never be demoted or deactivated. */
  async update(id: string, dto: UpdateUserDto, actor: AuthUser, requestId?: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw AppException.notFound('User');

    const losesAdmin = u.role === Role.ADMIN && u.active && ((dto.role !== undefined && dto.role !== Role.ADMIN) || dto.active === false);
    if (losesAdmin) {
      if (u.id === actor.id) throw new AppException(ErrorCode.CONFLICT, 'You cannot remove your own administrator access. Ask another administrator.');
      const admins = await this.prisma.user.count({ where: { role: Role.ADMIN, active: true } });
      if (admins <= 1) throw new AppException(ErrorCode.CONFLICT, 'WonderImport needs at least one active administrator.');
    }

    const data = { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.role !== undefined ? { role: dto.role } : {}), ...(dto.active !== undefined ? { active: dto.active } : {}) };
    const pick = (x: Pick<User, 'name' | 'role' | 'active'>) => ({ name: x.name, role: x.role, active: x.active });
    const diff = changedFields(pick(u), { ...pick(u), ...data });
    if (!diff.changed.length) return view(u);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id }, data });
      await this.audit.record({ entity: 'User', entityId: id, action: AuditAction.UPDATE, actorId: actor.id, before: diff.before, after: diff.after, requestId }, tx);
      return next;
    });
    return view(updated);
  }
}
