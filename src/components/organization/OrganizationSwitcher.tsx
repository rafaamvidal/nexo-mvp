import * as React from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCpfCnpj } from "@/lib/masks";

export function OrganizationSwitcher() {
  const { organizations, currentOrg, selectOrganization, createOrganization } = useOrganization();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState("");
  const [newOrgDoc, setNewOrgDoc] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  if (!currentOrg && organizations.length === 0) {
    return null;
  }

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }

    try {
      setIsCreating(true);
      await createOrganization({
        name: newOrgName.trim(),
        document: newOrgDoc.trim() || undefined,
      });
      toast.success("Nova empresa criada com sucesso!");
      setOpenCreate(false);
      setNewOrgName("");
      setNewOrgDoc("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar nova empresa");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 max-w-[200px] sm:max-w-[260px] gap-2 border-border/60 bg-background/50 px-2.5 text-xs font-medium shadow-none hover:bg-accent"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-left">{currentOrg?.name ?? "Selecionar Empresa"}</span>
            <ChevronsUpDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Minhas Empresas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => {
            const isSelected = org.id === currentOrg?.id;
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => selectOrganization(org.id)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{org.name}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setOpenCreate(true)}
            className="gap-2 text-xs text-primary focus:text-primary cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Criar Nova Empresa</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Adicionar Nova Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Crie outro espaço de trabalho isolado dentro da sua conta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNew} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="switcherOrgName">Nome da Empresa *</Label>
              <Input
                id="switcherOrgName"
                placeholder="Ex: Filial 02"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="switcherOrgDoc">CNPJ / CPF (opcional)</Label>
              <Input
                id="switcherOrgDoc"
                placeholder="00.000.000/0000-00"
                value={newOrgDoc}
                onChange={(e) => setNewOrgDoc(maskCpfCnpj(e.target.value))}
                disabled={isCreating}
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              className="w-full gap-2 mt-2"
              disabled={isCreating || !newOrgName.trim()}
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Criando…" : "Criar Empresa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
