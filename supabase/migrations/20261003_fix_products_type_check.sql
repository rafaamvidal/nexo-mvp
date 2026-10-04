-- ==============================================================================
-- MIGRAÇÃO: ATUALIZAÇÃO DA RESTRIÇÃO products_type_check
-- Permite cadastrar todas as novas classificações de produtos no AGILIX:
-- 'Produto Final', 'Matéria-Prima', 'Embalagem', 'Rótulo / Etiqueta',
-- 'Insumo de Produção', 'Utensílio / Ferramenta', 'Limpeza e Higiene',
-- 'Material de Apoio', 'Outro'
-- ==============================================================================

BEGIN;

-- 1. Remove a restrição legada que aceitava apenas 'Matéria-Prima' e 'Produto Final'
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_check;

-- 2. Adiciona a nova restrição expandida (ou permite qualquer texto)
ALTER TABLE public.products ADD CONSTRAINT products_type_check 
  CHECK (type IN (
    'Produto Final',
    'Matéria-Prima',
    'Embalagem',
    'Rótulo / Etiqueta',
    'Insumo de Produção',
    'Utensílio / Ferramenta',
    'Limpeza e Higiene',
    'Material de Apoio',
    'Outro'
  ));

COMMIT;
