
-- Tabela para manter o projeto ativo
CREATE TABLE public.keep_alive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sem RLS necessário (tabela interna de manutenção)
ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que insere um registro e limpa registros antigos
CREATE OR REPLACE FUNCTION public.keep_alive_ping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir novo registro
  INSERT INTO public.keep_alive (id) VALUES (gen_random_uuid());
  
  -- Limpar registros com mais de 2 minutos
  DELETE FROM public.keep_alive WHERE created_at < now() - interval '2 minutes';
END;
$$;

-- Agendar execução diária às 06:00 UTC
SELECT cron.schedule(
  'daily-keep-alive',
  '0 6 * * *',
  $$SELECT public.keep_alive_ping();$$
);
