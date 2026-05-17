import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { DollarSign, ArrowDownLeft, ArrowUpRight, Lock, Unlock, Banknote } from "lucide-react";

export default function Caixa() {
  const { cashRegister, openCashRegister, closeCashRegister, addWithdrawal, addDeposit, sales, operators, terminals } = useProducts();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"sangria" | "reforco" | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [closedReport, setClosedReport] = useState<any>(null);
  const [selectedOpId, setSelectedOpId] = useState(operators[0]?.id || "");
  const [selectedTermId, setSelectedTermId] = useState(terminals[0]?.id || "");

  const handleOpen = async () => {
    const balance = parseFloat(openingBalance) || 0;
    try {
      await openCashRegister(balance, selectedOpId, selectedTermId);
      toast({ title: "Caixa aberto", description: `Saldo inicial: ${formatBRL(balance)}` });
    } catch (err: any) {
      toast({ title: "Erro ao abrir caixa", description: err.message, variant: "destructive" });
    }
    setOpenDialog(false);
    setOpeningBalance("");
  };

  const handleClose = () => {
    const report = closeCashRegister();
    if (report) { setClosedReport(report); toast({ title: "Caixa fechado" }); }
    setCloseDialog(false);
  };

  const handleAction = () => {
    const amt = parseFloat(actionAmount);
    if (!amt || amt <= 0) return;
    if (actionDialog === "sangria") { addWithdrawal(amt, actionReason || "Sangria"); toast({ title: "Sangria registrada", description: formatBRL(amt) }); }
    else { addDeposit(amt, actionReason || "Reforço"); toast({ title: "Reforço registrado", description: formatBRL(amt) }); }
    setActionDialog(null); setActionAmount(""); setActionReason("");
  };

  // Vendas fiado não entram no fechamento do caixa (vão para Contas a Receber / relatórios)
  const isFiado = (m: string) => m?.startsWith("Pedido (Fiado)") || m?.toLowerCase().includes("fiado");
  const realSales = cashRegister?.sales.filter((s) => !isFiado(s.method)) || [];
  const fiadoSales = cashRegister?.sales.filter((s) => isFiado(s.method)) || [];
  const cashSales = realSales.filter((s) => s.method === "Dinheiro").reduce((s, v) => s + v.amount, 0);
  const totalSales = realSales.reduce((s, v) => s + v.amount, 0);
  const totalFiado = fiadoSales.reduce((s, v) => s + v.amount, 0);
  const totalWithdrawals = cashRegister?.withdrawals.reduce((s, v) => s + v.amount, 0) || 0;
  const totalDeposits = cashRegister?.deposits.reduce((s, v) => s + v.amount, 0) || 0;
  const expectedCash = (cashRegister?.openingBalance || 0) + cashSales - totalWithdrawals + totalDeposits;
  // Total geral do fechamento: vendas reais (todos os métodos não-fiado) + fundo + reforços - sangrias
  const closingTotal = (cashRegister?.openingBalance || 0) + totalSales + totalDeposits - totalWithdrawals;

  const salesByMethod = realSales.reduce((acc, s) => { acc[s.method] = (acc[s.method] || 0) + s.amount; return acc; }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Caixa" subtitle={cashRegister ? `${cashRegister.terminalName} — aberto` : "Caixa fechado"} />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-6">
        {!cashRegister ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Caixa Fechado</p>
            <Button onClick={() => setOpenDialog(true)} className="h-12 px-8"><Unlock className="h-4 w-4 mr-2" /> Abrir Caixa</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Saldo Inicial</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(cashRegister.openingBalance)}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium">Total Vendas (sem fiado)</p>
                <p className="text-lg font-semibold tabular-nums text-success">{formatBRL(totalSales)}</p>
                {totalFiado > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Fiado: {formatBRL(totalFiado)} (não entra no caixa)</p>}
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

            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">Fechamento previsto (Fundo + Vendas + Reforços − Sangrias)</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
                <span className="text-foreground">{formatBRL(cashRegister.openingBalance)}</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-success">{formatBRL(totalSales)}</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-success">{formatBRL(totalDeposits)}</span>
                <span className="text-muted-foreground">−</span>
                <span className="text-destructive">{formatBRL(totalWithdrawals)}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-lg font-semibold text-primary">{formatBRL(closingTotal)}</span>
              </div>
            </div>

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

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActionDialog("sangria")} className="flex-1"><ArrowUpRight className="h-4 w-4 mr-1 text-destructive" /> Sangria</Button>
              <Button variant="outline" onClick={() => setActionDialog("reforco")} className="flex-1"><ArrowDownLeft className="h-4 w-4 mr-1 text-success" /> Reforço</Button>
              <Button variant="destructive" onClick={() => setCloseDialog(true)}><Lock className="h-4 w-4 mr-1" /> Fechar Caixa</Button>
            </div>
          </>
        )}

        {closedReport && (() => {
          const repFiado = (closedReport.sales as any[]).filter((s) => isFiado(s.method));
          const repReal = (closedReport.sales as any[]).filter((s) => !isFiado(s.method));
          const repByMethod = repReal.reduce((acc: Record<string, number>, s: any) => { acc[s.method] = (acc[s.method] || 0) + s.amount; return acc; }, {});
          const repTotalReal = repReal.reduce((s: number, v: any) => s + v.amount, 0);
          const repTotalFiado = repFiado.reduce((s: number, v: any) => s + v.amount, 0);
          const repWith = (closedReport.withdrawals as any[]).reduce((s, v) => s + v.amount, 0);
          const repDep = (closedReport.deposits as any[]).reduce((s, v) => s + v.amount, 0);
          const repClosing = closedReport.openingBalance + repTotalReal + repDep - repWith;
          return (
            <div className="rounded-md border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Relatório de Fechamento</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Operador:</span><span className="text-foreground">{closedReport.operatorName}</span>
                <span className="text-muted-foreground">Terminal:</span><span className="text-foreground">{closedReport.terminalName}</span>
                <span className="text-muted-foreground">Abertura:</span><span className="text-foreground">{closedReport.openedAt.toLocaleString("pt-BR")}</span>
                <span className="text-muted-foreground">Fechamento:</span><span className="text-foreground">{closedReport.closedAt?.toLocaleString("pt-BR")}</span>
              </div>

              <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vendas por método</p>
                {Object.entries(repByMethod).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma venda.</p>}
                {Object.entries(repByMethod).map(([m, v]) => (
                  <div key={m} className="flex justify-between"><span className="text-foreground">{m}</span><span className="tabular-nums text-foreground">{formatBRL(v as number)}</span></div>
                ))}
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5 font-medium"><span>Subtotal vendas</span><span className="tabular-nums">{formatBRL(repTotalReal)}</span></div>
              </div>

              <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">(+) Fundo de Caixa</span><span className="tabular-nums text-foreground">{formatBRL(closedReport.openingBalance)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">(+) Vendas do dia</span><span className="tabular-nums text-foreground">{formatBRL(repTotalReal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">(+) Reforços</span><span className="tabular-nums text-success">{formatBRL(repDep)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">(−) Sangrias</span><span className="tabular-nums text-destructive">-{formatBRL(repWith)}</span></div>
                <div className="flex justify-between border-t border-border pt-2 mt-2 text-base font-semibold"><span>Fechamento do Caixa</span><span className="tabular-nums text-primary">{formatBRL(repClosing)}</span></div>
              </div>

              {repTotalFiado > 0 && (
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  <p>Vendas no fiado: <span className="tabular-nums">{formatBRL(repTotalFiado)}</span> — não entram no fechamento, ficam registradas em Contas a Receber e nos relatórios.</p>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setClosedReport(null)}>Fechar Relatório</Button>
            </div>
          );
        })()}
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle><DialogDescription>Selecione operador, terminal e saldo inicial.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select value={selectedOpId} onChange={(e) => setSelectedOpId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {operators.filter(o => o.ativo).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {terminals.filter(t => t.ativo).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <Input type="number" inputMode="decimal" placeholder="Saldo inicial (R$)" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="h-12 text-lg text-center" autoFocus />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button><Button onClick={handleOpen}>Abrir Caixa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle><DialogDescription>Confirma o fechamento do caixa?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button><Button variant="destructive" onClick={handleClose}>Fechar Caixa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
