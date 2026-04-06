import { useState } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SegurancaConfig() {
  const { adminPin, setAdminPin } = useProducts();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePin = () => {
    if (currentPin !== adminPin) {
      toast.error("PIN atual incorreto.");
      return;
    }
    if (newPin.length < 4) {
      toast.error("O novo PIN deve ter pelo menos 4 dígitos.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Os PINs não conferem.");
      return;
    }
    if (newPin === currentPin) {
      toast.error("O novo PIN deve ser diferente do atual.");
      return;
    }
    setAdminPin(newPin);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    toast.success("PIN do administrador alterado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          Alterar PIN do Administrador
        </h3>
        <p className="text-xs text-muted-foreground">
          O PIN é utilizado para acessar áreas administrativas e autorizar ações destrutivas.
        </p>

        <div className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">PIN Atual</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                className="pr-10 text-center tracking-[0.3em]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Novo PIN</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className="pr-10 text-center tracking-[0.3em]"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Confirmar Novo PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center tracking-[0.3em]"
            />
          </div>

          <Button
            onClick={handleChangePin}
            disabled={!currentPin || !newPin || !confirmPin}
            className="w-full gap-2"
          >
            <Lock className="h-4 w-4" />
            Alterar PIN
          </Button>
        </div>
      </div>
    </div>
  );
}
