import { useEffect, useState, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

// Cast supabase client to any until generated types include restaurant_tables
const sb = supabase as any;
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TableStatus = "livre" | "ocupada" | "reservada" | "aguardando_pagamento";

interface RestaurantTable {
  id: string;
  numero: number;
  nome: string | null;
  capacidade: number;
  status: TableStatus;
  posicao: number;
  observacao: string | null;
}

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; ring: string }> = {
  livre:                { label: "Livre",               bg: "bg-emerald-500/10",  text: "text-emerald-600 dark:text-emerald-400",  ring: "ring-emerald-500/30" },
  ocupada:              { label: "Ocupada",             bg: "bg-red-500/10",      text: "text-red-600 dark:text-red-400",          ring: "ring-red-500/30" },
  reservada:            { label: "Reservada",           bg: "bg-blue-500/10",     text: "text-blue-600 dark:text-blue-400",        ring: "ring-blue-500/30" },
  aguardando_pagamento: { label: "Aguardando pagamento",bg: "bg-amber-500/10",    text: "text-amber-600 dark:text-amber-400",      ring: "ring-amber-500/30" },
};

const STATUS_ORDER: TableStatus[] = ["livre", "ocupada", "reservada", "aguardando_pagamento"];

export default function Restaurante() {
  const { tenantId: companyId } = useTenant();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<TableStatus | "todas">("todas");

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("restaurant_tables")
      .select("*")
      .order("numero", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar mesas", description: error.message, variant: "destructive" });
    } else {
      setTables(((data || []) as unknown) as RestaurantTable[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  const filtered = useMemo(
    () => filter === "todas" ? tables : tables.filter((t) => t.status === filter),
    [tables, filter]
  );

  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = { livre: 0, ocupada: 0, reservada: 0, aguardando_pagamento: 0 };
    tables.forEach((t) => { c[t.status]++; });
    return c;
  }, [tables]);

  const handleStatusChange = async (table: RestaurantTable, newStatus: TableStatus) => {
    const { error } = await sb
      .from("restaurant_tables")
      .update({ status: newStatus })
      .eq("id", table.id);
    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } else {
      setTables((prev) => prev.map((t) => t.id === table.id ? { ...t, status: newStatus } : t));
      toast({ title: "Status atualizado", description: `Mesa ${table.numero}: ${STATUS_CONFIG[newStatus].label}` });
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (!confirm(`Excluir a mesa ${table.numero}?`)) return;
    const { error } = await sb.from("restaurant_tables").delete().eq("id", table.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setTables((prev) => prev.filter((t) => t.id !== table.id));
      toast({ title: "Mesa excluída" });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Restaurante" subtitle="Salão e gestão de mesas" />

      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4">
        {/* Header com ação */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Salão</h2>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova mesa
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(active ? "todas" : s)}
                className={cn(
                  "rounded-md border border-border p-3 text-left transition-all",
                  active ? "ring-2 " + cfg.ring : "hover:border-foreground/20"
                )}
              >
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={cn("text-2xl font-semibold tabular-nums", cfg.text)}>{counts[s]}</p>
              </button>
            );
          })}
        </div>

        {/* Grid de mesas */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {tables.length === 0 ? "Nenhuma mesa cadastrada ainda." : "Nenhuma mesa nesse filtro."}
            </p>
            {tables.length === 0 && (
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Cadastrar primeira mesa
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map((t) => {
              const cfg = STATUS_CONFIG[t.status];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-md border border-border p-3 flex flex-col gap-2 transition-all",
                    cfg.bg
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Mesa</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground">{t.numero}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditing(t); setDialogOpen(true); }}
                        className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-foreground"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {t.nome && <p className="text-xs text-foreground truncate">{t.nome}</p>}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{t.capacidade} lugares</span>
                  </div>

                  <Select
                    value={t.status}
                    onValueChange={(v) => handleStatusChange(t, v as TableStatus)}
                  >
                    <SelectTrigger className={cn("h-8 text-xs", cfg.text)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TableFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        companyId={companyId}
        existingNumeros={tables.map((t) => t.numero)}
        onSaved={(saved, isNew) => {
          setTables((prev) => isNew ? [...prev, saved].sort((a, b) => a.numero - b.numero)
                                    : prev.map((t) => t.id === saved.id ? saved : t));
        }}
      />
    </div>
  );
}

function TableFormDialog({
  open, onOpenChange, editing, companyId, existingNumeros, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RestaurantTable | null;
  companyId: string | null;
  existingNumeros: number[];
  onSaved: (t: RestaurantTable, isNew: boolean) => void;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNumero(editing ? String(editing.numero) : String((Math.max(0, ...existingNumeros) + 1)));
      setNome(editing?.nome || "");
      setCapacidade(String(editing?.capacidade ?? 4));
      setObservacao(editing?.observacao || "");
    }
  }, [open, editing]);

  const handleSave = async () => {
    const num = parseInt(numero, 10);
    const cap = parseInt(capacidade, 10);
    if (!num || num < 1) {
      toast({ title: "Número inválido", variant: "destructive" });
      return;
    }
    if (!cap || cap < 1) {
      toast({ title: "Capacidade inválida", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      numero: num,
      nome: nome.trim() || null,
      capacidade: cap,
      observacao: observacao.trim() || null,
      tenant_id: companyId,
    };

    if (editing) {
      const { data, error } = await sb
        .from("restaurant_tables")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        onSaved((data as unknown) as RestaurantTable, false);
        toast({ title: "Mesa atualizada" });
        onOpenChange(false);
      }
    } else {
      const { data, error } = await sb
        .from("restaurant_tables")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      } else {
        onSaved((data as unknown) as RestaurantTable, true);
        toast({ title: "Mesa criada" });
        onOpenChange(false);
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar mesa ${editing.numero}` : "Nova mesa"}</DialogTitle>
          <DialogDescription>
            Cadastre o número, nome (opcional) e capacidade da mesa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número *</Label>
              <Input id="numero" type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacidade">Capacidade *</Label>
              <Input id="capacidade" type="number" min={1} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome / referência (opcional)</Label>
            <Input id="nome" placeholder="Ex: Varanda, Balcão 1" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs">Observação</Label>
            <Input id="obs" placeholder="Ex: próxima da janela" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Criar mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
