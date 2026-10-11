import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Options for form dropdowns and filters, in one request. Archived records are excluded. */
@Controller('lookups')
export class LookupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async all() {
    const active = { archivedAt: null };
    const [clients, suppliers, categories] = await Promise.all([
      this.prisma.client.findMany({ where: active, select: { id: true, code: true, name: true, isStock: true }, orderBy: [{ isStock: 'asc' }, { name: 'asc' }] }),
      this.prisma.supplier.findMany({ where: active, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ where: active, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { data: { clients, suppliers, categories } };
  }
}
