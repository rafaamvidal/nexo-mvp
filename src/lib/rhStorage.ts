import { supabase } from "@/integrations/supabase/client";
import type { Employee, EmployeeVacation, EmployeeOccurrence, VacationPeriodInfo } from "@/types/rh";
import { addMonths, differenceInDays, format, isAfter, isBefore, parseISO, subDays } from "date-fns";

const EMPLOYEES_STORAGE_KEY = (orgId: string) => `agilix_employees_${orgId}`;
const VACATIONS_STORAGE_KEY = (orgId: string) => `agilix_vacations_${orgId}`;
const OCCURRENCES_STORAGE_KEY = (orgId: string) => `agilix_occurrences_${orgId}`;

// ==============================================================================
// 1. GESTÃO DE COLABORADORES (EMPLOYEES)
// ==============================================================================

export async function fetchEmployees(orgId?: string): Promise<Employee[]> {
  if (!orgId) return [];

  try {
    const { data, error } = await (supabase.from("employees") as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (!error && data) {
      // Salva cópia em cache local
      localStorage.setItem(EMPLOYEES_STORAGE_KEY(orgId), JSON.stringify(data));
      return data as Employee[];
    }
  } catch (err) {
    // Segue para fallback
  }

  // Fallback para localStorage
  const local = localStorage.getItem(EMPLOYEES_STORAGE_KEY(orgId));
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore
    }
  }

  return [];
}

export async function upsertEmployee(employee: Partial<Employee>, orgId: string): Promise<Employee> {
  const isUpdate = Boolean(employee.id);
  const now = new Date().toISOString();

  const payload: any = {
    ...employee,
    organization_id: orgId,
    base_salary: Number(employee.base_salary || 0),
    benefits_total: Number(employee.benefits_total || 0),
  };

  if (!isUpdate) {
    payload.id = crypto.randomUUID();
    payload.created_at = now;
  }

  // 1. Tenta salvar no Supabase
  try {
    const query = isUpdate
      ? (supabase.from("employees") as any).update(payload).eq("id", employee.id!)
      : (supabase.from("employees") as any).insert(payload);

    const { data, error } = await query.select().single();
    if (!error && data) {
      await updateLocalEmployee(data, orgId);
      return data;
    }
  } catch (err) {
    // Segue para fallback
  }

  // 2. Fallback no localStorage
  await updateLocalEmployee(payload, orgId);
  return payload as Employee;
}

async function updateLocalEmployee(emp: Employee, orgId: string) {
  const list = await fetchEmployees(orgId);
  const index = list.findIndex((e) => e.id === emp.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...emp };
  } else {
    list.unshift(emp);
  }
  localStorage.setItem(EMPLOYEES_STORAGE_KEY(orgId), JSON.stringify(list));
}

export async function deleteEmployee(id: string, orgId: string): Promise<void> {
  try {
    await (supabase.from("employees") as any).delete().eq("id", id);
  } catch {
    // Ignore
  }

  const list = (await fetchEmployees(orgId)).filter((e) => e.id !== id);
  localStorage.setItem(EMPLOYEES_STORAGE_KEY(orgId), JSON.stringify(list));
}

// ==============================================================================
// 2. CONTROLE DE FÉRIAS (VACATIONS)
// ==============================================================================

export async function fetchVacations(orgId?: string): Promise<EmployeeVacation[]> {
  if (!orgId) return [];

  try {
    const { data, error } = await (supabase.from("employee_vacations") as any)
      .select("*, employees(name, role, department)")
      .eq("organization_id", orgId)
      .order("start_date", { ascending: false });

    if (!error && data) {
      const enriched: EmployeeVacation[] = data.map((v: any) => ({
        ...v,
        employee_name: v.employees?.name,
        employee_role: v.employees?.role,
        employee_department: v.employees?.department,
      }));
      localStorage.setItem(VACATIONS_STORAGE_KEY(orgId), JSON.stringify(enriched));
      return enriched;
    }
  } catch {
    // Fallback
  }

  const local = localStorage.getItem(VACATIONS_STORAGE_KEY(orgId));
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore
    }
  }

  return [];
}

