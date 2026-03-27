import { useState, useMemo } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Clock, User, Monitor, ShoppingCart, XCircle, ArrowUpRight, ArrowDownLeft, Lock, Unlock, Filter, CalendarIcon, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportLogsCSV } from "@/lib/export-utils";

const typeLabels: Record<string, { label: string; color: string; Icon: any }> = {
  abertura_caixa: { label: "Abertura de Caixa", color: "bg-success/10 text-success", Icon: Unlock },
  fechamento_caixa: { label: "Fechamento de Caixa", color: "bg-destructive/10 text-destructive", Icon: Lock },
  venda: { label: "Venda", color: "bg-primary/10 text-primary", Icon: ShoppingCart },
  cancelamento_item: { label: "Cancel. Item", color: "bg-warning/10 text-warning", Icon: XCircle },
  cancelamento_cupom: { label: "Cancel. Cupom", color: "bg-destructive/10 text-destructive", Icon: XCircle },
  sangria: { label: "Sangria", color: "bg-destructive/10 text-destructive", Icon: ArrowUpRight },
  reforco: { label: "Reforço", color: "bg-success/10 text-success", Icon: ArrowDownLeft },
};

const allTypes = Object.keys(typeLabels);

export default function LogsConfig() {
  const { actionLogs, operators, terminals } = useProducts();

  const [filterOperator, setFilterOperator] = useState("all");
  const [filterTerminal, setFilterTerminal] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return actionLogs.filter((log) => {
      if (filterOperator !== "all" && log.operatorId !== filterOperator) return false;
      if (filterTerminal !== "all" && log.terminalId !== filterTerminal) return false;
      if (filterType !== "all" && log.type !== filterType) return false;
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        if (log.date < start) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (log.date > end) return false;
      }
      return true;
    });
  }, [actionLogs, filterOperator, filterTerminal, filterType, dateFrom, dateTo]);

  const hasFilters = filterOperator !== "all" || filterTerminal !== "all" || filterType !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setFilterOperator("all");
    setFilterTerminal("all");
    setFilterType("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Histórico de Ações</h3>
        <p className="text-sm text-muted-foreground">Registro de todas as operações realizadas no PDV</p>
      </div>

      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Operador</label>
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Terminal</label>
            <Select value={filterTerminal} onValueChange={setFilterTerminal}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {terminals.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo de Ação</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {allTypes.map((t) => (
                  <SelectItem key={t} value={t}>{typeLabels[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 flex-1 text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 flex-1 text-xs justify-start", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Results summary */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} registro{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        {hasFilters ? " (filtrado)" : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação encontrada com os filtros selecionados.</p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Data/Hora</th>
                <th className="text-left py-2.5 px-4 font-medium">Tipo</th>
                <th className="text-left py-2.5 px-4 font-medium">Operador</th>
                <th className="text-left py-2.5 px-4 font-medium">Terminal</th>
                <th className="text-left py-2.5 px-4 font-medium">Descrição</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const info = typeLabels[log.type] || { label: log.type, color: "bg-muted text-muted-foreground", Icon: Clock };
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {log.date.toLocaleDateString("pt-BR")} {log.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${info.color}`}>{info.label}</span>
                    </td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.operatorName}</td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.terminalName}</td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.description}</td>
                    <td className="py-2 px-4 text-right tabular-nums text-foreground text-xs">{log.amount ? formatBRL(log.amount) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
