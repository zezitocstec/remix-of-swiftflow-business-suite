import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, KeyRound, Copy, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Factor {
  id: string;
  status: string;
  friendly_name?: string;
}

export default function TwoFactorConfig() {
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupRemaining, setBackupRemaining] = useState<number | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [generatingBackup, setGeneratingBackup] = useState(false);

  const refreshBackup = async () => {
    const { data, error } = await supabase.functions.invoke("mfa-backup-codes", { body: { action: "status" } });
    if (!error && data) setBackupRemaining(data.remaining ?? 0);
  };

  const generateBackup = async () => {
    if (backupRemaining && backupRemaining > 0) {
      if (!confirm("Isso invalidará os códigos antigos. Continuar?")) return;
    }
    setGeneratingBackup(true);
    const { data, error } = await supabase.functions.invoke("mfa-backup-codes", { body: { action: "generate" } });
    setGeneratingBackup(false);
    if (error || !data?.codes) {
      toast.error(error?.message ?? "Falha ao gerar códigos");
      return;
    }
    setBackupCodes(data.codes);
    setBackupRemaining(data.codes.length);
    toast.success("Códigos gerados! Guarde em local seguro.");
  };

  const copyAll = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Códigos copiados");
  };

  const downloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob(
      [`Códigos de recuperação 2FA\nGerados em: ${new Date().toLocaleString()}\n\n${backupCodes.join("\n")}\n\nUse cada código apenas uma vez.`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return;
    const totp = data.totp?.[0];
    setFactor(totp ? { id: totp.id, status: totp.status, friendly_name: totp.friendly_name } : null);
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setBusy(true);
    // remove any unverified factor first to avoid conflicts
    const { data: list } = await supabase.auth.mfa.listFactors();
    const stale = list?.totp?.find((f: any) => f.status !== "verified");
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrollData({
      id: data.id,
      qr: (data as any).totp.qr_code,
      secret: (data as any).totp.secret,
      uri: (data as any).totp.uri,
    });
    setCode("");
    setEnrollOpen(true);
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    if (code.length !== 6) {
      toast.error("Código deve ter 6 dígitos");
      return;
    }
    setBusy(true);
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (ce || !ch) {
      setBusy(false);
      toast.error(ce?.message ?? "Erro ao gerar challenge");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: ch.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA ativado com sucesso!");
    setEnrollOpen(false);
    setEnrollData(null);
    setCode("");
    await refresh();
  };

  const disable = async () => {
    if (!factor) return;
    if (!confirm("Desativar a verificação em duas etapas?")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA desativado");
    await refresh();
  };

  return (
    <div className="rounded-md border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Verificação em duas etapas (Google Authenticator)
      </h3>
      <p className="text-xs text-muted-foreground">
        Adicione uma camada extra de segurança usando um app autenticador (Google Authenticator, Authy, 1Password etc.).
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : factor && factor.status === "verified" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium text-foreground">Ativado</p>
            <p className="text-xs text-muted-foreground">{factor.friendly_name ?? "Authenticator"}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={disable} disabled={busy} className="gap-2">
            <ShieldOff className="h-4 w-4" /> Desativar
          </Button>
        </div>
      ) : (
        <Button onClick={startEnroll} disabled={busy} className="gap-2">
          <ShieldCheck className="h-4 w-4" /> Ativar 2FA
        </Button>
      )}

      {enrollOpen && enrollData && (
        <div className="mt-4 rounded-md border border-border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium text-foreground">1. Escaneie o QR Code no seu app autenticador</p>
          <div
            className="bg-white p-3 rounded-md inline-block"
            dangerouslySetInnerHTML={{ __html: enrollData.qr }}
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Ou insira manualmente este código:
            </p>
            <code className="block text-xs bg-background border border-border rounded px-2 py-1 font-mono break-all">
              {enrollData.secret}
            </code>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="otp-code" className="text-sm font-medium">
              2. Digite o código de 6 dígitos gerado no app
            </Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEnrollOpen(false); setEnrollData(null); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={verifyEnroll} disabled={busy || code.length !== 6} className="gap-2">
              <KeyRound className="h-4 w-4" /> Confirmar e Ativar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
