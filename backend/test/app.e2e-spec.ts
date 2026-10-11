import Decimal from 'decimal.js';
import { Workbook } from 'exceljs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { as, createTestApp, resetDatabase, USERS } from './helpers';

/**
 * Release workflows over real HTTP against a real database.
 * Run with: npm run test:e2e   (needs backend/.env.test pointing at a disposable database)
 */
describe('WonderImport API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let refs: Awaited<ReturnType<typeof resetDatabase>>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    refs = await resetDatabase(prisma);
  });
  afterAll(async () => {
    await app.close();
  });

  const staff = () => as(app, USERS.staff);
  const admin = () => as(app, USERS.admin);
  const viewer = () => as(app, USERS.viewer);

  const newGood = (over: Record<string, unknown> = {}) => ({
    itemName: 'Mini Fan',
    trackingNumber: 'YT100',
    quantity: 2,
    unitCost: '4',
    clientId: refs.cons.id,
    supplierId: refs.supplier.id,
    categoryId: refs.category.id,
    ...over,
  });

  // ───────────────────────── Security baseline ─────────────────────────

  describe('security', () => {
    it('serves health publicly with hardened headers', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('rejects missing and invalid tokens with UNAUTHENTICATED', async () => {
      const res = await request(app.getHttpServer()).get('/api/goods').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      await request(app.getHttpServer()).get('/api/goods').set('Authorization', 'Bearer forged').expect(401);
    });

    it('rejects people who were never added', async () => {
      const res = await as(app, 'stranger@example.com').get('/auth/me').expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_PROVISIONED');
    });

    it('links an invited person on first sign-in', async () => {
      await prisma.user.create({ data: { email: 'new@test.wonderimport', name: 'New Person', role: 'STAFF' } });
      const res = await as(app, 'new@test.wonderimport').get('/auth/me').expect(200);
      expect(res.body.data).toMatchObject({ email: 'new@test.wonderimport', role: 'STAFF' });
      expect(await prisma.auditLog.count({ where: { action: 'ACCOUNT_LINK' } })).toBe(1);
    });

    it('blocks a deactivated account immediately', async () => {
      await prisma.user.update({ where: { email: USERS.staff }, data: { active: false } });
      const res = await staff().get('/goods').expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('rejects unknown fields and oversized bodies', async () => {
      const unknown = await staff().post('/goods', { ...newGood(), isAdmin: true }).expect(422);
      expect(unknown.body.error.code).toBe('VALIDATION_FAILED');
      const huge = await staff().post('/goods', { ...newGood(), notes: 'x'.repeat(300_000) });
      expect(huge.status).toBe(413);
    });
  });

  // ───────────────────────── Permissions ─────────────────────────

  describe('permissions', () => {
    it('lets viewers read but never write', async () => {
      await viewer().get('/goods').expect(200);
      await viewer().get('/dashboard/summary').expect(200);
      const res = await viewer().post('/goods', newGood()).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      await viewer().get('/exports/goods').expect(403);
      await viewer().get('/imports').expect(403);
    });

    it('keeps pricing defaults, suppliers and people for administrators', async () => {
      await staff().patch('/settings/pricing', { defaultExchangeRate: '2' }).expect(403);
      await staff().post('/suppliers', { name: 'New' }).expect(403);
      await staff().get('/users').expect(403);
      await admin().patch('/settings/pricing', { defaultExchangeRate: '1.9' }).expect(200);
    });
  });

  // ───────────────────────── Goods lifecycle ─────────────────────────

  describe('goods', () => {
    it('prices a good with exact decimals and records history', async () => {
      const res = await staff().post('/goods', newGood()).expect(201);
      expect(res.body.data).toMatchObject({ suggestedPrice: '22.64', sellingPrice: '22.64', totalCost: '15.10', expectedRevenue: '45.28', profit: '30.18', margin: '66.65', status: 'ORDERED' });
      expect(res.body.data.statusHistory).toHaveLength(1);
      expect(await prisma.goodFinancialSnapshot.count()).toBe(1);
      expect(await prisma.auditLog.count({ where: { entity: 'Good', action: 'CREATE' } })).toBe(1);
    });

    it('requires a reason for a manual selling price', async () => {
      const missing = await staff().post('/goods', newGood({ sellingPrice: '30' })).expect(422);
      expect(missing.body.error.fields).toEqual([expect.objectContaining({ field: 'overrideReason' })]);
      const ok = await staff().post('/goods', newGood({ sellingPrice: '30', overrideReason: 'Market price' })).expect(201);
      expect(ok.body.data).toMatchObject({ sellingPrice: '30.00', priceOverridden: true, overriddenBy: { name: 'Kofi Staff' } });
    });

    it('moves one stage at a time, warns on a missing check-in, and refuses stale updates', async () => {
      const id = (await staff().post('/goods', newGood()).expect(201)).body.data.id;
      await staff().patch(`/goods/${id}/status`, { status: 'IN_TRANSIT' }).expect(422);
      await staff().patch(`/goods/${id}/status`, { status: 'AT_SUPPLIER', expectedStatus: 'ORDERED' }).expect(200);
      await staff().patch(`/goods/${id}/status`, { status: 'CHINA_WAREHOUSE', expectedStatus: 'AT_SUPPLIER' }).expect(200);
      const moved = await staff().patch(`/goods/${id}/status`, { status: 'IN_TRANSIT', expectedStatus: 'CHINA_WAREHOUSE' }).expect(200);
      expect(moved.body.warnings).toEqual(['CHINA_CHECK_IN_PENDING']);

      const stale = await staff().patch(`/goods/${id}/status`, { status: 'IN_TRANSIT', expectedStatus: 'CHINA_WAREHOUSE' }).expect(409);
      expect(stale.body.error.code).toBe('CONFLICT');

      await staff().patch(`/goods/${id}/status`, { status: 'ORDERED', note: 'Mistake' }).expect(422);
      await admin().patch(`/goods/${id}/status`, { status: 'AT_SUPPLIER', note: 'Parcel never left' }).expect(200);

      const history = await staff().get(`/goods/${id}/history`).expect(200);
      expect(history.body.data.map((h: { action: string }) => h.action)).toEqual(
        expect.arrayContaining(['CREATE', 'STATUS_CHANGE', 'STATUS_CORRECTION']),
      );
    });

    it('filters, searches and sorts with the shared contract', async () => {
      await staff().post('/goods', newGood({ itemName: 'Leather Bag', unitCost: '50' })).expect(201);
      await staff().post('/goods', newGood({ itemName: 'Phone Case', unitCost: '3', clientId: refs.stock.id })).expect(201);
      const res = await viewer().get(`/goods?q=bag&clientId=${refs.cons.id}&sort=profit:desc`).expect(200);
      expect(res.body.data.map((g: { itemName: string }) => g.itemName)).toEqual(['Leather Bag']);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ───────────────────────── Reconciliation ─────────────────────────

  describe('reconciliation', () => {
    it('dashboard totals equal the goods list, the stages, and the clients plus unassigned stock', async () => {
      await staff().post('/goods', newGood({ unitCost: '3.24', quantity: 10, sellingPrice: '18', overrideReason: 'Spreadsheet price' })).expect(201);
      await staff().post('/goods', newGood({ unitCost: '132', quantity: 1, sellingPrice: '350', overrideReason: 'Spreadsheet price', clientId: refs.stock.id })).expect(201);
      const g3 = (await staff().post('/goods', newGood({ unitCost: '6' })).expect(201)).body.data.id;
      await staff().patch(`/goods/${g3}/status`, { status: 'AT_SUPPLIER' }).expect(200);

      const summary = (await viewer().get('/dashboard/summary?period=all').expect(200)).body.data;
      const list = (await viewer().get('/goods?pageSize=100').expect(200)).body.data as { totalCost: string; expectedRevenue: string; profit: string }[];
      const sum = (k: 'totalCost' | 'expectedRevenue' | 'profit') => list.reduce((d, g) => d.plus(g[k]), new Decimal(0)).toFixed(2);

      expect(summary.totals).toMatchObject({ goods: 3, landedCost: sum('totalCost'), revenue: sum('expectedRevenue'), profit: sum('profit') });
      const stages = summary.pipeline.reduce((d: Decimal, p: { revenue: string }) => d.plus(p.revenue), new Decimal(0));
      expect(stages.toFixed(2)).toBe(summary.totals.revenue);

      const cons = (await viewer().get(`/clients/${refs.cons.id}`).expect(200)).body.data.summary;
      expect(new Decimal(cons.revenue).plus(summary.unassigned.revenue).toFixed(2)).toBe(summary.totals.revenue);
    });
  });

  // ───────────────────────── Import ─────────────────────────

  describe('import', () => {
    const csv = [
      'Delivery ID,Product Description,Quantity of Item,Cost Per 1Unit,Person for,Actual Selling Price',
      '777388094064965,MOUSUF Perfume,1,13,Cons,',
      '777388094064965,MOUSUF Perfume,1,13,Cons,',
      'YT55,Wall Tape,10,3.24,,18',
      ',,1,26,,',
      'JT9,Mystery,1,5,Nobody,',
    ].join('\n');

    it('reviews, then imports only the selected rows in one step', async () => {
      const up = await staff()
        .upload('/imports')
        .field('defaultClientId', refs.stock.id)
        .field('defaultSupplierId', refs.supplier.id)
        .field('defaultCategoryId', refs.category.id)
        .attach('file', Buffer.from(csv, 'utf8'), 'june.csv')
        .expect(201);
      const batch = up.body.data;
      expect(batch.rows.map((r: { state: string }) => r.state)).toEqual(['VALID', 'WARNING', 'VALID', 'INVALID', 'INVALID']);
      expect(await prisma.good.count()).toBe(0); // nothing saved during review

      const commit = await staff().post(`/imports/${batch.id}/commit`, { rowNumbers: [2, 4] }).expect(201);
      expect(commit.body.data).toMatchObject({ status: 'COMMITTED', committedRows: 2, skippedRows: 1 });
      const tape = await prisma.good.findFirstOrThrow({ where: { itemName: 'Wall Tape' } });
      expect(tape.sellingPrice.toFixed(2)).toBe('18.00');
      expect(tape.overrideReason).toBe('Imported from june.csv, row 4');

      await staff().post(`/imports/${batch.id}/commit`, { rowNumbers: [3] }).expect(409);

      const errors = await staff().get(`/imports/${batch.id}/errors`).expect(200);
      expect(errors.headers['content-type']).toContain('spreadsheetml');

      await staff().post(`/imports/${batch.id}/archive-goods`, { reason: 'Wrong file' }).expect(403);
      const undo = await admin().post(`/imports/${batch.id}/archive-goods`, { reason: 'Wrong file' }).expect(201);
      expect(undo.body.data.archived).toBe(2);
      expect(await prisma.good.count({ where: { archivedAt: null } })).toBe(0);
    });

    it('refuses files that are not what their name says', async () => {
      const res = await staff().upload('/imports').attach('file', Buffer.from('MZ not a workbook'), 'evil.xlsx').expect(422);
      expect(res.body.error.fields[0]).toMatchObject({ field: 'file' });
    });
  });

  // ───────────────────────── Export ─────────────────────────

  describe('export', () => {
    it('exports exactly the filtered list with a totals row, and audits it', async () => {
      await staff().post('/goods', newGood({ itemName: 'A' })).expect(201);
      const b = (await staff().post('/goods', newGood({ itemName: 'B' })).expect(201)).body.data.id;
      await staff().patch(`/goods/${b}/status`, { status: 'AT_SUPPLIER' }).expect(200);

      const res = await staff()
        .get('/exports/goods?status=AT_SUPPLIER')
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-disposition']).toMatch(/wonderimport-goods-\d{4}-\d{2}-\d{2}\.xlsx/);

      const wb = new Workbook();
      await wb.xlsx.load(res.body as never);
      const ws = wb.getWorksheet('Goods')!;
      expect(ws.rowCount).toBe(3); // header, one good, totals
      expect(ws.getRow(2).getCell(2).value).toBe('B');
      expect(String(ws.getRow(3).getCell(1).value)).toContain('Total, 1 goods');
      expect(wb.getWorksheet('About this export')).toBeDefined();
      expect(await prisma.auditLog.count({ where: { action: 'EXPORT' } })).toBe(1);
    });
  });

  // ───────────────────────── People ─────────────────────────

  describe('people', () => {
    it('adds people and never leaves WonderImport without an administrator', async () => {
      const created = await admin().post('/users', { email: 'New@Test.WonderImport', name: 'Esi', role: 'STAFF' }).expect(201);
      expect(created.body.data.user).toMatchObject({ email: 'new@test.wonderimport', role: 'STAFF', linked: false });
      await admin().post('/users', { email: 'new@test.wonderimport', name: 'Dup', role: 'STAFF' }).expect(422);

      const me = await prisma.user.findUniqueOrThrow({ where: { email: USERS.admin } });
      const selfDemote = await admin().patch(`/users/${me.id}`, { role: 'STAFF' }).expect(409);
      expect(selfDemote.body.error.message).toContain('your own');
    });
  });
});
