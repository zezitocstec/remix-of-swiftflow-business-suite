import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, Receipt, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/mock-data";

const sb = supabase as any;

interface HistoryOrder {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  people_count: number | null;
  operator_id: string | null;
  items: { product_name: string; quantity: number; price: number; observacao: string | null }[];
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableId: string | null;
  tableNumero?: number;
  tableNome?: string | null;
}

export default function TableHistoryDialog({ open, onOpenChange, tableId, tableNumero, tableNome }: Props) {
  const { tenantId } = useTenant();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !tableId || !tenantId) return;
    setExpanded(new Set());
    (async () => {
      setLoading(true);
      try {
        const { data: ordersData, error } = await sb
          .from("restaurant_orders")
          .select("id, status, created_at, closed_at, people_count, operator_id")
          .eq("table_id", tableId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;

        const list = (ordersData || []) as any[];
        if (list.length === 0) { setOrders([]); setLoading(false); return; }

        const orderIds = list.map((o: any) => o.id);
        const { data: itemsData } = await sb
          .from("restaurant_order_items")
          .select("order_id, product_name, quantity, price, observacao")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true });

        const itemsByOrder = new Map<string, HistoryOrder["items"]>();
        (itemsData || []).forEach((i: any) => {
          const arr = itemsByOrder.get(i.order_id) || [];
          arr.push({ product_name: i.product_name, quantity: Number(i.quantity), price: Number(i.price), observacao: i.observacao });
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
        toast({ title: "Erro ao carregar histórico", description: err?.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tableId, tenantId]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const statusLabel = (s: string) => {
    if (s === "fechada") return "Fechada";
    if (s === "aberta") return "Aberta";
    if (s === "aguardando_pagamento") return "Aguardando pgto";
    return s;
  };

  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "fechada") return "secondary";
    if (s === "aberta") return "default";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico — Mesa {tableNumero}
            {tableNome && <span className="text-sm text-muted-foreground font-normal">({tableNome})</span>}
          </DialogTitle>
          <DialogDescription>Últimas 30 comandas registradas nesta mesa.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma comanda encontrada para esta mesa.
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {orders.map((o) => {
                const open = expanded.has(o.id);
                const dt = new Date(o.created_at);
                const closedDt = o.closed_at ? new Date(o.closed_at) : null;
                return (
                  <div key={o.id} className="rounded-md border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggle(o.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Badge variant={statusVariant(o.status)} className="text-[10px]">
                            {statusLabel(o.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {o.items.length} ite{o.items.length === 1 ? "m" : "ns"} · Total {formatBRL(o.total)}
                          {closedDt && ` · Fechada ${closedDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </div>
                      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {open && (
                      <div className="border-t border-border px-3 pb-3 pt-2 space-y-1">
                        {o.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-foreground">{it.quantity}x {it.product_name}</span>
                            <span className="tabular-nums text-muted-foreground">{formatBRL(it.price * it.quantity)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border/50">
                          <span>Total</span>
                          <span className="tabular-nums">{formatBRL(o.total)}</span>
                        </div>
                      </div>
                    )}
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
