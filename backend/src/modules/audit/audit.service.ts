import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { AuditAction } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, type Db } from '../../prisma/prisma.service';

export interface AuditEntry {
  entity: string;
  entityId: string;
  action: AuditAction;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string | null;
  requestId?: string;
}

/** Converts Decimals, Dates and BigInts into plain JSON so audit rows are readable and stable. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Decimal || (v && typeof v === 'object' && typeof v.toFixed === 'function' && typeof v.d !== 'undefined')) return v.toString();
      return v;
    }),
  ) as Prisma.InputJsonValue;
}

/** Keeps only the keys whose values changed, so update entries stay small. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const norm = (v: unknown) => JSON.stringify(toAuditJson(v));
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === 'updatedAt') continue;
    if (norm(before[key]) !== norm(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one audit row. Pass the transaction client so the audit entry
   * commits or rolls back together with the change it describes.
   */
  async record(entry: AuditEntry, db: Db = this.prisma) {
    return db.auditLog.create({
      data: {
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        actorId: entry.actorId ?? null,
        before: toAuditJson(entry.before),
        after: toAuditJson(entry.after),
        note: entry.note ?? null,
        requestId: entry.requestId ?? null,
      },
    });
  }

  history(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}
