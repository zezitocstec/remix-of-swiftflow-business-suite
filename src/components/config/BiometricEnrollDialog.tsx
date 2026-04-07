import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, CheckCircle2, XCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { registerBiometric } from "@/lib/webauthn";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type EnrollStep = "list" | "ready" | "scanning" | "success" | "error";

const FINGER_LABELS = [
  "Indicador direito",
  "Indicador esquerdo",
  "Polegar direito",
  "Polegar esquerdo",
  "Outro dedo",
];

interface Credential {
  id: string;
  device_name: string;
  created_at: string;
}

interface BiometricEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorId: string;
  operatorName: string;
  onSuccess: () => void;
}

export default function BiometricEnrollDialog({
  open,
  onOpenChange,
  operatorId,
  operatorName,
  onSuccess,
}: BiometricEnrollDialogProps) {
  const [step, setStep] = useState<EnrollStep>("list");
  const [errorMsg, setErrorMsg] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFinger, setSelectedFinger] = useState(FINGER_LABELS[0]);

  useEffect(() => {
    if (open) {
      setStep("list");
      setErrorMsg("");
      loadCredentials();
    }
  }, [open]);

  const loadCredentials = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("webauthn_credentials" as any)
      .select("id, device_name, created_at")
      .eq("operator_id", operatorId)
      .order("created_at", { ascending: true });
    setCredentials((data as Credential[]) || []);
    setLoading(false);
  };

  const handleDeleteCredential = async (credId: string) => {
    await supabase
      .from("webauthn_credentials" as any)
      .delete()
      .eq("id", credId);
    await loadCredentials();
    onSuccess();
  };

  const handleStartEnroll = async () => {
    setStep("scanning");
    setErrorMsg("");

    try {
      const result = await registerBiometric(operatorId, selectedFinger);

      if (result.success) {
        setStep("success");
        await loadCredentials();
        onSuccess();
      } else {
        setStep("error");
        setErrorMsg(
          result.error?.includes("cancelada")
            ? "Você cancelou a leitura. Toque em tentar novamente."
            : result.error || "Não foi possível registrar a digital."
        );
      }
    } catch {
      setStep("error");
      setErrorMsg("Erro ao acessar o sensor biométrico. Verifique as permissões.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-card border-border">
        <DialogTitle className="sr-only">Cadastro de Digital</DialogTitle>

        <div className="flex flex-col items-center px-6 pt-8 pb-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-foreground">Digitais Cadastradas</h2>
            <p className="text-sm text-muted-foreground">{operatorName}</p>
          </div>

          {/* List view */}
          {step === "list" && (
            <div className="w-full space-y-4">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Fingerprint className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma digital cadastrada</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {credentials.map((cred, i) => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Fingerprint className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {cred.device_name || `Digital ${i + 1}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(cred.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCredential(cred.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  setSelectedFinger(FINGER_LABELS[credentials.length] || FINGER_LABELS[4]);
                  setStep("ready");
                }}
                className="w-full h-12 gap-2"
              >
                <Plus className="h-4 w-4" />
                Cadastrar Nova Digital
              </Button>

              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full text-muted-foreground"
              >
                Fechar
              </Button>
            </div>
          )}

          {/* Ready / Scanning / Success / Error views */}
          {step !== "list" && (
            <>
              {/* Finger selector (ready state) */}
              {step === "ready" && (
                <div className="w-full space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Qual dedo deseja cadastrar?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FINGER_LABELS.map((label) => (
                      <button
                        key={label}
                        onClick={() => setSelectedFinger(label)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full border transition-colors",
                          selectedFinger === label
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-primary/50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fingerprint visual */}
              <div className="relative flex items-center justify-center">
                {step === "scanning" && (
                  <>
                    <span className="absolute h-32 w-32 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                    <span className="absolute h-28 w-28 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                  </>
                )}
                {step === "success" && (
                  <span className="absolute h-32 w-32 rounded-full bg-success/10 animate-ping" style={{ animationDuration: "1.5s" }} />
                )}
                <div
                  className={cn(
                    "relative z-10 h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500",
                    step === "ready" && "bg-primary/10",
                    step === "scanning" && "bg-primary/20 scale-110",
                    step === "success" && "bg-success/20",
                    step === "error" && "bg-destructive/10"
                  )}
                >
                  {step === "success" ? (
                    <CheckCircle2 className="h-12 w-12 text-success animate-in zoom-in duration-300" />
                  ) : step === "error" ? (
                    <XCircle className="h-12 w-12 text-destructive animate-in zoom-in duration-300" />
                  ) : (
                    <Fingerprint
                      className={cn(
                        "h-12 w-12 transition-all duration-500",
                        step === "ready" && "text-primary",
                        step === "scanning" && "text-primary animate-pulse"
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Status text */}
              <div className="text-center min-h-[3rem] flex flex-col justify-center">
                {step === "ready" && (
                  <p className="text-sm text-muted-foreground">
                    Selecione o dedo e toque em iniciar. Posicione seu dedo no sensor do dispositivo.
                  </p>
                )}
                {step === "scanning" && (
                  <div className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-sm font-medium text-primary">Posicione seu dedo no sensor...</p>
                  </div>
                )}
                {step === "success" && (
                  <p className="text-sm font-medium text-success">
                    {selectedFinger} cadastrado com sucesso!
                  </p>
                )}
                {step === "error" && (
                  <p className="text-sm text-destructive">{errorMsg}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="w-full space-y-2">
                {step === "ready" && (
                  <>
                    <Button onClick={handleStartEnroll} className="w-full h-14 text-base gap-2">
                      <Fingerprint className="h-5 w-5" />
                      Iniciar Cadastro
                    </Button>
                    <Button variant="ghost" onClick={() => setStep("list")} className="w-full text-muted-foreground">
                      Voltar
                    </Button>
                  </>
                )}
                {step === "scanning" && (
                  <Button variant="outline" onClick={() => setStep("ready")} className="w-full h-12">
                    Cancelar
                  </Button>
                )}
                {step === "error" && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("list")} className="flex-1 h-12">
                      Voltar
                    </Button>
                    <Button onClick={handleStartEnroll} className="flex-1 h-12 gap-2">
                      <Fingerprint className="h-4 w-4" />
                      Tentar Novamente
                    </Button>
                  </div>
                )}
                {step === "success" && (
                  <div className="space-y-2">
                    <Button onClick={() => { setStep("ready"); setSelectedFinger(FINGER_LABELS[Math.min(credentials.length, 4)]); }} variant="outline" className="w-full h-12 gap-2">
                      <Plus className="h-4 w-4" />
                      Cadastrar Outra Digital
                    </Button>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground">
                      Concluir
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
