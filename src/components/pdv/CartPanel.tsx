import { useState } from "react";
import {
  Plus, Minus, Trash2,
  Percent, DollarSign, PauseCircle, PlayCircle, Tag, TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBRL, type CartItem } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ParkedSale } from "./types";
import PaymentPanel from "./PaymentPanel";

interface CartPanelProps {
  cart: CartItem[];
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  onFinalizeSale: (methods: { method: string; amount: number }[]) => void;
  discount: { type: "percent" | "value"; amount: number };
  setDiscount: (d: { type: "percent" | "value"; amount: number }) => void;
  surcharge: { type: "percent" | "value"; amount: number };
  setSurcharge: (s: { type: "percent" | "value"; amount: number }) => void;
  parkedSales: ParkedSale[];
  onParkSale: (name: string) => void;
  onRecallSale: (id: string) => void;
  showPayment: boolean;
  setShowPayment: (v: boolean) => void;
  showParkDialog: boolean;
  setShowParkDialog: (v: boolean) => void;
  showRecallDialog: boolean;
  setShowRecallDialog: (v: boolean) => void;
}

export default function CartPanel({
  cart, updateQty, removeItem, clearCart, onFinalizeSale,
  discount, setDiscount, surcharge, setSurcharge,
  parkedSales, onParkSale, onRecallSale,
  showPayment, setShowPayment,
  showParkDialog, setShowParkDialog,
  showRecallDialog, setShowRecallDialog,
}: CartPanelProps) {
  const [showAdjust, setShowAdjust] = useState<"discount" | "surcharge" | null>(null);
  const [adjustType, setAdjustType] = useState<"percent" | "value">("percent");
  const [adjustValue, setAdjustValue] = useState("");
  const [showPark, setShowPark] = useState(false);
  const [parkName, setParkName] = useState("");
  const [showRecall, setShowRecall] = useState(false);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const discountAmount = discount.type === "percent" ? subtotal * (discount.amount / 100) : discount.amount;
  const surchargeAmount = surcharge.type === "percent" ? subtotal * (surcharge.amount / 100) : surcharge.amount;
  const total = Math.max(0, subtotal - discountAmount + surchargeAmount);

  const openAdjust = (mode: "discount" | "surcharge") => {
    const current = mode === "discount" ? discount : surcharge;
    setAdjustType(current.type);
    setAdjustValue(current.amount > 0 ? String(current.amount) : "");
    setShowAdjust(mode);
  };

  const applyAdjust = () => {
    const val = parseFloat(adjustValue) || 0;
    if (showAdjust === "discount") setDiscount({ type: adjustType, amount: val });
    else setSurcharge({ type: adjustType, amount: val });
    setShowAdjust(null);
  };

  const handleFinalize = (method: string) => {
    onFinalizeSale(method);
    setShowPayment(false);
  };

  return (
    <>
      <div className="w-full sm:w-80 lg:w-96 border-t sm:border-t-0 sm:border-l border-border bg-card flex flex-col max-h-[50vh] sm:max-h-none">
        {/* Header */}
        <div className="h-12 sm:h-14 border-b border-border flex items-center justify-between px-3 sm:px-4 shrink-0">
          <span className="text-sm font-semibold text-foreground">Carrinho ({totalItems})</span>
          <div className="flex items-center gap-1">
            {parkedSales.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowRecall(true)} className="text-primary touch-manipulation h-9 px-2">
                <PlayCircle className="h-4 w-4 mr-1" /> {parkedSales.length}
              </Button>
            )}
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-destructive hover:underline font-medium px-2 py-1 touch-manipulation">
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-auto min-h-0">
          <AnimatePresence mode="popLayout">
            {cart.map((item) => (
              <motion.div
                key={item.product.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="border-b border-border px-3 sm:px-4 py-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(item.product.price)}</p>
                  </div>
                  <button onClick={() => removeItem(item.product.id)} className="text-muted-foreground hover:text-destructive p-2 -mr-2 touch-manipulation">
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, -1)} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors touch-manipulation active:scale-95">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm tabular-nums font-medium text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors touch-manipulation active:scale-95">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatBRL(item.product.price * item.quantity)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 min-h-[120px]">
              <p className="text-sm">Nenhum item no carrinho</p>
              <p className="text-xs mt-1">Toque em um produto para adicionar</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 sm:p-4 space-y-2 shrink-0">
          {/* Adjust buttons */}
          {cart.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => openAdjust("discount")}
                className="flex-1 h-10 touch-manipulation text-xs"
              >
                <Tag className="h-3.5 w-3.5 mr-1 text-success" />
                Desconto {discount.amount > 0 && `(${discount.type === "percent" ? `${discount.amount}%` : formatBRL(discount.amount)})`}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => openAdjust("surcharge")}
                className="flex-1 h-10 touch-manipulation text-xs"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1 text-warning" />
                Acréscimo {surcharge.amount > 0 && `(${surcharge.type === "percent" ? `${surcharge.amount}%` : formatBRL(surcharge.amount)})`}
              </Button>
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotal)}</span>
            </div>
            {discount.amount > 0 && (
              <div className="flex justify-between text-xs text-success">
                <span>Desconto ({discount.type === "percent" ? `${discount.amount}%` : "valor"})</span>
                <span className="tabular-nums">-{formatBRL(discountAmount)}</span>
              </div>
            )}
            {surcharge.amount > 0 && (
              <div className="flex justify-between text-xs text-warning">
                <span>Acréscimo ({surcharge.type === "percent" ? `${surcharge.amount}%` : "valor"})</span>
                <span className="tabular-nums">+{formatBRL(surchargeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1 border-t border-border">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">
                {formatBRL(total)}
              </span>
            </div>
          </div>

          {/* Actions */}
          {!showPayment ? (
            <div className="flex gap-2">
              {cart.length > 0 && (
                <Button variant="outline" size="default" onClick={() => setShowPark(true)} className="h-12 touch-manipulation">
                  <PauseCircle className="h-4 w-4" />
                </Button>
              )}
              <button
                onClick={() => cart.length > 0 && setShowPayment(true)}
                disabled={cart.length === 0}
                className="flex-1 h-12 rounded-lg bg-accent text-accent-foreground font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation select-none"
              >
                Finalizar Venda
              </button>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Banknote, label: "Dinheiro" },
                  { icon: QrCode, label: "PIX" },
                  { icon: CreditCard, label: "Crédito" },
                  { icon: Smartphone, label: "Débito" },
                ].map((m) => (
                  <button
                    key={m.label}
                    onClick={() => handleFinalize(m.label)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all active:scale-[0.97] touch-manipulation select-none min-h-[2.75rem]"
                  >
                    <m.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPayment(false)} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 touch-manipulation">
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={!!showAdjust} onOpenChange={() => setShowAdjust(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{showAdjust === "discount" ? "Desconto" : "Acréscimo"}</DialogTitle>
            <DialogDescription>Informe o tipo e valor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={adjustType === "percent" ? "default" : "outline"}
                onClick={() => setAdjustType("percent")}
                className="flex-1 h-12 touch-manipulation"
              >
                <Percent className="h-4 w-4 mr-1" /> Porcentagem
              </Button>
              <Button
                variant={adjustType === "value" ? "default" : "outline"}
                onClick={() => setAdjustType("value")}
                className="flex-1 h-12 touch-manipulation"
              >
                <DollarSign className="h-4 w-4 mr-1" /> Valor (R$)
              </Button>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={adjustType === "percent" ? "Ex: 10" : "Ex: 5.00"}
              value={adjustValue}
              onChange={(e) => setAdjustValue(e.target.value)}
              className="h-12 text-lg text-center"
              autoFocus
            />
            {adjustType === "percent" && subtotal > 0 && adjustValue && (
              <p className="text-sm text-muted-foreground text-center">
                = {formatBRL(subtotal * (parseFloat(adjustValue) || 0) / 100)}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              if (showAdjust === "discount") setDiscount({ type: "percent", amount: 0 });
              else setSurcharge({ type: "percent", amount: 0 });
              setShowAdjust(null);
            }} className="touch-manipulation">Remover</Button>
            <Button onClick={applyAdjust} className="touch-manipulation">Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Park Sale Dialog */}
      <Dialog open={showPark} onOpenChange={setShowPark}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Estacionar Venda</DialogTitle>
            <DialogDescription>O cliente pode buscar itens e você atende o próximo. Identifique o cliente:</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nome do cliente (opcional)"
            value={parkName}
            onChange={(e) => setParkName(e.target.value)}
            className="h-12"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPark(false)}>Cancelar</Button>
            <Button onClick={() => { onParkSale(parkName || "Cliente"); setShowPark(false); setParkName(""); }}>
              <PauseCircle className="h-4 w-4 mr-1" /> Estacionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recall Sale Dialog */}
      <Dialog open={showRecall} onOpenChange={setShowRecall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vendas Estacionadas</DialogTitle>
            <DialogDescription>Selecione para retomar o atendimento</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-auto">
            {parkedSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => { onRecallSale(sale.id); setShowRecall(false); }}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{sale.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.items.length} itens • {formatBRL(sale.items.reduce((s, i) => s + i.product.price * i.quantity, 0))}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {sale.parkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
