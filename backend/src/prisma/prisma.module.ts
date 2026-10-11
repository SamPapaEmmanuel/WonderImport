import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaService };

export const prisma = globalForPrisma.prisma ?? new PrismaService();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}