export async function upsertVacation(vacation: Partial<EmployeeVacation>, orgId: string): Promise<EmployeeVacation> {
  const isUpdate = Boolean(vacation.id);
  const payload: any = {
    ...vacation,
    organization_id: orgId,
    days: Number(vacation.days || 30),
    sell_days: Number(vacation.sell_days || 0),
    advance_13th: Boolean(vacation.advance_13th),
  };

  if (!isUpdate) {
    payload.id = crypto.randomUUID();
    payload.created_at = new Date().toISOString();
  }

  // Remove campos virtuais de join antes do insert/update
  delete payload.employee_name;
  delete payload.employee_role;
  delete payload.employee_department;

  try {
    const query = isUpdate
      ? (supabase.from("employee_vacations") as any).update(payload).eq("id", vacation.id!)
      : (supabase.from("employee_vacations") as any).insert(payload);

    const { data, error } = await query.select().single();
    if (!error && data) {
      await updateLocalVacation(data, orgId);
      return data;
    }
  } catch {
    // Fallback
  }

  await updateLocalVacation(payload, orgId);
  return payload as EmployeeVacation;
}

async function updateLocalVacation(vac: EmployeeVacation, orgId: string) {
  const list = await fetchVacations(orgId);
  const index = list.findIndex((v) => v.id === vac.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...vac };
  } else {
    list.unshift(vac);
  }
  localStorage.setItem(VACATIONS_STORAGE_KEY(orgId), JSON.stringify(list));
}

export async function deleteVacation(id: string, orgId: string): Promise<void> {
  try {
    await (supabase.from("employee_vacations") as any).delete().eq("id", id);
  } catch {
    // Ignore
  }

  const list = (await fetchVacations(orgId)).filter((v) => v.id !== id);
  localStorage.setItem(VACATIONS_STORAGE_KEY(orgId), JSON.stringify(list));
}

/**
 * Calcula os períodos aquisitivo e concessivo de férias segundo a CLT:
 * - A cada 12 meses de admissão = adquire 30 dias de férias.
 * - Período concessivo = até 11 meses após o término do período aquisitivo (para não dobrar).
 */
export function calculateVacationPeriod(admissionDateStr: string, existingVacations: EmployeeVacation[] = []): VacationPeriodInfo {
  const admission = parseISO(admissionDateStr);
  const now = new Date();

  // Quantidade de anos completos trabalhados
  let yearsWorked = Math.floor(differenceInDays(now, admission) / 365);
  if (yearsWorked < 0) yearsWorked = 0;

  // Ciclo atual
  const cycleStart = addMonths(admission, yearsWorked * 12);
  const cycleEnd = subDays(addMonths(cycleStart, 12), 1);
  const concessionLimit = subDays(addMonths(cycleEnd, 12), 30); // Limite legal para gozo antes de dobrar

  // Dias utilizados neste ciclo
  const usedDays = existingVacations
    .filter((v) => v.status !== "Cancelada")
    .reduce((sum, v) => sum + Number(v.days || 0), 0);

  const daysEntitled = 30;
  const daysRemaining = Math.max(0, daysEntitled - usedDays);

  const isOverdue = isAfter(now, concessionLimit) && daysRemaining > 0;
  const isNearOverdue = !isOverdue && differenceInDays(concessionLimit, now) <= 60 && daysRemaining > 0;

  return {
    acquisitionStart: format(cycleStart, "yyyy-MM-dd"),
    acquisitionEnd: format(cycleEnd, "yyyy-MM-dd"),
    concessionLimit: format(concessionLimit, "yyyy-MM-dd"),
    daysEntitled,
    daysUsed: usedDays,
    daysRemaining,
    isOverdue,
    isNearOverdue,
  };
}

// ==============================================================================
// 3. OCORRÊNCIAS / PONTO (OCCURRENCES)
// ==============================================================================

