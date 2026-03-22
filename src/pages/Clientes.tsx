import { TopBar } from "@/components/TopBar";
import { useProducts, type Client } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let remainder = sum % 11;
  if (remainder < 2) remainder = 0; else remainder = 11 - remainder;
  if (remainder !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  remainder = sum % 11;
  if (remainder < 2) remainder = 0; else remainder = 11 - remainder;
  return remainder === parseInt(digits[13]);
}

function validateDocument(doc: string): { valid: boolean; type: string } {
  const digits = doc.replace(/\D/g, "");
  if (digits.length <= 11) return { valid: validateCPF(doc), type: "CPF" };
  return { valid: validateCNPJ(doc), type: "CNPJ" };
}

function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : digits.length > 6 ? `${a}.${b}.${c}` : digits.length > 3 ? `${a}.${b}` : a);
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) => e ? `${a}.${b}.${c}/${d}-${e}` : `${a}.${b}.${c}/${d}`);
}

const emptyForm = { nome: "", cpfCnpj: "", telefone: "", email: "", dataNascimento: "", observacoes: "", creditLimit: 0 };

export default function Clientes() {
  const { clients, addClient, updateClient, deleteClient, debts, sales } = useProducts();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [docError, setDocError] = useState("");

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => c.nome.toLowerCase().includes(q) || c.cpfCnpj.includes(q) || c.email.toLowerCase().includes(q));
  }, [search, clients]);

  const openNew = () => { setEditingClient(null); setForm(emptyForm); setDocError(""); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditingClient(c); setForm({ nome: c.nome, cpfCnpj: c.cpfCnpj, telefone: c.telefone, email: c.email, dataNascimento: c.dataNascimento, observacoes: c.observacoes, creditLimit: c.creditLimit }); setDocError(""); setDialogOpen(true); };
  const openDelete = (c: Client) => { setDeletingClient(c); setDeleteDialogOpen(true); };
  const openHistory = (c: Client) => { setSelectedClient(c); setHistoryDialogOpen(true); };

  const clientSales = useMemo(() => {
    if (!selectedClient) return [];
    return sales.filter((s) => s.clientId === selectedClient.id);
  }, [selectedClient, sales]);

  const clientDebts = useMemo(() => {
    if (!selectedClient) return [];
    return debts.filter((d) => d.clientId === selectedClient.id);
  }, [selectedClient, debts]);

  const handleSave = () => {
    if (!form.nome.trim()) { toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" }); return; }
    if (form.cpfCnpj) {
      const { valid, type } = validateDocument(form.cpfCnpj);
      if (!valid) { setDocError(`${type} inválido`); return; }
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast({ title: "Erro", description: "Email inválido.", variant: "destructive" }); return; }

    if (editingClient) {
      updateClient(editingClient.id, form);
      toast({ title: "Cliente atualizado", description: `${form.nome} foi atualizado.` });
    } else {
      addClient(form);
      toast({ title: "Cliente cadastrado", description: `${form.nome} foi adicionado.` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingClient) return;
    deleteClient(deletingClient.id);
    toast({ title: "Cliente excluído", description: `${deletingClient.nome} foi removido.` });
    setDeleteDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Clientes" subtitle={`${clients.length} clientes cadastrados`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-card px-3 h-9">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground" placeholder="Buscar por nome, CPF/CNPJ ou email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Novo Cliente</Button>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Nome</th>
                <th className="text-left py-2.5 px-4 font-medium">CPF/CNPJ</th>
                <th className="text-left py-2.5 px-4 font-medium">Telefone</th>
                <th className="text-left py-2.5 px-4 font-medium">Email</th>
                <th className="text-right py-2.5 px-4 font-medium">Crédito</th>
                <th className="text-right py-2.5 px-4 font-medium">Compras</th>
                <th className="text-center py-2.5 px-4 font-medium w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                  <td className="py-2.5 px-4 text-muted-foreground tabular-nums">{c.cpfCnpj}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{c.telefone}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{c.email}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    <span className={c.creditUsed > 0 ? "text-warning" : "text-foreground"}>
                      {formatBRL(c.creditLimit - c.creditUsed)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{c.compras}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openHistory(c)} title="Histórico"><Users className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>{editingClient ? "Altere os dados do cliente." : "Preencha os dados para cadastrar."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" /></div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpfCnpj} onChange={(e) => { setForm({ ...form, cpfCnpj: formatDocument(e.target.value) }); setDocError(""); }}
                  placeholder="000.000.000-00" maxLength={18} className={docError ? "border-destructive" : ""} />
                {docError && <p className="text-xs text-destructive">{docError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Data de Nascimento</Label><Input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Limite de Crédito (R$)</Label><Input type="number" min="0" step="0.01" value={form.creditLimit || ""} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Notas sobre o cliente..." rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingClient ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <strong>{deletingClient?.nome}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — {selectedClient?.nome}</DialogTitle>
            <DialogDescription>{selectedClient?.cpfCnpj} • {selectedClient?.compras} compras • Total: {formatBRL(selectedClient?.total || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-auto">
            {clientDebts.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Fiado</h4>
                {clientDebts.map((d) => (
                  <div key={d.id} className="flex justify-between text-sm border-b border-border py-2">
                    <span className="text-foreground">{d.saleDate.toLocaleDateString("pt-BR")}</span>
                    <span className={d.paid >= d.amount ? "text-success" : "text-destructive"}>{formatBRL(d.amount - d.paid)} restante</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Compras</h4>
              {clientSales.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>}
              {clientSales.map((s) => (
                <div key={s.id} className="border-b border-border py-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{s.date.toLocaleDateString("pt-BR")}</span>
                    <span className="font-medium tabular-nums text-foreground">{formatBRL(s.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
