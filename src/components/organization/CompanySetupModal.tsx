import * as React from "react";
import { Building2, LogOut, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOrganization } from "@/contexts/OrganizationContext";
import { maskCpfCnpj, maskPhone } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import agiliXLogo from "@/assets/agilix_logo.png";

export function CompanySetupModal() {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const {
    organizations,
    currentOrg,
    isLoading,
    isSetupModalOpen,
    openSetupModal,
    closeSetupModal,
    createOrganization,
  } = useOrganization();

  const [companyName, setCompanyName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const getDismissKey = React.useCallback(
    () => (user ? `agilix_dismiss_setup_${user.id}` : "agilix_dismiss_setup"),
    [user]
  );

  const [isDismissed, setIsDismissed] = React.useState(false);

  // Sincroniza o estado de dismiss com a sessão atual do usuário ativo
  React.useEffect(() => {
    if (user) {
      const dismissed = sessionStorage.getItem(getDismissKey()) === "true";
      setIsDismissed(dismissed);
    } else {
      setIsDismissed(false);
    }
  }, [user, getDismissKey]);

  // Usuário superadmin da plataforma não deve ser obrigado a criar empresa automaticamente
  const isPlatformAdmin = Boolean(user?.email === "admin@erp.com.br" || isAdmin);

  // Deve abrir automaticamente se for usuário comum sem nenhuma empresa e sem dismiss nesta sessão
  const shouldAutoOpen = Boolean(
    user &&
    !isPlatformAdmin &&
    !isDismissed &&
    !isLoading &&
    !currentOrg &&
    organizations.length === 0
  );

  const isOpen = isSetupModalOpen || shouldAutoOpen;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (user) {
      sessionStorage.setItem(getDismissKey(), "true");
    }
    closeSetupModal();
  };

  const handleLogout = async () => {
    handleDismiss();
    await signOut();
  };

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

      toast.success("Empresa cadastrada com sucesso! Bem-vindo ao Agilix ERP.");
      setCompanyName("");
      setDocument("");
      setPhone("");
      closeSetupModal();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar empresa");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md border-border/60 shadow-elevated">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

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
            Configurar Empresa
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Defina o nome da sua empresa. Todos os seus produtos, vendas,
            clientes e movimentações financeiras serão salvos exclusivamente neste ambiente.
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

          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="submit"
              variant="hero"
              className="w-full gap-2"
              disabled={isSubmitting || !companyName.trim()}
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Criando espaço de trabalho…" : "Cadastrar Empresa & Começar"}
            </Button>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Agora não / Continuar no sistema
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair da conta
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
