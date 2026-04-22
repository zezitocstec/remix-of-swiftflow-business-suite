import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { extractSaleExtras } from "@/lib/sale-extras";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, FileText, Loader2, ChevronDown, ChevronRight, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportReportPDF } from "@/lib/export-pdf";

const sb = supabase as any;

interface RestaurantSaleRow {
  orderId: string;
  saleId: string | null;
  tableNumero: number;
  tableNome: string | null;
  operatorName: string;
  clientName: string | null;
  closedAt: Date;
  productsTotal: number;
  serviceFee: number;
  couvert: number;
  grandTotal: number;
  items: { product_name: string; quantity: number; price: number }[];
  payments: { method: string; amount: number }[];
}

export default function RestauranteReport() {
  const { tenantId } = useTenant();
  const { operators } = useProducts();
  const [rows, setRows] = useState<RestaurantSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      // 1) Fetch closed restaurant orders for this tenant
      const { data: orders, error: ordErr } = await sb
        .from("restaurant_orders")
        .select("id, sale_id, table_id, operator_id, closed_at")
        .eq("tenant_id", tenantId)
        .eq("status", "fechada")
        .not("sale_id", "is", null)
        .order("closed_at", { ascending: false })
        .limit(500);
      if (ordErr || !orders || orders.length === 0) { setRows([]); setLoading(false); return; }

      const tableIds = Array.from(new Set(orders.map((o: any) => o.table_id).filter(Boolean)));
      const saleIds = orders.map((o: any) => o.sale_id).filter(Boolean);

      const [tablesRes, salesRes, itemsRes, paymentsRes] = await Promise.all([
        sb.from("restaurant_tables").select("id, numero, nome").in("id", tableIds),
        sb.from("sales").select("id, total, client_name, operator_name, created_at").in("id", saleIds),
        sb.from("sale_items").select("sale_id, product_name, quantity, price").in("sale_id", saleIds),
        sb.from("sale_payments").select("sale_id, method, amount").in("sale_id", saleIds),
      ]);

      const tableMap = new Map<string, { numero: number; nome: string | null }>(
        (tablesRes.data || []).map((t: any) => [t.id, { numero: t.numero, nome: t.nome }])
      );
      const saleMap = new Map<string, any>((salesRes.data || []).map((s: any) => [s.id, s]));
      const itemsBySale = new Map<string, any[]>();
      (itemsRes.data || []).forEach((it: any) => {
        const arr = itemsBySale.get(it.sale_id) || [];
        arr.push(it); itemsBySale.set(it.sale_id, arr);
      });
      const paysBySale = new Map<string, any[]>();
      (paymentsRes.data || []).forEach((p: any) => {
        const arr = paysBySale.get(p.sale_id) || [];
        arr.push(p); paysBySale.set(p.sale_id, arr);
      });

      const rs: RestaurantSaleRow[] = orders.map((o: any) => {
        const sale = saleMap.get(o.sale_id);
        const t = o.table_id ? tableMap.get(o.table_id) : undefined;
        const pays = (paysBySale.get(o.sale_id) || []).map((p: any) => ({ method: p.method, amount: Number(p.amount) }));
        const { serviceFee, couvert, realMethods } = extractSaleExtras(pays);
        const productsTotal = sale ? Number(sale.total) : 0;
        return {
          orderId: o.id,
          saleId: o.sale_id,
          tableNumero: t?.numero ?? 0,
          tableNome: t?.nome ?? null,
          operatorName: sale?.operator_name || "—",
          clientName: sale?.client_name ?? null,
          closedAt: new Date(o.closed_at || sale?.created_at || Date.now()),
          productsTotal,
          serviceFee,
          couvert,
          grandTotal: productsTotal + serviceFee + couvert,
          items: (itemsBySale.get(o.sale_id) || []).map((i: any) => ({
            product_name: i.product_name, quantity: i.quantity, price: Number(i.price),
          })),
          payments: realMethods,
        };
      });
      setRows(rs);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (dateFrom) { const s = new Date(dateFrom); s.setHours(0,0,0,0); if (r.closedAt < s) return false; }
      if (dateTo)   { const e = new Date(dateTo);   e.setHours(23,59,59,999); if (r.closedAt > e) return false; }
      if (filterOperator !== "all" && r.operatorName !== filterOperator) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, filterOperator]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    products: acc.products + r.productsTotal,
    fee: acc.fee + r.serviceFee,
    couvert: acc.couvert + r.couvert,
    grand: acc.grand + r.grandTotal,
  }), { products: 0, fee: 0, couvert: 0, grand: 0 }), [filtered]);

  const operatorNames = useMemo(() => Array.from(new Set(rows.map(r => r.operatorName).filter(Boolean))), [rows]);

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleExportPDF = () => {
    const headers = ["Data/Hora", "Mesa", "Cliente", "Garçom", "Itens", "Subtotal", "Taxa", "Couvert", "Total"];
    const data = filtered.map(r => [
      `${r.closedAt.toLocaleDateString("pt-BR")} ${r.closedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`,
      r.tableNome ? `${r.tableNumero} (${r.tableNome})` : String(r.tableNumero),
      r.clientName || "—",
      r.operatorName,
      String(r.items.reduce((s, i) => s + i.quantity, 0)),
      formatBRL(r.productsTotal),
      r.serviceFee > 0 ? formatBRL(r.serviceFee) : "—",
      r.couvert > 0 ? formatBRL(r.couvert) : "—",
      formatBRL(r.grandTotal),
    ]);
    exportReportPDF("Vendas do Restaurante", headers, data, [
      { label: "Faturamento (produtos)", value: formatBRL(totals.products) },
      { label: "Taxa de serviço", value: formatBRL(totals.fee) },
      { label: "Couvert", value: formatBRL(totals.couvert) },
      { label: "Total cobrado", value: formatBRL(totals.grand) },
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
        <p className="text-sm text-muted-foreground">
          Nenhuma venda do restaurante encontrada. Feche uma mesa em /restaurante para gerar dados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportPDF}>
            <FileText className="h-3 w-3 mr-1" /> PDF
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Garçom / Operador</label>
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {operatorNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-full text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-full text-xs justify-start", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mesas fechadas</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{filtered.length}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Faturamento (produtos)</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totals.products)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taxa de serviço</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totals.fee)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Couvert</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totals.couvert)}</p>
        </div>
      </div>

      {/* Sales table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Vendas do Restaurante ({filtered.length})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="w-8 px-2"></th>
                <th className="text-left py-2.5 px-3 font-medium">Data/Hora</th>
                <th className="text-left py-2.5 px-3 font-medium">Mesa</th>
                <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
                <th className="text-left py-2.5 px-3 font-medium">Garçom</th>
                <th className="text-right py-2.5 px-3 font-medium">Itens</th>
                <th className="text-right py-2.5 px-3 font-medium">Subtotal</th>
                <th className="text-right py-2.5 px-3 font-medium">Taxa</th>
                <th className="text-right py-2.5 px-3 font-medium">Couvert</th>
                <th className="text-right py-2.5 px-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isOpen = expanded.has(r.orderId);
                const itemsCount = r.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <>
                    <tr key={r.orderId} className="border-b border-border hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.orderId)}>
                      <td className="px-2 text-muted-foreground">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.closedAt.toLocaleDateString("pt-BR")} {r.closedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                      </td>
                      <td className="py-2 px-3 text-xs text-foreground font-medium">
                        Mesa {r.tableNumero}{r.tableNome ? <span className="text-muted-foreground"> — {r.tableNome}</span> : null}
                      </td>
                      <td className="py-2 px-3 text-xs text-foreground">{r.clientName || "—"}</td>
                      <td className="py-2 px-3 text-xs text-foreground">{r.operatorName}</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums text-foreground">{itemsCount}</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums text-foreground">{formatBRL(r.productsTotal)}</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums text-muted-foreground">{r.serviceFee > 0 ? formatBRL(r.serviceFee) : "—"}</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums text-muted-foreground">{r.couvert > 0 ? formatBRL(r.couvert) : "—"}</td>
                      <td className="py-2 px-3 text-right text-xs tabular-nums text-foreground font-semibold">{formatBRL(r.grandTotal)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={r.orderId + "-d"} className="border-b border-border bg-muted/20">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Itens consumidos</p>
                              <div className="space-y-1">
                                {r.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-foreground">{it.quantity}× {it.product_name}</span>
                                    <span className="tabular-nums text-muted-foreground">{formatBRL(it.price * it.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Pagamentos</p>
                              <div className="space-y-1">
                                {r.payments.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : r.payments.map((p, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-foreground">{p.method}</span>
                                    <span className="tabular-nums text-muted-foreground">{formatBRL(p.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
