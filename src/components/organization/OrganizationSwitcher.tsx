import * as React from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
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

export function OrganizationSwitcher() {
  const { organizations, currentOrg, selectOrganization, openSetupModal } = useOrganization();

  // Se o usuário ainda não possui nenhuma empresa, exibe o botão destacado para cadastrar
  if (!currentOrg && organizations.length === 0) {
    return (
      <Button
        onClick={openSetupModal}
        variant="hero"
        size="sm"
        className="h-8 gap-1.5 text-xs font-semibold shadow-sm"
      >
        <Plus className="h-3.5 w-3.5" />
        Cadastrar Empresa
      </Button>
    );
  }

  return (
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
              className="flex items-center justify-between text-xs cursor-pointer"
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
          onClick={openSetupModal}
          className="gap-2 text-xs text-primary focus:text-primary cursor-pointer font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Cadastrar Nova Empresa</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
