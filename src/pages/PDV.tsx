import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import { useProducts, type Client, type Operator, type Terminal } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RotateCcw, Users, CreditCard, Printer, User, Banknote, Lock, Monitor } from "lucide-react";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import type { ParkedSale } from "@/components/pdv/types";
import { usePDVShortcuts } from "@/hooks/usePDVShortcuts";
import { printReceipt } from "@/components/pdv/ReceiptPrint";

export default function PDV() {
  const { products, sellProducts, cancelSale, clients, createDebt, debts, payDebt, sales, cashRegister, openCashRegister, operators, terminals, addActionLog } = useProducts();

  // Setup state — operator selection + PIN + terminal + opening balance
  const [setupStep, setSetupStep] = useState<"operator" | "pin" | "terminal" | "balance" | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [setupBalance, setSetupBalance] = useState("");

  useEffect(() => {
    if (!cashRegister) setSetupStep("operator");
  }, []);

  useEffect(() => {
    if (!cashRegister && setupStep === null) {
      setSetupStep("operator");
      setSelectedOperator(null);
      setSelectedTerminal(null);
      setPinInput("");
      setSetupBalance("");
    }
  }, [cashRegister]);

  // Auto dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => { mq.removeEventListener("change", handler); document.documentElement.classList.remove("dark"); };
  }, []);

  const currentOperator = selectedOperator || (cashRegister ? operators.find(o => o.id === cashRegister.operatorId) : null);
  const currentTerminal = selectedTerminal || (cashRegister ? terminals.find(t => t.id === cashRegister.terminalId) : null);

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
  const [showDebtors, setShowDebtors] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [debtPayMethod, setDebtPayMethod] = useState("Dinheiro");

  // PIN authorization state for cancellations
  const [authDialog, setAuthDialog] = useState<{ type: "cancelarItem" | "cancelarCupom"; itemId?: string } | null>(null);
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");

  const requestAuth = (type: "cancelarItem" | "cancelarCupom", itemId?: string) => {
    // Check if current operator already has the permission
    if (currentOperator?.permissions[type]) {
      if (type === "cancelarItem" && itemId) executeRemoveItem(itemId, currentOperator);
      else if (type === "cancelarCupom") executeCancelSale(currentOperator);
      return;
    }
    setAuthDialog({ type, itemId });
    setAuthPin("");
    setAuthError("");
  };

  const validateAuth = async () => {
    if (!authDialog) return;
    // Try each active operator with the required permission via server-side RPC
    for (const op of operators.filter(o => o.ativo && o.permissions[authDialog.type])) {
      const { data: valid } = await supabase.rpc("verify_operator_pin", { p_operator_id: op.id, p_pin: authPin });
      if (valid) {
        if (authDialog.type === "cancelarItem" && authDialog.itemId) {
          executeRemoveItem(authDialog.itemId, op);
        } else if (authDialog.type === "cancelarCupom") {
          executeCancelSale(op);
        }
        setAuthDialog(null);
        return;
      }
    }
    setAuthError("PIN inválido ou operador sem permissão");
    setAuthPin("");
    setAuthPin("");
  };

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

  const executeRemoveItem = (id: string, authorizer: Operator) => {
    const item = cart.find(i => i.product.id === id);
    if (item && currentTerminal) {
      addActionLog({
        type: "cancelamento_item", operatorId: currentOperator?.id || authorizer.id, operatorName: currentOperator?.nome || authorizer.nome,
        terminalId: currentTerminal.id, terminalName: currentTerminal.nome,
        description: `Item removido: ${item.product.name} (${item.quantity}x)${authorizer.id !== currentOperator?.id ? ` • Autorizado por: ${authorizer.nome}` : ""}`,
        amount: item.product.price * item.quantity,
      });
    }
    setCart((prev) => prev.filter((i) => i.product.id !== id));
    toast({ title: "Item removido", description: `${item?.product.name} removido do carrinho.` });
  };

  const removeItem = useCallback((id: string) => {
    requestAuth("cancelarItem", id);
  }, [currentOperator, currentTerminal, cart, operators]);

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

  const finalizeSale = async (methods: { method: string; amount: number }[]) => {
    const isPedido = methods.some((m) => m.method === "Pedido (Fiado)");

    if (isPedido && selectedClient) {
      const debtId = await createDebt(selectedClient.id, total);
      if (!debtId) {
        toast({ title: "Crédito insuficiente", description: `${selectedClient.nome} não tem crédito disponível suficiente.`, variant: "destructive" });
        return;
      }
    }

    const items = cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }));
    const saleId = await sellProducts(items, methods, selectedClient?.id, currentTerminal?.id, currentOperator?.id);
    setLastSaleId(saleId);

    const saleRecord = {
      id: saleId,
      items: cart.map(i => ({ productId: i.product.id, productName: i.product.name, quantity: i.quantity, price: i.product.price })),
      total, methods,
      clientId: selectedClient?.id, clientName: selectedClient?.nome,
      terminalId: currentTerminal?.id, terminalName: currentTerminal?.nome,
      operatorId: currentOperator?.id, operatorName: currentOperator?.nome,
      date: new Date(),
    };
    setLastSaleRecord(saleRecord);

    // Log
    if (currentOperator && currentTerminal) {
      await addActionLog({
        type: "venda", operatorId: currentOperator.id, operatorName: currentOperator.nome,
        terminalId: currentTerminal.id, terminalName: currentTerminal.nome,
        description: `Venda #${saleId.slice(0, 8)} • ${totalItems} itens • ${methods.map(m => m.method).join("+")}`,
        amount: total, saleId,
      });
    }

    const methodStr = methods.map((m) => m.method).join(" + ");
    toast({ title: "Venda finalizada!", description: `${totalItems} itens — ${formatBRL(total)} via ${methodStr}.` });

    if (isPedido) {
      setShowReceiptOptions(true);
    } else {
      printReceipt(saleRecord, "venda", 1);
    }

    clearCart();
  };

  const executeCancelSale = (authorizer: Operator) => {
    if (lastSaleId) {
      cancelSale(lastSaleId);
      if (currentTerminal) {
        addActionLog({
          type: "cancelamento_cupom", operatorId: currentOperator?.id || authorizer.id, operatorName: currentOperator?.nome || authorizer.nome,
          terminalId: currentTerminal.id, terminalName: currentTerminal.nome,
          description: `Cupom cancelado #${lastSaleId.slice(0, 8)}${authorizer.id !== currentOperator?.id ? ` • Autorizado por: ${authorizer.nome}` : ""}`,
          saleId: lastSaleId,
        });
      }
      toast({ title: "Venda cancelada", description: "Estoque restaurado." });
      setLastSaleId(null);
    }
    setCancelDialogOpen(false);
  };

  const handleCancelSale = () => {
    setCancelDialogOpen(false);
    requestAuth("cancelarCupom");
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

  const activeOperators = operators.filter(o => o.ativo && o.permissions.abrirCaixa);
  const activeTerminals = terminals.filter(t => t.ativo);

  const handleOpenCashRegister = () => {
    if (selectedOperator && selectedTerminal) {
      const balance = parseFloat(setupBalance) || 0;
      openCashRegister(balance, selectedOperator.id, selectedTerminal.id);
      addActionLog({
        type: "abertura_caixa", operatorId: selectedOperator.id, operatorName: selectedOperator.nome,
        terminalId: selectedTerminal.id, terminalName: selectedTerminal.nome,
        description: `Caixa aberto com fundo de ${formatBRL(balance)}`, amount: balance,
      });
      setSetupStep(null);
      toast({ title: "Caixa aberto!", description: `${selectedOperator.nome} • ${selectedTerminal.nome} • Fundo: ${formatBRL(balance)}` });
    }
  };

  // Mandatory setup screen
  if (setupStep) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-pos-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              {setupStep === "operator" ? <User className="h-8 w-8 text-primary" /> : setupStep === "pin" ? <Lock className="h-8 w-8 text-primary" /> : setupStep === "terminal" ? <Monitor className="h-8 w-8 text-primary" /> : <Banknote className="h-8 w-8 text-primary" />}
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {setupStep === "operator" ? "Selecione o Operador" : setupStep === "pin" ? "PIN de Acesso" : setupStep === "terminal" ? "Selecione o Terminal" : "Fundo de Caixa"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {setupStep === "operator" ? "Escolha seu operador para iniciar" : setupStep === "pin" ? `Operador: ${selectedOperator?.nome}` : setupStep === "terminal" ? `Operador: ${selectedOperator?.nome}` : `${selectedOperator?.nome} • ${selectedTerminal?.nome}`}
            </p>
          </div>

          {setupStep === "operator" ? (
            <div className="space-y-2">
              {activeOperators.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum operador cadastrado com permissão de caixa. Cadastre em Configurações &gt; Usuários.</p>
              ) : (
                activeOperators.map((op) => (
                  <button key={op.id} onClick={() => { setSelectedOperator(op); setPinInput(""); setSetupStep("pin"); }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{op.nome}</p>
                      <div className="flex gap-1 mt-0.5">
                        {op.permissions.cancelarItem && <span className="text-[10px] bg-warning/10 text-warning px-1 py-0.5 rounded">Cancel. Item</span>}
                        {op.permissions.cancelarCupom && <span className="text-[10px] bg-destructive/10 text-destructive px-1 py-0.5 rounded">Cancel. Cupom</span>}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : setupStep === "pin" ? (
            <div className="space-y-4">
              <Input type="password" inputMode="numeric" maxLength={6} placeholder="Digite o PIN" value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-2xl text-center tracking-[0.5em]" autoFocus
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && pinInput && selectedOperator) {
                    const { data: valid } = await supabase.rpc("verify_operator_pin", { p_operator_id: selectedOperator.id, p_pin: pinInput });
                    if (valid) setSetupStep("terminal");
                    else { toast({ title: "PIN incorreto", variant: "destructive" }); setPinInput(""); }
                  }
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setSetupStep("operator"); setSelectedOperator(null); }} className="h-14 touch-manipulation">Voltar</Button>
                <Button onClick={async () => {
                  if (!selectedOperator || !pinInput) return;
                  const { data: valid } = await supabase.rpc("verify_operator_pin", { p_operator_id: selectedOperator.id, p_pin: pinInput });
                  if (valid) setSetupStep("terminal");
                  else { toast({ title: "PIN incorreto", variant: "destructive" }); setPinInput(""); }
                }} disabled={!pinInput} className="flex-1 h-14 text-base touch-manipulation">Confirmar</Button>
              </div>
            </div>
          ) : setupStep === "terminal" ? (
            <div className="space-y-2">
              {activeTerminals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum terminal cadastrado. Cadastre em Configurações &gt; Terminais.</p>
              ) : (
                activeTerminals.map((t) => (
                  <button key={t.id} onClick={() => { setSelectedTerminal(t); setSetupStep("balance"); }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{t.nome}</p>
                  </button>
                ))
              )}
              <Button variant="outline" onClick={() => setSetupStep("pin")} className="w-full h-12 touch-manipulation mt-2">Voltar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input type="number" inputMode="decimal" placeholder="Valor inicial em dinheiro (R$)" value={setupBalance}
                onChange={(e) => setSetupBalance(e.target.value)} className="h-14 text-lg text-center" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleOpenCashRegister(); }}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSetupStep("terminal")} className="h-14 touch-manipulation">Voltar</Button>
                <Button onClick={handleOpenCashRegister} className="flex-1 h-14 text-base touch-manipulation">Abrir Caixa</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row h-[100dvh] bg-pos-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <ProductGrid
        products={products} search={search} setSearch={setSearch} onAddToCart={addToCart}
        lastSaleId={lastSaleId} onCancelLastSale={() => setCancelDialogOpen(true)}
        selectedClient={selectedClient} onSelectClient={() => setShowClientPicker(true)}
        onClearClient={() => setSelectedClient(null)} onOpenDebtors={() => setShowDebtors(true)}
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

      {/* Debtors Dialog */}
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

      {/* Receipt Options Dialog (Fiado) */}
      <Dialog open={showReceiptOptions} onOpenChange={setShowReceiptOptions}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Imprimir Cupom do Pedido</DialogTitle>
            <DialogDescription>Escolha quantas vias imprimir</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button onClick={() => { if (lastSaleRecord) printReceipt(lastSaleRecord, "venda", 1); setShowReceiptOptions(false); }} className="w-full h-12 touch-manipulation">
              <Printer className="h-4 w-4 mr-2" /> 1 Via (Loja)
            </Button>
            <Button variant="outline" onClick={() => { if (lastSaleRecord) printReceipt(lastSaleRecord, "venda", 2); setShowReceiptOptions(false); }} className="w-full h-12 touch-manipulation">
              <Printer className="h-4 w-4 mr-2" /> 2 Vias (Loja + Cliente)
            </Button>
            <Button variant="ghost" onClick={() => setShowReceiptOptions(false)} className="w-full touch-manipulation text-xs">
              Não imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Authorization Dialog */}
      <Dialog open={!!authDialog} onOpenChange={() => setAuthDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Autorização Necessária
            </DialogTitle>
            <DialogDescription>
              {authDialog?.type === "cancelarItem" ? "Cancelamento de item" : "Cancelamento de cupom"} requer PIN de um operador autorizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password" inputMode="numeric" maxLength={6}
              placeholder="PIN do autorizador"
              value={authPin}
              onChange={(e) => { setAuthPin(e.target.value.replace(/\D/g, "")); setAuthError(""); }}
              className="h-14 text-2xl text-center tracking-[0.5em]"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && authPin) validateAuth(); }}
            />
            {authError && <p className="text-xs text-destructive text-center">{authError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAuthDialog(null)} className="touch-manipulation">Cancelar</Button>
            <Button variant="destructive" onClick={validateAuth} disabled={!authPin} className="touch-manipulation">Autorizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
