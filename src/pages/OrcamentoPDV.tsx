import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import { useProducts, type Client, type Operator } from "@/contexts/ProductContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Search, ShoppingCart, User, Lock, Fingerprint, Plus, Minus, Trash2,
  Tag, Percent, DollarSign, Users, FileText, Save, ArrowLeft, X, CheckCircle,
  ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";
import { isPlatformAuthAvailable, authenticateBiometric } from "@/lib/webauthn";
import { AnimatePresence, motion } from "framer-motion";

export default function OrcamentoPDV() {
  const { products, operators, clients } = useProducts();
  const { companyName } = useTenant();

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operatorNameInput, setOperatorNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Quote state
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState<{ id: string; nome: string } | null>(null);
  const [discount, setDiscount] = useState<{ type: "percent" | "value"; amount: number }>({ type: "percent", amount: 0 });
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  // UI state
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showVendedorPicker, setShowVendedorPicker] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<number | null>(null);

  useEffect(() => {
    isPlatformAuthAvailable().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  // Dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => { mq.removeEventListener("change", handler); document.documentElement.classList.remove("dark"); };
  }, []);

  // Load vendedores
  useEffect(() => {
    if (authed) {
      supabase.from("vendedores").select("id, nome, comissao").eq("ativo", true).then(({ data }) => {
        setVendedores(data || []);
      });
    }
  }, [authed]);

  const verifyOperatorViaEdge = async (operatorId: string, pin: string) => {
    const { data, error } = await supabase.functions.invoke("verify-operator", {
      body: { operator_id: operatorId, pin },
    });
    if (error) return { valid: false, error: "Erro de conexão" };
    return data as { valid: boolean; error?: string; operator?: any };
  };

  const verifyOperatorByName = async (name: string, pin: string) => {
    const { data, error } = await supabase.functions.invoke("verify-operator", {
      body: { operator_name: name, pin },
    });
    if (error) return { valid: false, error: "Erro de conexão" };
    return data as { valid: boolean; error?: string; operator?: any };
  };

  const handleLoginSubmit = async () => {
    if (!operatorNameInput.trim() || !pinInput) return;
    setLoginLoading(true);
    const result = await verifyOperatorByName(operatorNameInput.trim(), pinInput);
    if (result.valid && result.operator) {
      const op = operators.find(o => o.id === result.operator!.id);
      if (op) {
        setSelectedOperator(op);
        setAuthed(true);
        toast({ title: "Autenticado!", description: `Bem-vindo, ${op.nome}` });
      }
    } else {
      toast({ title: result.error || "Credenciais inválidas", variant: "destructive" });
      setPinInput("");
    }
    setLoginLoading(false);
  };

  const activeOperators = operators.filter(o => o.ativo);

  // Product filtering
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products.slice(0, 50);
    const q = debouncedSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    ).slice(0, 50);
  }, [debouncedSearch, products]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 20);
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.nome.toLowerCase().includes(q) || c.cpfCnpj.includes(q)).slice(0, 20);
  }, [clientSearch, clients]);

  // Cart operations
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? { ...i, quantity: 0 } : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmount = discount.type === "percent" ? subtotal * (discount.amount / 100) : discount.amount;
  const total = Math.max(0, subtotal - discountAmount);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  // Save quote
  const handleSaveQuote = async () => {
    if (cart.length === 0) {
      toast({ title: "Adicione itens ao orçamento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalClientName = selectedClient?.nome || clientName || null;
      const { data: tenantId } = await supabase.rpc("get_my_company_id");
      
      const { data: orc, error } = await supabase.from("orcamentos").insert({
        client_id: selectedClient?.id || null,
        client_name: finalClientName,
        vendedor_id: selectedVendedor?.id || null,
        vendedor_name: selectedVendedor?.nome || null,
        desconto_tipo: discount.type,
        desconto_valor: discount.amount,
        subtotal,
        total,
        observacoes,
        status: "rascunho",
        tenant_id: tenantId,
      } as any).select("id, numero").single();

      if (error) throw error;

      // Insert items
      const items = cart.map(i => ({
        orcamento_id: orc.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        desconto_tipo: "percent" as const,
        desconto_valor: 0,
        total: i.product.price * i.quantity,
        tenant_id: tenantId,
      }));

      await supabase.from("orcamento_items").insert(items as any);

      setSavedQuoteNumber(orc.numero);
      toast({ title: "Orçamento salvo!", description: `#${orc.numero} criado com sucesso.` });

      // Reset
      setCart([]);
      setSelectedClient(null);
      setClientName("");
      setSelectedVendedor(null);
      setDiscount({ type: "percent", amount: 0 });
      setObservacoes("");
      setShowCart(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    setCart([]);
    setSelectedClient(null);
    setClientName("");
    setSelectedVendedor(null);
    setDiscount({ type: "percent", amount: 0 });
    setObservacoes("");
    setSavedQuoteNumber(null);
  };

  // ─── Auth screen ───
  if (!authed) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-pos-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-6 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Orçamentos</h1>
            <p className="text-sm text-muted-foreground">Informe suas credenciais para acessar</p>
          </div>

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
                      const pinEl = document.getElementById("orc-pin-input");
                      pinEl?.focus();
                    }
                  }}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="orc-pin-input"
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
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setBiometricLoading(true);
                    try {
                      const result = await authenticateBiometric();
                      if (result.valid && result.operator) {
                        const op = operators.find(o => o.id === result.operator!.id);
                        if (op) {
                          setSelectedOperator(op);
                          setAuthed(true);
                          toast({ title: "Autenticado!", description: `Bem-vindo, ${result.operator.nome}` });
                        }
                      } else {
                        toast({ title: "Falha na biometria", description: result.error, variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Erro na biometria", variant: "destructive" });
                    } finally {
                      setBiometricLoading(false);
                    }
                  }}
                  disabled={biometricLoading}
                  className="w-full h-14 text-base gap-2 touch-manipulation"
                >
                  {biometricLoading ? <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /> : <Fingerprint className="h-5 w-5" />}
                  {biometricLoading ? "Verificando..." : "Entrar com Digital"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main UI ───
  return (
    <div className="flex flex-col h-[100dvh] bg-pos-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 h-12 bg-card border-b border-border shrink-0">
        <ClipboardList className="h-5 w-5 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate flex-1">Orçamento</span>
        <span className="text-xs text-muted-foreground truncate">{selectedOperator?.nome}</span>
        <Button variant="ghost" size="sm" onClick={() => { setAuthed(false); setAuthStep("operator"); clearAll(); }} className="text-xs text-muted-foreground">
          Sair
        </Button>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {savedQuoteNumber && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-success/10 border-b border-success/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm font-medium text-success">Orçamento #{savedQuoteNumber} salvo!</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSavedQuoteNumber(null)}><X className="h-4 w-4" /></Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar: client, vendedor, notes, discount */}
      <div className="flex gap-1.5 px-3 py-2 bg-card/50 border-b border-border overflow-x-auto shrink-0">
        <Button variant={selectedClient || clientName ? "default" : "outline"} size="sm" onClick={() => setShowClientPicker(true)}
          className="text-xs gap-1 shrink-0 touch-manipulation">
          <Users className="h-3.5 w-3.5" />
          {selectedClient?.nome || clientName || "Cliente"}
        </Button>
        <Button variant={selectedVendedor ? "default" : "outline"} size="sm" onClick={() => setShowVendedorPicker(true)}
          className="text-xs gap-1 shrink-0 touch-manipulation">
          <User className="h-3.5 w-3.5" />
          {selectedVendedor?.nome || "Vendedor"}
        </Button>
        <Button variant={discount.amount > 0 ? "default" : "outline"} size="sm" onClick={() => setShowDiscountDialog(true)}
          className="text-xs gap-1 shrink-0 touch-manipulation">
          <Tag className="h-3.5 w-3.5" />
          {discount.amount > 0 ? `${discount.type === "percent" ? `${discount.amount}%` : formatBRL(discount.amount)}` : "Desconto"}
        </Button>
        <Button variant={observacoes ? "default" : "outline"} size="sm" onClick={() => setShowNotesDialog(true)}
          className="text-xs gap-1 shrink-0 touch-manipulation">
          <FileText className="h-3.5 w-3.5" />
          Obs
        </Button>
      </div>

      {/* Product search + grid / Cart toggle on mobile */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Products panel */}
        <div className={`flex-1 flex flex-col overflow-hidden ${showCart ? "hidden sm:flex" : "flex"}`}>
          <div className="px-3 py-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto, SKU ou código..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10" autoFocus />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="flex flex-col p-3 rounded-lg border border-border bg-card hover:border-primary hover:shadow-sm transition-all touch-manipulation text-left active:scale-[0.98]">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-16 object-cover rounded mb-2" />
                  ) : (
                    <div className="w-full h-16 bg-muted rounded mb-2 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{p.name}</p>
                  <p className="text-sm font-bold text-primary mt-1 tabular-nums">{formatBRL(p.price)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Estoque: {p.stock}</p>
                </button>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mb-2" />
                <p className="text-sm">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className={`sm:w-80 md:w-96 flex flex-col bg-card border-l border-border overflow-hidden ${showCart ? "flex" : "hidden sm:flex"}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Itens ({totalItems})
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-destructive">Limpar</Button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Adicione produtos ao orçamento</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(item.product.price)} × {item.quantity} = {formatBRL(item.product.price * item.quantity)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.product.id, -1)} className="h-7 w-7 rounded border border-border flex items-center justify-center touch-manipulation hover:bg-secondary">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="h-7 w-7 rounded border border-border flex items-center justify-center touch-manipulation hover:bg-secondary">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(item.product.id)} className="h-7 w-7 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 touch-manipulation ml-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + Save */}
          {cart.length > 0 && (
            <div className="border-t border-border px-3 py-3 space-y-2 shrink-0 bg-card">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              {discount.amount > 0 && (
                <div className="flex justify-between text-xs text-destructive">
                  <span>Desconto {discount.type === "percent" ? `(${discount.amount}%)` : ""}</span>
                  <span className="tabular-nums">-{formatBRL(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border">
                <span>Total</span>
                <span className="tabular-nums">{formatBRL(total)}</span>
              </div>
              <Button onClick={handleSaveQuote} disabled={saving} className="w-full h-12 text-base touch-manipulation gap-2">
                {saving ? (
                  <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {saving ? "Salvando..." : "Salvar Orçamento"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile floating cart toggle */}
      <div className="sm:hidden fixed bottom-4 right-4 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button onClick={() => setShowCart(!showCart)}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center relative touch-manipulation active:scale-95 transition-transform">
          {showCart ? <ArrowLeft className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}
          {totalItems > 0 && !showCart && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* ─── Client Picker ─── */}
      <Dialog open={showClientPicker} onOpenChange={setShowClientPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Cliente</DialogTitle>
            <DialogDescription>Vincule um cliente ou digite um nome avulso</DialogDescription>
          </DialogHeader>
          <Input placeholder="Nome avulso (sem cadastro)..." value={clientName}
            onChange={e => { setClientName(e.target.value); setSelectedClient(null); }} className="h-10" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou selecione</span></div>
          </div>
          <Input placeholder="Buscar cliente cadastrado..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="h-10" />
          <div className="space-y-1 max-h-48 overflow-auto">
            {filteredClients.map(c => (
              <button key={c.id} onClick={() => { setSelectedClient(c); setClientName(""); setShowClientPicker(false); setClientSearch(""); }}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.cpfCnpj}</p>
                </div>
              </button>
            ))}
          </div>
          {clientName && (
            <DialogFooter>
              <Button onClick={() => { setSelectedClient(null); setShowClientPicker(false); }} className="touch-manipulation">
                Usar "{clientName}"
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Vendedor Picker ─── */}
      <Dialog open={showVendedorPicker} onOpenChange={setShowVendedorPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-auto">
            {vendedores.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum vendedor cadastrado.</p>}
            {vendedores.map(v => (
              <button key={v.id} onClick={() => { setSelectedVendedor({ id: v.id, nome: v.nome }); setShowVendedorPicker(false); }}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary transition-all touch-manipulation text-left">
                <p className="text-sm font-medium text-foreground">{v.nome}</p>
                <span className="text-xs text-muted-foreground">{v.comissao}%</span>
              </button>
            ))}
          </div>
          {selectedVendedor && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedVendedor(null); setShowVendedorPicker(false); }} className="touch-manipulation text-destructive">
                Remover Vendedor
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Discount Dialog ─── */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desconto Geral</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={discount.type === "percent" ? "default" : "outline"} onClick={() => setDiscount(d => ({ ...d, type: "percent" }))} className="flex-1 gap-1 touch-manipulation">
                <Percent className="h-4 w-4" /> Porcentagem
              </Button>
              <Button variant={discount.type === "value" ? "default" : "outline"} onClick={() => setDiscount(d => ({ ...d, type: "value" }))} className="flex-1 gap-1 touch-manipulation">
                <DollarSign className="h-4 w-4" /> Valor
              </Button>
            </div>
            <Input type="number" inputMode="decimal" placeholder={discount.type === "percent" ? "Ex: 10" : "Ex: 50.00"} value={discount.amount || ""}
              onChange={e => setDiscount(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))}
              className="h-12 text-lg text-center" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDiscount({ type: "percent", amount: 0 }); setShowDiscountDialog(false); }} className="touch-manipulation">Remover</Button>
            <Button onClick={() => setShowDiscountDialog(false)} className="touch-manipulation">Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Notes Dialog ─── */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Observações</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Observações do orçamento..." value={observacoes} onChange={e => setObservacoes(e.target.value)}
            rows={4} className="resize-none" />
          <DialogFooter>
            <Button onClick={() => setShowNotesDialog(false)} className="touch-manipulation">OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
