import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { formatBRL } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportReportPDF } from "@/lib/export-pdf";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadRestaurantSettings, type RestaurantSettings } from "@/components/config/RestauranteConfig";

// ... keep existing code
interface Orcamento {
  id: string;
  numero: number;
  vendedor_id: string | null;
  vendedor_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

interface Vendedor {
  id: string;
  nome: string;
  comissao: number;
  meta_mensal: number;
  ativo: boolean;
}

interface ComissaoRow {
  vendedorId: string;
  vendedorName: string;
  comissaoPct: number;
  totalConvertido: number;
  comissaoValor: number;
  qtdOrcamentos: number;
  metaMensal: number;
}

interface WaiterRow {
  operatorId: string;
  operatorName: string;
  comissaoPct: number;
  totalVendido: number;
  comissaoValor: number;
  qtdComandas: number;
}

const sb = supabase as any;

export default function ComissoesReport() {
  const { tenantId } = useTenant();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [waiterData, setWaiterData] = useState<WaiterRow[]>([]);
  const [restSettings, setRestSettings] = useState<RestaurantSettings | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [orcRes, vendRes, settings] = await Promise.all([
      supabase.from("orcamentos").select("id, numero, vendedor_id, vendedor_name, total, status, created_at")
        .eq("tenant_id", tenantId).eq("status", "convertido").order("created_at", { ascending: false }),
      supabase.from("vendedores").select("id, nome, comissao, meta_mensal, ativo").eq("tenant_id", tenantId),
      loadRestaurantSettings(tenantId),
    ]);
    if (orcRes.data) setOrcamentos(orcRes.data);
    if (vendRes.data) setVendedores(vendRes.data);
    setRestSettings(settings);

    // Load waiter commissions from closed restaurant orders
    const pct = settings.waiter_commission_pct || 0;
    let orderQuery = sb
      .from("restaurant_orders")
      .select("id, operator_id, created_at, total")
      .eq("tenant_id", tenantId)
      .eq("status", "fechada");
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      orderQuery = orderQuery.gte("created_at", start.toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      orderQuery = orderQuery.lte("created_at", end.toISOString());
    }
    const { data: closedOrders } = await orderQuery;
    const orders = (closedOrders || []) as Array<{ id: string; operator_id: string | null; created_at: string; total: number | null }>;

    // If orders don't have a total column, compute from items
    let orderTotals = new Map<string, number>();
    const ordersNeedItems = orders.some((o) => o.total == null);
    if (ordersNeedItems && orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const { data: items } = await sb
        .from("restaurant_order_items")
        .select("order_id, price, quantity")
        .in("order_id", ids);
      (items || []).forEach((it: any) => {
        orderTotals.set(it.order_id, (orderTotals.get(it.order_id) || 0) + Number(it.price || 0) * Number(it.quantity || 0));
      });
    }

    // Aggregate by operator
    const waiterMap = new Map<string, WaiterRow>();
    orders.forEach((o) => {
      if (!o.operator_id) return;
      const total = o.total != null ? Number(o.total) : (orderTotals.get(o.id) || 0);
      const existing = waiterMap.get(o.operator_id) || {
        operatorId: o.operator_id,
        operatorName: o.operator_id,
        comissaoPct: pct,
        totalVendido: 0,
        comissaoValor: 0,
        qtdComandas: 0,
      };
      existing.totalVendido += total;
      existing.comissaoValor += total * (pct / 100);
      existing.qtdComandas++;
      waiterMap.set(o.operator_id, existing);
    });

    // Try to resolve operator names from operadores table
    if (waiterMap.size > 0) {
      const opIds = Array.from(waiterMap.keys());
      const { data: ops } = await sb.from("operadores").select("id, nome").in("id", opIds);
      (ops || []).forEach((op: any) => {
        const row = waiterMap.get(op.id);
        if (row) row.operatorName = op.nome || op.id;
      });
    }

    setWaiterData(Array.from(waiterMap.values()).sort((a, b) => b.comissaoValor - a.comissaoValor));
  }, [tenantId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (filterVendedor !== "all" && o.vendedor_id !== filterVendedor) return false;
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        if (new Date(o.created_at) < start) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }
      return true;
    });
  }, [orcamentos, dateFrom, dateTo, filterVendedor]);

  const comissoes = useMemo<ComissaoRow[]>(() => {
    const vendedorMap = new Map(vendedores.map(v => [v.id, v]));
    const map = new Map<string, ComissaoRow>();

    filtered.forEach((o) => {
      if (!o.vendedor_id) return;
      const vendedor = vendedorMap.get(o.vendedor_id);
      const pct = vendedor?.comissao ?? 0;
      const name = vendedor?.nome || o.vendedor_name || "Vendedor desconhecido";

      const existing = map.get(o.vendedor_id) || {
        vendedorId: o.vendedor_id,
        vendedorName: name,
        comissaoPct: pct,
        totalConvertido: 0,
        comissaoValor: 0,
        qtdOrcamentos: 0,
        metaMensal: vendedor?.meta_mensal ?? 0,
      };
      existing.totalConvertido += o.total;
      existing.comissaoValor += o.total * (pct / 100);
      existing.qtdOrcamentos++;
      map.set(o.vendedor_id, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.comissaoValor - a.comissaoValor);
  }, [filtered, vendedores]);

  const totalComissoes = comissoes.reduce((s, c) => s + c.comissaoValor, 0);
  const totalConvertido = comissoes.reduce((s, c) => s + c.totalConvertido, 0);

  const totalWaiterComissoes = waiterData.reduce((s, w) => s + w.comissaoValor, 0);
  const totalWaiterVendido = waiterData.reduce((s, w) => s + w.totalVendido, 0);

  const chartData = comissoes.map(c => ({
    name: c.vendedorName.length > 12 ? c.vendedorName.slice(0, 12) + "…" : c.vendedorName,
    comissao: Math.round(c.comissaoValor * 100) / 100,
    vendas: Math.round(c.totalConvertido * 100) / 100,
  }));

  const waiterChartData = waiterData.map(w => ({
    name: w.operatorName.length > 12 ? w.operatorName.slice(0, 12) + "…" : w.operatorName,
    comissao: Math.round(w.comissaoValor * 100) / 100,
    vendas: Math.round(w.totalVendido * 100) / 100,
  }));

  const handleExportCSV = () => {
    const header = "Vendedor,Comissão %,Orçamentos,Total Convertido,Comissão Valor\n";
    const rows = comissoes.map(c =>
      `"${c.vendedorName}",${c.comissaoPct},${c.qtdOrcamentos},${c.totalConvertido.toFixed(2)},${c.comissaoValor.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "comissoes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const headers = ["Vendedor", "Comissão %", "Orçamentos", "Total Convertido", "Comissão"];
    const rows = comissoes.map(c => [
      c.vendedorName, `${c.comissaoPct}%`, String(c.qtdOrcamentos),
      formatBRL(c.totalConvertido), formatBRL(c.comissaoValor),
    ]);
    exportReportPDF("Relatório de Comissões", headers, rows, [
      { label: "Total Convertido", value: formatBRL(totalConvertido) },
      { label: "Total Comissões", value: formatBRL(totalComissoes) },
      { label: "Vendedores", value: String(comissoes.length) },
    ]);
  };

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportPDF}>
              <FileText className="h-3 w-3 mr-1" /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vendedor</label>
            <Select value={filterVendedor} onValueChange={setFilterVendedor}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
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

      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="garcons">Garçons</TabsTrigger>
        </TabsList>

        {/* ─── Aba Vendedores ─── */}
        <TabsContent value="vendedores" className="space-y-6 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Convertido</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalConvertido)}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Comissões</p>
              <p className="text-lg font-semibold tabular-nums text-primary">{formatBRL(totalComissoes)}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Vendedores</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{comissoes.length}</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-4">Comissões por Vendedor</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatBRL(v), name === "comissao" ? "Comissão" : "Vendas"]}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Meta progress */}
          {comissoes.some(c => c.metaMensal > 0) && (
            <div className="rounded-md border border-border bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-4">Progresso da Meta Mensal</h4>
              <div className="space-y-3">
                {comissoes.filter(c => c.metaMensal > 0).map(c => {
                  const pct = Math.min((c.comissaoValor / c.metaMensal) * 100, 100);
                  return (
                    <div key={c.vendedorId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{c.vendedorName}</span>
                        <span className="text-muted-foreground">{formatBRL(c.comissaoValor)} / {formatBRL(c.metaMensal)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detail table */}
          {comissoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum orçamento convertido com vendedor vinculado encontrado.</p>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Comissão %</TableHead>
                    <TableHead className="text-right">Orçamentos</TableHead>
                    <TableHead className="text-right">Total Convertido</TableHead>
                    <TableHead className="text-right">Comissão (R$)</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissoes.map((c) => (
                    <TableRow key={c.vendedorId}>
                      <TableCell className="font-medium text-foreground">{c.vendedorName}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{c.comissaoPct}%</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{c.qtdOrcamentos}</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{formatBRL(c.totalConvertido)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-primary">{formatBRL(c.comissaoValor)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.metaMensal > 0 ? `${Math.min((c.comissaoValor / c.metaMensal) * 100, 100).toFixed(0)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary font-semibold">
                    <TableCell className="text-foreground">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums text-foreground">{comissoes.reduce((s, c) => s + c.qtdOrcamentos, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{formatBRL(totalConvertido)}</TableCell>
                    <TableCell className="text-right tabular-nums text-primary">{formatBRL(totalComissoes)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── Aba Garçons ─── */}
        <TabsContent value="garcons" className="space-y-6 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Vendido (Mesas)</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalWaiterVendido)}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Comissões Garçons</p>
              <p className="text-lg font-semibold tabular-nums text-primary">{formatBRL(totalWaiterComissoes)}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Comissão configurada</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{restSettings?.waiter_commission_pct ?? 0}%</p>
            </div>
          </div>

          {/* Chart */}
          {waiterChartData.length > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-4">Comissões por Garçom</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waiterChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatBRL(v), name === "comissao" ? "Comissão" : "Vendas"]}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          {waiterData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {(restSettings?.waiter_commission_pct ?? 0) === 0
                ? "Configure o percentual de comissão do garçom em Configurações → Restaurante."
                : "Nenhuma comanda fechada com garçom vinculado encontrada no período."}
            </p>
          ) : (
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead>Garçom</TableHead>
                    <TableHead className="text-right">Comissão %</TableHead>
                    <TableHead className="text-right">Comandas</TableHead>
                    <TableHead className="text-right">Total Vendido</TableHead>
                    <TableHead className="text-right">Comissão (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waiterData.map((w) => (
                    <TableRow key={w.operatorId}>
                      <TableCell className="font-medium text-foreground">{w.operatorName}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{w.comissaoPct}%</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{w.qtdComandas}</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{formatBRL(w.totalVendido)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-primary">{formatBRL(w.comissaoValor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary font-semibold">
                    <TableCell className="text-foreground">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums text-foreground">{waiterData.reduce((s, w) => s + w.qtdComandas, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{formatBRL(totalWaiterVendido)}</TableCell>
                    <TableCell className="text-right tabular-nums text-primary">{formatBRL(totalWaiterComissoes)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}