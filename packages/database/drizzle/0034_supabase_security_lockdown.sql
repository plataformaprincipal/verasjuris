-- Bloqueia o acesso direto ao schema public pela API REST do Supabase (PostgREST).
-- A aplicação acessa o banco pela API própria, conectada como dono das tabelas,
-- que ignora o RLS. Os papéis anon e authenticated não devem tocar nenhuma tabela.
-- Idempotente e seguro fora do Supabase: os papéis só são tratados se existirem.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
  END IF;
END $$;--> statement-breakpoint
ALTER FUNCTION public.verasjuris_forbid_audit_mutation() SET search_path = public, pg_temp;
