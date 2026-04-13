import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { formatBRL } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportReportPDF } from "@/lib/export-pdf";

interface Orcamento {
  id: string;
  vendedor_id: string | null;
  vendedor_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

interface ConversaoRow {
  vendedorId: string;
  vendedorName: string;
  total: number;
  convertidos: number;
  rascunho: number;
  autorizados: number;
  expirados: number;
  valorConvertido: number;
  valorTotal: number;
  taxa: number;
}

export default function ConversaoReport() {
  const { tenantId } = useTenant();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("orcamentos")
      .select("id, vendedor_id, vendedor_name, total, status, created_at")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false });
    if (data) setOrcamentos(data);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (!o.vendedor_id) return false;
      if (dateFrom) {
        const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
        if (new Date(o.created_at) < start) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }
      return true;
    });
  }, [orcamentos, dateFrom, dateTo]);

  const conversoes = useMemo<ConversaoRow[]>(() => {
    const map = new Map<string, ConversaoRow>();
    filtered.forEach((o) => {
      if (!o.vendedor_id) return;
      const existing = map.get(o.vendedor_id) || {
        vendedorId: o.vendedor_id,
        vendedorName: o.vendedor_name || "Desconhecido",
        total: 0, convertidos: 0, rascunho: 0, autorizados: 0, expirados: 0,
        valorConvertido: 0, valorTotal: 0, taxa: 0,
      };
      existing.total++;
      existing.valorTotal += o.total;
      if (o.status === "convertido") { existing.convertidos++; existing.valorConvertido += o.total; }
      else if (o.status === "rascunho") existing.rascunho++;
      else if (o.status === "autorizado") existing.autorizados++;
      else if (o.status === "expirado" || (new Date(o.created_at) < new Date() && o.status !== "convertido")) existing.expirados++;
      map.set(o.vendedor_id, existing);
    });
    return Array.from(map.values()).map(c => ({
      ...c,
      taxa: c.total > 0 ? (c.convertidos / c.total) * 100 : 0,
    })).sort((a, b) => b.taxa - a.taxa);
  }, [filtered]);

  const totalAll = conversoes.reduce((s, c) => s + c.total, 0);
  const totalConvertidos = conversoes.reduce((s, c) => s + c.convertidos, 0);
  const taxaGeral = totalAll > 0 ? (totalConvertidos / totalAll) * 100 : 0;
  const valorTotalConvertido = conversoes.reduce((s, c) => s + c.valorConvertido, 0);

  const chartData = conversoes.map(c => ({
    name: c.vendedorName.length > 12 ? c.vendedorName.slice(0, 12) + "…" : c.vendedorName,
    taxa: Math.round(c.taxa * 10) / 10,
    convertidos: c.convertidos,
    total: c.total,
  }));

  const handleExportPDF = () => {
    const headers = ["Vendedor", "Total", "Convertidos", "Taxa %", "Valor Convertido"];
    const rows = conversoes.map(c => [
      c.vendedorName, String(c.total), String(c.convertidos),
      `${c.taxa.toFixed(1)}%`, formatBRL(c.valorConvertido),
    ]);
    exportReportPDF("Relatório de Conversão", headers, rows, [
      { label: "Orçamentos Totais", value: String(totalAll) },
      { label: "Convertidos", value: String(totalConvertidos) },
      { label: "Taxa de Conversão", value: `${taxaGeral.toFixed(1)}%` },
    ]);
  };

  if (!tenantId) return null;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <p className="text-xs text-muted-foreground">Total de Orçamentos</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{totalAll}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Convertidos</p>
          <p className="text-lg font-semibold tabular-nums text-success">{totalConvertidos}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{taxaGeral.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor Convertido</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(valorTotalConvertido)}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Taxa de Conversão por Vendedor</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  formatter={(v: number, name: string) => [name === "taxa" ? `${v}%` : v, name === "taxa" ? "Taxa de Conversão" : name]}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="taxa" name="Taxa %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Progress bars */}
      {conversoes.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Conversão por Vendedor</h4>
          <div className="space-y-3">
            {conversoes.map(c => (
              <div key={c.vendedorId} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{c.vendedorName}</span>
                  <span className="text-muted-foreground">{c.convertidos}/{c.total} ({c.taxa.toFixed(0)}%)</span>
                </div>
                <Progress value={c.taxa} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail table */}
      {conversoes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum orçamento com vendedor vinculado encontrado.</p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Autorizados</TableHead>
                <TableHead className="text-right">Rascunho</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Valor Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversoes.map((c) => (
                <TableRow key={c.vendedorId}>
                  <TableCell className="font-medium text-foreground">{c.vendedorName}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{c.total}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{c.convertidos}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{c.autorizados}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{c.rascunho}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-primary">{c.taxa.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{formatBRL(c.valorConvertido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
