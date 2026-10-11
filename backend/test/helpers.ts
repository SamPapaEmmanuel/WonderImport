import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Role } from '../src/generated/prisma/enums';
import { SupabaseTokenVerifier } from '../src/modules/auth/supabase-token.verifier';
import { PrismaService } from '../src/prisma/prisma.service';

/** Deterministic UUID for a test email, used as the Supabase user id. */
export const authIdFor = (email: string) => {
  const h = createHash('sha1').update(email).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** Accepts tokens of the form "test:<email>" instead of real Supabase JWTs. */
const fakeVerifier = {
  verify: async (token: string) => (token.startsWith('test:') ? { sub: authIdFor(token.slice(5)), email: token.slice(5) } : null),
};

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier)
    .useValue(fakeVerifier)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export const USERS = {
  admin: 'admin@test.wonderimport',
  staff: 'staff@test.wonderimport',
  viewer: 'viewer@test.wonderimport',
} as const;

/** Empties every table, then creates people, pricing, and one of each master record. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE import_rows, import_batches, audit_logs, good_financial_snapshots, goods_status_history, goods,
             clients, suppliers, categories, app_settings, users RESTART IDENTITY CASCADE`);
  const [admin] = await Promise.all([
    prisma.user.create({ data: { email: USERS.admin, name: 'Ama Admin', role: Role.ADMIN, authId: authIdFor(USERS.admin) } }),
    prisma.user.create({ data: { email: USERS.staff, name: 'Kofi Staff', role: Role.STAFF, authId: authIdFor(USERS.staff) } }),
    prisma.user.create({ data: { email: USERS.viewer, name: 'Yaa Viewer', role: Role.VIEWER, authId: authIdFor(USERS.viewer) } }),
  ]);
  await prisma.appSetting.create({ data: { key: 'pricing', value: { defaultExchangeRate: '1.887', priceMultiplier: '3', baseCurrency: 'GHS', sourceCurrency: 'CNY' }, updatedById: admin.id } });
  const [stock, cons, supplier, category] = await Promise.all([
    prisma.client.create({ data: { code: 'STOCK', name: 'Stock (unassigned)', isStock: true } }),
    prisma.client.create({ data: { code: 'CL-001', name: 'Cons' } }),
    prisma.supplier.create({ data: { name: '1688 Wholesale' } }),
    prisma.category.create({ data: { name: 'Bags' } }),
  ]);
  return { stock, cons, supplier, category };
}

/** supertest agent with a signed-in user. */
export function as(app: NestExpressApplication, email: string) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer test:${email}` };
  return {
    get: (url: string) => request(server).get(`/api${url}`).set(auth),
    post: (url: string, body?: object) => request(server).post(`/api${url}`).set(auth).send(body ?? {}),
    patch: (url: string, body: object) => request(server).patch(`/api${url}`).set(auth).send(body),
    upload: (url: string) => request(server).post(`/api${url}`).set(auth),
  };
}
