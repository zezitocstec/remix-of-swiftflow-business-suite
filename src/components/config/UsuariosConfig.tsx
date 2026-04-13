import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Shield, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: "admin" | "user";
  has_company: boolean;
}

async function callManageUsers(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await supabase.functions.invoke("manage-users", {
    body: { action, ...params },
  });

  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export default function UsuariosConfig() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "user" as "admin" | "user" });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await callManageUsers("list");
      setUsers(data);
    } catch (e: any) {
      toast({ title: "Erro ao carregar usuários", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password) {
      toast({ title: "Email e senha são obrigatórios", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await callManageUsers("create", { email: form.email, password: form.password, role: form.role });
      toast({ title: "Usuário criado com sucesso" });
      setDialogOpen(false);
      setForm({ email: "", password: "", role: "user" });
      loadUsers();
    } catch (e: any) {
      toast({ title: "Erro ao criar usuário", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    try {
      await callManageUsers("update_role", { user_id: userId, role: newRole });
      toast({ title: "Papel atualizado" });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e: any) {
      toast({ title: "Erro ao atualizar papel", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await callManageUsers("delete", { user_id: deleteId });
      toast({ title: "Usuário removido" });
      setUsers((prev) => prev.filter((u) => u.id !== deleteId));
    } catch (e: any) {
      toast({ title: "Erro ao remover usuário", description: e.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Nunca";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Usuários do Sistema</h3>
          <p className="text-sm text-muted-foreground">Gerencie quem pode acessar o sistema e suas permissões</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${u.role === "admin" ? "bg-primary/10" : "bg-muted"}`}>
                    {u.role === "admin" ? (
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    ) : (
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {u.email}
                      {isSelf && <span className="text-xs text-muted-foreground ml-2">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Último acesso: {formatDate(u.last_sign_in_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleRoleChange(u.id, v as "admin" | "user")}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(u.id)}
                    disabled={isSelf}
                    title={isSelf ? "Você não pode excluir sua própria conta" : "Excluir usuário"}
                  >
                    <Trash2 className={`h-4 w-4 ${isSelf ? "text-muted-foreground" : "text-destructive"}`} />
                  </Button>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário com acesso ao sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@email.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Senha (mín. 6 caracteres)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "user" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador — acesso total</SelectItem>
                  <SelectItem value="user">Operador — acesso ao PDV e Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza? Este usuário perderá todo o acesso ao sistema. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
