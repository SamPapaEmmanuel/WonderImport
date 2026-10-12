/**
 * Seeds controlled demo data:
 *  - pricing defaults (1 CNY = GHS 1.887, multiplier 3)
 *  - the first administrator, with a Supabase login (email + password)
 *  - categories, placeholder suppliers, clients from the spreadsheet's "Person for" column
 *  - the 220 goods from the reference spreadsheet (SEED_DEMO_GOODS=true)
 *
 * Required in .env:
 *  - DIRECT_URL (or DATABASE_URL)
 *  - SEED_ADMIN_EMAIL
 *  - SEED_ADMIN_PASSWORD         (at least 8 characters)
 *  - SUPABASE_URL                (https://<project-ref>.supabase.co)
 *  - SUPABASE_SERVICE_ROLE_KEY   (Project Settings -> API -> service_role; never commit or expose it)
 * Optional: SEED_ADMIN_NAME, SEED_DEMO_GOODS=false
 *
 * Safe to run more than once: master data is upserted, the admin's password is reset to
 * SEED_ADMIN_PASSWORD, and goods are only loaded into an empty table.
 * Run with: npm run db:seed
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { AuditAction, Role, ShipmentStatus } from '../src/generated/prisma/enums';
import { computeFinancials } from '../src/common/finance/pricing';
import { SHIPMENT_FLOW, STATUS_DATE_FIELD } from '../src/common/finance/shipment';
import { DEFAULT_PRICING, PRICING_KEY } from '../src/modules/settings/settings.types';
import seed from './seed-data/goods.json';

interface SeedGood {
  sourceRow: number;
  trackingNumber: string | null;
  itemName: string;
  quantity: number;
  unitCost: string;
  client: string | null;
  category: string;
  supplier: string;
  actualSellingPrice: string | null;
  retailPrice: string | null;
  status: keyof typeof ShipmentStatus;
  orderedAt: string;
  chinaCheckedIn: boolean;
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DIRECT_URL or DATABASE_URL before seeding');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const STOCK_CLIENT = { code: 'STOCK', name: 'Stock (unassigned)' };

const CATEGORIES: Record<string, string> = {
  Apparel: 'Tops, shirts, shorts, sleepwear',
  Bags: 'Handbags, shoulder bags, totes',
  Fragrance: 'Perfumes and body sprays',
  Watches: 'Wrist watches',
  Footwear: 'Sneakers and slippers',
  Electronics: 'Small electronics and gadgets',
  'Phone accessories': 'Cases, cords and straps',
  'Home & stationery': 'Home items, books and stationery',
  Accessories: 'Hats, belts, glasses and jewellery',
};

const SUPPLIERS = [
  { name: 'Taobao Marketplace', notes: 'Placeholder supplier for seeded data' },
  { name: '1688 Wholesale', notes: 'Placeholder supplier for seeded data' },
  { name: 'Pinduoduo', notes: 'Placeholder supplier for seeded data' },
];

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T09:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

/** Typical days from order to reaching each stage, used to back-fill a believable timeline. */
const STAGE_OFFSET_DAYS = [0, 4, 10, 14, 38, 42];

/**
 * Creates the administrator's login in Supabase Auth (email + password).
 * If the email is already registered, resets that account's password instead.
 * Returns the Supabase user id.
 */
async function ensureSupabaseLogin(email: string, password: string, name: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to create the administrator login');
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (!error && data.user) {
    console.log(`Supabase login created for ${email}`);
    return data.user.id;
  }

  // Already registered: find the account and reset its password.
  let existingId: string | undefined;
  for (let page = 1; !existingId; page++) {
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw listError;
    existingId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (list.users.length < 200) break;
  }
  if (!existingId) throw error ?? new Error(`Could not create or find a Supabase user for ${email}`);

  const { error: updateError } = await supabase.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
  });
  if (updateError) throw updateError;
  console.log(`Supabase login already existed for ${email}; password reset`);
  return existingId;
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!adminEmail) throw new Error('Set SEED_ADMIN_EMAIL to the first administrator’s email');
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administrator';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (adminPassword.length < 8) throw new Error('Set SEED_ADMIN_PASSWORD (at least 8 characters)');

  const supabaseUserId = await ensureSupabaseLogin(adminEmail, adminPassword, adminName);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: adminName, role: Role.ADMIN, authId: supabaseUserId },
    update: { role: Role.ADMIN, active: true, authId: supabaseUserId },
  });
  console.log(`Administrator: ${admin.email}`);

  await prisma.appSetting.upsert({
    where: { key: PRICING_KEY },
    create: { key: PRICING_KEY, value: { ...DEFAULT_PRICING }, updatedById: admin.id },
    update: {},
  });

  const categoryIds = new Map<string, string>();
  for (const [name, description] of Object.entries(CATEGORIES)) {
    const c = await prisma.category.upsert({ where: { name }, create: { name, description }, update: {} });
    categoryIds.set(name, c.id);
  }

  const supplierIds = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const row = await prisma.supplier.upsert({ where: { name: s.name }, create: s, update: {} });
    supplierIds.set(s.name, row.id);
  }

  const goods = (seed as { goods: SeedGood[] }).goods;
  const clientNames = [...new Set(goods.map((g) => g.client).filter((c): c is string => !!c))].sort();
  const clientIds = new Map<string | null, string>();
  const stock = await prisma.client.upsert({
    where: { code: STOCK_CLIENT.code },
    create: { ...STOCK_CLIENT, isStock: true, notes: 'Goods bought for resale with no named buyer' },
    update: {},
  });
  clientIds.set(null, stock.id);
  for (const [i, name] of clientNames.entries()) {
    const code = `CL-${String(i + 1).padStart(3, '0')}`;
    const c = await prisma.client.upsert({ where: { code }, create: { code, name }, update: {} });
    clientIds.set(name, c.id);
  }
  console.log(`Master data: ${categoryIds.size} categories, ${supplierIds.size} suppliers, ${clientIds.size} clients`);

  if (process.env.SEED_DEMO_GOODS === 'false') return;
  if ((await prisma.good.count()) > 0) {
    console.log('Goods table already has data; skipping demo goods.');
    return;
  }

  const rate = (seed as { exchangeRate: string }).exchangeRate;
  const multiplier = (seed as { multiplier: string }).multiplier;
  const goodRows: Prisma.GoodCreateManyInput[] = [];
