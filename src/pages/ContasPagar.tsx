import { useState, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  DollarSign,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ContasPagar() {
  const { suppliers, bills, addSupplier, deleteSupplier, addBill, payBill, deleteBill } = useProducts();

  // Supplier form
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [sName, setSName] = useState("");
  const [sCnpj, setSCnpj] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sEmail, setSEmail] = useState("");

  // Bill form
  const [billOpen, setBillOpen] = useState(false);
  const [bDesc, setBDesc] = useState("");
  const [bAmount, setBAmount] = useState("");
  const [bDue, setBDue] = useState("");
  const [bSupplier, setBSupplier] = useState("");
  const [bCategory, setBCategory] = useState("fornecedor");

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterSupplier, setFilterSupplier] = useState<string>("todos");

  const now = new Date();

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (filterStatus === "pendente" && b.status !== "pendente") return false;
      if (filterStatus === "pago" && b.status !== "pago") return false;
      if (filterStatus === "vencido" && !(b.status === "pendente" && new Date(b.dueDate) < now)) return false;
      if (filterSupplier !== "todos" && b.supplierId !== filterSupplier) return false;
      return true;
    });
  }, [bills, filterStatus, filterSupplier, now]);

  const totalPendente = useMemo(
    () => bills.filter((b) => b.status === "pendente").reduce((s, b) => s + b.amount, 0),
    [bills]
  );
  const totalVencido = useMemo(
    () => bills.filter((b) => b.status === "pendente" && new Date(b.dueDate) < now).reduce((s, b) => s + b.amount, 0),
    [bills, now]
  );
  const totalPago = useMemo(
    () => bills.filter((b) => b.status === "pago").reduce((s, b) => s + b.amount, 0),
    [bills]
  );

  const handleAddSupplier = () => {
    if (!sName.trim()) return;
    addSupplier({ nome: sName, cnpj: sCnpj, telefone: sPhone, email: sEmail });
    setSName(""); setSCnpj(""); setSPhone(""); setSEmail("");
    setSupplierOpen(false);
    toast({ title: "Fornecedor cadastrado" });
  };

  const handleAddBill = () => {
    if (!bDesc.trim() || !bAmount || !bDue) return;
    addBill({
      description: bDesc,
      amount: parseFloat(bAmount),
      dueDate: new Date(bDue),
      supplierId: bSupplier || undefined,
      supplierName: bSupplier ? suppliers.find((s) => s.id === bSupplier)?.nome : undefined,
      category: bCategory,
      status: "pendente",
    });
    setBDesc(""); setBAmount(""); setBDue(""); setBSupplier(""); setBCategory("fornecedor");
    setBillOpen(false);
    toast({ title: "Conta cadastrada" });
  };

  const getDueStatus = (b: typeof bills[0]) => {
    if (b.status === "pago") return { label: "Pago", cls: "bg-success/10 text-success", icon: CheckCircle2 };
    const due = new Date(b.dueDate);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Vencido", cls: "bg-destructive/10 text-destructive", icon: AlertTriangle };
    if (diff <= 3) return { label: `Vence em ${diff}d`, cls: "bg-warning/10 text-warning", icon: Clock };
    return { label: "Pendente", cls: "bg-secondary text-muted-foreground", icon: Clock };
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Contas a Pagar" subtitle="Fornecedores e vencimentos" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-warning/10"><Clock className="h-4 w-4 text-warning" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pendente</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalPendente)}</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-destructive/10"><AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Vencido</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalVencido)}</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-success/10"><CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pago (mês)</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalPago)}</p>
            </div>
          </div>
        </div>

        {/* Actions + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={billOpen} onOpenChange={setBillOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Descrição</Label><Input value={bDesc} onChange={(e) => setBDesc(e.target.value)} placeholder="Ex: Fornecedor Bebidas" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" value={bAmount} onChange={(e) => setBAmount(e.target.value)} /></div>
                  <div><Label>Vencimento</Label><Input type="date" value={bDue} onChange={(e) => setBDue(e.target.value)} /></div>
                </div>
                <div><Label>Fornecedor</Label>
                  <Select value={bSupplier} onValueChange={setBSupplier}>
                    <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Categoria</Label>
                  <Select value={bCategory} onValueChange={setBCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="aluguel">Aluguel</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="agua">Água</SelectItem>
                      <SelectItem value="internet">Internet</SelectItem>
                      <SelectItem value="salarios">Salários</SelectItem>
                      <SelectItem value="impostos">Impostos</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddBill} className="w-full">Cadastrar Conta</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Building2 className="h-4 w-4 mr-1" /> Novo Fornecedor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Fornecedor</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Nome da empresa" /></div>
                <div><Label>CNPJ</Label><Input value={sCnpj} onChange={(e) => setSCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} /></div>
                  <div><Label>Email</Label><Input value={sEmail} onChange={(e) => setSEmail(e.target.value)} /></div>
                </div>
                <Button onClick={handleAddSupplier} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="ml-auto flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos fornecedores</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Suppliers list */}
        {suppliers.length > 0 && (
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Fornecedores ({suppliers.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-secondary text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">{s.cnpj || "Sem CNPJ"}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { deleteSupplier(s.id); toast({ title: "Fornecedor removido" }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bills table */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Descrição</th>
                <th className="text-left py-2.5 px-4 font-medium">Fornecedor</th>
                <th className="text-center py-2.5 px-4 font-medium">Categoria</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor</th>
                <th className="text-center py-2.5 px-4 font-medium">Vencimento</th>
                <th className="text-center py-2.5 px-4 font-medium">Status</th>
                <th className="text-center py-2.5 px-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma conta encontrada.</td></tr>
              )}
              {filteredBills.map((b) => {
                const st = getDueStatus(b);
                const StIcon = st.icon;
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground">{b.description}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{b.supplierName || "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground capitalize">{b.category}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(b.amount)}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">
                      {new Date(b.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {b.status === "pendente" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar como pago"
                            onClick={() => { payBill(b.id); toast({ title: "Conta paga!" }); }}>
                            <DollarSign className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Excluir"
                          onClick={() => { deleteBill(b.id); toast({ title: "Conta removida" }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
