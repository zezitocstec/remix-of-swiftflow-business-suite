import { useState, useCallback, useRef, useMemo } from "react";
import { formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import { useProducts, type Client } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RotateCcw, Users, CreditCard, Printer } from "lucide-react";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import type { ParkedSale } from "@/components/pdv/types";
import { usePDVShortcuts } from "@/hooks/usePDVShortcuts";
import { printReceipt } from "@/components/pdv/ReceiptPrint";

export default function PDV() {
  const { products, sellProducts, cancelSale, clients, createDebt, debts, payDebt } = useProducts();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [discount, setDiscount] = useState<{ type: "percent" | "value"; amount: number }>({ type: "percent", amount: 0 });
  const [surcharge, setSurcharge] = useState<{ type: "percent" | "value"; amount: number }>({ type: "percent", amount: 0 });
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showParkDialog, setShowParkDialog] = useState(false);
  const [showRecallDialog, setShowRecallDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  // Debtors dialog
  const [showDebtors, setShowDebtors] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [debtPayMethod, setDebtPayMethod] = useState("Dinheiro");

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Sem estoque", description: `${product.name} está sem estoque (0 un).`, variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Estoque insuficiente", description: `${product.name}: limite de ${product.stock} unidades.`, variant: "destructive" });
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) => {
      return prev.map((i) => {
        if (i.product.id !== id) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return { ...i, quantity: 0 };
        if (delta > 0 && newQty > i.product.stock) {
          toast({ title: "Estoque insuficiente", description: `${i.product.name}: limite de ${i.product.stock} unidades.`, variant: "destructive" });
          return i;
        }
        return { ...i, quantity: newQty };
      }).filter((i) => i.quantity > 0);
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  }, []);

  const clearCart = () => {
    setCart([]);
    setDiscount({ type: "percent", amount: 0 });
    setSurcharge({ type: "percent", amount: 0 });
    setShowPayment(false);
    setSelectedClient(null);
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmount = discount.type === "percent" ? subtotal * (discount.amount / 100) : discount.amount;
  const surchargeAmount = surcharge.type === "percent" ? subtotal * (surcharge.amount / 100) : surcharge.amount;
  const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [lastSaleRecord, setLastSaleRecord] = useState<any>(null);

  const finalizeSale = (methods: { method: string; amount: number }[]) => {
    const isPedido = methods.some((m) => m.method === "Pedido (Fiado)");

    if (isPedido && selectedClient) {
      const debtId = createDebt(selectedClient.id, total);
      if (!debtId) {
        toast({ title: "Crédito insuficiente", description: `${selectedClient.nome} não tem crédito disponível suficiente.`, variant: "destructive" });
        return;
      }
    }

    const items = cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }));
    const saleId = sellProducts(items, methods, selectedClient?.id);
    setLastSaleId(saleId);

    // Build sale record for receipt
    const saleRecord = {
      id: saleId,
      items: cart.map(i => ({ productId: i.product.id, productName: i.product.name, quantity: i.quantity, price: i.product.price })),
      total,
      methods,
      clientId: selectedClient?.id,
      clientName: selectedClient?.nome,
      date: new Date(),
    };
    setLastSaleRecord(saleRecord);

    const methodStr = methods.map((m) => m.method).join(" + ");
    toast({ title: "Venda finalizada!", description: `${totalItems} itens — ${formatBRL(total)} via ${methodStr}.` });

    // If it's a Pedido (Fiado), show receipt options
    if (isPedido) {
      setShowReceiptOptions(true);
    } else {
      // Auto-print 1 copy for regular sales
      printReceipt(saleRecord, "venda", 1);
    }

    clearCart();
  };

  const handleCancelSale = () => {
    if (lastSaleId) {
      cancelSale(lastSaleId);
      toast({ title: "Venda cancelada", description: "Estoque restaurado." });
      setLastSaleId(null);
    }
    setCancelDialogOpen(false);
  };

  const parkSale = (customerName: string) => {
    if (cart.length === 0) return;
    setParkedSales((prev) => [...prev, { id: crypto.randomUUID(), items: [...cart], customerName, parkedAt: new Date(), discount, surcharge }]);
    toast({ title: "Venda estacionada", description: `${customerName} — ${totalItems} itens guardados.` });
    clearCart();
  };

  const recallSale = (id: string) => {
    const sale = parkedSales.find((s) => s.id === id);
    if (!sale) return;
    setCart(sale.items);
    setDiscount(sale.discount);
    setSurcharge(sale.surcharge);
    setParkedSales((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Venda retomada", description: `${sale.customerName} — ${sale.items.length} itens.` });
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) => c.nome.toLowerCase().includes(q) || c.cpfCnpj.includes(q));
  }, [clientSearch, clients]);

  const openDebts = debts.filter((d) => d.paid < d.amount);
  const debtorClients = useMemo(() => {
    const ids = new Set(openDebts.map((d) => d.clientId));
    return clients.filter((c) => ids.has(c.id));
  }, [openDebts, clients]);

  const handlePayDebt = (debtId: string) => {
    const amt = parseFloat(debtPayAmount);
    if (!amt || amt <= 0) return;
    const debt = openDebts.find(d => d.id === debtId);
    payDebt(debtId, amt, debtPayMethod);
    toast({ title: "Pagamento registrado", description: `${formatBRL(amt)} via ${debtPayMethod}.` });
    setDebtPayAmount("");

    // Print payment receipt
    if (debt) {
      const remaining = Math.max(0, (debt.amount - debt.paid) - amt);
      const sale = sales.find(s => s.clientId === debt.clientId && Math.abs(s.total - debt.amount) < 0.01) || {
        id: debt.id, items: [], total: debt.amount, methods: [], clientName: debt.clientName, date: debt.saleDate,
      };
      printReceipt(sale as any, "pagamento", 1, { amount: amt, method: debtPayMethod, remainingDebt: remaining });
    }
  };

  usePDVShortcuts({
    onSearch: () => document.querySelector<HTMLInputElement>('input[placeholder*="Buscar produto"]')?.focus(),
    onPark: () => { if (cart.length > 0) setShowParkDialog(true); },
    onRecall: () => { if (parkedSales.length > 0) setShowRecallDialog(true); },
    onFinalize: () => { if (cart.length > 0 && !showPayment) setShowPayment(true); },
    onCancel: () => { if (showPayment) setShowPayment(false); },
  });

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100vh-3.5rem)] sm:h-screen bg-pos-bg">
      <ProductGrid
        products={products}
        search={search}
        setSearch={setSearch}
        onAddToCart={addToCart}
        lastSaleId={lastSaleId}
        onCancelLastSale={() => setCancelDialogOpen(true)}
        selectedClient={selectedClient}
        onSelectClient={() => setShowClientPicker(true)}
        onClearClient={() => setSelectedClient(null)}
        onOpenDebtors={() => setShowDebtors(true)}
        debtorCount={debtorClients.length}
      />
      <CartPanel
        cart={cart} updateQty={updateQty} removeItem={removeItem} clearCart={clearCart}
        onFinalizeSale={finalizeSale}
        discount={discount} setDiscount={setDiscount}
        surcharge={surcharge} setSurcharge={setSurcharge}
        parkedSales={parkedSales} onParkSale={parkSale} onRecallSale={recallSale}
        showPayment={showPayment} setShowPayment={setShowPayment}
        showParkDialog={showParkDialog} setShowParkDialog={setShowParkDialog}
        showRecallDialog={showRecallDialog} setShowRecallDialog={setShowRecallDialog}
        selectedClient={selectedClient}
      />

      {/* Cancel Sale Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Última Venda</DialogTitle>
            <DialogDescription>O estoque será restaurado. Deseja continuar?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Não</Button>
            <Button variant="destructive" onClick={handleCancelSale}>Sim, cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Picker Dialog */}
      <Dialog open={showClientPicker} onOpenChange={setShowClientPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Cliente</DialogTitle>
            <DialogDescription>Vincule um cliente à venda (opcional para fiado)</DialogDescription>
          </DialogHeader>
          <Input placeholder="Buscar por nome ou CPF/CNPJ..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="h-10" autoFocus />
          <div className="space-y-1 max-h-60 overflow-auto">
            {filteredClients.map((c) => (
              <button key={c.id} onClick={() => { setSelectedClient(c); setShowClientPicker(false); setClientSearch(""); }}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.cpfCnpj} • Crédito: {formatBRL(c.creditLimit - c.creditUsed)}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Debtors Dialog (F4) */}
      <Dialog open={showDebtors} onOpenChange={setShowDebtors}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Clientes Devedores (Fiado)</DialogTitle>
            <DialogDescription>Gerencie pagamentos de dívidas pendentes</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {openDebts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma dívida pendente.</p>}
            {openDebts.map((d) => (
              <div key={d.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.clientName}</p>
                    <p className="text-xs text-muted-foreground">{d.saleDate.toLocaleDateString("pt-BR")} • Total: {formatBRL(d.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-destructive">{formatBRL(d.amount - d.paid)}</p>
                    <p className="text-xs text-muted-foreground">devendo</p>
                  </div>
                </div>
                {d.payments.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {d.payments.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span>{p.date.toLocaleDateString("pt-BR")} — {p.method}</span>
                        <span className="text-success">-{formatBRL(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {d.paid < d.amount && (
                  <div className="flex gap-2 pt-1">
                    <Input type="number" inputMode="decimal" placeholder="Valor" value={selectedDebtorId === d.id ? debtPayAmount : ""}
                      onFocus={() => setSelectedDebtorId(d.id)}
                      onChange={(e) => { setSelectedDebtorId(d.id); setDebtPayAmount(e.target.value); }}
                      className="h-9 text-sm flex-1" />
                    <select value={selectedDebtorId === d.id ? debtPayMethod : "Dinheiro"}
                      onChange={(e) => { setSelectedDebtorId(d.id); setDebtPayMethod(e.target.value); }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs">
                      <option>Dinheiro</option><option>PIX</option><option>Crédito</option><option>Débito</option>
                    </select>
                    <Button size="sm" className="h-9" onClick={() => handlePayDebt(d.id)}>Pagar</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
