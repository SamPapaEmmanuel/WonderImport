import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/** Resets the disposable test database to the current schema once per run (no migration history needed). */
export default async function globalSetup() {
  const env = { ...process.env, ...config({ path: resolve(__dirname, '../.env.test') }).parsed };
  if (env.E2E_WIPE_DATABASE !== 'yes') throw new Error('Set E2E_WIPE_DATABASE=yes in backend/.env.test (disposable database only).');
  execSync('npx prisma db push --force-reset --accept-data-loss', { cwd: resolve(__dirname, '..'), env, stdio: 'inherit' });
}
