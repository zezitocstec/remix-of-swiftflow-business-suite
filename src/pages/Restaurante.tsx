import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useProducts, type Operator } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Users, Loader2, Move, ArrowRightLeft, Link2, Link2Off, MapPin,
  UtensilsCrossed, Lock, Fingerprint, Printer, Clock, DollarSign, User as UserIcon,
  Search, ArrowDownAZ, ArrowDown01, LayoutGrid, List, RefreshCw, History, MoreVertical,
} from "lucide-react";
import { formatBRL } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  DndContext, useDraggable, type DragEndEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import OperatorAutocomplete from "@/components/pdv/OperatorAutocomplete";
import { isPlatformAuthAvailable, authenticateBiometric } from "@/lib/webauthn";
import ComandaDialog, { type ComandaTable } from "@/components/restaurante/ComandaDialog";
import ReprintDialog from "@/components/restaurante/ReprintDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sb = supabase as any;

type TableStatus = "livre" | "ocupada" | "reservada" | "aguardando_pagamento";

interface RestaurantArea {
  id: string;
  nome: string;
  ordem: number;
}

interface RestaurantTable {
  id: string;
  numero: number;
  nome: string | null;
  capacidade: number;
  status: TableStatus;
  observacao: string | null;
  area_id: string | null;
  pos_x: number;
  pos_y: number;
  group_id: string | null;
  current_people: number;
}

