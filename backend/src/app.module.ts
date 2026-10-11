import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env';
import { RequestContextMiddleware } from './common/logging/request-context.middleware';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportsModule } from './modules/exports/exports.module';
import { GoodsModule } from './modules/goods/goods.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Per-IP request budget. Heavier endpoints (uploads, exports) set tighter limits with @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: env().RATE_LIMIT_PER_MINUTE }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    SettingsModule,
    LookupsModule,
    ClientsModule,
    SuppliersModule,
    CategoriesModule,
    GoodsModule,
    DashboardModule,
    ImportsModule,
    ExportsModule,
    UsersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
