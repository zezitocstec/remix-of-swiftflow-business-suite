import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  comissao: number;
  meta_mensal: number;
  ativo: boolean;
}

export default function VendedoresConfig() {
  const { tenantId } = useTenant();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [nome, setNome] = useState("");
  const [comissao, setComissao] = useState("");
  const [metaMensal, setMetaMensal] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("vendedores").select("*").eq("tenant_id", tenantId).order("nome");
    if (data) setVendedores(data as any);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!nome.trim() || !tenantId) { toast.error("Informe o nome"); return; }
    await supabase.from("vendedores").insert({ nome: nome.trim(), comissao: Number(comissao) || 0, meta_mensal: Number(metaMensal) || 0, tenant_id: tenantId });
    setNome(""); setComissao(""); setMetaMensal("");
    toast.success("Vendedor adicionado");
    load();
  };

  const toggleAtivo = async (v: Vendedor) => {
    await supabase.from("vendedores").update({ ativo: !v.ativo }).eq("id", v.id);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vendedores").delete().eq("id", id);
    toast.success("Vendedor removido");
    load();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Vendedores</h3>
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Nome do vendedor" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1 min-w-[150px]" />
        <Input placeholder="Comissão (%)" type="number" value={comissao} onChange={(e) => setComissao(e.target.value)} className="w-28" />
        <Input placeholder="Meta mensal (R$)" type="number" value={metaMensal} onChange={(e) => setMetaMensal(e.target.value)} className="w-36" />
        <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Meta Mensal</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum vendedor cadastrado</TableCell></TableRow>
            ) : vendedores.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.nome}</TableCell>
                <TableCell>{v.comissao}%</TableCell>
                <TableCell className="tabular-nums">{v.meta_mensal > 0 ? `R$ ${v.meta_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                <TableCell><Switch checked={v.ativo} onCheckedChange={() => toggleAtivo(v)} /></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
