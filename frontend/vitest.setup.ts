import { vi } from 'vitest';

// Set environment variables for tests
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

// Mock HTTP client
vi.mock('@/common/http', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    apiUrl: 'http://localhost:4000/api',
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'test-key',
  },
}));
