import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import { useProducts, type Client, type Operator, type Terminal } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RotateCcw, Users, CreditCard, Printer, User, Banknote, Lock, Monitor, Fingerprint, FileText } from "lucide-react";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import type { ParkedSale } from "@/components/pdv/types";
import { usePDVShortcuts } from "@/hooks/usePDVShortcuts";
import { printReceipt } from "@/components/pdv/ReceiptPrint";
import { isPlatformAuthAvailable, authenticateBiometric } from "@/lib/webauthn";
import WeightCaptureDialog from "@/components/pdv/WeightCaptureDialog";
import { ScaleProvider } from "@/contexts/ScaleContext";

function PDVInner() {
  const { products, sellProducts, cancelSale, clients, createDebt, debts, payDebt, sales, cashRegister, openCashRegister, operators, terminals, addActionLog } = useProducts();

  // Setup state — operator name + PIN + terminal + opening balance
  const [setupStep, setSetupStep] = useState<"login" | "terminal" | "balance" | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [operatorNameInput, setOperatorNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [setupBalance, setSetupBalance] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    if (!cashRegister) setSetupStep("login");
    isPlatformAuthAvailable().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    if (!cashRegister && setupStep === null) {
      setSetupStep("login");
      setSelectedOperator(null);
      setSelectedTerminal(null);
      setOperatorNameInput("");
      setPinInput("");
      setSetupBalance("");
    }
  }, [cashRegister]);

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const result = await authenticateBiometric();
      if (result.valid && result.operator) {
        const op = operators.find(o => o.id === result.operator!.id);
        if (op && result.operator.permissions?.abrirCaixa) {
          setSelectedOperator(op);
          setSetupStep("terminal");
          toast({ title: "Autenticado!", description: `Bem-vindo, ${result.operator.nome}` });
        } else if (op && !result.operator.permissions?.abrirCaixa) {
          toast({ title: "Sem permissão", description: "Este operador não tem permissão para abrir caixa.", variant: "destructive" });
        } else {
          toast({ title: "Operador não encontrado", variant: "destructive" });
        }
      } else {
        toast({ title: "Falha na biometria", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na biometria", variant: "destructive" });
    } finally {
      setBiometricLoading(false);
    }
  };

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
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [authorizedQuotes, setAuthorizedQuotes] = useState<any[]>([]);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);

  // PIN authorization state for cancellations
  const [authDialog, setAuthDialog] = useState<{ type: "cancelarItem" | "cancelarCupom"; itemId?: string } | null>(null);
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");

  const verifyOperatorViaEdge = async (operatorId: string, pin: string, requiredPermission?: string) => {
    const { data, error } = await supabase.functions.invoke("verify-operator", {
      body: { operator_id: operatorId, pin, required_permission: requiredPermission },
    });
    if (error) return { valid: false, error: "Erro de conexão" };
    return data as { valid: boolean; error?: string; operator?: { id: string; nome: string }; hasPermission?: boolean };
  };

  const verifyOperatorByName = async (name: string, pin: string, requiredPermission?: string) => {
    const { data, error } = await supabase.functions.invoke("verify-operator", {
      body: { operator_name: name, pin, required_permission: requiredPermission },
    });
    if (error) return { valid: false, error: "Erro de conexão" };
    return data as { valid: boolean; error?: string; operator?: { id: string; nome: string }; hasPermission?: boolean };
  };

  const handleLoginSubmit = async () => {
    if (!operatorNameInput.trim() || !pinInput) return;
    setLoginLoading(true);
    const result = await verifyOperatorByName(operatorNameInput.trim(), pinInput, "abrirCaixa");
    if (result.valid && result.hasPermission && result.operator) {
      const op = operators.find(o => o.id === result.operator!.id);
      if (op) {
        setSelectedOperator(op);
        setSetupStep("terminal");
        toast({ title: "Autenticado!", description: `Bem-vindo, ${op.nome}` });
      }
    } else {
      toast({ title: result.error || "Credenciais inválidas", variant: "destructive" });
      setPinInput("");
    }
    setLoginLoading(false);
  };

  const requestAuth = (type: "cancelarItem" | "cancelarCupom", itemId?: string) => {
    // For current operator, verify permission server-side
    if (currentOperator) {
      // We still show auth dialog - permission will be verified server-side
      setAuthDialog({ type, itemId });
      setAuthPin("");
      setAuthError("");
      return;
    }
    setAuthDialog({ type, itemId });
    setAuthPin("");
    setAuthError("");
  };

  const [authValidating, setAuthValidating] = useState(false);

  const validateAuth = async () => {
    if (!authDialog) return;
    setAuthValidating(true);
    try {
      // Try each active operator - permission check happens server-side
      for (const op of operators.filter(o => o.ativo)) {
        const result = await verifyOperatorViaEdge(op.id, authPin, authDialog.type);
        if (result.valid && result.hasPermission) {
          const authorizer: Operator = { id: op.id, nome: result.operator?.nome || op.nome, pin: "", ativo: true, permissions: { abrirCaixa: true, cancelarItem: authDialog.type === "cancelarItem", cancelarCupom: authDialog.type === "cancelarCupom" } };
          if (authDialog.type === "cancelarItem" && authDialog.itemId) {
            executeRemoveItem(authDialog.itemId, authorizer);
          } else if (authDialog.type === "cancelarCupom") {
            executeCancelSale(authorizer);
          }
          setAuthDialog(null);
          return;
        }
      }
      setAuthError("PIN inválido ou operador sem permissão");
      setAuthPin("");
    } finally {
      setAuthValidating(false);
    }
  };

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Sem estoque", description: `${product.name} está sem estoque (0 un).`, variant: "destructive" });
      return;
    }
    // If product is sold by weight (KG), show weight capture dialog
    if (product.unidade?.toUpperCase() === "KG") {
      setWeightProduct(product);
      return;
    }
    addToCartWithQty(product, 1);
  }, []);

  const addToCartWithQty = useCallback((product: Product, qty: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const newQty = product.unidade?.toUpperCase() === "KG" ? existing.quantity + qty : existing.quantity + qty;
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: newQty } : i);
      }
      return [...prev, { product, quantity: qty, discount: 0 }];
    });
  }, []);

  const handleWeightConfirm = useCallback((product: Product, value: number, isUnit?: boolean) => {
    addToCartWithQty(product, value);
    setWeightProduct(null);
    if (isUnit) {
      toast({ title: "Produto adicionado", description: `${product.name}: ${value} un — ${formatBRL(value * product.price)}` });
    } else {
      toast({ title: "Produto pesado adicionado", description: `${product.name}: ${value.toFixed(3)} kg — ${formatBRL(value * product.price)}` });
    }
  }, [addToCartWithQty]);

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
      // Fiado: always 2 copies (Loja + Cliente) with client and operator names
      printReceipt(saleRecord, "venda", 2);
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

  // ─── Load authorized quotes ───
  const loadAuthorizedQuotes = async () => {
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("autorizado", true)
      .neq("status", "convertido")
      .order("created_at", { ascending: false });
    setAuthorizedQuotes(data || []);
    setQuoteSearch("");
    setShowQuotePicker(true);
  };

  const loadQuoteIntoCart = async (quote: any) => {
    const { data: items } = await supabase
      .from("orcamento_items")
      .select("*")
      .eq("orcamento_id", quote.id);
    if (!items || items.length === 0) {
      toast({ title: "Orçamento vazio", variant: "destructive" });
      return;
    }
    // Map quote items to cart items
    const cartItems: CartItem[] = [];
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        cartItems.push({ product, quantity: item.quantity, discount: 0 });
      }
    }
    if (cartItems.length === 0) {
      toast({ title: "Produtos não encontrados no cadastro", variant: "destructive" });
      return;
    }
    setCart(cartItems);
    // Apply general discount from quote
    if (quote.desconto_valor > 0) {
      setDiscount({ type: quote.desconto_tipo === "percent" ? "percent" : "value", amount: quote.desconto_valor });
    }
    // Set client if exists
    if (quote.client_id) {
      const client = clients.find(c => c.id === quote.client_id);
      if (client) setSelectedClient(client);
    }
    // Mark quote as converted
    await supabase.from("orcamentos").update({ status: "convertido" }).eq("id", quote.id);
    setShowQuotePicker(false);
    toast({ title: "Orçamento carregado", description: `#${quote.numero} — ${cartItems.length} itens adicionados ao carrinho.` });
  };

  const filteredQuotes = useMemo(() => {
    if (!quoteSearch) return authorizedQuotes;
    const q = quoteSearch.toLowerCase();
    return authorizedQuotes.filter(
      (o: any) => String(o.numero).includes(q) || (o.client_name || "").toLowerCase().includes(q)
    );
  }, [quoteSearch, authorizedQuotes]);

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
    onCloseCashRegister: () => { if (cashRegister) window.dispatchEvent(new CustomEvent("pdv:close-cash-register")); },
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

   if (setupStep) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-pos-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              {setupStep === "login" ? <Lock className="h-8 w-8 text-primary" /> : setupStep === "terminal" ? <Monitor className="h-8 w-8 text-primary" /> : <Banknote className="h-8 w-8 text-primary" />}
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {setupStep === "login" ? "Acesso ao PDV" : setupStep === "terminal" ? "Selecione o Terminal" : "Fundo de Caixa"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {setupStep === "login" ? "Informe suas credenciais para iniciar" : setupStep === "terminal" ? `Operador: ${selectedOperator?.nome}` : `${selectedOperator?.nome} • ${selectedTerminal?.nome}`}
            </p>
          </div>

          {setupStep === "login" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome do operador"
                    value={operatorNameInput}
                    onChange={(e) => setOperatorNameInput(e.target.value)}
                    className="h-14 pl-10 text-base"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const pinEl = document.getElementById("pdv-pin-input");
                        pinEl?.focus();
                      }
                    }}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pdv-pin-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="PIN de acesso"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    className="h-14 pl-10 text-2xl text-center tracking-[0.5em]"
                    onKeyDown={(e) => { if (e.key === "Enter") handleLoginSubmit(); }}
                  />
                </div>
              </div>
              <Button
                onClick={handleLoginSubmit}
                disabled={loginLoading || !operatorNameInput.trim() || !pinInput}
                className="w-full h-14 text-base touch-manipulation"
              >
                {loginLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                ) : "Entrar"}
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
                    onClick={handleBiometricLogin}
                    disabled={biometricLoading}
                    className="w-full h-14 text-base gap-2 touch-manipulation"
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
              <Button variant="outline" onClick={() => { setSetupStep("login"); setSelectedOperator(null); setOperatorNameInput(""); setPinInput(""); }} className="w-full h-12 touch-manipulation mt-2">Voltar</Button>
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
        onOpenQuotes={loadAuthorizedQuotes}
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

      {/* Quote Picker Dialog */}
      <Dialog open={showQuotePicker} onOpenChange={setShowQuotePicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Orçamentos Autorizados
            </DialogTitle>
            <DialogDescription>Selecione um orçamento para carregar no caixa</DialogDescription>
          </DialogHeader>
          <Input placeholder="Buscar por número ou cliente..." value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} className="h-10" autoFocus />
          <div className="space-y-2 max-h-60 overflow-auto">
            {filteredQuotes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum orçamento autorizado disponível.</p>}
            {filteredQuotes.map((q: any) => (
              <button key={q.id} onClick={() => loadQuoteIntoCart(q)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                <div>
                  <p className="text-sm font-medium text-foreground">#{q.numero} — {q.client_name || "Avulso"}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.vendedor_name ? `Vendedor: ${q.vendedor_name} • ` : ""}
                    Validade: {new Date(q.validade).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground">{formatBRL(q.total)}</span>
              </button>
            ))}
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
              {authDialog?.type === "cancelarItem" ? "Cancelamento de item" : "Cancelamento de cupom"} requer autorização de um operador.
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
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAuthDialog(null)} className="touch-manipulation">Cancelar</Button>
            {biometricAvailable && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!authDialog) return;
                  setBiometricLoading(true);
                  try {
                    const result = await authenticateBiometric();
                    if (result.valid && result.operator) {
                      const permKey = authDialog.type === "cancelarItem" ? "cancelarItem" : "cancelarCupom";
                      if (result.operator.permissions?.[permKey]) {
                        const authorizer: Operator = { id: result.operator.id, nome: result.operator.nome, pin: "", ativo: true, permissions: result.operator.permissions as any };
                        if (authDialog.type === "cancelarItem" && authDialog.itemId) {
                          executeRemoveItem(authDialog.itemId, authorizer);
                        } else if (authDialog.type === "cancelarCupom") {
                          executeCancelSale(authorizer);
                        }
                        setAuthDialog(null);
                      } else {
                        setAuthError("Operador sem permissão para esta ação");
                      }
                    } else {
                      setAuthError(result.error || "Falha na biometria");
                    }
                  } finally {
                    setBiometricLoading(false);
                  }
                }}
                disabled={biometricLoading}
                className="touch-manipulation gap-1"
              >
                {biometricLoading ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> : <Fingerprint className="h-4 w-4" />}
                Digital
              </Button>
            )}
            <Button variant="destructive" onClick={validateAuth} disabled={!authPin || authValidating} className="touch-manipulation">{authValidating ? "Verificando..." : "Autorizar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Capture Dialog */}
      <WeightCaptureDialog
        open={!!weightProduct}
        product={weightProduct}
        onConfirm={handleWeightConfirm}
        onCancel={() => setWeightProduct(null)}
      />
    </div>
  );
}

export default function PDV() {
  return (
    <ScaleProvider>
      <PDVInner />
    </ScaleProvider>
  );
}
