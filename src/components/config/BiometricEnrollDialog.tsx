import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { registerBiometric } from "@/lib/webauthn";
import { cn } from "@/lib/utils";

type EnrollStep = "ready" | "scanning" | "success" | "error";

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
  const [step, setStep] = useState<EnrollStep>("ready");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setStep("ready");
      setErrorMsg("");
    }
  }, [open]);

  const handleStartEnroll = async () => {
    setStep("scanning");
    setErrorMsg("");

    try {
      const result = await registerBiometric(operatorId);

      if (result.success) {
        setStep("success");
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 2000);
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

        <div className="flex flex-col items-center px-6 pt-10 pb-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-foreground">Cadastro de Digital</h2>
            <p className="text-sm text-muted-foreground">{operatorName}</p>
          </div>

          {/* Fingerprint visual */}
          <div className="relative flex items-center justify-center">
            {/* Pulse rings */}
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
                Toque no botão abaixo e posicione seu dedo no sensor de digital do dispositivo
              </p>
            )}
            {step === "scanning" && (
              <div className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">
                  Posicione seu dedo no sensor...
                </p>
              </div>
            )}
            {step === "success" && (
              <p className="text-sm font-medium text-success">
                Digital cadastrada com sucesso!
              </p>
            )}
            {step === "error" && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-2">
            {step === "ready" && (
              <Button onClick={handleStartEnroll} className="w-full h-14 text-base gap-2">
                <Fingerprint className="h-5 w-5" />
                Iniciar Cadastro
              </Button>
            )}

            {step === "scanning" && (
              <Button
                variant="outline"
                onClick={() => {
                  setStep("ready");
                }}
                className="w-full h-12"
              >
                Cancelar
              </Button>
            )}

            {step === "error" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-12"
                >
                  Fechar
                </Button>
                <Button
                  onClick={handleStartEnroll}
                  className="flex-1 h-12 gap-2"
                >
                  <Fingerprint className="h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            )}

            {step === "success" && (
              <p className="text-xs text-center text-muted-foreground">Fechando automaticamente...</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
