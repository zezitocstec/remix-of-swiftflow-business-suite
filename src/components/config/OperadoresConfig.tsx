import { useState } from "react";
import { useProducts, type Operator } from "@/contexts/ProductContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from "lucide-react";

const emptyForm = { nome: "", pin: "", ativo: true, permissions: { abrirCaixa: true, cancelarItem: false, cancelarCupom: false } };

export default function OperadoresConfig() {
  const { operators, addOperator, updateOperator, deleteOperator } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (op: Operator) => {
    setEditId(op.id);
    setForm({ nome: op.nome, pin: op.pin, ativo: op.ativo, permissions: { ...op.permissions } });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!form.pin || form.pin.length < 4) { toast({ title: "PIN deve ter no mínimo 4 dígitos", variant: "destructive" }); return; }
    if (editId) {
      updateOperator(editId, form);
      toast({ title: "Operador atualizado" });
    } else {
      addOperator(form);
      toast({ title: "Operador cadastrado" });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) { deleteOperator(deleteId); toast({ title: "Operador removido" }); }
    setDeleteId(null);
  };

  const setPerm = (key: keyof typeof form.permissions, val: boolean) => {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: val } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Operadores de Caixa</h3>
          <p className="text-sm text-muted-foreground">Cadastre operadores e defina permissões de acesso ao PDV</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Operador</Button>
      </div>

      <div className="space-y-2">
        {operators.map((op) => (
          <div key={op.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${op.ativo ? "bg-primary/10" : "bg-muted"}`}>
                {op.permissions.cancelarCupom ? <ShieldCheck className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{op.nome}</p>
                <div className="flex gap-2 mt-0.5">
                  {op.permissions.abrirCaixa && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Caixa</span>}
                  {op.permissions.cancelarItem && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded">Cancel. Item</span>}
                  {op.permissions.cancelarCupom && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Cancel. Cupom</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${op.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {op.ativo ? "Ativo" : "Inativo"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => openEdit(op)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(op.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {operators.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum operador cadastrado. Clique em "Novo Operador" para começar.</p>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Operador" : "Novo Operador"}</DialogTitle>
            <DialogDescription>Defina os dados e permissões do operador</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Operador</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>PIN de Acesso (mín. 4 dígitos)</Label>
              <Input type="password" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))} placeholder="••••" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Operador Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Permissões</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Abrir/Fechar Caixa</p>
                  <p className="text-xs text-muted-foreground">Permite abrir e operar o PDV</p>
                </div>
                <Switch checked={form.permissions.abrirCaixa} onCheckedChange={(v) => setPerm("abrirCaixa", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Cancelar Item</p>
                  <p className="text-xs text-muted-foreground">Permite remover itens do cupom</p>
                </div>
                <Switch checked={form.permissions.cancelarItem} onCheckedChange={(v) => setPerm("cancelarItem", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Cancelar Cupom</p>
                  <p className="text-xs text-muted-foreground">Permite cancelar uma venda inteira</p>
                </div>
                <Switch checked={form.permissions.cancelarCupom} onCheckedChange={(v) => setPerm("cancelarCupom", v)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Operador</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover este operador? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
