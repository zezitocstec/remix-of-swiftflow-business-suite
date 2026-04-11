import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { formatBRL } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function OrcamentosReport() {
  const { tenantId } = useTenant();
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("orcamentos").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    if (data) setOrcamentos(data);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return orcamentos;
    if (statusFilter === "autorizado") return orcamentos.filter((o) => o.autorizado);
    if (statusFilter === "rascunho") return orcamentos.filter((o) => !o.autorizado && o.status === "rascunho");
    if (statusFilter === "expirado") return orcamentos.filter((o) => new Date(o.validade) < new Date() && !o.autorizado);
    return orcamentos;
  }, [orcamentos, statusFilter]);

  const totalGeral = filtered.reduce((s, o) => s + Number(o.total), 0);

  const statusBadge = (o: any) => {
    if (o.autorizado) return <Badge className="bg-green-600 text-white">Autorizado</Badge>;
    if (o.status === "convertido") return <Badge variant="secondary">Convertido</Badge>;
    if (new Date(o.validade) < new Date()) return <Badge variant="destructive">Expirado</Badge>;
    return <Badge variant="outline">Rascunho</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Relatório de Orçamentos</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} orçamentos — Total: {formatBRL(totalGeral)}</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="autorizado">Autorizados</SelectItem>
            <SelectItem value="expirado">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</TableCell></TableRow>
            ) : filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">#{o.numero}</TableCell>
                <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>{o.client_name || "—"}</TableCell>
                <TableCell>{o.vendedor_name || "—"}</TableCell>
                <TableCell>{formatBRL(o.subtotal)}</TableCell>
                <TableCell className="text-xs">
                  {o.desconto_valor > 0 ? `${o.desconto_tipo === "percent" ? o.desconto_valor + "%" : formatBRL(o.desconto_valor)}` : "—"}
                </TableCell>
                <TableCell className="font-medium">{formatBRL(o.total)}</TableCell>
                <TableCell className="text-xs">{format(new Date(o.validade), "dd/MM/yyyy")}</TableCell>
                <TableCell>{statusBadge(o)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
