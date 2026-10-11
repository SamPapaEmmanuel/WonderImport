import { Role } from '../../generated/prisma/enums';
import type { AuthUser } from '../auth/auth.types';
import { UsersService } from './users.service';

const actor: AuthUser = { id: 'me', authId: 'a', email: 'me@x.com', name: 'Me', role: Role.ADMIN };
const user = (over: Record<string, unknown>) => ({ id: 'u1', authId: null, email: 'u@x.com', name: 'U', role: Role.ADMIN, active: true, createdAt: new Date(), updatedAt: new Date(), ...over });

function setup(target: ReturnType<typeof user>, activeAdmins: number) {
  const tx = { user: { update: jest.fn(async ({ data }: { data: object }) => ({ ...target, ...data })) }, auditLog: { create: jest.fn() } };
  const prisma = {
    user: { findUnique: jest.fn(async () => target), count: jest.fn(async () => activeAdmins) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn() };
  return { service: new UsersService(prisma as never, audit as never, { configured: false, invite: jest.fn() } as never), audit };
}

describe('UsersService.update', () => {
  it('refuses to demote the last active administrator', async () => {
    const { service } = setup(user({}), 1);
    await expect(service.update('u1', { role: Role.STAFF }, actor)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses to deactivate the last active administrator', async () => {
    const { service } = setup(user({}), 1);
    await expect(service.update('u1', { active: false }, actor)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('stops administrators removing their own access', async () => {
    const { service } = setup(user({ id: 'me' }), 3);
    await expect(service.update('me', { role: Role.VIEWER }, actor)).rejects.toMatchObject({ message: expect.stringContaining('your own') });
  });

  it('demotes an administrator when another remains, and audits it', async () => {
    const { service, audit } = setup(user({}), 2);
    await expect(service.update('u1', { role: Role.STAFF }, actor)).resolves.toMatchObject({ role: 'STAFF' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', before: { role: 'ADMIN' }, after: { role: 'STAFF' } }), expect.anything());
  });

  it('changes staff freely', async () => {
    const { service } = setup(user({ role: Role.STAFF }), 1);
    await expect(service.update('u1', { active: false }, actor)).resolves.toMatchObject({ active: false });
  });
});
