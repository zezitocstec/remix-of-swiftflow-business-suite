import { useState, useEffect, useMemo, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Trash2, Edit, CheckCircle, FileText, CalendarIcon, Save, X, Printer, Download, Copy, History,
} from "lucide-react";

interface OrcamentoItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  desconto_tipo: "percent" | "value";
  desconto_valor: number;
  total: number;
}

interface Orcamento {
  id: string;
  numero: number;
  client_id?: string;
  client_name?: string;
  vendedor_id?: string;
  vendedor_name?: string;
  desconto_tipo: "percent" | "value";
  desconto_valor: number;
  validade: string;
  status: string;
  autorizado: boolean;
  observacoes: string;
  subtotal: number;
  total: number;
  created_at: string;
  items?: OrcamentoItem[];
}

interface Vendedor {
  id: string;
  nome: string;
  comissao: number;
  ativo: boolean;
}

function calcItemTotal(item: OrcamentoItem) {
  const gross = item.quantity * item.unit_price;
  if (item.desconto_tipo === "percent") return gross * (1 - item.desconto_valor / 100);
  return Math.max(0, gross - item.desconto_valor);
}

function calcTotals(items: OrcamentoItem[], descontoTipo: "percent" | "value", descontoValor: number) {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  let total = subtotal;
  if (descontoTipo === "percent") total = subtotal * (1 - descontoValor / 100);
  else total = Math.max(0, subtotal - descontoValor);
  return { subtotal, total };
}