type SortMode = "numero" | "tempo" | "valor";
type ViewMode = "grid" | "list";

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; ring: string; border: string }> = {
  livre:                { label: "Livre",                bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30", border: "border-emerald-500/40" },
  ocupada:              { label: "Ocupada",              bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",         ring: "ring-red-500/30",     border: "border-red-500/40" },
  reservada:            { label: "Reservada",            bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",       ring: "ring-blue-500/30",    border: "border-blue-500/40" },
  aguardando_pagamento: { label: "Aguardando pagamento", bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     ring: "ring-amber-500/30",   border: "border-amber-500/40" },
};

const STATUS_ORDER: TableStatus[] = ["livre", "ocupada", "reservada", "aguardando_pagamento"];

const GROUP_COLORS = [
  "border-fuchsia-500", "border-cyan-500", "border-orange-500",
  "border-violet-500", "border-lime-500", "border-pink-500",
];

export default function Restaurante() {
  const { tenantId: companyId } = useTenant();
  const { operators } = useProducts();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [transferFrom, setTransferFrom] = useState<RestaurantTable | null>(null);
  const [groupMode, setGroupMode] = useState(false);
  const [groupSelection, setGroupSelection] = useState<Set<string>>(new Set());
  const [comandaTable, setComandaTable] = useState<ComandaTable | null>(null);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [tableInfo, setTableInfo] = useState<Record<string, { total: number; openedAt: string; operatorId: string | null }>>({});
  const [, setNowTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("numero");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [refreshing, setRefreshing] = useState(false);
  const [historyTableId, setHistoryTableId] = useState<string | null>(null);

  // Re-render every 30s so "tempo de ocupação" stays fresh
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ─── Auth state ───
  const [authed, setAuthed] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operatorNameInput, setOperatorNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => { isPlatformAuthAvailable().then(setBiometricAvailable); }, []);

  // Dark mode follow system (consistent with /pdv and /orcamento standalone screens)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => { mq.removeEventListener("change", handler); document.documentElement.classList.remove("dark"); };
  }, []);

  const verifyOperatorByName = async (name: string, pin: string) => {
    const { data, error } = await supabase.functions.invoke("verify-operator", {
      body: { operator_name: name, pin },
    });
    if (error) return { valid: false, error: "Erro de conexão" };
    return data as { valid: boolean; error?: string; operator?: any };
  };

  const handleLoginSubmit = async () => {
    if (!operatorNameInput.trim() || !pinInput) return;
    setLoginLoading(true);
    const result = await verifyOperatorByName(operatorNameInput.trim(), pinInput);
    if (result.valid && result.operator) {
      const op = operators.find((o) => o.id === result.operator!.id);
      if (op) {
        setSelectedOperator(op);
        setAuthed(true);
        toast({ title: "Autenticado!", description: `Bem-vindo, ${op.nome}` });
      }
    } else {
      toast({ title: result.error || "Credenciais inválidas", variant: "destructive" });
      setPinInput("");
    }
    setLoginLoading(false);
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const result = await authenticateBiometric();
      if (result.valid && result.operator) {
        const op = operators.find((o) => o.id === result.operator!.id);
        if (op) {
          setSelectedOperator(op);
          setAuthed(true);
          toast({ title: "Autenticado!", description: `Bem-vindo, ${result.operator.nome}` });
        }
      } else {
        toast({ title: "Falha na biometria", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na biometria", variant: "destructive" });
    } finally {
      setBiometricLoading(false);
    }
  };

  const activeOperators = operators.filter((o) => o.ativo);

  const load = async () => {
    setLoading(true);
    const [areasRes, tablesRes] = await Promise.all([
      sb.from("restaurant_areas").select("*").order("ordem", { ascending: true }),
      sb.from("restaurant_tables").select("*").order("numero", { ascending: true }),
    ]);
    if (areasRes.error) toast({ title: "Erro ao carregar ambientes", description: areasRes.error.message, variant: "destructive" });
    if (tablesRes.error) toast({ title: "Erro ao carregar mesas", description: tablesRes.error.message, variant: "destructive" });

    const loadedAreas = (areasRes.data || []) as RestaurantArea[];
    setAreas(loadedAreas);
    setTables((tablesRes.data || []) as RestaurantTable[]);
    if (!activeAreaId && loadedAreas.length > 0) setActiveAreaId(loadedAreas[0].id);
    setLoading(false);
    loadTableInfo();
  };

  const loadTableInfo = async () => {
    const { data: orders } = await sb
      .from("restaurant_orders")
      .select("id, table_id, created_at, operator_id")
      .in("status", ["aberta", "aguardando_pagamento"]);
    const list = (orders || []) as Array<{ id: string; table_id: string; created_at: string; operator_id: string | null }>;
    if (list.length === 0) { setTableInfo({}); return; }
    const orderIds = list.map((o) => o.id);
    const { data: itemsData } = await sb
      .from("restaurant_order_items")
      .select("order_id, price, quantity")
      .in("order_id", orderIds);
    const totals = new Map<string, number>();
    (itemsData || []).forEach((it: any) => {
      totals.set(it.order_id, (totals.get(it.order_id) || 0) + Number(it.price || 0) * Number(it.quantity || 0));
    });
    const next: Record<string, { total: number; openedAt: string; operatorId: string | null }> = {};
    list.forEach((o) => {
      next[o.table_id] = { total: totals.get(o.id) || 0, openedAt: o.created_at, operatorId: o.operator_id };
    });
    setTableInfo(next);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  // Refresh open-order info every 30s to keep partial totals + waiter fresh
  useEffect(() => {
    if (!companyId) return;
    const id = setInterval(() => loadTableInfo(), 30000);
    return () => clearInterval(id);
  }, [companyId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Pull-to-refresh on touch devices
  useEffect(() => {
    let startY = 0;
    let pulling = false;
    const onStart = (e: TouchEvent) => {
      const sc = (e.target as HTMLElement)?.closest?.("[data-scroll-root]");
      if (!sc || (sc as HTMLElement).scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 80) {
        pulling = false;
        handleRefresh();
      }
    };
    const onEnd = () => { pulling = false; };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [handleRefresh]);

  const filteredTables = useMemo(
    () => tables.filter((t) => (t.area_id || null) === (activeAreaId || null)),
    [tables, activeAreaId]
  );
  const tablesInArea = useMemo(() => {
    let arr = statusFilter === "all" ? filteredTables : filteredTables.filter((t) => t.status === statusFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      arr = arr.filter((t) =>
        String(t.numero).includes(q) || (t.nome || "").toLowerCase().includes(q)
      );
    }
    const sorted = [...arr];
    sorted.sort((a, b) => {
      if (sortMode === "tempo") {
        const ta = tableInfo[a.id]?.openedAt ? new Date(tableInfo[a.id].openedAt).getTime() : Infinity;
        const tb = tableInfo[b.id]?.openedAt ? new Date(tableInfo[b.id].openedAt).getTime() : Infinity;
        return ta - tb; // mais antigos primeiro
      }
      if (sortMode === "valor") {
        return (tableInfo[b.id]?.total ?? -1) - (tableInfo[a.id]?.total ?? -1);
      }
      return a.numero - b.numero;
    });
    return sorted;
  }, [filteredTables, statusFilter, searchQuery, sortMode, tableInfo]);

  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = { livre: 0, ocupada: 0, reservada: 0, aguardando_pagamento: 0 };
    filteredTables.forEach((t) => { c[t.status]++; });
    return c;
  }, [filteredTables]);

  // Group color map
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    tablesInArea.forEach((t) => {
      if (t.group_id && !map.has(t.group_id)) {
        map.set(t.group_id, GROUP_COLORS[i % GROUP_COLORS.length]);
        i++;
      }
    });
    return map;
  }, [tablesInArea]);

  const handleStatusChange = async (table: RestaurantTable, newStatus: TableStatus) => {
    const { error } = await sb.from("restaurant_tables").update({ status: newStatus }).eq("id", table.id);
    if (error) return toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    setTables((prev) => prev.map((t) => t.id === table.id ? { ...t, status: newStatus } : t));
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (!confirm(`Excluir a mesa ${table.numero}?`)) return;
    const { error } = await sb.from("restaurant_tables").delete().eq("id", table.id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    setTables((prev) => prev.filter((t) => t.id !== table.id));
    toast({ title: "Mesa excluída" });
  };

  // ---- Transferir status ----
  const handleTransfer = async (target: RestaurantTable) => {
    if (!transferFrom) return;
    if (target.id === transferFrom.id) return;
    if (target.status !== "livre") {
      return toast({ title: "Mesa de destino precisa estar livre", variant: "destructive" });
    }
    // mover status, nome (cliente), observação para alvo; origem volta a livre
    const updates = await Promise.all([
      sb.from("restaurant_tables").update({
        status: transferFrom.status,
        observacao: transferFrom.observacao,
      }).eq("id", target.id),
      sb.from("restaurant_tables").update({
        status: "livre",
        observacao: null,
      }).eq("id", transferFrom.id),
    ]);
    const err = updates.find((r) => r.error)?.error;
    if (err) return toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    setTables((prev) => prev.map((t) => {
      if (t.id === target.id) return { ...t, status: transferFrom.status, observacao: transferFrom.observacao };
      if (t.id === transferFrom.id) return { ...t, status: "livre" as TableStatus, observacao: null };
      return t;
    }));
    toast({ title: "Mesa transferida", description: `Mesa ${transferFrom.numero} → Mesa ${target.numero}` });
    setTransferFrom(null);
  };

  // ---- Juntar mesas ----
  const toggleGroupSelect = (id: string) => {
    setGroupSelection((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmJoin = async () => {
    if (groupSelection.size < 2) {
      return toast({ title: "Selecione 2 ou mais mesas", variant: "destructive" });
    }
    const newGroupId = crypto.randomUUID();
    const ids = Array.from(groupSelection);
    const { error } = await sb.from("restaurant_tables").update({ group_id: newGroupId }).in("id", ids);
    if (error) return toast({ title: "Erro ao juntar", description: error.message, variant: "destructive" });
    setTables((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, group_id: newGroupId } : t));
    toast({ title: "Mesas agrupadas", description: `${ids.length} mesas juntadas` });
    setGroupSelection(new Set());
    setGroupMode(false);
  };

  const ungroup = async (groupId: string) => {
    const { error } = await sb.from("restaurant_tables").update({ group_id: null }).eq("group_id", groupId);
    if (error) return toast({ title: "Erro ao desagrupar", description: error.message, variant: "destructive" });
    setTables((prev) => prev.map((t) => t.group_id === groupId ? { ...t, group_id: null } : t));
    toast({ title: "Grupo desfeito" });
  };

  // ---- Drag & drop ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const table = tables.find((t) => t.id === id);
    if (!table) return;
    const newX = Math.max(0, table.pos_x + e.delta.x);
    const newY = Math.max(0, table.pos_y + e.delta.y);
    setTables((prev) => prev.map((t) => t.id === id ? { ...t, pos_x: newX, pos_y: newY } : t));
    const { error } = await sb.from("restaurant_tables")
      .update({ pos_x: Math.round(newX), pos_y: Math.round(newY) })
      .eq("id", id);
    if (error) toast({ title: "Erro ao salvar posição", description: error.message, variant: "destructive" });
  }, [tables]);

  // ─── Auth screen ───
  if (!authed) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-6 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Restaurante</h1>
            <p className="text-sm text-muted-foreground">Informe suas credenciais para acessar</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <OperatorAutocomplete
                value={operatorNameInput}
                onChange={setOperatorNameInput}
                operators={activeOperators}
                autoFocus
                onEnterAdvance={() => document.getElementById("rest-pin-input")?.focus()}
                onSelect={() => document.getElementById("rest-pin-input")?.focus()}
              />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="rest-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="PIN de acesso"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  className="h-14 pl-10 text-2xl text-center tracking-[0.5em]"
                  onKeyDown={(e) => { if (e.key === "Enter") handleLoginSubmit(); }}
                />
              </div>
            </div>
            <Button
              onClick={handleLoginSubmit}
              disabled={loginLoading || !operatorNameInput.trim() || !pinInput}
              className="w-full h-14 text-base touch-manipulation"
            >
              {loginLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : "Entrar"}
            </Button>
            {biometricAvailable && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading}
                  className="w-full h-14 text-base gap-2 touch-manipulation"
                >
                  {biometricLoading ? <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /> : <Fingerprint className="h-5 w-5" />}
                  {biometricLoading ? "Verificando..." : "Entrar com Digital"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main UI ───
  return (
    <div className="flex flex-col h-[100dvh] bg-background" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 h-12 bg-card border-b border-border shrink-0">
        <UtensilsCrossed className="h-5 w-5 text-primary shrink-0" />
        <div className="flex flex-col leading-tight flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">Restaurante</span>
          <span className="text-[10px] text-muted-foreground truncate">Salão e gestão de mesas</span>
        </div>
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">{selectedOperator?.nome}</span>
        <Button variant="ghost" size="sm" onClick={() => { setAuthed(false); setOperatorNameInput(""); setPinInput(""); setSelectedOperator(null); }} className="text-xs text-muted-foreground">
          Sair
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4" data-scroll-root>
        {refreshing && (
          <div className="flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
          </div>
        )}
        {/* Ambientes */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {areas.length > 0 ? (
              <Tabs value={activeAreaId || ""} onValueChange={setActiveAreaId}>
                <TabsList>
                  {areas.map((a) => (
                    <TabsTrigger key={a.id} value={a.id}>{a.nome}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum ambiente cadastrado</span>
            )}
            <Button variant="outline" size="sm" onClick={() => setAreaDialogOpen(true)}>
              <MapPin className="h-4 w-4" /> Ambientes
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={editLayout ? "default" : "outline"}
              size="sm"
              onClick={() => { setEditLayout((v) => !v); setGroupMode(false); setTransferFrom(null); }}
              disabled={!activeAreaId}
            >
              <Move className="h-4 w-4" /> {editLayout ? "Concluir layout" : "Editar layout"}
            </Button>
            <Button
              variant={groupMode ? "default" : "outline"}
              size="sm"
              onClick={() => { setGroupMode((v) => !v); setEditLayout(false); setTransferFrom(null); setGroupSelection(new Set()); }}
              disabled={!activeAreaId}
            >
              <Link2 className="h-4 w-4" /> {groupMode ? "Cancelar" : "Juntar mesas"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReprintOpen(true)}
              title="Reimprimir cupom de uma mesa fechada"
            >
              <Printer className="h-4 w-4" /> Reimprimir cupom
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!activeAreaId}>
              <Plus className="h-4 w-4" /> Nova mesa
            </Button>
          </div>
        </div>

        {/* Banner de modo */}
        {transferFrom && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm flex items-center justify-between">
            <span>Selecione a <b>mesa de destino livre</b> para transferir a Mesa {transferFrom.numero}.</span>
            <Button variant="ghost" size="sm" onClick={() => setTransferFrom(null)}>Cancelar</Button>
          </div>
        )}
        {groupMode && (
          <div className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 p-3 text-sm flex items-center justify-between gap-2">
            <span>Toque nas mesas para selecionar ({groupSelection.size} selecionadas). Mín. 2.</span>
            <Button size="sm" onClick={confirmJoin} disabled={groupSelection.size < 2}>Confirmar grupo</Button>
          </div>
        )}
        {editLayout && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
            Arraste as mesas para reposicionar. As coordenadas são salvas automaticamente.
          </div>
        )}

        {/* Resumo + filtro por status (chips clicáveis) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-md border p-3 text-left transition-colors",
              statusFilter === "all" ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:bg-muted/40"
            )}
          >
            <p className="text-xs text-muted-foreground">Todas</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{filteredTables.length}</p>
          </button>
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? "all" : s)}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  active ? `${cfg.border} ring-2 ${cfg.ring} ${cfg.bg}` : "border-border hover:bg-muted/40"
                )}
              >
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={cn("text-2xl font-semibold tabular-nums", cfg.text)}>{counts[s]}</p>
              </button>
            );
          })}
        </div>

        {/* Plano de salão */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !activeAreaId ? (
          <EmptyState
            text="Crie um ambiente para começar (ex: Salão, Varanda)."
            cta={<Button onClick={() => setAreaDialogOpen(true)}><MapPin className="h-4 w-4" /> Criar ambiente</Button>}
          />
        ) : tablesInArea.length === 0 ? (
          <EmptyState
            text="Nenhuma mesa neste ambiente."
            cta={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Cadastrar mesa</Button>}
          />
        ) : (
          editLayout ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="relative w-full min-h-[500px] rounded-md border border-dashed border-border bg-muted/20 overflow-hidden">
                {tablesInArea.map((t) => (
                  <DraggableTable
                    key={t.id}
                    table={t}
                    draggable
                    layoutMode="absolute"
                    groupColor={t.group_id ? groupColorMap.get(t.group_id) : undefined}
                    selected={groupSelection.has(t.id)}
                    onClick={() => {}}
                    onEdit={() => { setEditing(t); setDialogOpen(true); }}
                    onDelete={() => handleDelete(t)}
                    onStatusChange={(s) => handleStatusChange(t, s)}
                    onTransfer={() => setTransferFrom(t)}
                    onUngroup={t.group_id ? () => ungroup(t.group_id!) : undefined}
                    isTransferSource={transferFrom?.id === t.id}
                    info={tableInfo[t.id]}
                    operators={operators}
                  />
                ))}
              </div>
            </DndContext>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 rounded-md border border-dashed border-border bg-muted/20 p-3">
              {tablesInArea.map((t) => (
                <DraggableTable
                  key={t.id}
                  table={t}
                  draggable={false}
                  layoutMode="grid"
                  groupColor={t.group_id ? groupColorMap.get(t.group_id) : undefined}
                  selected={groupSelection.has(t.id)}
                  onClick={() => {
                    if (groupMode) return toggleGroupSelect(t.id);
                    if (transferFrom) return handleTransfer(t);
                    setComandaTable({ id: t.id, numero: t.numero, nome: t.nome, status: t.status });
                  }}
                  onEdit={() => { setEditing(t); setDialogOpen(true); }}
                  onDelete={() => handleDelete(t)}
                  onStatusChange={(s) => handleStatusChange(t, s)}
                  onTransfer={() => setTransferFrom(t)}
                  onUngroup={t.group_id ? () => ungroup(t.group_id!) : undefined}
                  isTransferSource={transferFrom?.id === t.id}
                  info={tableInfo[t.id]}
                  operators={operators}
                />
              ))}
            </div>
          )
        )}
      </div>

      <TableFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        companyId={companyId}
        areaId={activeAreaId}
        existingNumeros={tables.map((t) => t.numero)}
        onSaved={(saved, isNew) => {
          setTables((prev) => isNew ? [...prev, saved].sort((a, b) => a.numero - b.numero)
                                    : prev.map((t) => t.id === saved.id ? saved : t));
        }}
      />

      <AreasDialog
        open={areaDialogOpen}
        onOpenChange={setAreaDialogOpen}
        companyId={companyId}
        areas={areas}
        onChanged={(next) => {
          setAreas(next);
          if (!activeAreaId && next.length > 0) setActiveAreaId(next[0].id);
          if (activeAreaId && !next.find((a) => a.id === activeAreaId)) {
            setActiveAreaId(next[0]?.id || null);
          }
        }}
      />

      <ComandaDialog
        open={!!comandaTable}
        onOpenChange={(v) => { if (!v) setComandaTable(null); }}
        table={comandaTable}
        operatorId={selectedOperator?.id}
        operatorName={selectedOperator?.nome}
        onTableStatusChange={(tableId, status) => {
          setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, status } : t));
          setComandaTable((prev) => prev && prev.id === tableId ? { ...prev, status } : prev);
          loadTableInfo();
        }}
      />

      <ReprintDialog
        open={reprintOpen}
        onOpenChange={setReprintOpen}
        operatorId={selectedOperator?.id}
        operatorName={selectedOperator?.nome}
      />
    </div>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground mb-3">{text}</p>
      {cta}
    </div>
  );
}

// ---------- Helpers ----------
function formatDuration(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${String(rm).padStart(2, "0")}` : `${h}h`;
}

// ---------- Draggable Table Card ----------
function DraggableTable({
  table, draggable, layoutMode = "absolute", groupColor, selected, onClick, onEdit, onDelete, onStatusChange, onTransfer, onUngroup, isTransferSource, info, operators,
}: {
  table: RestaurantTable;
  draggable: boolean;
  layoutMode?: "absolute" | "grid";
  groupColor?: string;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TableStatus) => void;
  onTransfer: () => void;
  onUngroup?: () => void;
  isTransferSource: boolean;
  info?: { total: number; openedAt: string; operatorId: string | null };
  operators?: Operator[];
}) {
  const cfg = STATUS_CONFIG[table.status];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id, disabled: !draggable,
  });

  const style: React.CSSProperties = layoutMode === "absolute" ? {
    position: "absolute",
    left: table.pos_x,
    top: table.pos_y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    width: 160,
    zIndex: isDragging ? 50 : 1,
    touchAction: draggable ? "none" : undefined,
  } : {
    width: "100%",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { if (!draggable) { e.stopPropagation(); onClick(); } }}
      className={cn(
        "rounded-md border-2 p-3 flex flex-col gap-2 transition-shadow shadow-sm",
        cfg.bg,
        groupColor || cfg.border,
        selected && "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-background",
        isTransferSource && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
        draggable && "cursor-grab active:cursor-grabbing",
        !draggable && "cursor-pointer hover:shadow-md",
      )}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Mesa</p>
          <p className="text-2xl font-bold tabular-nums text-foreground leading-none">{table.numero}</p>
        </div>
        {!draggable && (
          <div className="flex gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-foreground" aria-label="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-destructive" aria-label="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {table.nome && <p className="text-xs text-foreground truncate">{table.nome}</p>}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{table.capacidade}</span>
        {table.group_id && <Badge variant="outline" className="text-[10px] h-5">Grupo</Badge>}
      </div>

      {info && (table.status === "ocupada" || table.status === "aguardando_pagamento") && (
        <div className="rounded bg-background/60 border border-border/60 p-1.5 space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3" />Parcial
            </span>
            <span className="font-semibold tabular-nums text-foreground">{formatBRL(info.total)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />{formatDuration(info.openedAt)}
            </span>
            {info.operatorId && operators && (
              <span className="flex items-center gap-1 truncate max-w-[80px]">
                <UserIcon className="h-3 w-3" />
                {operators.find((o) => o.id === info.operatorId)?.nome?.split(" ")[0] || "—"}
              </span>
            )}
          </div>
        </div>
      )}

      {!draggable && (
        <div className="flex flex-col gap-1.5">
          <Select value={table.status} onValueChange={(v) => onStatusChange(v as TableStatus)}>
            <SelectTrigger className={cn("h-7 text-xs", cfg.text)} onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {table.status !== "livre" && (
              <button
                onClick={(e) => { e.stopPropagation(); onTransfer(); }}
                className="flex-1 text-[10px] py-1 rounded border border-border hover:bg-background/60 flex items-center justify-center gap-1"
              >
                <ArrowRightLeft className="h-3 w-3" /> Transferir
              </button>
            )}
            {onUngroup && (
              <button
                onClick={(e) => { e.stopPropagation(); onUngroup(); }}
                className="flex-1 text-[10px] py-1 rounded border border-border hover:bg-background/60 flex items-center justify-center gap-1"
              >
                <Link2Off className="h-3 w-3" /> Desagrupar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Table Form Dialog ----------
function TableFormDialog({
  open, onOpenChange, editing, companyId, areaId, existingNumeros, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RestaurantTable | null;
  companyId: string | null;
  areaId: string | null;
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
    if (!num || num < 1) return toast({ title: "Número inválido", variant: "destructive" });
    if (!cap || cap < 1) return toast({ title: "Capacidade inválida", variant: "destructive" });
    if (!companyId) return toast({ title: "Empresa não identificada", variant: "destructive" });

    setSaving(true);
    const payload: any = {
      numero: num,
      nome: nome.trim() || null,
      capacidade: cap,
      observacao: observacao.trim() || null,
      tenant_id: companyId,
      area_id: areaId,
    };

    const op = editing
      ? sb.from("restaurant_tables").update(payload).eq("id", editing.id).select().single()
      : sb.from("restaurant_tables").insert(payload).select().single();

    const { data, error } = await op;
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      onSaved(data as RestaurantTable, !editing);
      toast({ title: editing ? "Mesa atualizada" : "Mesa criada" });
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar mesa ${editing.numero}` : "Nova mesa"}</DialogTitle>
          <DialogDescription>Cadastre o número, nome (opcional) e capacidade da mesa.</DialogDescription>
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

// ---------- Areas Dialog ----------
function AreasDialog({
  open, onOpenChange, companyId, areas, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string | null;
  areas: RestaurantArea[];
  onChanged: (next: RestaurantArea[]) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    if (!companyId) return toast({ title: "Empresa não identificada", variant: "destructive" });
    setSaving(true);
    const { data, error } = await sb.from("restaurant_areas")
      .insert({ tenant_id: companyId, nome, ordem: areas.length })
      .select().single();
    setSaving(false);
    if (error) return toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    onChanged([...areas, data as RestaurantArea]);
    setNovoNome("");
    toast({ title: "Ambiente criado" });
  };

  const rename = async (a: RestaurantArea, novo: string) => {
    if (!novo.trim() || novo.trim() === a.nome) return;
    const { error } = await sb.from("restaurant_areas").update({ nome: novo.trim() }).eq("id", a.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    onChanged(areas.map((x) => x.id === a.id ? { ...x, nome: novo.trim() } : x));
  };

  const remove = async (a: RestaurantArea) => {
    if (!confirm(`Excluir o ambiente "${a.nome}"? As mesas ficarão sem ambiente.`)) return;
    const { error } = await sb.from("restaurant_areas").delete().eq("id", a.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    onChanged(areas.filter((x) => x.id !== a.id));
    toast({ title: "Ambiente excluído" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ambientes do salão</DialogTitle>
          <DialogDescription>Crie áreas como Salão, Varanda, Mezanino. Cada uma tem seu próprio plano de mesas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome do ambiente" value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add} disabled={saving || !novoNome.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-auto">
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum ambiente cadastrado.</p>
            ) : areas.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border border-border rounded-md p-2">
                <Input defaultValue={a.nome} onBlur={(e) => rename(a, e.target.value)} className="h-8" />
                <Button variant="ghost" size="sm" onClick={() => remove(a)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
