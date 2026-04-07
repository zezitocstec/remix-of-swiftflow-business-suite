import { useState, useEffect } from "react";
import { useProducts, type Operator } from "@/contexts/ProductContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield, ShieldCheck, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isWebAuthnSupported, isPlatformAuthAvailable } from "@/lib/webauthn";
import BiometricEnrollDialog from "@/components/config/BiometricEnrollDialog";

const emptyForm = { nome: "", pin: "", ativo: true, permissions: { abrirCaixa: true, cancelarItem: false, cancelarCupom: false } };

export default function OperadoresConfig() {
  const { operators, addOperator, updateOperator, deleteOperator } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricCredentials, setBiometricCredentials] = useState<Record<string, number>>({});
  const [registeringBiometric, setRegisteringBiometric] = useState<string | null>(null);
  const [enrollDialogOp, setEnrollDialogOp] = useState<{ id: string; nome: string } | null>(null);
  useEffect(() => {
    isPlatformAuthAvailable().then(setBiometricSupported);
    loadBiometricCounts();
  }, []);

  const loadBiometricCounts = async () => {
    const { data } = await supabase
      .from("webauthn_credentials" as any)
      .select("operator_id");
    if (data) {
      const counts: Record<string, number> = {};
      (data as any[]).forEach((row: any) => {
        counts[row.operator_id] = (counts[row.operator_id] || 0) + 1;
      });
      setBiometricCredentials(counts);
    }
  };

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (op: Operator) => {
    setEditId(op.id);
    setForm({ nome: op.nome, pin: op.pin, ativo: op.ativo, permissions: { ...op.permissions } });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!editId && (!form.pin || form.pin.length < 4)) { toast({ title: "PIN deve ter no mínimo 4 dígitos", variant: "destructive" }); return; }
    if (editId && form.pin && form.pin.length < 4) { toast({ title: "PIN deve ter no mínimo 4 dígitos", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateOperator(editId, form);
        toast({ title: "Operador atualizado" });
      } else {
        await addOperator(form);
        toast({ title: "Operador cadastrado" });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: "Erro ao salvar operador", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (deleteId) { deleteOperator(deleteId); toast({ title: "Operador removido" }); }
    setDeleteId(null);
  };

  const handleRegisterBiometric = (operatorId: string) => {
    const op = operators.find(o => o.id === operatorId);
    if (op) setEnrollDialogOp({ id: op.id, nome: op.nome });
  };

  const handleRemoveBiometric = async (operatorId: string) => {
    const { error } = await supabase
      .from("webauthn_credentials" as any)
      .delete()
      .eq("operator_id", operatorId);
    if (!error) {
      toast({ title: "Biometria removida" });
      loadBiometricCounts();
    }
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
                  {(biometricCredentials[op.id] || 0) > 0 && (
                    <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Fingerprint className="h-3 w-3" /> Digital
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${op.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {op.ativo ? "Ativo" : "Inativo"}
              </span>
              {biometricSupported && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegisterBiometric(op.id)}
                  disabled={registeringBiometric === op.id}
                  title="Cadastrar digital"
                >
                  <Fingerprint className={`h-4 w-4 ${(biometricCredentials[op.id] || 0) > 0 ? "text-primary" : "text-muted-foreground"}`} />
                </Button>
              )}
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
              <Label>PIN de Acesso {editId ? "(deixe vazio para manter)" : "(mín. 4 dígitos)"}</Label>
              <Input type="password" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))} placeholder={editId ? "••••  (novo PIN)" : "••••"} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Operador Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>

            {/* Biometric section in edit mode */}
            {editId && biometricSupported && (
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" /> Autenticação Biométrica
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">
                      {(biometricCredentials[editId] || 0) > 0
                        ? `${biometricCredentials[editId]} digital(is) cadastrada(s)`
                        : "Nenhuma digital cadastrada"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">Use a digital para login rápido no PDV</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegisterBiometric(editId)}
                    >
                      Cadastrar
                    </Button>
                    {(biometricCredentials[editId] || 0) > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveBiometric(editId)} className="text-destructive">
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

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
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editId ? "Salvar" : "Cadastrar"}</Button>
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

      {/* Biometric Enroll Dialog */}
      {enrollDialogOp && (
        <BiometricEnrollDialog
          open={!!enrollDialogOp}
          onOpenChange={(open) => { if (!open) setEnrollDialogOp(null); }}
          operatorId={enrollDialogOp.id}
          operatorName={enrollDialogOp.nome}
          onSuccess={() => {
            loadBiometricCounts();
            toast({ title: "Biometria cadastrada!", description: "Digital registrada com sucesso." });
          }}
        />
      )}
    </div>
  );
}