export default function Orcamentos() {
  const { products, clients } = useProducts();
  const { tenantId, companyName } = useTenant();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "rascunho" | "autorizado" | "convertido" | "expirado">("todos");
  const [editing, setEditing] = useState<Orcamento | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyOrcamento, setHistoryOrcamento] = useState<Orcamento | null>(null);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null);

  const logHistory = useCallback(async (orcamentoId: string, numero: number, acao: string, descricao: string) => {
    if (!tenantId) return;
    await supabase.from("orcamento_historico").insert({
      orcamento_id: orcamentoId,
      orcamento_numero: numero,
      acao,
      descricao,
      usuario_email: user?.email || "desconhecido",
      tenant_id: tenantId,
    });
  }, [tenantId, user]);

  // ─── Load orcamentos & vendedores ───
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [oRes, vRes] = await Promise.all([
      supabase.from("orcamentos").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("vendedores").select("*").eq("tenant_id", tenantId).eq("ativo", true),
    ]);
    if (oRes.data) setOrcamentos(oRes.data as any);
    if (vRes.data) setVendedores(vRes.data as any);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getEffectiveStatus = (o: Orcamento) => {
    if (o.status === "convertido") return "convertido";
    if (o.autorizado) return "autorizado";
    if (new Date(o.validade) < new Date()) return "expirado";
    return "rascunho";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orcamentos.filter((o) => {
      const matchSearch = String(o.numero).includes(q) ||
        (o.client_name || "").toLowerCase().includes(q) ||
        (o.vendedor_name || "").toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (statusFilter === "todos") return true;
      return getEffectiveStatus(o) === statusFilter;
    });
  }, [orcamentos, search, statusFilter]);

  const handleNew = () => {
    setEditing(null);
    setShowEditor(true);
  };

  const handleEdit = async (o: Orcamento) => {
    const { data } = await supabase.from("orcamento_items").select("*").eq("orcamento_id", o.id);
    setEditing({ ...o, items: (data as any) || [] });
    setShowEditor(true);
  };

  const handleAuthorize = async (o: Orcamento) => {
    await supabase.from("orcamentos").update({ autorizado: true, status: "autorizado" }).eq("id", o.id);
    await logHistory(o.id, o.numero, "autorizado", "Orçamento autorizado");
    toast.success(`Orçamento #${o.numero} autorizado`);
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await supabase.from("orcamento_items").delete().eq("orcamento_id", deleteTarget.id);
    await supabase.from("orcamento_historico").delete().eq("orcamento_id", deleteTarget.id);
    await supabase.from("orcamentos").delete().eq("id", deleteTarget.id);
    toast.success(`Orçamento #${deleteTarget.numero} excluído`);
    setDeleteTarget(null);
    loadData();
  };

  const handleShowHistory = async (o: Orcamento) => {
    setHistoryOrcamento(o);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("orcamento_historico")
      .select("*")
      .eq("orcamento_id", o.id)
      .order("created_at", { ascending: false });
    setHistoryEntries(data || []);
    setHistoryLoading(false);
  };

  const handlePrint = async (o: Orcamento) => {
    const { data: items } = await supabase.from("orcamento_items").select("*").eq("orcamento_id", o.id);
    const { data: company } = await supabase.from("companies").select("*").eq("id", tenantId).single();

    const printWindow = window.open("", "_blank", "width=400,height=700");
    if (!printWindow) return;

    const itemsHtml = (items || []).map((i: any) => {
      const descStr = i.desconto_valor > 0
        ? ` (${i.desconto_tipo === "percent" ? `${i.desconto_valor}%` : formatBRL(i.desconto_valor)} desc.)`
        : "";
      return `<tr>
        <td style="text-align:left;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${i.product_name}${descStr}</td>
        <td style="text-align:center;font-size:11px;padding:4px;border-bottom:1px solid #eee">${i.quantity}</td>
        <td style="text-align:right;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${formatBRL(i.unit_price)}</td>
        <td style="text-align:right;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${formatBRL(i.total)}</td>
      </tr>`;
    }).join("");

    const descontoGeral = o.desconto_valor > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#666"><span>Desconto Geral (${o.desconto_tipo === "percent" ? `${o.desconto_valor}%` : formatBRL(o.desconto_valor)})</span><span>-${formatBRL(o.subtotal - o.total)}</span></div>`
      : "";

    const companyInfo = company ? `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-weight:bold;font-size:16px">${company.nome_fantasia || company.nome}</div>
        ${company.cnpj ? `<div style="font-size:10px;color:#666">CNPJ: ${company.cnpj}</div>` : ""}
        ${company.telefone ? `<div style="font-size:10px;color:#666">Tel: ${company.telefone}</div>` : ""}
        ${company.logradouro ? `<div style="font-size:10px;color:#666">${company.logradouro}${company.numero ? `, ${company.numero}` : ""} — ${company.cidade || ""}/${company.uf || ""}</div>` : ""}
      </div>
    ` : "";

    printWindow.document.write(`<html><head><title>Orçamento #${o.numero}</title>
    <style>@media print { body { margin: 0; } @page { size: A4; margin: 15mm; } }</style>
    </head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${companyInfo}
      <div style="text-align:center;font-weight:bold;font-size:18px;margin:12px 0;border-top:2px solid #000;border-bottom:2px solid #000;padding:8px 0">ORÇAMENTO #${o.numero}</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px">
        <div>
          <div><strong>Cliente:</strong> ${o.client_name || "Avulso"}</div>
          ${o.vendedor_name ? `<div><strong>Vendedor:</strong> ${o.vendedor_name}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div><strong>Data:</strong> ${format(new Date(o.created_at), "dd/MM/yyyy")}</div>
          <div><strong>Validade:</strong> ${format(new Date(o.validade), "dd/MM/yyyy")}</div>
          <div><strong>Status:</strong> ${o.autorizado ? "Autorizado" : "Rascunho"}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead><tr style="border-bottom:2px solid #000">
          <th style="text-align:left;font-size:11px;padding:4px 0">Produto</th>
          <th style="text-align:center;font-size:11px;padding:4px">Qtd</th>
          <th style="text-align:right;font-size:11px;padding:4px 0">Unit.</th>
          <th style="text-align:right;font-size:11px;padding:4px 0">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top:2px solid #000;padding-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px"><span>Subtotal</span><span>${formatBRL(o.subtotal)}</span></div>
        ${descontoGeral}
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:4px;border-top:1px solid #000;padding-top:4px"><span>TOTAL</span><span>${formatBRL(o.total)}</span></div>
      </div>
      ${o.observacoes ? `<div style="margin-top:16px;font-size:11px;color:#666;border-top:1px dashed #ccc;padding-top:8px"><strong>Observações:</strong> ${o.observacoes}</div>` : ""}
      <div style="margin-top:32px;text-align:center;font-size:10px;color:#999">Documento válido até ${format(new Date(o.validade), "dd/MM/yyyy")}</div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleDownloadPDF = async (o: Orcamento) => {
    const { data: items } = await supabase.from("orcamento_items").select("*").eq("orcamento_id", o.id);
    const { data: company } = await supabase.from("companies").select("*").eq("id", tenantId).single();

    const itemsHtml = (items || []).map((i: any) => {
      const descStr = i.desconto_valor > 0
        ? ` (${i.desconto_tipo === "percent" ? `${i.desconto_valor}%` : formatBRL(i.desconto_valor)} desc.)`
        : "";
      return `<tr>
        <td style="text-align:left;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${i.product_name}${descStr}</td>
        <td style="text-align:center;font-size:11px;padding:4px;border-bottom:1px solid #eee">${i.quantity}</td>
        <td style="text-align:right;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${formatBRL(i.unit_price)}</td>
        <td style="text-align:right;font-size:11px;padding:4px 0;border-bottom:1px solid #eee">${formatBRL(i.total)}</td>
      </tr>`;
    }).join("");

    const descontoGeral = o.desconto_valor > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#666"><span>Desconto Geral (${o.desconto_tipo === "percent" ? `${o.desconto_valor}%` : formatBRL(o.desconto_valor)})</span><span>-${formatBRL(o.subtotal - o.total)}</span></div>`
      : "";

    const companyInfo = company ? `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-weight:bold;font-size:16px">${company.nome_fantasia || company.nome}</div>
        ${company.cnpj ? `<div style="font-size:10px;color:#666">CNPJ: ${company.cnpj}</div>` : ""}
        ${company.telefone ? `<div style="font-size:10px;color:#666">Tel: ${company.telefone}</div>` : ""}
        ${company.logradouro ? `<div style="font-size:10px;color:#666">${company.logradouro}${company.numero ? `, ${company.numero}` : ""} — ${company.cidade || ""}/${company.uf || ""}</div>` : ""}
      </div>
    ` : "";

    const html = `<html><head><title>Orçamento #${o.numero}</title>
    <style>@media print { body { margin: 0; } @page { size: A4; margin: 15mm; } }</style>
    </head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${companyInfo}
      <div style="text-align:center;font-weight:bold;font-size:18px;margin:12px 0;border-top:2px solid #000;border-bottom:2px solid #000;padding:8px 0">ORÇAMENTO #${o.numero}</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px">
        <div>
          <div><strong>Cliente:</strong> ${o.client_name || "Avulso"}</div>
          ${o.vendedor_name ? `<div><strong>Vendedor:</strong> ${o.vendedor_name}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div><strong>Data:</strong> ${format(new Date(o.created_at), "dd/MM/yyyy")}</div>
          <div><strong>Validade:</strong> ${format(new Date(o.validade), "dd/MM/yyyy")}</div>
          <div><strong>Status:</strong> ${o.autorizado ? "Autorizado" : "Rascunho"}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead><tr style="border-bottom:2px solid #000">
          <th style="text-align:left;font-size:11px;padding:4px 0">Produto</th>
          <th style="text-align:center;font-size:11px;padding:4px">Qtd</th>
          <th style="text-align:right;font-size:11px;padding:4px 0">Unit.</th>
          <th style="text-align:right;font-size:11px;padding:4px 0">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top:2px solid #000;padding-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px"><span>Subtotal</span><span>${formatBRL(o.subtotal)}</span></div>
        ${descontoGeral}
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:4px;border-top:1px solid #000;padding-top:4px"><span>TOTAL</span><span>${formatBRL(o.total)}</span></div>
      </div>
      ${o.observacoes ? `<div style="margin-top:16px;font-size:11px;color:#666;border-top:1px dashed #ccc;padding-top:8px"><strong>Observações:</strong> ${o.observacoes}</div>` : ""}
      <div style="margin-top:32px;text-align:center;font-size:10px;color:#999">Documento válido até ${format(new Date(o.validade), "dd/MM/yyyy")}</div>
    </body></html>`;

    // Use print-to-PDF via hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const handleDuplicate = async (o: Orcamento) => {
    if (!tenantId) return;
    const { data: items } = await supabase.from("orcamento_items").select("*").eq("orcamento_id", o.id);

    const payload = {
      client_id: o.client_id || null,
      client_name: o.client_name || null,
      vendedor_id: o.vendedor_id || null,
      vendedor_name: o.vendedor_name || null,
      desconto_tipo: o.desconto_tipo,
      desconto_valor: o.desconto_valor,
      validade: format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
      observacoes: o.observacoes || "",
      subtotal: o.subtotal,
      total: o.total,
      tenant_id: tenantId,
      autorizado: false,
      status: "rascunho",
    };

    const { data: newOrc } = await supabase.from("orcamentos").insert(payload).select("id, numero").single();
    if (newOrc && items && items.length > 0) {
      const itemsPayload = items.map((i: any) => ({
        orcamento_id: newOrc.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        desconto_tipo: i.desconto_tipo,
        desconto_valor: i.desconto_valor,
        total: i.total,
        tenant_id: tenantId,
      }));
      await supabase.from("orcamento_items").insert(itemsPayload);
    }

    if (newOrc) {
      await logHistory(newOrc.id, newOrc.numero, "criado", `Duplicado a partir do orçamento #${o.numero}`);
      await logHistory(o.id, o.numero, "duplicado", `Orçamento duplicado como #${newOrc.numero}`);
    }
    toast.success(`Orçamento duplicado como #${newOrc?.numero}`);
    loadData();
  };

  const statusBadge = (o: Orcamento) => {
    const s = getEffectiveStatus(o);
    if (s === "autorizado") return <Badge className="bg-green-600 text-white">Autorizado</Badge>;
    if (s === "convertido") return <Badge variant="secondary">Convertido</Badge>;
    if (s === "expirado") return <Badge variant="destructive">Expirado</Badge>;
    return <Badge variant="outline">Rascunho</Badge>;
  };

  const statusCounts = useMemo(() => {
    const counts = { todos: orcamentos.length, rascunho: 0, autorizado: 0, convertido: 0, expirado: 0 };
    orcamentos.forEach(o => { counts[getEffectiveStatus(o)]++; });
    return counts;
  }, [orcamentos]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Orçamentos" subtitle="Propostas comerciais" />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, cliente ou vendedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={handleNew}><Plus className="h-4 w-4 mr-1" /> Novo Orçamento</Button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {(["todos", "rascunho", "autorizado", "convertido", "expirado"] as const).map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="text-xs capitalize">
              {s} ({statusCounts[s]})
            </Button>
          ))}
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Vendedor</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</TableCell></TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">#{o.numero}</TableCell>
                  <TableCell>{o.client_name || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{o.vendedor_name || "—"}</TableCell>
                  <TableCell className="font-medium">{formatBRL(o.total)}</TableCell>
                  <TableCell className="text-xs">{format(new Date(o.validade), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{statusBadge(o)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => handlePrint(o)} title="Imprimir"><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDownloadPDF(o)} title="Baixar PDF"><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDuplicate(o)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleShowHistory(o)} title="Histórico"><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(o)} title="Editar"><Edit className="h-4 w-4" /></Button>
                    {!o.autorizado && <Button size="icon" variant="ghost" onClick={() => handleAuthorize(o)} title="Autorizar"><CheckCircle className="h-4 w-4 text-green-600" /></Button>}
                    {getEffectiveStatus(o) === "rascunho" && (
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(o)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {showEditor && (
        <OrcamentoEditor
          orcamento={editing}
          products={products}
          clients={clients}
          vendedores={vendedores}
          tenantId={tenantId}
          onClose={() => { setShowEditor(false); loadData(); }}
          logHistory={logHistory}
        />
      )}

      {/* History Dialog */}
      <Dialog open={!!historyOrcamento} onOpenChange={() => setHistoryOrcamento(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico — Orçamento #{historyOrcamento?.numero}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de histórico.</p>
          ) : (
            <div className="space-y-3">
              {historyEntries.map((h: any) => (
                <div key={h.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs capitalize">{h.acao}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")} {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{h.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-1">por {h.usuario_email}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Orçamento Editor Dialog ───
function OrcamentoEditor({
  orcamento, products, clients, vendedores, tenantId, onClose, logHistory,
}: {
  orcamento: Orcamento | null;
  products: any[];
  clients: any[];
  vendedores: Vendedor[];
  tenantId: string | null;
  onClose: () => void;
  logHistory: (orcamentoId: string, numero: number, acao: string, descricao: string) => Promise<void>;
}) {
  const [items, setItems] = useState<OrcamentoItem[]>(orcamento?.items || []);
  const [clientId, setClientId] = useState(orcamento?.client_id || "");
  const [clientName, setClientName] = useState(orcamento?.client_name || "");
  const [vendedorId, setVendedorId] = useState(orcamento?.vendedor_id || "");
  const [vendedorName, setVendedorName] = useState(orcamento?.vendedor_name || "");
  const [descontoTipo, setDescontoTipo] = useState<"percent" | "value">(orcamento?.desconto_tipo as any || "percent");
  const [descontoValor, setDescontoValor] = useState(orcamento?.desconto_valor || 0);
  const [validade, setValidade] = useState<Date>(orcamento?.validade ? new Date(orcamento.validade) : new Date(Date.now() + 30 * 86400000));
  const [observacoes, setObservacoes] = useState(orcamento?.observacoes || "");
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode?.includes(q) || p.sku?.toLowerCase().includes(q));
  }, [products, productSearch]);

  const addItem = (product: any) => {
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      setItems(items.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total: calcItemTotal({ ...i, quantity: i.quantity + 1 }) } : i));
    } else {
      const newItem: OrcamentoItem = {
        product_id: product.id, product_name: product.name,
        quantity: 1, unit_price: product.price,
        desconto_tipo: "percent", desconto_valor: 0, total: product.price,
      };
      setItems([...items, newItem]);
    }
    setProductSearch("");
  };

  const updateItem = (idx: number, patch: Partial<OrcamentoItem>) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...patch };
      updated.total = calcItemTotal(updated);
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const { subtotal, total } = calcTotals(items, descontoTipo, descontoValor);

  const handleSave = async (authorize = false) => {
    if (!tenantId) return;
    if (items.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: clientId || null,
        client_name: clientName || null,
        vendedor_id: vendedorId || null,
        vendedor_name: vendedorName || null,
        desconto_tipo: descontoTipo,
        desconto_valor: descontoValor,
        validade: format(validade, "yyyy-MM-dd"),
        observacoes,
        subtotal,
        total,
        tenant_id: tenantId,
        autorizado: authorize || orcamento?.autorizado || false,
        status: authorize ? "autorizado" : (orcamento?.status || "rascunho"),
      };

      let orcId = orcamento?.id;
      let orcNumero = orcamento?.numero;
      if (orcId) {
        await supabase.from("orcamentos").update(payload).eq("id", orcId);
        await supabase.from("orcamento_items").delete().eq("orcamento_id", orcId);
      } else {
        const { data } = await supabase.from("orcamentos").insert(payload).select("id, numero").single();
        orcId = data?.id;
        orcNumero = data?.numero;
      }

      if (orcId) {
        const itemsPayload = items.map((i) => ({
          orcamento_id: orcId!,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          desconto_tipo: i.desconto_tipo,
          desconto_valor: i.desconto_valor,
          total: i.total,
          tenant_id: tenantId,
        }));
        await supabase.from("orcamento_items").insert(itemsPayload);

        // Log history
        const acao = orcamento ? (authorize ? "autorizado" : "editado") : "criado";
        const descricao = orcamento
          ? (authorize ? "Orçamento salvo e autorizado" : `Orçamento editado — ${items.length} itens, total ${formatBRL(total)}`)
          : `Orçamento criado com ${items.length} itens, total ${formatBRL(total)}`;
        await logHistory(orcId, orcNumero || 0, acao, descricao);
      }

      toast.success(orcamento ? "Orçamento atualizado" : "Orçamento salvo");
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{orcamento ? `Editar Orçamento #${orcamento.numero}` : "Novo Orçamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client & Vendedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Select value={clientId || "__avulso"} onValueChange={(v) => {
                if (v === "__avulso") {
                  setClientId("");
                  setClientName("");
                } else {
                  setClientId(v);
                  const c = clients.find((c: any) => c.id === v);
                  setClientName(c?.nome || "");
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__avulso">— Cliente Avulso —</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {!clientId && (
                <Input placeholder="Nome do cliente avulso" value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
              <Select value={vendedorId || "__avulso"} onValueChange={(v) => {
                if (v === "__avulso") {
                  setVendedorId("");
                  setVendedorName("");
                } else {
                  setVendedorId(v);
                  const vd = vendedores.find((vd) => vd.id === v);
                  setVendedorName(vd?.nome || "");
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__avulso">— Vendedor Avulso —</SelectItem>
                  {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome} ({v.comissao}%)</SelectItem>)}
                </SelectContent>
              </Select>
              {!vendedorId && (
                <Input placeholder="Nome do vendedor avulso" value={vendedorName} onChange={(e) => setVendedorName(e.target.value)} className="mt-1" />
              )}
            </div>
          </div>

          {/* Validade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Validade</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !validade && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validade ? format(validade, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={validade} onSelect={(d) => d && setValidade(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={1} placeholder="Notas adicionais..." />
            </div>
          </div>

          {/* Product search & add */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Adicionar Produto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar por nome, SKU ou código de barras..." className="pl-9" />
            </div>
            {productSearch && (
              <div className="border border-border rounded-md mt-1 max-h-40 overflow-auto bg-card">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-secondary transition-colors">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{formatBRL(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-24">Preço Un.</TableHead>
                    <TableHead className="w-32">Desconto</TableHead>
                    <TableHead className="w-24 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{item.product_name}</TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                          className="h-8 w-16 text-xs" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step={0.01} value={item.unit_price}
                          onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                          className="h-8 w-20 text-xs" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Select value={item.desconto_tipo} onValueChange={(v) => updateItem(idx, { desconto_tipo: v as any })}>
                            <SelectTrigger className="h-8 w-14 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">%</SelectItem>
                              <SelectItem value="value">R$</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" min={0} step={0.01} value={item.desconto_valor}
                            onChange={(e) => updateItem(idx, { desconto_valor: Number(e.target.value) })}
                            className="h-8 w-16 text-xs" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">{formatBRL(item.total)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* General discount & totals */}
          <div className="flex flex-col sm:flex-row items-end gap-4 border-t border-border pt-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Desconto Geral</label>
              <div className="flex gap-2 mt-1">
                <Select value={descontoTipo} onValueChange={(v) => setDescontoTipo(v as any)}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="value">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0} step={0.01} value={descontoValor}
                  onChange={(e) => setDescontoValor(Number(e.target.value))} className="w-28" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-muted-foreground">Subtotal: {formatBRL(subtotal)}</p>
              <p className="text-lg font-bold text-foreground">Total: {formatBRL(total)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
            {!orcamento?.autorizado && (
              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-1" /> Salvar e Autorizar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
