import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load test settings before any application module reads the environment.
config({ path: resolve(__dirname, '../.env.test'), override: true });

if (process.env.E2E_WIPE_DATABASE !== 'yes') {
  throw new Error('End-to-end tests wipe their database. Create backend/.env.test from .env.test.example and set E2E_WIPE_DATABASE=yes for a disposable database.');
}
