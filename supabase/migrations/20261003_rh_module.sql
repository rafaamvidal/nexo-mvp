-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA: MÓDULO DE RECURSOS HUMANOS (RH) & DEPARTAMENTO PESSOAL
-- Tabelas: employees, employee_vacations, employee_occurrences
-- ==============================================================================

-- 1. TABELA DE COLABORADORES (EMPLOYEES)
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  rg text,
  birth_date date,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  role text NOT NULL,
  department text NOT NULL,
  contract_type text NOT NULL DEFAULT 'CLT',
  admission_date date NOT NULL DEFAULT CURRENT_DATE,
  resignation_date date,
  status text NOT NULL DEFAULT 'Ativo',
  base_salary numeric NOT NULL DEFAULT 0,
  benefits_total numeric NOT NULL DEFAULT 0,
  pix_key text,
  bank_name text,
  bank_agency text,
  bank_account text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees(department);

-- 2. TABELA DE CONTROLE DE FÉRIAS (EMPLOYEE_VACATIONS)
CREATE TABLE IF NOT EXISTS public.employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL DEFAULT 30,
  sell_days integer NOT NULL DEFAULT 0,
  advance_13th boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Agendada',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_org ON public.employee_vacations(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_vacations_emp ON public.employee_vacations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_vacations_dates ON public.employee_vacations(start_date, end_date);

-- 3. TABELA DE OCORRÊNCIAS / PONTO (EMPLOYEE_OCCURRENCES)
CREATE TABLE IF NOT EXISTS public.employee_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  "type" text NOT NULL,
  "date" date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  hours_or_days numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_occurrences_org ON public.employee_occurrences(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_occurrences_emp ON public.employee_occurrences(employee_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_org_isolation ON public.employees;
CREATE POLICY employees_org_isolation ON public.employees
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS employee_vacations_org_isolation ON public.employee_vacations;
CREATE POLICY employee_vacations_org_isolation ON public.employee_vacations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS employee_occurrences_org_isolation ON public.employee_occurrences;
CREATE POLICY employee_occurrences_org_isolation ON public.employee_occurrences
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- 5. TRIGGERS DE DEFAULT ORGANIZATION_ID
DROP TRIGGER IF EXISTS trg_set_org_employees ON public.employees;
CREATE TRIGGER trg_set_org_employees
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_employee_vacations ON public.employee_vacations;
CREATE TRIGGER trg_set_org_employee_vacations
  BEFORE INSERT ON public.employee_vacations
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_employee_occurrences ON public.employee_occurrences;
CREATE TRIGGER trg_set_org_employee_occurrences
  BEFORE INSERT ON public.employee_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organization_id();
