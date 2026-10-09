import * as React from "react";
import { Loader2, Plus, User, Briefcase, DollarSign, Building } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cleanDigits, maskCep, maskCpfCnpj, maskPhone } from "@/lib/masks";
import { fetchAddressByCep } from "@/lib/viaCep";
import type { Employee, ContractType, EmployeeStatus } from "@/types/rh";

interface EmployeeDialogProps {
  trigger?: React.ReactNode;
  initial?: Partial<Employee>;
  onSave: (payload: Partial<Employee>) => Promise<void>;
  title?: string;
  isOpenControlled?: boolean;
  onOpenChangeControlled?: (open: boolean) => void;
}

export function EmployeeDialog({
  trigger,
  initial,
  onSave,
  title,
  isOpenControlled,
  onOpenChangeControlled,
}: EmployeeDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const setOpen = onOpenChangeControlled || setInternalOpen;

  const [activeTab, setActiveTab] = React.useState("pessoal");
  const [loadingCep, setLoadingCep] = React.useState(false);

  // Campos Pessoais
  const [name, setName] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [rg, setRg] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [cep, setCep] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");

  // Campos Contratuais
  const [role, setRole] = React.useState("");
  const [department, setDepartment] = React.useState("Produção");
  const [contractType, setContractType] = React.useState<ContractType>("CLT");
  const [admissionDate, setAdmissionDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [resignationDate, setResignationDate] = React.useState("");
  const [status, setStatus] = React.useState<EmployeeStatus>("Ativo");

  // Remuneração
  const [baseSalary, setBaseSalary] = React.useState<string>("0");
  const [benefitsTotal, setBenefitsTotal] = React.useState<string>("0");

  // Dados Bancários
  const [pixKey, setPixKey] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [bankAgency, setBankAgency] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setActiveTab("pessoal");
    setName(initial?.name ?? "");
    setCpf(maskCpfCnpj(initial?.cpf ?? ""));
    setRg(initial?.rg ?? "");
    setBirthDate(initial?.birth_date ?? "");
    setEmail(initial?.email ?? "");
    setPhone(maskPhone(initial?.phone ?? ""));
    setCep(maskCep(initial?.zip_code ?? ""));
    setAddress(initial?.address ?? "");
    setCity(initial?.city ?? "");
    setState(initial?.state ?? "");

    setRole(initial?.role ?? "");
    setDepartment(initial?.department ?? "Produção");
    setContractType((initial?.contract_type as ContractType) ?? "CLT");
    setAdmissionDate(initial?.admission_date ?? new Date().toISOString().slice(0, 10));
    setResignationDate(initial?.resignation_date ?? "");
    setStatus((initial?.status as EmployeeStatus) ?? "Ativo");

    setBaseSalary(String(initial?.base_salary ?? 0));
    setBenefitsTotal(String(initial?.benefits_total ?? 0));

    setPixKey(initial?.pix_key ?? "");
    setBankName(initial?.bank_name ?? "");
    setBankAgency(initial?.bank_agency ?? "");
    setBankAccount(initial?.bank_account ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const handleCepLookup = async (cepInput: string) => {
    const raw = cleanDigits(cepInput);
    if (raw.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetchAddressByCep(raw);
      if (res) {
        const fullAddr = [res.logradouro, res.bairro].filter(Boolean).join(", ");
        if (fullAddr) setAddress(fullAddr);
        if (res.localidade) setCity(res.localidade);
        if (res.uf) setState(res.uf.toUpperCase());
        toast.success("Endereço preenchido via CEP!");
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do colaborador");
      setActiveTab("pessoal");
      return;
    }
    if (!role.trim()) {
      toast.error("Informe o cargo/função do colaborador");
      setActiveTab("contrato");
      return;
    }
    if (!admissionDate) {
      toast.error("Informe a data de admissão");
      setActiveTab("contrato");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        id: initial?.id,
        name: name.trim(),
        cpf: cleanDigits(cpf) ? maskCpfCnpj(cpf) : null,
        rg: rg.trim() || null,
        birth_date: birthDate || null,
        email: email.trim() || null,
        phone: cleanDigits(phone) ? maskPhone(phone) : null,
        zip_code: cleanDigits(cep) ? maskCep(cep) : null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        role: role.trim(),
        department: department.trim(),
        contract_type: contractType,
        admission_date: admissionDate,
        resignation_date: resignationDate || null,
        status,
        base_salary: Number(baseSalary) || 0,
        benefits_total: Number(benefitsTotal) || 0,
        pix_key: pixKey.trim() || null,
        bank_name: bankName.trim() || null,
        bank_agency: bankAgency.trim() || null,
        bank_account: bankAccount.trim() || null,
        notes: notes.trim() || null,
      });

      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar colaborador");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="hero" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Colaborador
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate pr-6 text-left leading-snug">
            <User className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">{title || (initial?.id ? "Editar Colaborador" : "Cadastrar Colaborador")}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
              <TabsTrigger value="pessoal" className="gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />
                Pessoal
              </TabsTrigger>
              <TabsTrigger value="contrato" className="gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" />
                Contrato
              </TabsTrigger>
              <TabsTrigger value="remuneracao" className="gap-1.5 text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                Salário
              </TabsTrigger>
              <TabsTrigger value="banco" className="gap-1.5 text-xs">
                <Building className="h-3.5 w-3.5" />
                Bancário
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: DADOS PESSOAIS */}
            <TabsContent value="pessoal" className="space-y-3 pt-3">
              <div className="grid gap-2">
                <Label htmlFor="emp-name">Nome Completo *</Label>
                <Input
                  id="emp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Santos"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="emp-cpf">CPF</Label>
                  <Input
                    id="emp-cpf"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-rg">RG</Label>
                  <Input
                    id="emp-rg"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    placeholder="00.000.000-0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-birth">Nascimento</Label>
                  <Input
                    id="emp-birth"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="emp-phone">Telefone / WhatsApp</Label>
                  <Input
                    id="emp-phone"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-email">E-mail</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@email.com"
                  />
                </div>
              </div>

              <div className="border-t pt-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Endereço Residencial
                </span>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label className="flex items-center justify-between">
                      <span>CEP</span>
                      {loadingCep && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </Label>
                    <Input
                      value={cep}
                      onChange={(e) => {
                        const m = maskCep(e.target.value);
                        setCep(m);
                        if (cleanDigits(m).length === 8) handleCepLookup(m);
                      }}
                      onBlur={() => handleCepLookup(cep)}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Logradouro / Bairro / Nº</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua das Flores, 123"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="col-span-2 grid gap-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
                  </div>
                  <div className="grid gap-2">
                    <Label>UF</Label>
                    <Input
                      value={state}
                      maxLength={2}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ABA 2: DADOS CONTRATUAIS */}
            <TabsContent value="contrato" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="emp-role">Cargo / Função *</Label>
                  <Input
                    id="emp-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ex: Confeiteiro, Vendedor, Gerente"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Departamento / Setor</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Produção">Produção & Cozinha</SelectItem>
                      <SelectItem value="Vendas">Vendas & Comercial</SelectItem>
                      <SelectItem value="Administrativo">Administrativo & Financeiro</SelectItem>
                      <SelectItem value="Logística">Logística & Estoque</SelectItem>
                      <SelectItem value="Diretoria">Diretoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Regime de Contratação</Label>
                  <Select value={contractType} onValueChange={(v) => setContractType(v as ContractType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                      <SelectItem value="PJ">PJ (Prestador de Serviço)</SelectItem>
                      <SelectItem value="Estágio">Estágio</SelectItem>
                      <SelectItem value="Temporário">Temporário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Status Atual</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Em Férias">Em Férias</SelectItem>
                      <SelectItem value="Afastado">Afastado (Médico/Licença)</SelectItem>
                      <SelectItem value="Desligado">Desligado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="emp-adm">Data de Admissão *</Label>
                  <Input
                    id="emp-adm"
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-res">Data de Demissão / Desligamento</Label>
                  <Input
                    id="emp-res"
                    type="date"
                    value={resignationDate}
                    onChange={(e) => setResignationDate(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: REMUNERAÇÃO & BENEFÍCIOS */}
            <TabsContent value="remuneracao" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="emp-sal">Salário Base (R$) *</Label>
                  <Input
                    id="emp-sal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Valor contratual fixo mensal.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="emp-ben">Total em Benefícios (R$)</Label>
                  <Input
                    id="emp-ben"
                    type="number"
                    step="0.01"
                    min="0"
                    value={benefitsTotal}
                    onChange={(e) => setBenefitsTotal(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Soma de VT, VR/VA, Seguro, etc.</p>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Custo Total Mensal do Colaborador:</span>
                  <span className="text-lg font-extrabold text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      (Number(baseSalary) || 0) + (Number(benefitsTotal) || 0)
                    )}
                  </span>
                </div>
              </div>
            </TabsContent>

            {/* ABA 4: DADOS BANCÁRIOS & OBS */}
            <TabsContent value="banco" className="space-y-3 pt-3">
              <div className="grid gap-2">
                <Label htmlFor="emp-pix">Chave Pix</Label>
                <Input
                  id="emp-pix"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, Telefone, E-mail ou Aleatória"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="emp-bank">Banco</Label>
                  <Input
                    id="emp-bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ex: Nubank, Itaú, Bradesco"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-ag">Agência</Label>
                  <Input
                    id="emp-ag"
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                    placeholder="0001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-acc">Conta</Label>
                  <Input
                    id="emp-acc"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="12345-6"
                  />
                </div>
              </div>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="emp-notes">Observações Gerais / Anotações Internas</Label>
                <Input
                  id="emp-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Horário de trabalho, restrições, EPIs entregues, etc."
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : initial?.id ? "Salvar Alterações" : "Cadastrar Colaborador"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
