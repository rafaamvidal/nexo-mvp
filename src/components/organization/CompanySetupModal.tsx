import * as React from "react";
import { Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { maskCpfCnpj, maskPhone } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import agiliXLogo from "@/assets/agilix_logo.png";

export function CompanySetupModal() {
  const { user } = useAuth();
  const { organizations, isLoading, createOrganization } = useOrganization();

  const [companyName, setCompanyName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Exibe o modal apenas se o usuário estiver autenticado e não tiver nenhuma organização cadastrada
  const shouldOpen = Boolean(user && !isLoading && organizations.length === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Informe o nome da sua empresa");
      return;
    }

    try {
      setIsSubmitting(true);
      await createOrganization({
        name: companyName.trim(),
        document: document.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      toast.success("Empresa criada com sucesso! Bem-vindo ao Agilix ERP.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar empresa");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldOpen) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md border-border/60 shadow-elevated"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center sm:text-left">
          <div className="mb-2 flex items-center justify-center sm:justify-start">
            <img
              src={agiliXLogo}
              alt="AGILIX"
              className="h-7 w-auto object-contain"
            />
          </div>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            Configurar Nova Empresa
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Para começar a usar o ERP, defina o nome da sua empresa. Todos os seus produtos, vendas,
            clientes e financeiro serão salvos exclusivamente neste ambiente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              Nome da Empresa / Razão Social <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              placeholder="Ex: Comercial Silva Ltda"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc">CNPJ ou CPF (opcional)</Label>
            <Input
              id="doc"
              placeholder="00.000.000/0000-00"
              value={document}
              onChange={(e) => setDocument(maskCpfCnpj(e.target.value))}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone / WhatsApp (opcional)</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="hero"
              className="w-full gap-2"
              disabled={isSubmitting || !companyName.trim()}
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Criando espaço de trabalho…" : "Criar Minha Empresa & Começar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
