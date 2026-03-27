import { useState } from "react";
import {
  Banknote, QrCode, CreditCard, Smartphone, Plus, X, Calculator, FileText,
} from "lucide-react";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Client } from "@/contexts/ProductContext";

interface PaymentMethod {
  id: string;
  method: string;
  amount: number;
}

const METHODS = [
  { icon: Banknote, label: "Dinheiro", key: "Dinheiro" },
  { icon: QrCode, label: "PIX", key: "PIX" },
  { icon: CreditCard, label: "Crédito", key: "Crédito" },
  { icon: Smartphone, label: "Débito", key: "Débito" },
];

interface PaymentPanelProps {
  total: number;
  onFinalize: (methods: { method: string; amount: number }[]) => void;
  onCancel: () => void;
  selectedClient?: Client | null;
}

export default function PaymentPanel({ total, onFinalize, onCancel, selectedClient }: PaymentPanelProps) {
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [cashReceived, setCashReceived] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [isMixedMode, setIsMixedMode] = useState(false);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const hasCash = payments.some((p) => p.method === "Dinheiro");
  const cashAmount = payments.filter((p) => p.method === "Dinheiro").reduce((s, p) => s + p.amount, 0);
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = hasCash ? Math.max(0, cashReceivedNum - cashAmount) : 0;

  const canUseFiado = selectedClient && selectedClient.creditLimit - selectedClient.creditUsed >= total;

  const addPayment = (method: string, amount: number) => {
    if (amount <= 0) return;
    setPayments((prev) => [...prev, { id: crypto.randomUUID(), method, amount }]);
    if (method === "Dinheiro") setCashReceived("");
    setSelectedMethod(null);
    setPartialAmount("");
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddPartial = () => {
    if (!selectedMethod) return;
    const amt = parseFloat(partialAmount);
    if (!amt || amt <= 0 || amt > remaining) return;
    addPayment(selectedMethod, amt);
  };

  const canFinalize = totalPaid >= total;

  const handleFinalize = () => {
    if (!canFinalize) return;
    onFinalize(payments.map((p) => ({ method: p.method, amount: p.amount })));
  };

  const showQuickPay = payments.length === 0 && !isMixedMode;
  const showMixedPanel = isMixedMode || payments.length > 0;

  return (
    <div className="space-y-3 animate-fade-in">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Pagamento — {formatBRL(total)}
      </p>

      {/* Quick full payment */}
      {showQuickPay && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button key={m.key} onClick={() => addPayment(m.key, total)}
                className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all active:scale-[0.97] touch-manipulation select-none min-h-[2.75rem]">
                <m.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <span className="text-sm font-medium text-foreground">{m.label}</span>
              </button>
            ))}
          </div>

          {selectedClient && (
            <button onClick={() => canUseFiado && addPayment("Pedido (Fiado)", total)}
              disabled={!canUseFiado}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-warning/50 bg-warning/5 hover:border-warning hover:bg-warning/10 transition-all active:scale-[0.97] touch-manipulation select-none disabled:opacity-40 disabled:cursor-not-allowed">
              <FileText className="h-4 w-4 text-warning" strokeWidth={1.5} />
              <div className="text-left flex-1">
                <span className="text-sm font-medium text-foreground">Pedido (Fiado)</span>
                <span className="text-xs text-muted-foreground block">
                  Crédito: {formatBRL(selectedClient.creditLimit - selectedClient.creditUsed)}
                </span>
              </div>
            </button>
          )}

          <button onClick={() => setIsMixedMode(true)}
            className="w-full flex items-center justify-center gap-1 text-xs text-primary hover:underline py-1 touch-manipulation">
            <Plus className="h-3 w-3" /> Pagamento misto
          </button>
        </>
      )}

      {/* Mixed payment mode */}
      {showMixedPanel && (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
              <span className="text-sm text-foreground">{p.method}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium tabular-nums text-foreground">{formatBRL(p.amount)}</span>
                <button onClick={() => removePayment(p.id)} className="text-muted-foreground hover:text-destructive touch-manipulation p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {remaining > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Restante</span>
                <span className="tabular-nums font-medium text-warning">{formatBRL(remaining)}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {METHODS.map((m) => (
                  <Button key={m.key} variant={selectedMethod === m.key ? "default" : "outline"} size="sm"
                    onClick={() => setSelectedMethod(selectedMethod === m.key ? null : m.key)} className="h-9 text-xs touch-manipulation">
                    <m.icon className="h-3.5 w-3.5 mr-1" />{m.label}
                  </Button>
                ))}
              </div>
              {selectedMethod && (
                <div className="flex gap-2">
                  <Input type="number" inputMode="decimal" placeholder={`Valor (max ${formatBRL(remaining)})`}
                    value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} className="h-10 text-sm flex-1" autoFocus />
                  <Button size="sm" onClick={handleAddPartial} className="h-10 touch-manipulation"><Plus className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => addPayment(selectedMethod, remaining)} variant="outline" className="h-10 touch-manipulation text-xs">Tudo</Button>
                </div>
              )}
            </div>
          )}

      {/* Cash change calculator (optional) */}
          {hasCash && totalPaid >= total && (
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calculator className="h-3.5 w-3.5" /> Troco (opcional)
              </div>
              <Input type="number" inputMode="decimal" placeholder="Valor recebido em dinheiro"
                value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="h-10 text-sm" />
              {cashReceivedNum > 0 && cashReceivedNum >= cashAmount && (
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">Troco</span>
                  <span className={`text-lg font-bold tabular-nums ${change > 0 ? "text-success" : "text-foreground"}`}>{formatBRL(change)}</span>
                </div>
              )}
            </div>
          )}

          {totalPaid >= total && (
            <div className="flex justify-between items-baseline text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Total pago</span>
              <span className="font-semibold tabular-nums text-foreground">{formatBRL(totalPaid)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 text-xs text-muted-foreground hover:text-foreground py-2 touch-manipulation">Cancelar (Esc)</button>
        {totalPaid >= total && (
          <Button onClick={handleFinalize} disabled={!canFinalize} className="flex-1 h-10 touch-manipulation">Confirmar</Button>
        )}
      </div>
    </div>
  );
}
