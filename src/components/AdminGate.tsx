import { useState, useEffect } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Fingerprint } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isPlatformAuthAvailable, authenticateBiometric } from "@/lib/webauthn";

interface AdminGateProps {
  children: React.ReactNode;
}

export default function AdminGate({ children }: AdminGateProps) {
  const { adminPin } = useProducts();
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    isPlatformAuthAvailable().then(setBiometricAvailable);
  }, []);

  const handleSubmit = () => {
    if (pin === adminPin) {
      setAuthenticated(true);
    } else {
      toast({ title: "PIN incorreto", description: "Acesso negado à área administrativa.", variant: "destructive" });
      setPin("");
    }
  };

  const handleBiometric = async () => {
    setBiometricLoading(true);
    try {
      const result = await authenticateBiometric();
      if (result.valid) {
        setAuthenticated(true);
        toast({ title: "Acesso liberado", description: `Autenticado via biometria: ${result.operator?.nome}` });
      } else if (result.error?.includes("Nenhuma biometria") || result.error?.includes("No biometric")) {
        toast({ title: "Nenhuma digital cadastrada", description: "Cadastre uma digital em Configurações > Operadores.", variant: "default" });
      } else if (result.error?.includes("cancelada")) {
        toast({ title: "Autenticação cancelada", description: "Toque novamente quando estiver pronto." });
      } else {
        toast({ title: "Falha na biometria", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na biometria", variant: "destructive" });
    } finally {
      setBiometricLoading(false);
    }
  };

  if (authenticated) return <>{children}</>;

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Área Administrativa | IT.Sega4 </h1>
          <p className="text-sm text-muted-foreground">Digite o PIN do administrador para acessar</p>
        </div>
        <Input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="h-14 text-2xl text-center tracking-[0.5em]"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        <Button onClick={handleSubmit} disabled={!pin} className="w-full h-14 text-base">
          Acessar
        </Button>

        {biometricAvailable && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleBiometric}
              disabled={biometricLoading}
              className="w-full h-14 text-base gap-2"
            >
              {biometricLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <Fingerprint className="h-5 w-5" />
              )}
              {biometricLoading ? "Verificando..." : "Entrar com Digital"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
