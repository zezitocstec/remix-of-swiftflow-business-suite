import { useState, useEffect, useRef } from "react";
import { Scale, Plug, RefreshCw, Keyboard, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL, type Product } from "@/lib/mock-data";
import { useScale } from "@/contexts/ScaleContext";

type CaptureMode = "auto" | "manual" | "unit";

interface WeightCaptureDialogProps {
  open: boolean;
  product: Product | null;
  /** weightKg pode representar peso (kg) OU quantidade (un) quando isUnit=true */
  onConfirm: (product: Product, weightKg: number, isUnit?: boolean) => void;
  onCancel: () => void;
}

export default function WeightCaptureDialog({ open, product, onConfirm, onCancel }: WeightCaptureDialogProps) {
  const { isSerialSupported, isConnected, isReading, lastWeight, connectScale, readWeight } = useScale();
  const [manualWeight, setManualWeight] = useState("");
  const [unitQty, setUnitQty] = useState("1");
  const [capturedWeight, setCapturedWeight] = useState<number | null>(null);
  const [mode, setMode] = useState<CaptureMode>("auto");
  const inputRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCapturedWeight(null);
      setManualWeight("");
      setUnitQty("1");
      setMode(isConnected ? "auto" : "manual");
    }
  }, [open, isConnected]);

  // Pré-preenche com leitura ao vivo da balança quando entra em modo auto
  useEffect(() => {
    if (open && mode === "auto" && lastWeight !== null && lastWeight > 0 && capturedWeight === null) {
      setCapturedWeight(lastWeight);
    }
  }, [open, mode, lastWeight, capturedWeight]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (mode === "manual") inputRef.current?.focus();
      else if (mode === "unit") unitRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [open, mode]);

  const handleReadScale = async () => {
    const reading = await readWeight();
    if (reading) setCapturedWeight(reading.weight);
  };

  const handleConnect = async () => {
    const ok = await connectScale();
    if (ok) setMode("auto");
  };

  const parsedManual = parseFloat(manualWeight.replace(",", ".")) || 0;
  const parsedUnit = parseFloat(unitQty.replace(",", ".")) || 0;

  const value =
    mode === "manual" ? parsedManual :
    mode === "unit" ? parsedUnit :
    (capturedWeight ?? 0);

  const totalPrice = product ? value * product.price : 0;

  const handleConfirm = () => {
    if (!product || value <= 0) return;
    onConfirm(product, value, mode === "unit");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {mode === "unit" ? "Entrada por Unidade" : "Captura de Peso"}
          </DialogTitle>
          <DialogDescription>
            {product?.name} — {product ? formatBRL(product.price) : ""}/{mode === "unit" ? "un" : "kg"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={mode === "auto" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("auto")}
              className="h-10"
              disabled={!isSerialSupported}
            >
              <Scale className="h-4 w-4 mr-1.5" />
              Balança
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("manual")}
              className="h-10"
            >
              <Keyboard className="h-4 w-4 mr-1.5" />
              Manual
            </Button>
            <Button
              variant={mode === "unit" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("unit")}
              className="h-10"
            >
              <Package className="h-4 w-4 mr-1.5" />
              Unidade
            </Button>
          </div>

          {mode === "auto" && (
            <div className="space-y-3">
              {!isConnected ? (
                <div className="text-center space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">Conecte a balança via porta serial</p>
                  <Button onClick={handleConnect} variant="outline" className="h-11">
                    <Plug className="h-4 w-4 mr-1.5" />
                    Conectar Balança
                  </Button>
                  {!isSerialSupported && (
                    <p className="text-xs text-destructive">Web Serial API não suportada neste navegador. Use o modo manual ou unidade.</p>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded-full px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Balança conectada
                  </div>
                  <Button onClick={handleReadScale} disabled={isReading} className="w-full h-12 text-base">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isReading ? "animate-spin" : ""}`} />
                    {isReading ? "Lendo peso..." : "Ler Peso da Balança"}
                  </Button>
                </div>
              )}

              {capturedWeight !== null && (
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Peso capturado</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{capturedWeight.toFixed(3)} kg</p>
                </div>
              )}
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Peso (kg)</label>
              <Input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                placeholder="Ex: 1.250"
                value={manualWeight}
                onChange={(e) => setManualWeight(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                className="h-14 text-2xl text-center font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground text-center">Digite o peso em quilogramas (use ponto ou vírgula)</p>
            </div>
          )}

          {mode === "unit" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Quantidade (un)</label>
              <Input
                ref={unitRef}
                type="text"
                inputMode="decimal"
                placeholder="Ex: 1"
                value={unitQty}
                onChange={(e) => setUnitQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                className="h-14 text-2xl text-center font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground text-center">
                Vender como unidade — o preço {formatBRL(product?.price ?? 0)} será aplicado por unidade
              </p>
            </div>
          )}

          {/* Price preview */}
          {value > 0 && product && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {mode === "unit"
                    ? `${value} un × ${formatBRL(product.price)}`
                    : `${value.toFixed(3)} kg × ${formatBRL(product.price)}`}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-foreground">Total do item</span>
                <span className="text-xl font-bold tabular-nums text-foreground">{formatBRL(totalPrice)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={value <= 0}>
            Adicionar ao Carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
