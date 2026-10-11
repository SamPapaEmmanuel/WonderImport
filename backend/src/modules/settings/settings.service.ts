import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditAction } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DEFAULT_PRICING, PRICING_KEY, type PricingSettings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPricing(): Promise<PricingSettings & { updatedAt: string | null; updatedBy: string | null }> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: PRICING_KEY },
      include: { updatedBy: { select: { name: true } } },
    });
    const value = { ...DEFAULT_PRICING, ...((row?.value as Partial<PricingSettings> | null) ?? {}) };
    return { ...value, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row?.updatedBy?.name ?? null };
  }

  /** Changing the default only affects goods created afterwards; existing goods keep their stored rate. */
  async updateExchangeRate(rate: string, actor: AuthUser, requestId?: string) {
    const before = await this.getPricing();
    const normalised = new Decimal(rate).toString();
    const value: PricingSettings = {
      defaultExchangeRate: normalised,
      priceMultiplier: before.priceMultiplier,
      baseCurrency: before.baseCurrency,
      sourceCurrency: before.sourceCurrency,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: PRICING_KEY },
        create: { key: PRICING_KEY, value: { ...value }, updatedById: actor.id },
        update: { value: { ...value }, updatedById: actor.id },
      });
      await this.audit.record(
        {
          entity: 'AppSetting',
          entityId: PRICING_KEY,
          action: AuditAction.UPDATE,
          actorId: actor.id,
          before: { defaultExchangeRate: before.defaultExchangeRate },
          after: { defaultExchangeRate: normalised },
          requestId,
        },
        tx,
      );
    });
    return this.getPricing();
  }
}
