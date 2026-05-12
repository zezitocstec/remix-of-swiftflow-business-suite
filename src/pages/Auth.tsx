import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { LogIn, Store, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recovering, setRecovering] = useState(false);

  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user && !mfaOpen) return <Navigate to="/" replace />;

  const checkMfa = async (): Promise<boolean> => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      const { data: list } = await supabase.auth.mfa.listFactors();
      const totp = list?.totp?.find((f: any) => f.status === "verified");
      if (!totp) return false;
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (ce || !ch) {
        toast({ title: "Erro 2FA", description: ce?.message ?? "Falha", variant: "destructive" });
        await supabase.auth.signOut();
        return true;
      }
      setMfaFactorId(totp.id);
      setMfaChallengeId(ch.id);
      setMfaCode("");
      setMfaOpen(true);
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setSubmitting(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await checkMfa();
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setGoogleLoading(false);
      toast({ title: "Erro Google", description: error.message, variant: "destructive" });
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || !mfaChallengeId) return;
    if (mfaCode.length !== 6) {
      toast({ title: "Código inválido", description: "Digite os 6 dígitos.", variant: "destructive" });
      return;
    }
    setMfaSubmitting(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: mfaCode,
    });
    setMfaSubmitting(false);
    if (error) {
      toast({ title: "Código incorreto", description: error.message, variant: "destructive" });
      return;
    }
    setMfaOpen(false);
  };

  const cancelMfa = async () => {
    setMfaOpen(false);
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaCode("");
    await supabase.auth.signOut();
  };

  const handleRecover = async () => {
    const target = recoverEmail.trim();
    if (!target) {
      toast({ title: "Informe um e-mail", variant: "destructive" });
      return;
    }
    setRecovering(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setRecovering(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "E-mail enviado",
      description: "Verifique sua caixa de entrada para redefinir a senha.",
    });
    setRecoverOpen(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sistema PDV</h1>
          <p className="text-sm text-muted-foreground">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <button
                type="button"
                onClick={() => {
                  setRecoverEmail(email);
                  setRecoverOpen(true);
                }}
                className="text-xs text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <><LogIn className="h-4 w-4 mr-2" /> Entrar</>
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continuar com Google
            </>
          )}
        </Button>
      </div>

      <Dialog open={recoverOpen} onOpenChange={setRecoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recover-email">E-mail</Label>
            <Input
              id="recover-email"
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecoverOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRecover} disabled={recovering}>
              {recovering ? (
                <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : (
                <><Mail className="h-4 w-4 mr-2" /> Enviar link</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
