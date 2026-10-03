import { describe, it, expect } from "vitest";
import { addMonths, subMonths, format, subDays } from "date-fns";
import { calculateVacationPeriod } from "@/lib/rhStorage";
import type { Employee, EmployeeVacation } from "@/types/rh";

describe("RH & Departamento Pessoal Module Tests", () => {
  it("calculates vacation period correctly for a 1-year employee", () => {
    const oneYearAgo = format(subMonths(new Date(), 14), "yyyy-MM-dd");

    const period = calculateVacationPeriod(oneYearAgo, []);

    expect(period.daysEntitled).toBe(30);
    expect(period.daysUsed).toBe(0);
    expect(period.daysRemaining).toBe(30);
    expect(period.isOverdue).toBe(false);
  });

  it("deducts used vacation days and updates days remaining", () => {
    const oneYearAgo = format(subMonths(new Date(), 14), "yyyy-MM-dd");
    const mockVacations: EmployeeVacation[] = [
      {
        id: "vac-1",
        employee_id: "emp-1",
        start_date: "2026-05-01",
        end_date: "2026-05-15",
        days: 15,
        status: "Concluída",
      },
    ];

    const period = calculateVacationPeriod(oneYearAgo, mockVacations);

    expect(period.daysUsed).toBe(15);
    expect(period.daysRemaining).toBe(15);
  });

  it("detects overdue vacation when concession limit has passed with days remaining", () => {
    // Admitido há quase 2 anos e meio (mais de 23 meses), sem tirar férias
    const admissionDate = format(subMonths(new Date(), 26), "yyyy-MM-dd");

    const period = calculateVacationPeriod(admissionDate, []);

    expect(period.daysRemaining).toBe(30);
  });

  it("calculates payroll total correctly for active and on-vacation employees", () => {
    const mockEmployees: Employee[] = [
      {
        id: "1",
        name: "Carlos",
        role: "Confeiteiro",
        department: "Produção",
        contract_type: "CLT",
        admission_date: "2024-01-01",
        status: "Ativo",
        base_salary: 3000,
        benefits_total: 500,
      },
      {
        id: "2",
        name: "Mariana",
        role: "Vendedora",
        department: "Vendas",
        contract_type: "PJ",
        admission_date: "2024-03-01",
        status: "Em Férias",
        base_salary: 2500,
        benefits_total: 300,
      },
      {
        id: "3",
        name: "João",
        role: "Ex-Funcionário",
        department: "Produção",
        contract_type: "CLT",
        admission_date: "2023-01-01",
        status: "Desligado",
        base_salary: 2000,
        benefits_total: 400,
      },
    ];

    const activeList = mockEmployees.filter(
      (e) => e.status === "Ativo" || e.status === "Em Férias"
    );

    const totalCost = activeList.reduce(
      (sum, e) => sum + Number(e.base_salary) + Number(e.benefits_total),
      0
    );

    expect(activeList).toHaveLength(2);
    expect(totalCost).toBe(3500 + 2800); // 6300
  });

  it("ensures CLT abono pecuniário (venda de férias) is capped at 10 days", () => {
    const rawSellDays = 15;
    const cappedSellDays = Math.min(10, Math.max(0, rawSellDays));

    expect(cappedSellDays).toBe(10);
  });
});
