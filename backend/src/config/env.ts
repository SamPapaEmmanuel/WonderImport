import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be the project URL, e.g. https://abc.supabase.co'),
  SUPABASE_JWT_SECRET: z.string().optional().transform((v) => (v ? v : undefined)),
  /** Server-side only. Enables sending Supabase invitation emails from Settings > People. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().transform((v) => (v ? v : undefined)),
  /** Number of proxies in front of the API (e.g. 1 behind a load balancer), so rate limits see real client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validates process.env once and fails fast with a readable list of problems. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee backend/.env.example.`);
  }
  cached = parsed.data;
  if (cached.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (/localhost|127\.0\.0\.1/.test(cached.WEB_ORIGIN)) problems.push('WEB_ORIGIN still points at localhost');
    if (!cached.SUPABASE_URL.startsWith('https://')) problems.push('SUPABASE_URL must use https');
    if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return cached;
}

export function allowedOrigins(): string[] {
  return env()
    .WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
