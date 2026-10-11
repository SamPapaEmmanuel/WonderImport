import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SupabaseAdmin } from './supabase-admin';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [AuditModule], controllers: [UsersController], providers: [UsersService, SupabaseAdmin] })
export class UsersModule {}
