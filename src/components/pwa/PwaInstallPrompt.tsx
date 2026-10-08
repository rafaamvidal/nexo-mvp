import * as React from "react";
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt({
  variant = "header",
}: {
  variant?: "header" | "sidebar";
}) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [iosModalOpen, setIosModalOpen] = React.useState(false);

  const isIOS = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  const isStandalone = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes("android-app://")
    );
  }, []);

  React.useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("AGILIX instalado com sucesso como aplicativo!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setIosModalOpen(true);
    } else {
      // In other browsers where beforeinstallprompt fired or didn't fire, explain how to install
      toast.info(
        "Para instalar no seu navegador, clique no menu de opções (três pontinhos) e escolha 'Instalar aplicativo' ou 'Adicionar à tela inicial'."
      );
    }
  };

  if (isInstalled) {
    return null;
  }

  if (variant === "sidebar") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="w-full justify-start gap-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold"
          title="Baixar como aplicativo para celular ou tablet"
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          <span className="truncate">Baixar Aplicativo</span>
        </Button>

        <IosInstallDialog open={iosModalOpen} onOpenChange={setIosModalOpen} />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        className="hidden xs:inline-flex sm:flex items-center gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs px-2 sm:px-3 h-8 font-semibold transition-all"
        title="Instalar AGILIX como aplicativo no seu dispositivo"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Baixar App</span>
        <span className="md:hidden">App</span>
      </Button>

      <IosInstallDialog open={iosModalOpen} onOpenChange={setIosModalOpen} />
    </>
  );
}

function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar no iPhone / iPad
          </DialogTitle>
          <DialogDescription>
            Siga os passos rápidos abaixo no Safari para usar o AGILIX como aplicativo:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
              1
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                Toque no botão Compartilhar <Share2 className="h-4 w-4 text-primary" />
              </p>
              <p className="text-xs text-muted-foreground">
                No Safari, toque no ícone de compartilhamento na barra inferior do iPhone ou no topo do iPad.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
              2
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                Escolha "Adicionar à Tela de Início" <PlusSquare className="h-4 w-4 text-primary" />
              </p>
              <p className="text-xs text-muted-foreground">
                Role a lista para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs">
              Pronto! O AGILIX abrirá como um aplicativo nativo em tela cheia, sem barras de navegador.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