const snapshotRows: Prisma.GoodFinancialSnapshotCreateManyInput[] = [];
const historyRows: Prisma.GoodsStatusHistoryCreateManyInput[] = [];

  for (const g of goods) {
    const id = randomUUID();
    const f = computeFinancials({
      quantity: g.quantity,
      unitCost: g.unitCost,
      exchangeRate: rate,
      multiplier,
      sellingPriceOverride: g.actualSellingPrice,
    });
    const reached = SHIPMENT_FLOW.indexOf(g.status as ShipmentStatus);
    const stageDates: Partial<Record<(typeof STATUS_DATE_FIELD)[ShipmentStatus], Date>> = {};
    SHIPMENT_FLOW.slice(0, reached + 1).forEach((s, i) => {
      stageDates[STATUS_DATE_FIELD[s]] = addDays(g.orderedAt, STAGE_OFFSET_DAYS[i]);
    });
    const orderedAt = addDays(g.orderedAt, 0);

    goodRows.push({
      id,
      itemName: g.itemName,
      trackingNumber: g.trackingNumber,
      quantity: g.quantity,
      unitCost: g.unitCost,
      exchangeRate: rate,
      priceMultiplier: multiplier,
      suggestedPrice: f.suggestedPrice,
      sellingPrice: f.sellingPrice,
      priceOverridden: f.priceOverridden,
      overrideReason: f.priceOverridden ? 'Actual selling price recorded in the reference spreadsheet' : null,
      overriddenById: f.priceOverridden ? admin.id : null,
      overriddenAt: f.priceOverridden ? orderedAt : null,
      retailPrice: g.retailPrice,
      totalCost: f.totalCost,
      expectedRevenue: f.expectedRevenue,
      profit: f.profit,
      margin: f.margin,
      status: g.status as ShipmentStatus,
      chinaCheckedIn: g.chinaCheckedIn,
      chinaCheckedInAt: g.chinaCheckedIn ? addDays(g.orderedAt, STAGE_OFFSET_DAYS[2] + 1) : null,
      chinaCheckedInById: g.chinaCheckedIn ? admin.id : null,
      ...stageDates,
      notes: `Imported from spreadsheet row ${g.sourceRow}`,
      clientId: clientIds.get(g.client) as string,
      supplierId: supplierIds.get(g.supplier) as string,
      categoryId: categoryIds.get(g.category) as string,
      createdById: admin.id,
      createdAt: orderedAt,
    });

    snapshotRows.push({
      goodId: id,
      quantity: g.quantity,
      unitCost: g.unitCost,
      exchangeRate: rate,
      priceMultiplier: multiplier,
      suggestedPrice: f.suggestedPrice,
      sellingPrice: f.sellingPrice,
      priceOverridden: f.priceOverridden,
      overrideReason: f.priceOverridden ? 'Actual selling price recorded in the reference spreadsheet' : null,
      createdById: admin.id,
      createdAt: orderedAt,
    });

    SHIPMENT_FLOW.slice(0, reached + 1).forEach((s, i) => {
      historyRows.push({
        goodId: id,
        fromStatus: i === 0 ? null : SHIPMENT_FLOW[i - 1],
        toStatus: s,
        changedById: admin.id,
        changedAt: addDays(g.orderedAt, STAGE_OFFSET_DAYS[i]),
        note: i === 0 ? 'Seeded from reference spreadsheet' : null,
      });
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.good.createMany({ data: goodRows });
    await tx.goodFinancialSnapshot.createMany({ data: snapshotRows });
    await tx.goodsStatusHistory.createMany({ data: historyRows });
    await tx.auditLog.create({
      data: {
        entity: 'Seed',
        entityId: 'reference-spreadsheet',
        action: AuditAction.IMPORT,
        actorId: admin.id,
        after: { goods: goodRows.length, statusHistory: historyRows.length },
        note: 'Demo data from Final Importation Analysis.xlsx',
      },
    });
  });
  console.log(`Goods: ${goodRows.length} created with ${historyRows.length} status history entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());