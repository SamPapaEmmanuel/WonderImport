import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditAction, ImportBatchStatus, ImportRowState } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { paginate, skipTake, type PaginationQuery } from '../../common/pagination/pagination';
import { dateOnly } from '../../common/validation/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { SettingsService } from '../settings/settings.service';
import type { CommitImportDto, UploadImportDto } from './dto';
import { readImportFile } from './import-file';
import { ImportFileError, type ParsedRow } from './import-parse';
import { duplicateKey, validateRows, type ImportContext, type ImportDefaults, type ParsedGood, type RowMessage } from './import-validate';
import { buildErrorReport, buildTemplateCsv, buildTemplateXlsx } from './import-workbooks';

/** What is stored on the batch so a commit re-validates with exactly the choices made at upload. */
export interface StoredOptions {
  defaults: ImportDefaults;
  sheetName: string | null;
  headerRow: number;
  mapping: { field: string; header: string }[];
  ignoredColumns: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────────────────── Template ─────────────────────────

  async template(format: 'xlsx' | 'csv') {
    if (format === 'csv') return { buffer: Buffer.from(buildTemplateCsv(), 'utf8'), fileName: 'wonderimport-goods-template.csv', type: 'text/csv; charset=utf-8' };
    const active = { archivedAt: null };
    const [clients, suppliers, categories] = await Promise.all([
      this.prisma.client.findMany({ where: active, select: { name: true }, orderBy: [{ isStock: 'desc' }, { name: 'asc' }] }),
      this.prisma.supplier.findMany({ where: active, select: { name: true }, orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ where: active, select: { name: true }, orderBy: { name: 'asc' } }),
    ]);
    const buffer = await buildTemplateXlsx({ clients: clients.map((c) => c.name), suppliers: suppliers.map((s) => s.name), categories: categories.map((c) => c.name) });
    return { buffer, fileName: 'wonderimport-goods-template.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  // ───────────────────────── Validation context ─────────────────────────

  private async context(defaults: ImportDefaults, fileName: string, rows: ParsedRow[]): Promise<ImportContext> {
    const pricing = await this.settings.getPricing();
    const pick = { id: true, name: true, archivedAt: true } as const;
    const tracking = [...new Set(rows.map((r) => r.cells.trackingNumber).filter((t) => t !== null && t !== undefined).map((t) => (typeof t === 'number' && Number.isInteger(t) ? BigInt(Math.round(t)).toString() : String(t).trim())))];
    const untrackedNames = [...new Set(rows.filter((r) => r.cells.trackingNumber == null && r.cells.itemName != null).map((r) => String(r.cells.itemName).trim()))];

    const [clients, suppliers, categories, existing] = await Promise.all([
      this.prisma.client.findMany({ select: { ...pick, code: true } }),
      this.prisma.supplier.findMany({ select: pick }),
      this.prisma.category.findMany({ select: pick }),
      this.prisma.good.findMany({
        where: { archivedAt: null, OR: [{ trackingNumber: { in: tracking } }, { trackingNumber: null, itemName: { in: untrackedNames } }] },
        select: { trackingNumber: true, itemName: true, quantity: true, unitCost: true },
      }),
    ]);

    const trackingUse = new Map<string, number>();
    for (const g of existing) if (g.trackingNumber) trackingUse.set(g.trackingNumber, (trackingUse.get(g.trackingNumber) ?? 0) + 1);
    const ref = (r: { id: string; name: string; archivedAt: Date | null; code?: string }) => ({ id: r.id, name: r.name, code: r.code, archived: !!r.archivedAt });

    return {
      clients: clients.map(ref),
      suppliers: suppliers.map(ref),
      categories: categories.map(ref),
      defaults: { ...defaults, exchangeRate: defaults.exchangeRate || pricing.defaultExchangeRate },
      multiplier: pricing.priceMultiplier,
      existingKeys: new Set(existing.map((g) => duplicateKey({ ...g, unitCost: g.unitCost.toString() }))),
      trackingUse,
      fileName,
      today: today(),
    };
  }

  /** Upload defaults must point at active records. */
  private async checkDefaults(dto: UploadImportDto) {
    const fields: { field: string; code: string; message: string }[] = [];
    const check = async (field: string, id: string | null | undefined, find: (id: string) => Promise<{ archivedAt: Date | null } | null>, label: string) => {
      if (!id) return;
      const row = await find(id);
      if (!row) fields.push({ field, code: 'not_found', message: `That ${label} no longer exists` });
      else if (row.archivedAt) fields.push({ field, code: 'archived', message: `That ${label} is archived` });
    };
    const sel = { select: { archivedAt: true } } as const;
    await Promise.all([
      check('defaultClientId', dto.defaultClientId, (id) => this.prisma.client.findUnique({ where: { id }, ...sel }), 'client'),
      check('defaultSupplierId', dto.defaultSupplierId, (id) => this.prisma.supplier.findUnique({ where: { id }, ...sel }), 'supplier'),
      check('defaultCategoryId', dto.defaultCategoryId, (id) => this.prisma.category.findUnique({ where: { id }, ...sel }), 'category'),
    ]);
    if (fields.length) throw AppException.validation(fields);
  }

  // ───────────────────────── Upload (dry run) ─────────────────────────

  /** Reads and validates the file and stores the result for review. No goods are created. */
  async upload(file: { originalname: string; buffer: Buffer } | undefined, dto: UploadImportDto, actor: AuthUser) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'Choose a .xlsx or .csv file to upload' }]);
    await this.checkDefaults(dto);

    let sheet: Awaited<ReturnType<typeof readImportFile>>;
    try {
      sheet = await readImportFile(file.originalname, file.buffer);
    } catch (e) {
      if (e instanceof ImportFileError) throw AppException.validation([{ field: 'file', code: 'unreadable', message: e.message }]);
      throw e;
    }

    const defaults: ImportDefaults = {
      clientId: dto.defaultClientId ?? null,
      supplierId: dto.defaultSupplierId ?? null,
      categoryId: dto.defaultCategoryId ?? null,
      status: dto.defaultStatus ?? null,
      exchangeRate: dto.defaultExchangeRate ?? '',
    };
    const ctx = await this.context(defaults, file.originalname, sheet.rows);
    const validated = validateRows(sheet.rows, ctx);
    const count = (s: string) => validated.filter((v) => v.state === s).length;

    const options: StoredOptions = {
      defaults: ctx.defaults,
      sheetName: sheet.sheetName,
      headerRow: sheet.headerRow,
      mapping: sheet.mapping.map((m) => ({ field: m.field, header: m.header })),
      ignoredColumns: sheet.unmappedHeaders,
    };

    const id = await this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            fileName: file.originalname.slice(0, 200),
            status: ImportBatchStatus.READY,
            totalRows: validated.length,
            validRows: count('VALID'),
            warningRows: count('WARNING'),
            invalidRows: count('INVALID'),
            options: options as unknown as Prisma.InputJsonValue,
            importedById: actor.id,
          },
        });
        await tx.importRow.createMany({
          data: validated.map((v) => ({
            batchId: batch.id,
            rowNumber: v.rowNumber,
            raw: v.raw as unknown as Prisma.InputJsonValue,
            state: v.state as ImportRowState,
            messages: v.messages as unknown as Prisma.InputJsonValue,
            parsed: v.parsed ? (v.parsed as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          })),
        });
        return batch.id;
      },
      { timeout: 30_000 },
    );
    return this.get(id);
  }

  // ───────────────────────── Read ─────────────────────────

  private view(b: Prisma.ImportBatchGetPayload<{ include: { importedBy: { select: { id: true; name: true } } } }>) {
    return {
      id: b.id,
      fileName: b.fileName,
      status: b.status,
      totalRows: b.totalRows,
      validRows: b.validRows,
      warningRows: b.warningRows,
      invalidRows: b.invalidRows,
      committedRows: b.committedRows,
      skippedRows: b.skippedRows,
      options: b.options as unknown as StoredOptions | null,
      importedBy: b.importedBy,
      createdAt: b.createdAt.toISOString(),
      committedAt: b.committedAt?.toISOString() ?? null,
    };
  }

  private readonly include = { importedBy: { select: { id: true, name: true } } } as const;

  async list(q: PaginationQuery) {
    const [total, rows] = await Promise.all([
      this.prisma.importBatch.count(),
      this.prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' }, include: this.include, ...skipTake(q) }),
    ]);
    return paginate(rows.map((b) => this.view(b)), total, q, {});
  }

  async get(id: string) {
    const b = await this.prisma.importBatch.findUnique({ where: { id }, include: this.include });
    if (!b) throw AppException.notFound('Import');
    const rows = await this.prisma.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: 'asc' } });
    return {
      ...this.view(b),
      rows: rows.map((r) => ({
        rowNumber: r.rowNumber,
        state: r.state,
        raw: r.raw,
        messages: (r.messages ?? []) as unknown as RowMessage[],
        parsed: r.parsed as unknown as ParsedGood | null,
        goodId: r.goodId,
      })),
    };
  }

  // ───────────────────────── Commit ─────────────────────────

  /**
   * Creates goods for the chosen rows in one transaction. Rows are re-validated against current master data first,
   * so a client archived since the upload cannot slip through. Rows that are no longer valid are reported, not created.
   */
  async commit(id: string, dto: CommitImportDto, actor: AuthUser, requestId?: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw AppException.notFound('Import');
    if (batch.status !== ImportBatchStatus.READY) {
      throw new AppException(ErrorCode.CONFLICT, batch.status === ImportBatchStatus.COMMITTED ? 'This import has already been completed.' : 'This import was cancelled. Upload the file again.');
    }

    const wanted = [...new Set(dto.rowNumbers)];
    const selected = await this.prisma.importRow.findMany({ where: { batchId: id, rowNumber: { in: wanted } }, orderBy: { rowNumber: 'asc' } });
    if (selected.length !== wanted.length) {
      throw AppException.validation([{ field: 'rowNumbers', code: 'unknown', message: 'Some selected rows are not part of this import. Refresh and try again.' }]);
    }

    const options = batch.options as unknown as StoredOptions;
    const rows: ParsedRow[] = selected.map((r) => ({ rowNumber: r.rowNumber, cells: r.raw as ParsedRow['cells'] }));
    const ctx = await this.context(options.defaults, batch.fileName, rows);
    const revalidated = validateRows(rows, ctx);
    const importable = revalidated.filter((v) => v.parsed);
    const failed = revalidated.filter((v) => !v.parsed);
    if (!importable.length) {
      throw new AppException(ErrorCode.CONFLICT, 'None of the selected rows can be imported any more. Check the messages on each row.', undefined, {
        rows: failed.map((f) => ({ rowNumber: f.rowNumber, messages: f.messages })),
      });
    }

    const now = new Date();
    const goodIds = importable.map(() => randomUUID());
    const goods = importable.map((v, i) => {
      const p = v.parsed!;
      const f = p.financials;
      return {
        id: goodIds[i],
        itemName: p.itemName,
        trackingNumber: p.trackingNumber,
        quantity: p.quantity,
        quantitySold: p.quantitySold,
        unitCost: p.unitCost,
        exchangeRate: p.exchangeRate,
        priceMultiplier: ctx.multiplier,
        suggestedPrice: f.suggestedPrice,
        sellingPrice: f.sellingPrice,
        priceOverridden: f.priceOverridden,
        overrideReason: p.overrideReason,
        overriddenById: f.priceOverridden ? actor.id : null,
        overriddenAt: f.priceOverridden ? now : null,
        retailPrice: p.retailPrice,
        totalCost: f.totalCost,
        expectedRevenue: f.expectedRevenue,
        profit: f.profit,
        margin: f.margin,
        status: p.status,
        chinaCheckedIn: p.chinaCheckedIn,
        chinaCheckedInAt: p.chinaCheckedIn ? now : null,
        chinaCheckedInById: p.chinaCheckedIn ? actor.id : null,
        orderedAt: dateOnly(p.orderedAt),
        notes: p.notes,
        clientId: p.clientId,
        supplierId: p.supplierId,
        categoryId: p.categoryId,
        createdById: actor.id,
      };
    });

    await this.prisma.$transaction(
      async (tx) => {
        await tx.good.createMany({ data: goods });
        await tx.goodFinancialSnapshot.createMany({
          data: goods.map((g) => ({
            goodId: g.id,
            quantity: g.quantity,
            unitCost: g.unitCost,
            exchangeRate: g.exchangeRate,
            priceMultiplier: g.priceMultiplier,
            suggestedPrice: g.suggestedPrice,
            sellingPrice: g.sellingPrice,
            priceOverridden: g.priceOverridden,
            overrideReason: g.overrideReason,
            createdById: actor.id,
          })),
        });
        await tx.goodsStatusHistory.createMany({
          data: importable.map((v, i) => ({ goodId: goodIds[i], toStatus: v.parsed!.status, changedById: actor.id, note: `Imported from ${batch.fileName}, row ${v.rowNumber}` })),
        });
        await tx.auditLog.createMany({
          data: importable.map((v, i) => ({
            entity: 'Good',
            entityId: goodIds[i],
            action: AuditAction.CREATE,
            actorId: actor.id,
            after: { source: 'import', importBatchId: id, rowNumber: v.rowNumber },
            note: `Imported from ${batch.fileName}, row ${v.rowNumber}`,
            requestId: requestId ?? null,
          })),
        });

        // Mark committed rows with their new good, in one statement.
        const rowNumbers = importable.map((v) => v.rowNumber);
        await tx.$executeRaw`
          UPDATE import_rows AS r
          SET state = 'COMMITTED'::"ImportRowState", good_id = v.good_id
          FROM unnest(${rowNumbers}::int[], ${goodIds}::uuid[]) AS v(row_number, good_id)
          WHERE r.batch_id = ${id}::uuid AND r.row_number = v.row_number`;

        for (const f of failed) {
          await tx.importRow.update({
            where: { batchId_rowNumber: { batchId: id, rowNumber: f.rowNumber } },
            data: { state: ImportRowState.INVALID, messages: f.messages as unknown as Prisma.InputJsonValue, parsed: Prisma.DbNull },
          });
        }
        const skipped = await tx.importRow.updateMany({
          where: { batchId: id, state: { in: [ImportRowState.VALID, ImportRowState.WARNING] } },
          data: { state: ImportRowState.SKIPPED },
        });
        const invalid = await tx.importRow.count({ where: { batchId: id, state: ImportRowState.INVALID } });

        await tx.importBatch.update({
          where: { id },
          data: { status: ImportBatchStatus.COMMITTED, committedRows: importable.length, skippedRows: skipped.count, invalidRows: invalid, committedAt: now },
        });
        await this.audit.record(
          {
            entity: 'ImportBatch',
            entityId: id,
            action: AuditAction.IMPORT,
            actorId: actor.id,
            after: { fileName: batch.fileName, created: importable.length, skipped: skipped.count, failedOnCommit: failed.length },
            requestId,
          },
          tx,
        );
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    return { data: await this.get(id), failedOnCommit: failed.map((f) => ({ rowNumber: f.rowNumber, messages: f.messages })) };
  }

  /**
   * Undo for a mistaken import: archives every good the import created that is still active.
   * Archived goods leave lists and totals but keep their history, and can be restored one by one.
   */
  async archiveImportedGoods(id: string, reason: string, actor: AuthUser, requestId?: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw AppException.notFound('Import');
    if (batch.status !== ImportBatchStatus.COMMITTED) throw new AppException(ErrorCode.CONFLICT, 'Only a completed import has goods to archive.');

    const rows = await this.prisma.importRow.findMany({ where: { batchId: id, goodId: { not: null } }, select: { goodId: true } });
    const ids = rows.map((r) => r.goodId!);
    const active = await this.prisma.good.findMany({ where: { id: { in: ids }, archivedAt: null }, select: { id: true } });
    if (!active.length) throw new AppException(ErrorCode.CONFLICT, 'All goods from this import are already archived.');

    const now = new Date();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.good.updateMany({ where: { id: { in: active.map((g) => g.id) } }, data: { archivedAt: now, updatedById: actor.id } });
        await tx.auditLog.createMany({
          data: active.map((g) => ({ entity: 'Good', entityId: g.id, action: AuditAction.ARCHIVE, actorId: actor.id, note: `Import ${batch.fileName} rolled back: ${reason}`, requestId: requestId ?? null })),
        });
        await this.audit.record({ entity: 'ImportBatch', entityId: id, action: AuditAction.ARCHIVE, actorId: actor.id, after: { archivedGoods: active.length }, note: reason, requestId }, tx);
      },
      { timeout: 60_000 },
    );
    return { archived: active.length };
  }

  async cancel(id: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw AppException.notFound('Import');
    if (batch.status !== ImportBatchStatus.READY) throw new AppException(ErrorCode.CONFLICT, 'Only an import that is waiting for review can be cancelled.');
    await this.prisma.importBatch.update({ where: { id }, data: { status: ImportBatchStatus.CANCELLED } });
    return this.get(id);
  }

  async errorReport(id: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw AppException.notFound('Import');
    const rows = await this.prisma.importRow.findMany({ where: { batchId: id, state: ImportRowState.INVALID }, orderBy: { rowNumber: 'asc' } });
    if (!rows.length) throw new AppException(ErrorCode.NOT_FOUND, 'This import has no rows that need fixing.');
    const buffer = await buildErrorReport(
      batch.fileName,
      rows.map((r) => ({ rowNumber: r.rowNumber, raw: r.raw as ParsedRow['cells'], messages: (r.messages ?? []) as unknown as RowMessage[] })),
    );
    const base = batch.fileName.replace(/\.(xlsx|csv)$/i, '');
    return { buffer, fileName: `${base} - rows to fix.xlsx` };
  }
}
