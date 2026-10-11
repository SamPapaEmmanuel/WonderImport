import { api } from '@/lib/axios-instance';
import type { Envelope, Role } from '@/lib/types';

export interface Person {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  linked: boolean;
  createdAt: string;
}

export type InviteResult = 'sent' | 'already_registered' | 'not_configured' | 'failed';

export const usersApi = {
  list: async () => (await api.get<Envelope<{ users: Person[]; invitesEnabled: boolean }>>('/users')).data.data,
  create: async (body: { email: string; name: string; role: Role; sendInvite: boolean }) =>
    (await api.post<Envelope<{ user: Person; invite: InviteResult | null }>>('/users', body)).data.data,
  update: async (id: string, body: { name?: string; role?: Role; active?: boolean }) => (await api.patch<Envelope<Person>>(`/users/${id}`, body)).data.data,
  invite: async (id: string) => (await api.post<Envelope<{ invite: InviteResult }>>(`/users/${id}/invite`)).data.data.invite,
};

export function describeInvite(result: InviteResult | null, email: string): { tone: 'success' | 'info' | 'warning'; title: string; description?: string } | null {
  switch (result) {
    case 'sent':
      return { tone: 'success', title: `Invitation sent to ${email}`, description: 'They set a password from the email, then sign in.' };
    case 'already_registered':
      return { tone: 'info', title: `${email} already has a sign-in`, description: 'They can sign in now with their existing password.' };
    case 'not_configured':
      return { tone: 'info', title: 'Send the invitation from Supabase', description: 'Authentication > Users > Invite user, using the same email.' };
    case 'failed':
      return { tone: 'warning', title: 'The invitation email could not be sent', description: 'Try again, or invite them from the Supabase dashboard.' };
    default:
      return null;
  }
}
