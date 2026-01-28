import * as React from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha muito curta").max(72),
});
type FormValues = z.infer<typeof schema>;

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@erp.com.br", password: "" },
  });

  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo!");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-svh px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-balance text-3xl font-extrabold">ERP • Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse para gerenciar produtos e movimentações.</p>
        </div>

        <Card className="glass border-border/60 shadow-elevated">
          <CardHeader>
            <CardTitle className="text-xl">Login</CardTitle>
            <CardDescription>Entre com seu e-mail e senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" autoComplete="email" {...form.register("email")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
              </div>

              <Button type="submit" variant="hero" size="touch" disabled={submitting}>
                {submitting ? "Entrando…" : "Entrar"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Dica: se o login redirecionar com erro de URL no Supabase, configure as URLs de redirect/site na área de Auth.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
