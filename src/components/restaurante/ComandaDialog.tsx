import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Plus, Minus, Trash2, Loader2, Receipt, Clock, CheckCircle2,
  Banknote, QrCode, CreditCard, Smartphone, MessageSquarePlus, ChevronLeft,
  Users, Printer, Percent, Coins, AlertTriangle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, type Product } from "@/contexts/ProductContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { printPreConta } from "./PreContaPrint";
import { loadRestaurantSettings, DEFAULT_RESTAURANT_SETTINGS } from "@/components/config/RestauranteConfig";

const sb = supabase as any;

export interface ComandaTable {
  id: string;
  numero: number;
  nome: string | null;
  status: "livre" | "ocupada" | "reservada" | "aguardando_pagamento";
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  observacao: string | null;
}

interface Order {
  id: string;
  table_id: string;
  status: "aberta" | "aguardando_pagamento" | "fechada";
  created_at: string;
}

const PAY_METHODS = [
  { key: "Dinheiro", icon: Banknote },
  { key: "PIX", icon: QrCode },
  { key: "Crédito", icon: CreditCard },
  { key: "Débito", icon: Smartphone },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: ComandaTable | null;
  operatorId?: string;
  operatorName?: string;
  onTableStatusChange: (
    tableId: string,
    status: "livre" | "ocupada" | "aguardando_pagamento"
  ) => void;
}

