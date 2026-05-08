import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Loader2, Printer, Receipt, ChefHat, Wine, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/mock-data";
import { printFinalReceipt } from "./FinalReceiptPrint";
import { printKitchenTicket } from "./KitchenTicketPrint";
import { logPrintAttempt } from "@/lib/print-log";
import { loadRestaurantSettings } from "@/components/config/RestauranteConfig";

const sb = supabase as any;

interface TableOrder {
  id: string;
  status: string;
  sale_id: string | null;
  created_at: string;
  closed_at: string | null;
  items: {
    id: string;
    product_name: string;
    price: number;
    quantity: number;
    observacao: string | null;
    printed_to_kitchen_at: string | null;
    product_id: string | null;
  }[];
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableId: string | null;
  tableNumero?: number;
  tableNome?: string | null;
  operatorId?: string;
  operatorName?: string;
}

export default function TableReprintDialog({ open, onOpenChange, tableId, tableNumero, tableNome, operatorId, operatorName }: Props) {
  const { tenantId } = useTenant();
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [copies, setCopies] = useState<1 | 2 | 3>(1);
  const [defaultCopies, setDefaultCopies] = useState<1 | 2 | 3>(1);
  const [kitchenCategories, setKitchenCategories] = useState<string[]>([]);
  const [barCategories, setBarCategories] = useState<string[]>([]);

  const load = async () => {
    if (!tenantId || !tableId) return;
    setLoading(true);
    try {
      const { data: ordersData, error } = await sb
        .from("restaurant_orders")
        .select("id, status, sale_id, created_at, closed_at")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const list = (ordersData || []) as any[];
      if (list.length === 0) { setOrders([]); setLoading(false); return; }

      const orderIds = list.map((o: any) => o.id);
      const { data: itemsData } = await sb
        .from("restaurant_order_items")
        .select("id, order_id, product_name, price, quantity, observacao, printed_to_kitchen_at, product_id")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      const itemsByOrder = new Map<string, TableOrder["items"]>();
      (itemsData || []).forEach((i: any) => {
        const arr = itemsByOrder.get(i.order_id) || [];
        arr.push({
          id: i.id,
          product_name: i.product_name,
          price: Number(i.price),
          quantity: Number(i.quantity),
          observacao: i.observacao,
          printed_to_kitchen_at: i.printed_to_kitchen_at,
          product_id: i.product_id,
        });
        itemsByOrder.set(i.order_id, arr);
      });

      setOrders(list.map((o: any) => {
        const items = itemsByOrder.get(o.id) || [];
        return {
          ...o,
          items,
          total: items.reduce((s, i) => s + i.price * i.quantity, 0),
        };
      }));
    } catch (err: any) {
      toast({ title: "Erro ao carregar comandas", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !tableId || !tenantId) return;
    load();
    loadRestaurantSettings(tenantId).then((s) => {
      const c = Math.min(3, Math.max(1, Number(s.receipt_copies) || 1)) as 1 | 2 | 3;
      setDefaultCopies(c);
      setCopies(c);
      setKitchenCategories(Array.isArray(s.kitchen_categories) ? s.kitchen_categories : []);
      setBarCategories(Array.isArray(s.bar_categories) ? s.bar_categories : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tableId, tenantId]);

  const reprintReceipt = async (o: TableOrder) => {
    if (!tenantId) return;
    setReprintingId(o.id);
    try {
      let allPayments: { method: string; amount: number }[] = [];
      if (o.sale_id) {
        const { data: paymentsData } = await sb
          .from("sale_payments").select("method, amount").eq("sale_id", o.sale_id);
        allPayments = ((paymentsData || []) as any[]).map((p: any) => ({
          method: String(p.method), amount: Number(p.amount) || 0,
        }));
      }

      const feeRow = allPayments.find((p) => /^Taxa de serviço/i.test(p.method));
      const couvertRow = allPayments.find((p) => /^Couvert/i.test(p.method));
      const realPayments = allPayments.filter((p) => p !== feeRow && p !== couvertRow);

      const productsSubtotal = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const serviceFeeAmount = feeRow?.amount ?? 0;
      const serviceFeePct = productsSubtotal > 0 && serviceFeeAmount > 0
        ? Math.round((serviceFeeAmount / productsSubtotal) * 1000) / 10 : 0;
      const couvertTotal = couvertRow?.amount ?? 0;
      let peopleForCouvert = 1;
      let couvertPerPerson = couvertTotal;
      const m = couvertRow?.method.match(/(\d+)×/);
      if (m) { peopleForCouvert = Math.max(1, parseInt(m[1], 10)); couvertPerPerson = couvertTotal / peopleForCouvert; }
      const total = productsSubtotal + serviceFeeAmount + couvertTotal;

      const slipPayments = [
        ...realPayments,
        ...(feeRow ? [feeRow] : []),
        ...(couvertRow ? [couvertRow] : []),
      ];
      const slipPaid = slipPayments.reduce((s, p) => s + p.amount, 0);
      const change = Math.max(0, slipPaid - total);

      const result = printFinalReceipt({
        tableNumero: tableNumero ?? 0,
        tableNome: tableNome ?? null,
        items: o.items.map((i) => ({ id: i.id, product_name: i.product_name, price: i.price, quantity: i.quantity, observacao: i.observacao })),
        productsSubtotal, serviceFeePct, serviceFeeAmount, couvertPerPerson, peopleForCouvert, couvertTotal,
        total,
        payments: slipPayments.length > 0 ? slipPayments : [{ method: "—", amount: total }],
        change, operatorName, copies,
      });

      logPrintAttempt({
        tenant_id: tenantId, table_id: tableId!, table_numero: tableNumero ?? 0, table_nome: tableNome ?? null,
        order_id: o.id, sale_id: o.sale_id, operator_id: operatorId ?? null, operator_name: operatorName ?? null,
        copies_requested: result.copiesRequested, copies_printed: result.copiesPrinted, ok: result.ok,
        total_amount: total, is_reprint: true, error_message: result.ok ? "Reimpressão (mesa)" : "Reimpressão falhou",
      });

      toast({ title: result.ok ? "Cupom reimpresso" : "Falha na reimpressão", variant: result.ok ? "default" : "destructive" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setReprintingId(null);
    }
  };

  const reprintKitchen = (o: TableOrder, station: "Cozinha" | "Bar") => {
    const kitchenItems = o.items.filter((i) => i.printed_to_kitchen_at);
    if (kitchenItems.length === 0) {
      toast({ title: `Nenhum item foi enviado para ${station}`, variant: "destructive" });
      return;
    }
    const result = printKitchenTicket({
      station,
      tableNumero: tableNumero ?? 0,
      tableNome,
      items: kitchenItems.map((i) => ({ product_name: i.product_name, quantity: i.quantity, observacao: i.observacao })),
      operatorName,
    });
    toast({ title: result.ok ? `Ticket ${station} reimpresso` : "Falha na impressão", variant: result.ok ? "default" : "destructive" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Reimprimir — Mesa {tableNumero}
            {tableNome && <span className="text-sm text-muted-foreground font-normal">({tableNome})</span>}
          </DialogTitle>
          <DialogDescription>Selecione a comanda e o tipo de impressão desejado.</DialogDescription>
        </DialogHeader>

        <div className="p-3 border-b border-border shrink-0 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Vias cupom</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setCopies(n as 1 | 2 | 3)}
                  className={"px-3 h-8 text-sm tabular-nums " + (copies === n ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1 ml-auto">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Atualizar
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma comanda encontrada.</div>
          ) : (
            <div className="p-3 space-y-3">
              {orders.map((o) => {
                const dt = new Date(o.created_at);
                const hasKitchenItems = o.items.some((i) => i.printed_to_kitchen_at);
                return (
                  <div key={o.id} className="rounded-md border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge variant={o.status === "fechada" ? "secondary" : o.status === "aberta" ? "default" : "outline"} className="text-[10px]">
                            {o.status === "fechada" ? "Fechada" : o.status === "aberta" ? "Aberta" : "Aguardando pgto"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {o.items.length} ite{o.items.length === 1 ? "m" : "ns"} · Total {formatBRL(o.total)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5"
                        disabled={reprintingId !== null}
                        onClick={() => reprintReceipt(o)}>
                        {reprintingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                        Cupom final
                      </Button>
                      {hasKitchenItems && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => reprintKitchen(o, "Cozinha")}>
                            <ChefHat className="h-3.5 w-3.5" /> Ticket Cozinha
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => reprintKitchen(o, "Bar")}>
                            <Wine className="h-3.5 w-3.5" /> Ticket Bar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-3 border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
