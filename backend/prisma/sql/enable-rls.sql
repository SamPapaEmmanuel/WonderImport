-- Supabase exposes the public schema through its Data API (PostgREST).
-- WonderImport reads and writes only through the NestJS API, so the browser key must not reach these tables.
-- Enabling RLS with no policies blocks the anon/authenticated roles; the table owner used by Prisma is unaffected.
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_status_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.good_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.good_allocations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations       ENABLE ROW LEVEL SECURITY;
