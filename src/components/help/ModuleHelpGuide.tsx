import * as React from "react";
import { HelpCircle, Info, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODULE_HELP_DATA, HelpContent } from "./helpData";

interface ModuleHelpGuideProps {
  /** Chave do módulo em helpData.ts (ex: 'estoque', 'produtos', 'vendas', 'rh') */
  moduleKey?: keyof typeof MODULE_HELP_DATA | string;
  /** Conteúdo customizado caso não queira usar a chave pré-definida */
  customContent?: Partial<HelpContent>;
  /** Trigger visual personalizado se não quiser o botão padrão com '?' */
  trigger?: React.ReactNode;
  /** Classes CSS adicionais */
  className?: string;
}

export function ModuleHelpGuide({
  moduleKey,
  customContent,
  trigger,
  className = "",
}: ModuleHelpGuideProps) {
  const [open, setOpen] = React.useState(false);

  const data: HelpContent = React.useMemo(() => {
    if (moduleKey && MODULE_HELP_DATA[moduleKey]) {
      return {
        ...MODULE_HELP_DATA[moduleKey],
        ...customContent,
      };
    }
    return {
      title: customContent?.title ?? "Guia do Módulo",
      subtitle: customContent?.subtitle ?? "Entenda o funcionamento desta seção",
      summary: customContent?.summary ?? "Esta área permite gerenciar os dados da empresa de forma integrada.",
      whatToRegister: customContent?.whatToRegister ?? [
        "Preencha as informações necessárias nos campos indicados.",
        "Mantenha os cadastros sempre atualizados para relatórios precisos.",
      ],
      tips: customContent?.tips ?? [
        "Utilize a busca rápida para localizar itens com facilidade.",
      ],
    };
  }, [moduleKey, customContent]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors ${className}`}
            title={`Ajuda: ${data.title}`}
            aria-label={`Ajuda: ${data.title}`}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:max-w-lg sm:p-6 border border-border/80 shadow-2xl">
        <DialogHeader className="text-left space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold leading-tight text-foreground">
                {data.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{data.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs sm:text-sm">
          {/* VISÃO GERAL */}
          <div className="rounded-xl bg-muted/30 p-3 border border-border/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
              <Info className="h-3.5 w-3.5 text-primary" />
              Do que se trata este módulo?
            </span>
            <p className="text-foreground/90 leading-relaxed text-xs sm:text-sm">
              {data.summary}
            </p>
          </div>

          {/* O QUE CADASTRAR AQUI */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              O que deve ser cadastrado / gerenciado aqui?
            </span>
            <ul className="space-y-2">
              {data.whatToRegister.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-lg bg-card p-2 border border-border/50 text-xs sm:text-sm"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DICAS DE OURO */}
          {data.tips && data.tips.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Dicas de Uso do AGILIX:
              </span>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="hero"
            className="w-full text-xs"
            onClick={() => setOpen(false)}
          >
            Entendi, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
