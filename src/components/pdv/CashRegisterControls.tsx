import { useState } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Lock, Unlock, ArrowDownLeft, ArrowUpRight, Printer, Banknote } from "lucide-react";
import type { CashRegister } from "@/contexts/ProductContext";

function printClosingReport(report: CashRegister & { salesByMethod: Record<string, number>; totalSales: number; totalWithdrawals: number; totalDeposits: number; expectedCash: number }) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  const openDate = report.openedAt.toLocaleString("pt-BR");
  const closeDate = report.closedAt?.toLocaleString("pt-BR") || new Date().toLocaleString("pt-BR");

  const methodsHtml = Object.entries(report.salesByMethod).map(([method, amount]) =>
    `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span>${method}</span><span>${formatBRL(amount)}</span></div>`
  ).join("");

  const movementsHtml = [
    ...report.withdrawals.map(w => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#c00"><span>Sangria: ${w.reason}</span><span>-${formatBRL(w.amount)}</span></div>`),
    ...report.deposits.map(d => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#090"><span>Reforço: ${d.reason}</span><span>+${formatBRL(d.amount)}</span></div>`),
  ].join("");

  printWindow.document.write(`<html><head><title>Fechamento de Caixa</title>
    <style>@media print { body { margin: 0; } @page { size: 80mm auto; margin: 0; } }</style>
    </head><body>
    <div style="width:280px;font-family:monospace;padding:16px">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:12px">FECHAMENTO DE CAIXA</div>
      <div style="border-top:1px dashed #000;padding:6px 0;font-size:11px">
        <div><strong>Abertura:</strong> ${openDate}</div>
        <div><strong>Fechamento:</strong> ${closeDate}</div>
      </div>
      <div style="border-top:1px dashed #000;padding:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Saldo Inicial</span><span>${formatBRL(report.openingBalance)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:4px"><span>Total Vendas</span><span>${formatBRL(report.totalSales)}</span></div>
      </div>
      ${methodsHtml ? `<div style="border-top:1px dashed #000;padding:8px 0"><div style="font-size:10px;color:#666;margin-bottom:4px">POR MÉTODO</div>${methodsHtml}</div>` : ''}
      ${movementsHtml ? `<div style="border-top:1px dashed #000;padding:8px 0"><div style="font-size:10px;color:#666;margin-bottom:4px">MOVIMENTAÇÕES</div>${movementsHtml}</div>` : ''}
      <div style="border-top:1px dashed #000;padding:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Sangrias</span><span>-${formatBRL(report.totalWithdrawals)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>Reforços</span><span>+${formatBRL(report.totalDeposits)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:4px;border-top:1px solid #000;padding-top:4px"><span>Dinheiro Esperado</span><span>${formatBRL(report.expectedCash)}</span></div>
      </div>
    </div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

export default function CashRegisterControls() {
  const { cashRegister, openCashRegister, closeCashRegister, addWithdrawal, addDeposit } = useProducts();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"sangria" | "reforco" | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionReason, setActionReason] = useState("");

  const handleOpen = () => {
    const balance = parseFloat(openingBalance) || 0;
    openCashRegister(balance, "Operador");
    toast({ title: "Caixa aberto", description: `Saldo inicial: ${formatBRL(balance)}` });
    setOpenDialog(false);
    setOpeningBalance("");
  };

  const handleClose = () => {
    const report = closeCashRegister();
    if (report) {
      const totalSales = report.sales.reduce((s, v) => s + v.amount, 0);
      const cashSales = report.sales.filter(s => s.method === "Dinheiro").reduce((s, v) => s + v.amount, 0);
      const totalWithdrawals = report.withdrawals.reduce((s, v) => s + v.amount, 0);
      const totalDeposits = report.deposits.reduce((s, v) => s + v.amount, 0);
      const expectedCash = report.openingBalance + cashSales - totalWithdrawals + totalDeposits;
      const salesByMethod = report.sales.reduce((acc, s) => { acc[s.method] = (acc[s.method] || 0) + s.amount; return acc; }, {} as Record<string, number>);

      printClosingReport({ ...report, salesByMethod, totalSales, totalWithdrawals, totalDeposits, expectedCash });
      toast({ title: "Caixa fechado", description: `Total vendas: ${formatBRL(totalSales)}` });
    }
    setCloseDialog(false);
  };

  const handleAction = () => {
    const amt = parseFloat(actionAmount);
    if (!amt || amt <= 0) return;
    if (actionDialog === "sangria") {
      addWithdrawal(amt, actionReason || "Sangria");
      toast({ title: "Sangria registrada", description: formatBRL(amt) });
    } else {
      addDeposit(amt, actionReason || "Reforço");
      toast({ title: "Reforço registrado", description: formatBRL(amt) });
    }
    setActionDialog(null);
    setActionAmount("");
    setActionReason("");
  };

  if (!cashRegister) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpenDialog(true)} className="h-8 text-xs touch-manipulation shrink-0" title="Abrir Caixa">
          <Unlock className="h-3.5 w-3.5 mr-1" /> Abrir Caixa
        </Button>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle><DialogDescription>Informe o saldo inicial em dinheiro.</DialogDescription></DialogHeader>
            <Input type="number" inputMode="decimal" placeholder="Saldo inicial (R$)" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="h-12 text-lg text-center" autoFocus />
            <DialogFooter><Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button><Button onClick={handleOpen}>Abrir Caixa</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const totalSales = cashRegister.sales.reduce((s, v) => s + v.amount, 0);

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5 bg-success/10 text-success rounded-md px-2 py-1 text-xs font-medium">
          <Banknote className="h-3 w-3" />
          <span className="hidden sm:inline">{cashRegister.operatorName} •</span>
          <span className="tabular-nums">{formatBRL(totalSales)}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setActionDialog("sangria")} className="h-8 px-2 text-xs touch-manipulation" title="Sangria">
          <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setActionDialog("reforco")} className="h-8 px-2 text-xs touch-manipulation" title="Reforço">
          <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCloseDialog(true)} className="h-8 px-2 text-xs touch-manipulation" title="Fechar Caixa">
          <Lock className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {/* Close confirmation */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle><DialogDescription>O relatório será impresso automaticamente. Confirma o fechamento?</DialogDescription></DialogHeader>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Vendas</span><span className="font-medium tabular-nums text-foreground">{formatBRL(totalSales)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sangrias</span><span className="font-medium tabular-nums text-destructive">-{formatBRL(cashRegister.withdrawals.reduce((s, v) => s + v.amount, 0))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reforços</span><span className="font-medium tabular-nums text-success">+{formatBRL(cashRegister.deposits.reduce((s, v) => s + v.amount, 0))}</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button><Button variant="destructive" onClick={handleClose}><Printer className="h-4 w-4 mr-1" /> Fechar e Imprimir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sangria / Reforço dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{actionDialog === "sangria" ? "Sangria" : "Reforço"}</DialogTitle><DialogDescription>{actionDialog === "sangria" ? "Retirada de dinheiro do caixa" : "Entrada de dinheiro no caixa"}</DialogDescription></DialogHeader>
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
