import { useState } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Lock, ArrowDownLeft, ArrowUpRight, Printer, Banknote, AlertTriangle, CheckCircle } from "lucide-react";
import type { CashRegister } from "@/contexts/ProductContext";

interface ClosingReportData extends CashRegister {
  salesByMethod: Record<string, number>;
  totalSales: number;
  totalWithdrawals: number;
  totalDeposits: number;
  expectedCash: number;
  countedValues?: Record<string, number>;
  difference?: number;
}

function printClosingReport(report: ClosingReportData) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const openDate = report.openedAt.toLocaleString("pt-BR");
  const closeDate = report.closedAt?.toLocaleString("pt-BR") || new Date().toLocaleString("pt-BR");

  const methodsHtml = Object.entries(report.salesByMethod).map(([method, amount]) => {
    const counted = report.countedValues?.[method] ?? amount;
    const diff = counted - amount;
    return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0">
      <span>${method}</span>
      <span>Sist: ${formatBRL(amount)} | Inf: ${formatBRL(counted)}${diff !== 0 ? ` | Dif: ${diff > 0 ? "+" : ""}${formatBRL(diff)}` : ""}</span>
    </div>`;
  }).join("");

  const movementsHtml = [
    ...report.withdrawals.map(w => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#c00"><span>Sangria: ${w.reason}</span><span>-${formatBRL(w.amount)}</span></div>`),
    ...report.deposits.map(d => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#090"><span>Reforço: ${d.reason}</span><span>+${formatBRL(d.amount)}</span></div>`),
  ].join("");

  const diff = report.difference ?? 0;
  const diffHtml = diff !== 0
    ? `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;color:${diff > 0 ? '#090' : '#c00'};margin-top:4px;border-top:1px solid #000;padding-top:4px"><span>${diff > 0 ? "SOBRA" : "FALTA"}</span><span>${diff > 0 ? "+" : ""}${formatBRL(diff)}</span></div>`
    : `<div style="text-align:center;font-size:12px;font-weight:bold;color:#090;margin-top:4px;border-top:1px solid #000;padding-top:4px">✓ CAIXA CONFERIDO - SEM DIFERENÇA</div>`;

  printWindow.document.write(`<html><head><title>Fechamento de Caixa</title>
    <style>@media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }</style>
    </head><body>
    <div style="width:280px;font-family:monospace;padding:16px">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:12px">FECHAMENTO DE CAIXA</div>
      <div style="border-top:1px dashed #000;padding:6px 0;font-size:11px">
        <div><strong>Operador:</strong> ${report.operatorName}</div>
        <div><strong>Terminal:</strong> ${report.terminalName}</div>
        <div><strong>Abertura:</strong> ${openDate}</div>
        <div><strong>Fechamento:</strong> ${closeDate}</div>
      </div>
      <div style="border-top:1px dashed #000;padding:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Saldo Inicial</span><span>${formatBRL(report.openingBalance)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:4px"><span>Total Vendas</span><span>${formatBRL(report.totalSales)}</span></div>
      </div>
      ${methodsHtml ? `<div style="border-top:1px dashed #000;padding:8px 0"><div style="font-size:10px;color:#666;margin-bottom:4px">CONFERÊNCIA POR MÉTODO</div>${methodsHtml}</div>` : ''}
      ${movementsHtml ? `<div style="border-top:1px dashed #000;padding:8px 0"><div style="font-size:10px;color:#666;margin-bottom:4px">MOVIMENTAÇÕES</div>${movementsHtml}</div>` : ''}
      <div style="border-top:1px dashed #000;padding:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Sangrias</span><span>-${formatBRL(report.totalWithdrawals)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Reforços</span><span>+${formatBRL(report.totalDeposits)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:4px;border-top:1px solid #000;padding-top:4px"><span>Dinheiro Esperado</span><span>${formatBRL(report.expectedCash)}</span></div>
        ${diffHtml}
      </div>
    </div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

export function printMovementReceipt(type: "sangria" | "reforco", amount: number, reason: string, operatorName: string, terminalName: string) {
  const printWindow = window.open("", "_blank", "width=320,height=400");
  if (!printWindow) return;
  const now = new Date();
  const label = type === "sangria" ? "SANGRIA" : "REFORÇO";
  const color = type === "sangria" ? "#c00" : "#090";
  printWindow.document.write(`<html><head><title>${label}</title>
    <style>@media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }</style>
    </head><body>
    <div style="width:280px;font-family:monospace;padding:16px">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:12px">${label}</div>
      <div style="border-top:1px dashed #000;padding:8px 0;font-size:11px">
        <div><strong>Operador:</strong> ${operatorName}</div>
        <div><strong>Terminal:</strong> ${terminalName}</div>
        <div><strong>Data:</strong> ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div style="border-top:1px dashed #000;padding:12px 0;text-align:center">
        <div style="font-size:10px;color:#666;margin-bottom:4px">VALOR</div>
        <div style="font-size:18px;font-weight:bold;color:${color}">${type === "sangria" ? "-" : "+"}${formatBRL(amount)}</div>
      </div>
      ${reason ? `<div style="border-top:1px dashed #000;padding:8px 0;font-size:11px"><strong>Motivo:</strong> ${reason}</div>` : ''}
      <div style="text-align:center;margin-top:12px;font-size:9px;color:#666">Via Única</div>
    </div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

export default function CashRegisterControls() {
  const { cashRegister, closeCashRegister, addWithdrawal, addDeposit, addActionLog } = useProducts();
  const [closeDialog, setCloseDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"sangria" | "reforco" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionReason, setActionReason] = useState("");

  // Reconciliation counted values
  const [countedDinheiro, setCountedDinheiro] = useState("");
  const [countedPix, setCountedPix] = useState("");
  const [countedCredito, setCountedCredito] = useState("");
  const [countedDebito, setCountedDebito] = useState("");
  const [countedFiado, setCountedFiado] = useState("");

  const resetCounted = () => {
    setCountedDinheiro("");
    setCountedPix("");
    setCountedCredito("");
    setCountedDebito("");
    setCountedFiado("");
  };

  const handleClose = async () => {
    if (!cashRegister) return;
    const cr = cashRegister;

    const salesByMethod = cr.sales.reduce((acc, s) => { acc[s.method] = (acc[s.method] || 0) + s.amount; return acc; }, {} as Record<string, number>);
    const totalSales = cr.sales.reduce((s, v) => s + v.amount, 0);
    const totalWithdrawals = cr.withdrawals.reduce((s, v) => s + v.amount, 0);
    const totalDeposits = cr.deposits.reduce((s, v) => s + v.amount, 0);
    const cashSales = salesByMethod["Dinheiro"] || 0;
    const expectedCash = cr.openingBalance + cashSales - totalWithdrawals + totalDeposits;

    const countedValues: Record<string, number> = {};
    if (salesByMethod["Dinheiro"] !== undefined || countedDinheiro) countedValues["Dinheiro"] = parseFloat(countedDinheiro) || 0;
    if (salesByMethod["PIX"] !== undefined || countedPix) countedValues["PIX"] = parseFloat(countedPix) || 0;
    if (salesByMethod["Crédito"] !== undefined || countedCredito) countedValues["Crédito"] = parseFloat(countedCredito) || 0;
    if (salesByMethod["Débito"] !== undefined || countedDebito) countedValues["Débito"] = parseFloat(countedDebito) || 0;
    if (salesByMethod["Pedido (Fiado)"] !== undefined || countedFiado) countedValues["Pedido (Fiado)"] = parseFloat(countedFiado) || 0;

    // Total counted vs total system
    const allMethods = new Set([...Object.keys(salesByMethod), ...Object.keys(countedValues)]);
    let totalCounted = 0;
    let totalSystem = 0;
    allMethods.forEach(m => {
      totalCounted += countedValues[m] ?? (salesByMethod[m] || 0);
      totalSystem += salesByMethod[m] || 0;
    });
    // Add opening balance + deposits - withdrawals for cash reconciliation
    const totalCountedWithCash = totalCounted + (countedValues["Dinheiro"] !== undefined ? (cr.openingBalance - totalWithdrawals + totalDeposits) : 0);
    const difference = totalCounted - totalSystem;

    await addActionLog({
      type: "fechamento_caixa", operatorId: cr.operatorId, operatorName: cr.operatorName,
      terminalId: cr.terminalId, terminalName: cr.terminalName,
      description: `Caixa fechado | Diferença: ${difference === 0 ? "R$ 0,00" : formatBRL(difference)}`,
    });

    const report = await closeCashRegister();
    if (report) {
      printClosingReport({
        ...report, salesByMethod, totalSales, totalWithdrawals, totalDeposits, expectedCash,
        countedValues, difference,
      });
      toast({ title: "Caixa fechado", description: `Total vendas: ${formatBRL(totalSales)}${difference !== 0 ? ` • Diferença: ${formatBRL(difference)}` : ""}` });
    }
    setCloseDialog(false);
    resetCounted();
  };

  const handleAction = () => {
    if (!cashRegister) return;
    const amt = parseFloat(actionAmount);
    if (!amt || amt <= 0) return;
    if (actionDialog === "sangria") {
      addWithdrawal(amt, actionReason || "Sangria");
      addActionLog({
        type: "sangria", operatorId: cashRegister.operatorId, operatorName: cashRegister.operatorName,
        terminalId: cashRegister.terminalId, terminalName: cashRegister.terminalName,
        description: `Sangria: ${actionReason || "Sangria"}`, amount: amt,
      });
      printMovementReceipt("sangria", amt, actionReason || "Sangria", cashRegister.operatorName, cashRegister.terminalName);
      toast({ title: "Sangria registrada", description: formatBRL(amt) });
    } else {
      addDeposit(amt, actionReason || "Reforço");
      addActionLog({
        type: "reforco", operatorId: cashRegister.operatorId, operatorName: cashRegister.operatorName,
        terminalId: cashRegister.terminalId, terminalName: cashRegister.terminalName,
        description: `Reforço: ${actionReason || "Reforço"}`, amount: amt,
      });
      printMovementReceipt("reforco", amt, actionReason || "Reforço", cashRegister.operatorName, cashRegister.terminalName);
      toast({ title: "Reforço registrado", description: formatBRL(amt) });
    }
    setActionDialog(null);
    setActionAmount("");
    setActionReason("");
  };

  if (!cashRegister) return null;

  const totalSales = cashRegister.sales.reduce((s, v) => s + v.amount, 0);
  const salesByMethod = cashRegister.sales.reduce((acc, s) => { acc[s.method] = (acc[s.method] || 0) + s.amount; return acc; }, {} as Record<string, number>);
  const totalWithdrawals = cashRegister.withdrawals.reduce((s, v) => s + v.amount, 0);
  const totalDeposits = cashRegister.deposits.reduce((s, v) => s + v.amount, 0);
  const cashSales = salesByMethod["Dinheiro"] || 0;
  const expectedCash = cashRegister.openingBalance + cashSales - totalWithdrawals + totalDeposits;

  // Calculate difference for preview
  const getCountedTotal = () => {
    let total = 0;
    if (salesByMethod["Dinheiro"] !== undefined || countedDinheiro) total += parseFloat(countedDinheiro) || 0;
    if (salesByMethod["PIX"] !== undefined || countedPix) total += parseFloat(countedPix) || 0;
    if (salesByMethod["Crédito"] !== undefined || countedCredito) total += parseFloat(countedCredito) || 0;
    if (salesByMethod["Débito"] !== undefined || countedDebito) total += parseFloat(countedDebito) || 0;
    if (salesByMethod["Pedido (Fiado)"] !== undefined || countedFiado) total += parseFloat(countedFiado) || 0;
    return total;
  };
  const countedTotal = getCountedTotal();
  const hasCountedAnything = countedDinheiro || countedPix || countedCredito || countedDebito || countedFiado;
  const difference = hasCountedAnything ? countedTotal - totalSales : 0;

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5 bg-success/10 text-success rounded-md px-2 py-1 text-xs font-medium">
          <Banknote className="h-3 w-3" />
          <span className="hidden sm:inline">{cashRegister.operatorName} • {cashRegister.terminalName} •</span>
          <span className="tabular-nums">{formatBRL(totalSales)}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setActionDialog("sangria")} className="h-8 px-2 text-xs touch-manipulation" title="Sangria">
          <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setActionDialog("reforco")} className="h-8 px-2 text-xs touch-manipulation" title="Reforço">
          <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { resetCounted(); setCloseDialog(true); }} className="h-8 px-2 text-xs touch-manipulation" title="Fechar Caixa (F5)">
          <Lock className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {/* Close / Reconciliation Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
            <DialogDescription>Informe os valores contados para cada método de pagamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="text-sm space-y-1 bg-secondary/50 rounded-lg p-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo Inicial</span><span className="tabular-nums text-foreground">{formatBRL(cashRegister.openingBalance)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Vendas (Sistema)</span><span className="font-medium tabular-nums text-foreground">{formatBRL(totalSales)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sangrias</span><span className="tabular-nums text-destructive">-{formatBRL(totalWithdrawals)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reforços</span><span className="tabular-nums text-success">+{formatBRL(totalDeposits)}</span></div>
              <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground font-medium">Dinheiro Esperado</span><span className="font-bold tabular-nums text-primary">{formatBRL(expectedCash)}</span></div>
            </div>

            {/* Counted values inputs */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valores Informados pelo Operador</p>
              
              {(salesByMethod["Dinheiro"] !== undefined || true) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Dinheiro</span>
                  <Input type="number" inputMode="decimal" placeholder={formatBRL(salesByMethod["Dinheiro"] || 0)} value={countedDinheiro} onChange={(e) => setCountedDinheiro(e.target.value)} className="h-9 text-sm text-right tabular-nums" />
                  <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">Sist: {formatBRL(salesByMethod["Dinheiro"] || 0)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Crédito</span>
                <Input type="number" inputMode="decimal" placeholder={formatBRL(salesByMethod["Crédito"] || 0)} value={countedCredito} onChange={(e) => setCountedCredito(e.target.value)} className="h-9 text-sm text-right tabular-nums" />
                <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">Sist: {formatBRL(salesByMethod["Crédito"] || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Débito</span>
                <Input type="number" inputMode="decimal" placeholder={formatBRL(salesByMethod["Débito"] || 0)} value={countedDebito} onChange={(e) => setCountedDebito(e.target.value)} className="h-9 text-sm text-right tabular-nums" />
                <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">Sist: {formatBRL(salesByMethod["Débito"] || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">PIX</span>
                <Input type="number" inputMode="decimal" placeholder={formatBRL(salesByMethod["PIX"] || 0)} value={countedPix} onChange={(e) => setCountedPix(e.target.value)} className="h-9 text-sm text-right tabular-nums" />
                <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">Sist: {formatBRL(salesByMethod["PIX"] || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Fiado</span>
                <Input type="number" inputMode="decimal" placeholder={formatBRL(salesByMethod["Pedido (Fiado)"] || 0)} value={countedFiado} onChange={(e) => setCountedFiado(e.target.value)} className="h-9 text-sm text-right tabular-nums" />
                <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">Sist: {formatBRL(salesByMethod["Pedido (Fiado)"] || 0)}</span>
              </div>
            </div>

            {/* Difference display */}
            {hasCountedAnything && (
              <div className={`flex items-center gap-2 rounded-lg p-3 ${difference === 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                {difference === 0 ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {difference === 0 ? "Caixa conferido — sem diferença" : difference > 0 ? `Sobra de ${formatBRL(difference)}` : `Falta de ${formatBRL(Math.abs(difference))}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Informado: {formatBRL(countedTotal)} | Sistema: {formatBRL(totalSales)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClose}>
              <Printer className="h-4 w-4 mr-1" /> Fechar e Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sangria / Reforço Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{actionDialog === "sangria" ? "Sangria" : "Reforço"}</DialogTitle>
            <DialogDescription>{actionDialog === "sangria" ? "Retirada de dinheiro do caixa" : "Entrada de dinheiro no caixa"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="number" inputMode="decimal" placeholder="Valor (R$)" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} className="h-12 text-lg text-center" autoFocus />
            <Input placeholder="Motivo (opcional)" value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button><Button onClick={handleAction}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
