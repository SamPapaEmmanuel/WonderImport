import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({ imports: [AuditModule, SettingsModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