export default function ComandaDialog({
  open, onOpenChange, table, operatorId, operatorName, onTableStatusChange,
}: Props) {
  const { tenantId } = useTenant();
  const { products, sellProducts } = useProducts();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [obsEditing, setObsEditing] = useState<string | null>(null);
  const [obsDraft, setObsDraft] = useState("");
  const [view, setView] = useState<"comanda" | "pagamento">("comanda");
  const [payments, setPayments] = useState<{ id: string; method: string; amount: number }[]>([]);
  const [partial, setPartial] = useState("");
  const [closing, setClosing] = useState(false);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [splitCount, setSplitCount] = useState(1);
  const [splitAssignments, setSplitAssignments] = useState<Record<string, Record<number, number>>>({});
  const [personNames, setPersonNames] = useState<string[]>([]);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePct, setServiceFeePct] = useState(10);
  const [couvertEnabled, setCouvertEnabled] = useState(false);
  const [couvertAmount, setCouvertAmount] = useState(0);

  const productsSubtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  );
  const feePct = serviceFeeEnabled ? Math.max(0, serviceFeePct) : 0;
  const feeAmount = productsSubtotal * (feePct / 100);
  // Couvert is per-person; if no split, count as 1 person
  const peopleForCouvert = Math.max(1, splitCount);
  const couvertPerPerson = couvertEnabled ? Math.max(0, couvertAmount) : 0;
  const couvertTotal = couvertPerPerson * peopleForCouvert;
  // "subtotal" = consumption + couvert (service fee applies only to products)
  const subtotal = productsSubtotal + couvertTotal;
  const total = subtotal + feeAmount;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const perPerson = splitCount > 1 ? total / splitCount : total;
  const personNameAt = (idx: number) =>
    (personNames[idx]?.trim() || `Pessoa ${idx + 1}`);
  const setPersonNameAt = (idx: number, name: string) =>
    setPersonNames((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push("");
      next[idx] = name;
      return next;
    });

  // Per-person totals for "custom" mode.
  // Each person pays: (assigned items + share of unassigned items) × (1 + fee%) + couvert.
  // Service fee applies only to consumption (not to couvert).
  const customPerPerson = useMemo(() => {
    if (splitMode !== "custom" || splitCount <= 1) return [];
    const consumed = Array.from({ length: splitCount }, () => 0);
    let sharedSub = 0;
    items.forEach((it) => {
      const a = splitAssignments[it.id] || {};
      let assigned = 0;
      for (let p = 0; p < splitCount; p++) {
        const q = Math.max(0, Math.floor(a[p] || 0));
        if (q > 0) {
          consumed[p] += q * it.price;
          assigned += q;
        }
      }
      const remainQty = Math.max(0, it.quantity - assigned);
      if (remainQty > 0) sharedSub += remainQty * it.price;
    });
    if (sharedSub > 0) {
      const share = sharedSub / splitCount;
      for (let p = 0; p < splitCount; p++) consumed[p] += share;
    }
    return consumed.map((c) => c * (1 + feePct / 100) + couvertPerPerson);
  }, [splitMode, splitCount, items, splitAssignments, feePct, couvertPerPerson]);

  const assignedQty = (itemId: string) =>
    Object.values(splitAssignments[itemId] || {}).reduce(
      (s, q) => s + Math.max(0, Math.floor(q || 0)),
      0
    );

  const setAssignment = (itemId: string, person: number, qty: number) => {
    setSplitAssignments((prev) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return prev;
      const cur = { ...(prev[itemId] || {}) };
      const others = Object.entries(cur).reduce(
        (s, [k, v]) => (parseInt(k, 10) === person ? s : s + Math.max(0, Math.floor(v || 0))),
        0
      );
      const maxForThis = Math.max(0, item.quantity - others);
      const next = Math.max(0, Math.min(maxForThis, Math.floor(qty)));
      const newCur = { ...cur };
      if (next === 0) delete newCur[person];
      else newCur[person] = next;
      return { ...prev, [itemId]: newCur };
    });
  };

  // Load or create the order when dialog opens
  const loadOrCreateOrder = useCallback(async () => {
    if (!table || !tenantId) return;
    setLoading(true);
    // Try to find existing open order
    const { data: existing, error: e1 } = await sb
      .from("restaurant_orders")
      .select("*")
      .eq("table_id", table.id)
      .in("status", ["aberta", "aguardando_pagamento"])
      .maybeSingle();
    if (e1) {
      toast({ title: "Erro ao carregar comanda", description: e1.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    let ord: Order | null = existing as Order | null;
    if (!ord) {
      const { data: created, error: e2 } = await sb
        .from("restaurant_orders")
        .insert({ table_id: table.id, tenant_id: tenantId, status: "aberta", operator_id: operatorId ?? null })
        .select()
        .single();
      if (e2) {
        toast({ title: "Erro ao abrir comanda", description: e2.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      ord = created as Order;
      // mark table as occupied
      onTableStatusChange(table.id, "ocupada");
    }
    setOrder(ord);

    // Load items
    const { data: itemsData, error: e3 } = await sb
      .from("restaurant_order_items")
      .select("*")
      .eq("order_id", ord!.id)
      .order("created_at", { ascending: true });
    if (e3) {
      toast({ title: "Erro ao carregar itens", description: e3.message, variant: "destructive" });
    } else {
      setItems((itemsData || []) as OrderItem[]);
    }
    setLoading(false);
  }, [table, tenantId, operatorId, onTableStatusChange]);

  useEffect(() => {
    if (open && table) {
      setView("comanda");
      setSearch("");
      setObsEditing(null);
      setObsDraft("");
      setPayments([]);
      setPartial("");
      setSplitCount(1);
      setSplitMode("equal");
      setSplitAssignments({});
      setPersonNames([]);
      // Provisionally apply defaults; refined after settings load
      setServiceFeeEnabled(DEFAULT_RESTAURANT_SETTINGS.service_fee_enabled);
      setServiceFeePct(DEFAULT_RESTAURANT_SETTINGS.service_fee_pct);
      setCouvertEnabled(DEFAULT_RESTAURANT_SETTINGS.couvert_enabled);
      setCouvertAmount(DEFAULT_RESTAURANT_SETTINGS.couvert_amount);
      // Load tenant restaurant settings (taxa de serviço + couvert padrões)
      if (tenantId) {
        loadRestaurantSettings(tenantId).then((s) => {
          setServiceFeeEnabled(s.service_fee_enabled);
          setServiceFeePct(s.service_fee_pct);
          setCouvertEnabled(s.couvert_enabled);
          setCouvertAmount(s.couvert_amount);
        });
      }
      loadOrCreateOrder();
    } else {
      setOrder(null);
      setItems([]);
    }
  }, [open, table, tenantId, loadOrCreateOrder]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [products, search]);

  const addProduct = async (p: Product) => {
    if (!order || !tenantId) return;
    // If product already in order, increment quantity
    const existing = items.find((i) => i.product_id === p.id && !i.observacao);
    if (existing) {
      return updateQty(existing, existing.quantity + 1);
    }
    const { data, error } = await sb
      .from("restaurant_order_items")
      .insert({
        order_id: order.id,
        tenant_id: tenantId,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: 1,
        observacao: null,
      })
      .select()
      .single();
    if (error) return toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    setItems((prev) => [...prev, data as OrderItem]);
  };

  const updateQty = async (item: OrderItem, qty: number) => {
    if (qty < 1) return removeItem(item);
    const { error } = await sb
      .from("restaurant_order_items")
      .update({ quantity: qty })
      .eq("id", item.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: qty } : i)));
  };

  const removeItem = async (item: OrderItem) => {
    const { error } = await sb.from("restaurant_order_items").delete().eq("id", item.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const saveObs = async (item: OrderItem) => {
    const obs = obsDraft.trim() || null;
    const { error } = await sb
      .from("restaurant_order_items")
      .update({ observacao: obs })
      .eq("id", item.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, observacao: obs } : i)));
    setObsEditing(null);
    setObsDraft("");
  };

  const printNow = (overrideMode?: "none" | "equal" | "custom") => {
    if (!table || items.length === 0) return;
    const mode = overrideMode ?? (splitCount > 1 ? splitMode : "none");
    printPreConta({
      tableNumero: table.numero,
      tableNome: table.nome,
      items: items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        price: i.price,
        quantity: i.quantity,
        observacao: i.observacao,
      })),
      total: productsSubtotal,
      operatorName,
      mode,
      splitCount: mode !== "none" ? splitCount : undefined,
      assignments: mode === "custom" ? splitAssignments : undefined,
      personNames: mode !== "none" ? personNames : undefined,
      serviceFeePct: feePct,
      couvertPerPerson: couvertEnabled ? couvertPerPerson : 0,
      peopleForCouvert,
    });
  };

  const markAwaitingPayment = async () => {
    if (!order || !table) return;
    const { error } = await sb
      .from("restaurant_orders")
      .update({ status: "aguardando_pagamento" })
      .eq("id", order.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    onTableStatusChange(table.id, "aguardando_pagamento");
    // Imprime pré-conta automaticamente
    printNow();
    toast({ title: "Mesa marcada como aguardando pagamento", description: "Pré-conta enviada para impressão." });
    onOpenChange(false);
  };

  // ─── Pagamento ───
  const addPayment = (method: string, amount: number) => {
    if (amount <= 0) return;
    setPayments((prev) => [...prev, { id: crypto.randomUUID(), method, amount }]);
    setPartial("");
  };
  const removePayment = (id: string) => setPayments((prev) => prev.filter((p) => p.id !== id));
  const fillRemaining = (method: string) => addPayment(method, remaining);

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const unassignedTotalQty = useMemo(() => {
    if (splitMode !== "custom" || splitCount <= 1) return 0;
    return items.reduce((sum, it) => sum + Math.max(0, it.quantity - assignedQty(it.id)), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMode, splitCount, items, splitAssignments]);

  const finalize = async () => {
    if (!order || !table || items.length === 0) return;
    if (totalPaid + 0.001 < total) {
      return toast({ title: "Pagamento incompleto", description: "O valor pago é menor que o total.", variant: "destructive" });
    }
    if (unassignedTotalQty > 0) {
      setConfirmCloseOpen(true);
      return;
    }
    await doFinalize();
  };

  const doFinalize = async () => {
    if (!order || !table) return;
    setClosing(true);
    try {
      // Adjust last payment so totalPaid never exceeds total (handles dinheiro com troco)
      const adjusted = [...payments];
      const overpay = totalPaid - total;
      if (overpay > 0.001) {
        // reduce last payment by overpay (it's the change)
        const last = adjusted[adjusted.length - 1];
        adjusted[adjusted.length - 1] = { ...last, amount: last.amount - overpay };
      }

      // Sale total = productsSubtotal (only consumed products). Service fee and
      // couvert are recorded as separate sale_payments lines, so payments sum
      // exceeds sale total by exactly feeAmount + couvertTotal.
      // Scale payment methods proportionally down to productsSubtotal.
      let methodsForSale = adjusted.map((p) => ({ method: p.method, amount: p.amount }));
      const extras = feeAmount + couvertTotal;
      if (extras > 0.001 && total > 0.001) {
        const scale = productsSubtotal / total;
        methodsForSale = methodsForSale.map((p) => ({ method: p.method, amount: p.amount * scale }));
      }

      // Register sale via PDV path (creates sale + sale_items + sale_payments + stock movement)
      const saleId = await sellProducts(
        items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
        methodsForSale,
        undefined,
        undefined,
        operatorId
      );

      // Add the service fee + couvert as extra payment lines.
      if (saleId && tenantId) {
        const extraRows: any[] = [];
        if (feeAmount > 0.001) {
          extraRows.push({
            sale_id: saleId,
            method: `Taxa de serviço (${feePct}%)`,
            amount: feeAmount,
            tenant_id: tenantId,
          });
        }
        if (couvertTotal > 0.001) {
          extraRows.push({
            sale_id: saleId,
            method: `Couvert (${peopleForCouvert}× ${formatBRL(couvertPerPerson)})`,
            amount: couvertTotal,
            tenant_id: tenantId,
          });
        }
        if (extraRows.length > 0) {
          await sb.from("sale_payments").insert(extraRows);
        }
      }

      // Close the order, link to sale
      const { error: e1 } = await sb
        .from("restaurant_orders")
        .update({ status: "fechada", sale_id: saleId || null, closed_at: new Date().toISOString() })
        .eq("id", order.id);
      if (e1) throw e1;

      // Free the table (and break group if any)
      const { error: e2 } = await sb
        .from("restaurant_tables")
        .update({ status: "livre", observacao: null })
        .eq("id", table.id);
      if (e2) throw e2;

      onTableStatusChange(table.id, "livre");
      toast({ title: "Comanda fechada", description: `Mesa ${table.numero} liberada` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao fechar", description: err?.message ?? "Falha", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Mesa {table.numero}
            {table.nome && <span className="text-sm text-muted-foreground font-normal">— {table.nome}</span>}
            {order?.status === "aguardando_pagamento" && (
              <Badge variant="outline" className="text-amber-600 border-amber-500/40">Aguardando pagamento</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {view === "comanda" ? "Adicione produtos e gerencie a comanda." : "Selecione as formas de pagamento."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "comanda" ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
            {/* ─── Produtos ─── */}
            <div className="border-r border-border flex flex-col min-h-0">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto (nome, SKU, código)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado.</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addProduct(p)}
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBRL(p.price)}</p>
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* ─── Itens da comanda ─── */}
            <div className="flex flex-col min-h-0">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Itens ({items.length})</span>
                <span className="text-xs text-muted-foreground">{table.status === "ocupada" ? "Em aberto" : ""}</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum item. Adicione produtos pela busca ao lado.
                    </p>
                  ) : (
                    items.map((i) => (
                      <div key={i.id} className="border border-border rounded-md p-2 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{i.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBRL(i.price)} × {i.quantity} = <span className="text-foreground font-medium">{formatBRL(i.price * i.quantity)}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(i)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, i.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, i.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-7 text-xs gap-1"
                            onClick={() => {
                              setObsEditing(i.id);
                              setObsDraft(i.observacao || "");
                            }}
                          >
                            <MessageSquarePlus className="h-3 w-3" />
                            {i.observacao ? "Editar obs" : "Obs"}
                          </Button>
                        </div>

                        {obsEditing === i.id ? (
                          <div className="flex flex-col gap-1.5">
                            <Textarea
                              placeholder="Ex: sem cebola, ponto da carne, etc."
                              value={obsDraft}
                              onChange={(e) => setObsDraft(e.target.value)}
                              className="text-sm min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setObsEditing(null); setObsDraft(""); }}>
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={() => saveObs(i)}>Salvar</Button>
                            </div>
                          </div>
                        ) : i.observacao ? (
                          <p className="text-xs italic text-muted-foreground border-l-2 border-primary/40 pl-2">
                            {i.observacao}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t border-border bg-muted/30 shrink-0 space-y-1">
                {feePct > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatBRL(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Taxa de serviço ({feePct}%)</span>
                      <span className="tabular-nums">{formatBRL(feeAmount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">{formatBRL(total)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ─── Tela de pagamento ───
          <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-auto">
            <div className="rounded-md border border-border p-4 bg-muted/30 space-y-2">
              {(feePct > 0 || couvertTotal > 0) && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal (produtos)</span>
                    <span className="text-base tabular-nums text-foreground">{formatBRL(productsSubtotal)}</span>
                  </div>
                  {feePct > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de serviço ({feePct}%)</span>
                      <span className="text-base tabular-nums text-foreground">{formatBRL(feeAmount)}</span>
                    </div>
                  )}
                  {couvertTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Couvert ({peopleForCouvert}× {formatBRL(couvertPerPerson)})
                      </span>
                      <span className="text-base tabular-nums text-foreground">{formatBRL(couvertTotal)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total da comanda</span>
                <span className="text-xl font-bold tabular-nums text-foreground">{formatBRL(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pago</span>
                <span className="text-base font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatBRL(totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Restante</span>
                <span className={cn("text-base font-medium tabular-nums", remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                  {formatBRL(remaining)}
                </span>
              </div>
              {totalPaid > total && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm text-muted-foreground">Troco</span>
                  <span className="text-base font-medium tabular-nums text-foreground">{formatBRL(totalPaid - total)}</span>
                </div>
              )}
            </div>

            {/* ─── Taxa de serviço ─── */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <Label htmlFor="service-fee-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                    Taxa de serviço (garçom)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="service-fee-toggle"
                    checked={serviceFeeEnabled}
                    onCheckedChange={setServiceFeeEnabled}
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={serviceFeePct}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n) && n >= 0 && n <= 100) setServiceFeePct(n);
                      }}
                      disabled={!serviceFeeEnabled}
                      className="w-16 h-8 text-center tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              {serviceFeeEnabled && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Acrescido ao total e dividido proporcionalmente
                  </span>
                  <span className="text-sm font-bold tabular-nums text-primary">
                    + {formatBRL(feeAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* ─── Couvert ─── */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  <Label htmlFor="couvert-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                    Couvert (por pessoa)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="couvert-toggle"
                    checked={couvertEnabled}
                    onCheckedChange={setCouvertEnabled}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={couvertAmount}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n) && n >= 0) setCouvertAmount(n);
                      }}
                      disabled={!couvertEnabled}
                      className="w-24 h-8 text-center tabular-nums"
                    />
                  </div>
                </div>
              </div>
              {couvertEnabled && couvertPerPerson > 0 && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {peopleForCouvert}× {formatBRL(couvertPerPerson)} {splitCount > 1 ? "(por pessoa)" : "(1 pessoa)"}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-primary">
                    + {formatBRL(couvertTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* ─── Dividir conta ─── */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Dividir conta</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setSplitCount((n) => Math.max(1, n - 1))}
                    disabled={splitCount <= 1}
                    aria-label="Diminuir pessoas"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={splitCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n) && n >= 1 && n <= 50) setSplitCount(n);
                    }}
                    className="w-16 h-8 text-center tabular-nums"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setSplitCount((n) => Math.min(50, n + 1))}
                    disabled={splitCount >= 50}
                    aria-label="Aumentar pessoas"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1">pessoa{splitCount > 1 ? "s" : ""}</span>
                </div>
              </div>

              {splitCount > 1 && (
                <>
                  {/* Nomes das pessoas */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Nome de cada pessoa (opcional)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {Array.from({ length: splitCount }, (_, idx) => (
                        <Input
                          key={idx}
                          value={personNames[idx] ?? ""}
                          onChange={(e) => setPersonNameAt(idx, e.target.value)}
                          placeholder={`Pessoa ${idx + 1}`}
                          className="h-8 text-xs"
                          maxLength={30}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Toggle modo */}
                  <div className="flex gap-1 bg-muted rounded-md p-1">
                    <button
                      type="button"
                      onClick={() => setSplitMode("equal")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded transition-colors",
                        splitMode === "equal" ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Igualitária
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("custom")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded transition-colors",
                        splitMode === "custom" ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Por itens
                    </button>
                  </div>

                  {splitMode === "equal" ? (
                    <>
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                        <span className="text-sm text-muted-foreground">Valor por pessoa</span>
                        <span className="text-xl font-bold tabular-nums text-primary">{formatBRL(perPerson)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PAY_METHODS.map((m) => (
                          <Button
                            key={m.key}
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1"
                            onClick={() => addPayment(m.key, perPerson)}
                            disabled={remaining <= 0}
                          >
                            <m.icon className="h-3.5 w-3.5" />
                            +1 pessoa ({m.key})
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Atribua a quantidade de cada item para cada pessoa. Itens não atribuídos viram <b>parte compartilhada</b> (divididos igualmente).
                      </p>

                      <div className="border border-border rounded-md overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-muted/50">Item</th>
                              {Array.from({ length: splitCount }, (_, p) => {
                                const nm = personNameAt(p);
                                const short = nm.length > 8 ? nm.slice(0, 7) + "…" : nm;
                                return (
                                  <th key={p} className="p-2 font-medium text-muted-foreground text-center min-w-[88px]" title={nm}>
                                    {short}
                                  </th>
                                );
                              })}
                              <th className="text-right p-2 font-medium text-muted-foreground">Restante</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it) => {
                              const used = assignedQty(it.id);
                              const left = it.quantity - used;
                              return (
                                <tr key={it.id} className="border-t border-border">
                                  <td className="p-2 sticky left-0 bg-background">
                                    <div className="font-medium text-foreground truncate max-w-[140px]">{it.product_name}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {it.quantity}× {formatBRL(it.price)}
                                    </div>
                                  </td>
                                  {Array.from({ length: splitCount }, (_, p) => {
                                    const v = (splitAssignments[it.id] || {})[p] || 0;
                                    const canInc = left > 0;
                                    return (
                                      <td key={p} className="p-1">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setAssignment(it.id, p, v - 1)}
                                            disabled={v <= 0}
                                            className="h-6 w-6 rounded border border-border hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                                          >
                                            <Minus className="h-3 w-3" />
                                          </button>
                                          <span className="w-6 text-center tabular-nums text-foreground">{v}</span>
                                          <button
                                            type="button"
                                            onClick={() => setAssignment(it.id, p, v + 1)}
                                            disabled={!canInc}
                                            className="h-6 w-6 rounded border border-border hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className={cn(
                                    "p-2 text-right tabular-nums",
                                    left === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                  )}>
                                    {left}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {customPerPerson.map((personTotal, p) => (
                          <div key={p} className="border border-border rounded-md p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-foreground truncate" title={personNameAt(p)}>
                                {personNameAt(p)}
                              </span>
                              <span className="text-sm font-bold tabular-nums text-primary">{formatBRL(personTotal)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {PAY_METHODS.map((m) => (
                                <Button
                                  key={m.key}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] gap-1 px-2"
                                  onClick={() => addPayment(m.key, personTotal)}
                                  disabled={personTotal <= 0 || remaining <= 0}
                                >
                                  <m.icon className="h-3 w-3" />
                                  {m.key}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <Button size="sm" variant="outline" className="gap-1 w-full" onClick={() => printNow()}>
                    <Printer className="h-3.5 w-3.5" /> Imprimir pré-conta dividida ({splitCount} vias)
                  </Button>
                </>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Adicionar pagamento</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {PAY_METHODS.map((m) => (
                  <Button
                    key={m.key}
                    variant="outline"
                    className="h-16 flex-col gap-1"
                    onClick={() => fillRemaining(m.key)}
                    disabled={remaining <= 0}
                  >
                    <m.icon className="h-5 w-5" />
                    <span className="text-xs">{m.key}</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Valor parcial"
                  value={partial}
                  onChange={(e) => setPartial(e.target.value)}
                  className="flex-1"
                />
                {PAY_METHODS.map((m) => (
                  <Button
                    key={m.key}
                    size="sm"
                    variant="ghost"
                    onClick={() => addPayment(m.key, parseFloat(partial) || 0)}
                    disabled={!partial || parseFloat(partial) <= 0}
                  >
                    {m.key}
                  </Button>
                ))}
              </div>
            </div>

            {payments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pagamentos adicionados</p>
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-border rounded-md p-2">
                    <span className="text-sm text-foreground">{p.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">{formatBRL(p.amount)}</span>
                      <button onClick={() => removePayment(p.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Footer ─── */}
        <DialogFooter className="p-3 border-t border-border shrink-0 flex-row flex-wrap gap-2 sm:justify-between">
          {view === "comanda" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => printNow()}
                  disabled={items.length === 0}
                  className="gap-1"
                >
                  <Printer className="h-4 w-4" /> Pré-conta
                </Button>
                <Button
                  variant="outline"
                  onClick={markAwaitingPayment}
                  disabled={!order || items.length === 0}
                  className="gap-1"
                >
                  <Clock className="h-4 w-4" /> Aguardando pagamento
                </Button>
                <Button
                  onClick={() => setView("pagamento")}
                  disabled={!order || items.length === 0}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-4 w-4" /> Fechar mesa
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setView("comanda")} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar à comanda
              </Button>
              <Button
                onClick={finalize}
                disabled={closing || totalPaid + 0.001 < total}
                className="gap-1"
              >
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalizar e liberar mesa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
