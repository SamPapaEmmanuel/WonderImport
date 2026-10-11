import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: connection URLs live here, not in schema.prisma.
// Migrations use the direct/session connection; the running API uses DATABASE_URL via the pg adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