export async function fetchOccurrences(orgId?: string): Promise<EmployeeOccurrence[]> {
  if (!orgId) return [];

  try {
    const { data, error } = await (supabase.from("employee_occurrences") as any)
      .select("*, employees(name)")
      .eq("organization_id", orgId)
      .order("date", { ascending: false });

    if (!error && data) {
      const enriched: EmployeeOccurrence[] = data.map((o: any) => ({
        ...o,
        employee_name: o.employees?.name,
      }));
      localStorage.setItem(OCCURRENCES_STORAGE_KEY(orgId), JSON.stringify(enriched));
      return enriched;
    }
  } catch {
    // Fallback
  }

  const local = localStorage.getItem(OCCURRENCES_STORAGE_KEY(orgId));
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore
    }
  }

  return [];
}

export async function upsertOccurrence(occurrence: Partial<EmployeeOccurrence>, orgId: string): Promise<EmployeeOccurrence> {
  const isUpdate = Boolean(occurrence.id);
  const payload: any = {
    ...occurrence,
    organization_id: orgId,
  };

  if (!isUpdate) {
    payload.id = crypto.randomUUID();
    payload.created_at = new Date().toISOString();
  }

  delete payload.employee_name;

  try {
    const query = isUpdate
      ? (supabase.from("employee_occurrences") as any).update(payload).eq("id", occurrence.id!)
      : (supabase.from("employee_occurrences") as any).insert(payload);

    const { data, error } = await query.select().single();
    if (!error && data) {
      await updateLocalOccurrence(data, orgId);
      return data;
    }
  } catch {
    // Fallback
  }

  await updateLocalOccurrence(payload, orgId);
  return payload as EmployeeOccurrence;
}

async function updateLocalOccurrence(occ: EmployeeOccurrence, orgId: string) {
  const list = await fetchOccurrences(orgId);
  const index = list.findIndex((o) => o.id === occ.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...occ };
  } else {
    list.unshift(occ);
  }
  localStorage.setItem(OCCURRENCES_STORAGE_KEY(orgId), JSON.stringify(list));
}

export async function deleteOccurrence(id: string, orgId: string): Promise<void> {
  try {
    await (supabase.from("employee_occurrences") as any).delete().eq("id", id);
  } catch {
    // Ignore
  }

  const list = (await fetchOccurrences(orgId)).filter((o) => o.id !== id);
  localStorage.setItem(OCCURRENCES_STORAGE_KEY(orgId), JSON.stringify(list));
}

// ==============================================================================
// 4. INTEGRAÇÃO DA FOLHA DE PAGAMENTO COM O FINANCEIRO
// ==============================================================================

/**
 * Lança a folha de pagamento do mês corrente como contas a pagar na tabela financial_records.
 * Suporta lançamento específico de Vale (40% dia 20), Saldo (60% dia 05) ou ambos.
 */
export async function launchPayrollToFinancial(
  employees: Employee[],
  referenceMonth: string, // YYYY-MM
  orgId: string,
  launchType: "vale_40" | "saldo_60" | "all" = "all"
): Promise<{ count: number; total: number; type: string }> {
  const activeEmployees = employees.filter(
    (e) => (e.status === "Ativo" || e.status === "Em Férias") && Number(e.base_salary) > 0
  );

  if (activeEmployees.length === 0) {
    throw new Error("Nenhum colaborador ativo com salário cadastrado para gerar a folha.");
  }

  const [yearStr, monthStr] = referenceMonth.split("-");
  const nextMonth = Number(monthStr) === 12 ? 1 : Number(monthStr) + 1;
  const nextYear = Number(monthStr) === 12 ? Number(yearStr) + 1 : Number(yearStr);

  const dueVale20 = `${yearStr}-${monthStr.padStart(2, "0")}-20`;
  const dueSaldo05 = `${nextYear}-${String(nextMonth).padStart(2, "0")}-05`;

  let totalLaunched = 0;
  let count = 0;

  for (const emp of activeEmployees) {
    const salary = Number(emp.base_salary || 0);
    const benefits = Number(emp.benefits_total || 0);

    const valeAmount = Math.round(salary * 0.40 * 100) / 100;
    const saldoAmount = Math.round(salary * 0.60 * 100) / 100 + benefits;

    const payloads: any[] = [];

    if (launchType === "vale_40" || launchType === "all") {
      payloads.push({
        type: "Pagar",
        description: `Adiantamento Salarial (Vale 40%) - ${emp.name} (${emp.role}) - ${referenceMonth}`,
        category: "Salários / RH (Vale 40%)",
        entity_name: emp.name,
        amount: valeAmount,
        due_date: dueVale20,
        status: "Aberto",
        organization_id: orgId,
      });
    }

    if (launchType === "saldo_60" || launchType === "all") {
      payloads.push({
        type: "Pagar",
        description: `Saldo de Salário (60%) - ${emp.name} (${emp.role}) - ${referenceMonth}`,
        category: "Salários / RH (Saldo 60%)",
        entity_name: emp.name,
        amount: saldoAmount,
        due_date: dueSaldo05,
        status: "Aberto",
        organization_id: orgId,
      });
    }

    for (const p of payloads) {
      try {
        const { error } = await supabase.from("financial_records").insert(p);
        if (error) {
          console.warn("Aviso ao inserir no financeiro:", error);
        }
      } catch (err) {
        console.warn("Erro ao comunicar com financial_records:", err);
      }
      totalLaunched += p.amount;
      count += 1;
    }
  }

  return { count, total: totalLaunched, type: launchType };
}

