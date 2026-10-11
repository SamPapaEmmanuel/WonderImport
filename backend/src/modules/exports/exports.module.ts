import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClientsModule } from '../clients/clients.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({ imports: [AuditModule, ClientsModule], controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
