import { useState } from "react";
import { useProducts, type Terminal } from "@/contexts/ProductContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Monitor } from "lucide-react";

const emptyForm = { nome: "", ativo: true, cupom_inicio: 100000, cupom_atual: 100000, cupom_fim: 999999 };

export default function TerminaisConfig() {
  const { terminals, addTerminal, updateTerminal, deleteTerminal } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: Terminal) => { setEditId(t.id); setForm({ nome: t.nome, ativo: t.ativo, cupom_inicio: t.cupom_inicio ?? 100000, cupom_atual: t.cupom_atual ?? 100000, cupom_fim: t.cupom_fim ?? 999999 }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (editId) { updateTerminal(editId, form); toast({ title: "Terminal atualizado" }); }
    else { addTerminal(form); toast({ title: "Terminal cadastrado" }); }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) { deleteTerminal(deleteId); toast({ title: "Terminal removido" }); }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Terminais (Caixas)</h3>
          <p className="text-sm text-muted-foreground">Cadastre os terminais de caixa do estabelecimento</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Terminal</Button>
      </div>

      <div className="space-y-2">
        {terminals.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.ativo ? "bg-primary/10" : "bg-muted"}`}>
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">{t.nome}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${t.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {t.ativo ? "Ativo" : "Inativo"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {terminals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum terminal cadastrado.</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Terminal" : "Novo Terminal"}</DialogTitle>
            <DialogDescription>Defina o nome do terminal de caixa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Terminal</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Caixa 01" autoFocus />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Terminal</DialogTitle>
            <DialogDescription>Tem certeza? Esta ação não pode ser desfeita.</DialogDescription>
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