// ==============================================================================
// 5. CARGA INICIAL DE EXEMPLOS (SEED INDUSTRIAL)
// ==============================================================================

export async function seedSampleEmployees(orgId: string): Promise<Employee[]> {
  const samples: Array<Partial<Employee>> = [
    {
      name: "Carlos Eduardo Santos",
      role: "Mestre Confeiteiro",
      department: "Produção",
      contract_type: "CLT",
      admission_date: "2024-02-15",
      status: "Ativo",
      base_salary: 3200.0,
      benefits_total: 650.0,
      phone: "(11) 98765-4321",
      email: "carlos.santos@empresa.com",
      pix_key: "11987654321",
      city: "São Paulo",
      state: "SP",
    },
    {
      name: "Juliana Mendes da Silva",
      role: "Operadora de Embalagem & Selagem",
      department: "Produção",
      contract_type: "CLT",
      admission_date: "2024-06-01",
      status: "Ativo",
      base_salary: 2100.0,
      benefits_total: 550.0,
      phone: "(11) 97654-3210",
      email: "juliana.mendes@empresa.com",
      city: "São Paulo",
      state: "SP",
    },
    {
      name: "Rodrigo Almeida Prado",
      role: "Representante Comercial Externo",
      department: "Vendas",
      contract_type: "PJ",
      admission_date: "2024-04-10",
      status: "Ativo",
      base_salary: 3800.0,
      benefits_total: 400.0,
      phone: "(11) 96543-2109",
      email: "rodrigo.vendas@empresa.com",
      pix_key: "rodrigo.vendas@empresa.com",
      city: "São Paulo",
      state: "SP",
    },
    {
      name: "Fernanda Cristina Costa",
      role: "Supervisora Financeira & Administrativa",
      department: "Administrativo",
      contract_type: "CLT",
      admission_date: "2023-10-01",
      status: "Ativo",
      base_salary: 4200.0,
      benefits_total: 750.0,
      phone: "(11) 95432-1098",
      email: "fernanda.adm@empresa.com",
      pix_key: "123.456.789-00",
      city: "São Paulo",
      state: "SP",
    },
  ];

  const created: Employee[] = [];
  for (const s of samples) {
    const res = await upsertEmployee(s, orgId);
    created.push(res);
  }

  // Cria um agendamento de férias para demonstrar
  if (created[0]) {
    await upsertVacation(
      {
        employee_id: created[0].id,
        start_date: "2026-11-10",
        end_date: "2026-11-29",
        days: 20,
        sell_days: 10,
        advance_13th: true,
        status: "Agendada",
        notes: "Férias com abono pecuniário de 10 dias e adiantamento do 13º.",
      },
      orgId
    );
  }

  return created;
}
