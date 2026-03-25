import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { DollarSign, ArrowDownLeft, ArrowUpRight, Lock, Unlock, Banknote } from "lucide-react";

export default function Caixa() {
  const { cashRegister, openCashRegister, closeCashRegister, addWithdrawal, addDeposit, sales } = useProducts();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"sangria" | "reforco" | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [closedReport, setClosedReport] = useState<any>(null);

  const handleOpen = () => {
    const balance = parseFloat(openingBalance) || 0;
    openCashRegister(balance, "op-admin");
    toast({ title: "Caixa aberto", description: `Saldo inicial: ${formatBRL(balance)}` });
    setOpenDialog(false);
    setOpeningBalance("");
  };

  const handleClose = () => {
    const report = closeCashRegister();
    if (report) {
      setClosedReport(report);
      toast({ title: "Caixa fechado" });
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

  // Calculate totals
  const cashSales = cashRegister?.sales.filter((s) => s.method === "Dinheiro").reduce((s, v) => s + v.amount, 0) || 0;
  const totalSales = cashRegister?.sales.reduce((s, v) => s + v.amount, 0) || 0;
  const totalWithdrawals = cashRegister?.withdrawals.reduce((s, v) => s + v.amount, 0) || 0;
  const totalDeposits = cashRegister?.deposits.reduce((s, v) => s + v.amount, 0) || 0;
  const expectedCash = (cashRegister?.openingBalance || 0) + cashSales - totalWithdrawals + totalDeposits;

  // Group sales by method
  const salesByMethod = cashRegister?.sales.reduce((acc, s) => {
    acc[s.method] = (acc[s.method] || 0) + s.amount;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Caixa" subtitle={cashRegister ? "Caixa aberto" : "Caixa fechado"} />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {!cashRegister ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Caixa Fechado</p>
            <Button onClick={() => setOpenDialog(true)} className="h-12 px-8">
              <Unlock className="h-4 w-4 mr-2" /> Abrir Caixa
            </Button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Saldo Inicial</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(cashRegister.openingBalance)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Vendas</p>
                <p className="text-lg font-semibold tabular-nums text-success">{formatBRL(totalSales)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Sangrias / Reforços</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">-{formatBRL(totalWithdrawals)} / +{formatBRL(totalDeposits)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Dinheiro Esperado</p>
                <p className="text-lg font-semibold tabular-nums text-primary">{formatBRL(expectedCash)}</p>
              </div>
            </div>

            {/* Sales by method */}
            <div className="rounded-md border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Vendas por Método</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(salesByMethod).map(([method, amount]) => (
                  <div key={method} className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{method}</p>
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatBRL(amount)}</p>
                    </div>
                  </div>
                ))}
                {Object.keys(salesByMethod).length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhuma venda registrada.</p>}
              </div>
            </div>

            {/* Movements */}
            {(cashRegister.withdrawals.length > 0 || cashRegister.deposits.length > 0) && (
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary text-muted-foreground">
                      <th className="text-left py-2.5 px-4 font-medium">Tipo</th>
                      <th className="text-left py-2.5 px-4 font-medium">Motivo</th>
                      <th className="text-right py-2.5 px-4 font-medium">Valor</th>
                      <th className="text-right py-2.5 px-4 font-medium">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRegister.withdrawals.map((w, i) => (
                      <tr key={`w${i}`} className="border-b border-border">
                        <td className="py-2 px-4"><span className="text-xs font-medium bg-destructive/10 text-destructive rounded-full px-2 py-0.5">Sangria</span></td>
                        <td className="py-2 px-4 text-foreground">{w.reason}</td>
                        <td className="py-2 px-4 text-right tabular-nums text-destructive">-{formatBRL(w.amount)}</td>
                        <td className="py-2 px-4 text-right text-muted-foreground text-xs">{w.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                    {cashRegister.deposits.map((d, i) => (
                      <tr key={`d${i}`} className="border-b border-border">
                        <td className="py-2 px-4"><span className="text-xs font-medium bg-success/10 text-success rounded-full px-2 py-0.5">Reforço</span></td>
                        <td className="py-2 px-4 text-foreground">{d.reason}</td>
                        <td className="py-2 px-4 text-right tabular-nums text-success">+{formatBRL(d.amount)}</td>
                        <td className="py-2 px-4 text-right text-muted-foreground text-xs">{d.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActionDialog("sangria")} className="flex-1">
                <ArrowUpRight className="h-4 w-4 mr-1 text-destructive" /> Sangria
              </Button>
              <Button variant="outline" onClick={() => setActionDialog("reforco")} className="flex-1">
                <ArrowDownLeft className="h-4 w-4 mr-1 text-success" /> Reforço
              </Button>
              <Button variant="destructive" onClick={() => setCloseDialog(true)}>
                <Lock className="h-4 w-4 mr-1" /> Fechar Caixa
              </Button>
            </div>
          </>
        )}

        {/* Closed report */}
        {closedReport && (
          <div className="rounded-md border border-border bg-card p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Relatório de Fechamento</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Abertura:</span><span className="text-foreground">{closedReport.openedAt.toLocaleString("pt-BR")}</span>
              <span className="text-muted-foreground">Fechamento:</span><span className="text-foreground">{closedReport.closedAt?.toLocaleString("pt-BR")}</span>
              <span className="text-muted-foreground">Saldo Inicial:</span><span className="tabular-nums text-foreground">{formatBRL(closedReport.openingBalance)}</span>
              <span className="text-muted-foreground">Total Vendas:</span><span className="tabular-nums text-foreground">{formatBRL(closedReport.sales.reduce((s: number, v: any) => s + v.amount, 0))}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setClosedReport(null)}>Fechar Relatório</Button>
          </div>
        )}
      </div>

      {/* Open dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle><DialogDescription>Informe o saldo inicial em dinheiro.</DialogDescription></DialogHeader>
          <Input type="number" inputMode="decimal" placeholder="Saldo inicial (R$)" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="h-12 text-lg text-center" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button><Button onClick={handleOpen}>Abrir Caixa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close confirmation */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle><DialogDescription>Confirma o fechamento do caixa?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button><Button variant="destructive" onClick={handleClose}>Fechar Caixa</Button></DialogFooter>
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
    </div>
  );
}
