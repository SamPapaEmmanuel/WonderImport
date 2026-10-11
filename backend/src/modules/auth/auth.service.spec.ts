import { Role } from '../../generated/prisma/enums';
import { AppException } from '../../common/errors/app-exception';
import { AuthService } from './auth.service';

function setup(users: Array<{ id: string; authId: string | null; email: string; active?: boolean }>) {
  const rows = users.map((u) => ({ name: 'N', role: Role.STAFF, active: true, ...u }));
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const user = {
    findUnique: jest.fn(async ({ where }: { where: { authId?: string; email?: string } }) =>
      rows.find((r) => (where.authId ? r.authId === where.authId : r.email === where.email)) ?? null,
    ),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { authId: string } }) => {
      const r = rows.find((x) => x.id === where.id)!;
      r.authId = data.authId;
      return r;
    }),
  };
  const prisma = { user, $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({ user })) };
  return { service: new AuthService(prisma as never, audit as never), audit, rows };
}

describe('AuthService.resolveUser', () => {
  it('returns a linked user', async () => {
    const { service } = setup([{ id: 'u1', authId: 'auth-1', email: 'ama@example.com' }]);
    await expect(service.resolveUser({ sub: 'auth-1' })).resolves.toMatchObject({ id: 'u1', role: Role.STAFF });
  });

  it('links an invited user by email on first sign-in and audits it', async () => {
    const { service, audit, rows } = setup([{ id: 'u2', authId: null, email: 'kofi@example.com' }]);
    const user = await service.resolveUser({ sub: 'auth-2', email: 'Kofi@Example.com' }, 'req-1');
    expect(user.authId).toBe('auth-2');
    expect(rows[0].authId).toBe('auth-2');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'User', entityId: 'u2', action: 'ACCOUNT_LINK', actorId: 'u2', requestId: 'req-1' }),
      expect.anything(),
    );
  });

  it('rejects people who were never added', async () => {
    const { service } = setup([]);
    await expect(service.resolveUser({ sub: 'x', email: 'stranger@example.com' })).rejects.toMatchObject({ code: 'ACCOUNT_NOT_PROVISIONED' });
  });

  it('does not hijack an email already linked to another Supabase account', async () => {
    const { service } = setup([{ id: 'u3', authId: 'auth-3', email: 'yaa@example.com' }]);
    await expect(service.resolveUser({ sub: 'other', email: 'yaa@example.com' })).rejects.toBeInstanceOf(AppException);
  });

  it('rejects deactivated accounts', async () => {
    const { service } = setup([{ id: 'u4', authId: 'auth-4', email: 'old@example.com', active: false }]);
    await expect(service.resolveUser({ sub: 'auth-4' })).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' });
  });
});
