import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Loader2, Printer, Search, RefreshCw, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/mock-data";
import { printFinalReceipt } from "./FinalReceiptPrint";
import { logPrintAttempt } from "@/lib/print-log";
import { loadRestaurantSettings } from "@/components/config/RestauranteConfig";

const sb = supabase as any;

interface ClosedOrder {
  id: string;
  table_id: string;
  sale_id: string | null;
  closed_at: string | null;
  created_at: string;
  table_numero: number;
  table_nome: string | null;
  total_amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operatorId?: string;
  operatorName?: string;
}

export default function ReprintDialog({ open, onOpenChange, operatorId, operatorName }: Props) {
  const { tenantId } = useTenant();
  const [orders, setOrders] = useState<ClosedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [defaultCopies, setDefaultCopies] = useState<1 | 2 | 3>(1);
  const [copies, setCopies] = useState<1 | 2 | 3>(1);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Get latest 30 closed orders.
      const { data: ordersData, error: e1 } = await sb
        .from("restaurant_orders")
        .select("id, table_id, sale_id, closed_at, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "fechada")
        .order("closed_at", { ascending: false, nullsFirst: false })
        .limit(30);
      if (e1) throw e1;

      const list = (ordersData || []) as any[];
      const tableIds = Array.from(new Set(list.map((o) => o.table_id).filter(Boolean)));
      const saleIds = Array.from(new Set(list.map((o) => o.sale_id).filter(Boolean)));

      const [tablesRes, salesRes] = await Promise.all([
        tableIds.length
          ? sb.from("restaurant_tables").select("id, numero, nome").in("id", tableIds)
          : Promise.resolve({ data: [], error: null }),
        saleIds.length
          ? sb.from("sales").select("id, total").in("id", saleIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const tableMap = new Map<string, { numero: number; nome: string | null }>();
      (tablesRes.data || []).forEach((t: any) => tableMap.set(t.id, { numero: t.numero, nome: t.nome }));
      const saleMap = new Map<string, number>();
      (salesRes.data || []).forEach((s: any) => saleMap.set(s.id, Number(s.total) || 0));

      // For orders without sale_id, fall back to summing items.
      const noSaleIds = list.filter((o) => !o.sale_id).map((o) => o.id);
      const fallbackSums = new Map<string, number>();
      if (noSaleIds.length > 0) {
        const { data: itemsData } = await sb
          .from("restaurant_order_items")
          .select("order_id, price, quantity")
          .in("order_id", noSaleIds);
        (itemsData || []).forEach((i: any) => {
          fallbackSums.set(i.order_id, (fallbackSums.get(i.order_id) || 0) + Number(i.price) * Number(i.quantity));
        });
      }

      const enriched: ClosedOrder[] = list.map((o) => {
        const t = tableMap.get(o.table_id) || { numero: 0, nome: null };
        const total = o.sale_id
          ? (saleMap.get(o.sale_id) ?? 0)
          : (fallbackSums.get(o.id) ?? 0);
        return {
          id: o.id,
          table_id: o.table_id,
          sale_id: o.sale_id,
          closed_at: o.closed_at,
          created_at: o.created_at,
          table_numero: t.numero,
          table_nome: t.nome,
          total_amount: total,
        };
      });
      setOrders(enriched);
    } catch (err: any) {
      toast({ title: "Erro ao carregar mesas fechadas", description: err?.message ?? "Falha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !tenantId) return;
    load();
    loadRestaurantSettings(tenantId).then((s) => {
      const c = Math.min(3, Math.max(1, Number(s.receipt_copies) || 1)) as 1 | 2 | 3;
      setDefaultCopies(c);
      setCopies(c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      String(o.table_numero).includes(q) ||
      (o.table_nome ?? "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const reprint = async (o: ClosedOrder) => {
    if (!tenantId) return;
    setReprintingId(o.id);
    try {
      // Reload items + payments to rebuild the slip exactly as printed at closing time.
      const [itemsRes, paymentsRes] = await Promise.all([
        sb.from("restaurant_order_items")
          .select("id, product_name, price, quantity, observacao")
          .eq("order_id", o.id)
          .order("created_at", { ascending: true }),
        o.sale_id
          ? sb.from("sale_payments").select("method, amount").eq("sale_id", o.sale_id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (itemsRes.error) throw itemsRes.error;

      const items = (itemsRes.data || []) as any[];
      const allPayments = ((paymentsRes.data || []) as any[]).map((p) => ({
        method: String(p.method),
        amount: Number(p.amount) || 0,
      }));

      // The closing flow stores fee/couvert as separate sale_payments rows whose method
      // starts with "Taxa de serviço" or "Couvert". Identify them to compute breakdown,
      // but include only the real payments in the "PAGAMENTO" section of the slip.
      const feeRow = allPayments.find((p) => /^Taxa de serviço/i.test(p.method));
      const couvertRow = allPayments.find((p) => /^Couvert/i.test(p.method));
      const realPayments = allPayments.filter((p) => p !== feeRow && p !== couvertRow);

      const productsSubtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
      const serviceFeeAmount = feeRow?.amount ?? 0;
      const serviceFeePct = productsSubtotal > 0 && serviceFeeAmount > 0
        ? Math.round((serviceFeeAmount / productsSubtotal) * 1000) / 10
        : 0;
      const couvertTotal = couvertRow?.amount ?? 0;
      // Try to recover "N× R$X" from method label (e.g. "Couvert (2× R$ 10,00)").
      let peopleForCouvert = 1;
      let couvertPerPerson = couvertTotal;
      const m = couvertRow?.method.match(/(\d+)×/);
      if (m) {
        peopleForCouvert = Math.max(1, parseInt(m[1], 10));
        couvertPerPerson = couvertTotal / peopleForCouvert;
      }
      const total = productsSubtotal + serviceFeeAmount + couvertTotal;
      // realPayments was scaled to productsSubtotal at closing; reprint shows that
      // breakdown plus fee/couvert as separate labeled lines for consistency.
      const slipPayments = [
        ...realPayments,
        ...(feeRow ? [{ method: feeRow.method, amount: feeRow.amount }] : []),
        ...(couvertRow ? [{ method: couvertRow.method, amount: couvertRow.amount }] : []),
      ];
      const slipPaid = slipPayments.reduce((s, p) => s + p.amount, 0);
      const change = Math.max(0, slipPaid - total);

      const receiptOpts = {
        tableNumero: o.table_numero,
        tableNome: o.table_nome,
        items: items.map((i) => ({
          id: String(i.id),
          product_name: i.product_name,
          price: Number(i.price),
          quantity: Number(i.quantity),
          observacao: i.observacao ?? null,
        })),
        productsSubtotal,
        serviceFeePct,
        serviceFeeAmount,
        couvertPerPerson,
        peopleForCouvert,
        couvertTotal,
        total,
        payments: slipPayments.length > 0 ? slipPayments : [{ method: "—", amount: total }],
        change,
        operatorName,
        copies,
      };

      console.info(
        `[Reprint] Mesa ${o.table_numero} (order=${o.id}) — solicitando ${copies} via(s) reimpressão`
      );
      const result = printFinalReceipt(receiptOpts);

      logPrintAttempt({
        tenant_id: tenantId,
        table_id: o.table_id,
        table_numero: o.table_numero,
        table_nome: o.table_nome,
        order_id: o.id,
        sale_id: o.sale_id,
        operator_id: operatorId ?? null,
        operator_name: operatorName ?? null,
        copies_requested: result.copiesRequested,
        copies_printed: result.copiesPrinted,
        ok: result.ok,
        total_amount: total,
        is_reprint: true,
        error_message: result.ok
          ? "Reimpressão manual"
          : "Reimpressão manual — popup bloqueado ou falha de window.print",
      });

      if (result.ok) {
        toast({
          title: "Reimpressão concluída",
          description: `Mesa ${o.table_numero}: ${result.copiesPrinted} via(s).`,
        });
      } else {
        toast({
          title: "Reimpressão pode ter falhado",
          description: "Verifique pop-ups do navegador.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro na reimpressão", description: err?.message ?? "Falha", variant: "destructive" });
      logPrintAttempt({
        tenant_id: tenantId,
        table_id: o.table_id,
        table_numero: o.table_numero,
        table_nome: o.table_nome,
        order_id: o.id,
        sale_id: o.sale_id,
        operator_id: operatorId ?? null,
        operator_name: operatorName ?? null,
        copies_requested: copies,
        copies_printed: 0,
        ok: false,
        total_amount: o.total_amount,
        is_reprint: true,
        error_message: `Reimpressão falhou: ${err?.message ?? "erro desconhecido"}`,
      });
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Reimpressão de Cupom
          </DialogTitle>
          <DialogDescription>
            Selecione uma mesa fechada recentemente para emitir uma 2ª via. Cada tentativa é registrada nos logs de impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b border-border shrink-0 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por mesa ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Vias</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCopies(n as 1 | 2 | 3)}
                  className={
                    "px-3 h-9 text-sm tabular-nums " +
                    (copies === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground hover:bg-accent")
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              padrão: {defaultCopies}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Atualizar
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma mesa fechada encontrada.
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filtered.map((o) => {
                const dt = o.closed_at ? new Date(o.closed_at) : null;
                return (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">Mesa {o.table_numero}</span>
                        {o.table_nome && (
                          <span className="text-xs text-muted-foreground truncate">— {o.table_nome}</span>
                        )}
                        {!o.sale_id && (
                          <Badge variant="outline" className="text-[10px]">sem venda vinculada</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {dt ? dt.toLocaleString("pt-BR") : "—"} · Total {formatBRL(o.total_amount)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => reprint(o)}
                      disabled={reprintingId !== null}
                      className="gap-1.5 shrink-0"
                    >
                      {reprintingId === o.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Printer className="h-3.5 w-3.5" />
                      )}
                      Reimprimir
                    </Button>
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
