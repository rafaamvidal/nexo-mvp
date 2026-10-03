export type ContractType = "CLT" | "PJ" | "Estágio" | "Temporário";

export type EmployeeStatus = "Ativo" | "Em Férias" | "Afastado" | "Desligado";

export type VacationStatus = "Agendada" | "Em Gozo" | "Concluída" | "Cancelada";

export type OccurrenceType = "Falta" | "Atestado" | "Hora Extra" | "Advertência" | "Elogio" | "Outro";

export interface Employee {
  id: string;
  organization_id?: string;
  name: string;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  role: string; // Cargo (ex: Confeiteiro, Vendedor, Gerente)
  department: string; // Setor (ex: Produção, Vendas, Administrativo)
  contract_type: ContractType;
  admission_date: string; // YYYY-MM-DD
  resignation_date?: string | null;
  status: EmployeeStatus;
  base_salary: number;
  benefits_total: number;
  pix_key?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface EmployeeVacation {
  id: string;
  organization_id?: string;
  employee_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  days: number;
  sell_days?: number; // Abono pecuniário (dias vendidos, máx 10)
  advance_13th?: boolean; // Adiantamento 13º salário
  status: VacationStatus;
  notes?: string | null;
  created_at?: string;
  // Campos enriquecidos em tela
  employee_name?: string;
  employee_role?: string;
  employee_department?: string;
}

export interface EmployeeOccurrence {
  id: string;
  organization_id?: string;
  employee_id: string;
  type: OccurrenceType;
  date: string; // YYYY-MM-DD
  description: string;
  hours_or_days?: number | null;
  created_at?: string;
  // Campos enriquecidos em tela
  employee_name?: string;
}

export interface VacationPeriodInfo {
  acquisitionStart: string; // Início do período aquisitivo
  acquisitionEnd: string; // Fim do período aquisitivo (12 meses)
  concessionLimit: string; // Limite legal para gozo (11 meses após aquisitivo)
  daysEntitled: number; // Dias de direito (geralmente 30)
  daysUsed: number;
  daysRemaining: number;
  isOverdue: boolean; // Férias vencidas (passou do limite concessivo)
  isNearOverdue: boolean; // Menos de 60 dias para vencer
}
