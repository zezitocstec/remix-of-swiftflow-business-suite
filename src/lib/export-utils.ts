import { formatBRL } from "@/lib/mock-data";
import type { ActionLog, SaleRecord } from "@/contexts/ProductContext";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLogsCSV(logs: ActionLog[]) {
  const headers = ["Data/Hora", "Tipo", "Operador", "Terminal", "Descrição", "Valor"];
  const rows = logs.map(log => [
    `${log.date.toLocaleDateString("pt-BR")} ${log.date.toLocaleTimeString("pt-BR")}`,
    log.type,
    log.operatorName,
    log.terminalName,
    log.description,
    log.amount ? formatBRL(log.amount) : "",
  ]);
  downloadCSV(`logs_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportSalesCSV(sales: SaleRecord[]) {
  const headers = ["Data/Hora", "ID", "Terminal", "Operador", "Cliente", "Itens", "Pagamento", "Total"];
  const rows = sales.map(s => [
    `${s.date.toLocaleDateString("pt-BR")} ${s.date.toLocaleTimeString("pt-BR")}`,
    s.id.slice(0, 8),
    s.terminalName || "",
    s.operatorName || "",
    s.clientName || "",
    String(s.items.reduce((acc, i) => acc + i.quantity, 0)),
    s.methods.map(m => m.method).join("+"),
    formatBRL(s.total),
  ]);
  downloadCSV(`vendas_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportRevenueCSV(data: { month: string; revenue: number; sales: number; ticket: number }[]) {
  const headers = ["Mês", "Faturamento", "Vendas", "Ticket Médio"];
  const rows = data.map(d => [d.month, formatBRL(d.revenue), String(d.sales), formatBRL(d.ticket)]);
  downloadCSV(`faturamento_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}
