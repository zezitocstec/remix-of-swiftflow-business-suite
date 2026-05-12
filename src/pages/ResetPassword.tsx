import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { KeyRound, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    try {
      const stored = localStorage.getItem("recover_email");
      if (stored) setResendEmail(stored);
    } catch {}
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada", description: "Faça login com a nova senha." });
    try { localStorage.removeItem("recover_email"); } catch {}
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const handleResend = async () => {
    const target = resendEmail.trim();
    if (!target) {
      toast({ title: "Informe um e-mail", variant: "destructive" });
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResending(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    try { localStorage.setItem("recover_email", target); } catch {}
    toast({
      title: "E-mail reenviado",
      description: "Verifique sua caixa de entrada e a pasta de spam.",
    });
    setResendOpen(false);
    setCooldown(60);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            {ready ? "Defina sua nova senha." : "Validando link de recuperação..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !ready}>
            {submitting ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              "Atualizar senha"
            )}
          </Button>
        </form>

        <div className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Não recebeu o e-mail? Verifique a pasta de spam ou reenvie o link.
          </p>
          {!resendOpen ? (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setResendOpen(true)}
              disabled={cooldown > 0}
            >
              <Mail className="h-4 w-4" />
              {cooldown > 0 ? `Aguarde ${cooldown}s` : "Reenviar e-mail de recuperação"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="resend-email" className="text-xs">E-mail</Label>
              <Input
                id="resend-email"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setResendOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleResend} disabled={resending} className="flex-1 gap-2">
                  {resending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  ) : (
                    <><Mail className="h-4 w-4" /> Reenviar</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
