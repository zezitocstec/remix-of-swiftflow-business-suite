import { TopBar } from "@/components/TopBar";
import { formatBRL } from "@/lib/mock-data";
import { useProducts } from "@/contexts/ProductContext";
import { AlertTriangle, Plus, Upload, FileText, ArrowUpDown } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export default function Estoque() {
  const { products, movements, addStock, importXML } = useProducts();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryReason, setEntryReason] = useState("Entrada manual");
  const [showMovements, setShowMovements] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lowStock = products.filter((p) => p.stock < 40);

  const handleManualEntry = () => {
    if (!selectedProductId || !entryQty || parseInt(entryQty) <= 0) {
      toast({ title: "Erro", description: "Selecione um produto e informe a quantidade.", variant: "destructive" });
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    addStock(selectedProductId, parseInt(entryQty), entryReason || "Entrada manual");
    toast({ title: "Estoque atualizado", description: `+${entryQty} unidades de ${product?.name}.` });
    setEntryDialogOpen(false);
    setSelectedProductId("");
    setEntryQty("");
    setEntryReason("Entrada manual");
  };

  const handleXMLImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml")) {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo XML (NF-e).", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const count = importXML(content);
      if (count > 0) {
        toast({ title: "Importação concluída", description: `${count} produto(s) processado(s) do XML.` });
      } else {
        toast({ title: "Nenhum produto encontrado", description: "O XML não contém itens válidos.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Estoque" subtitle="Controle de inventário" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setEntryDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Entrada Manual
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importar XML (NF-e)
          </Button>
          <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={handleXMLImport} />
          <Button size="sm" variant={showMovements ? "secondary" : "outline"} onClick={() => setShowMovements(!showMovements)} className="ml-auto">
            <ArrowUpDown className="h-4 w-4" /> Movimentações
          </Button>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-foreground">Estoque Baixo</h3>
            </div>
            <div className="space-y-1">
              {lowStock.map((p) => (
                <p key={p.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{p.name}</span> — {p.stock} unidades
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Movements History */}
        {showMovements && movements.length > 0 && (
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 bg-secondary border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Histórico de Movimentações
              </h3>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium">Produto</th>
                    <th className="text-left py-2 px-4 font-medium">Tipo</th>
                    <th className="text-right py-2 px-4 font-medium">Qtd</th>
                    <th className="text-left py-2 px-4 font-medium">Motivo</th>
                    <th className="text-right py-2 px-4 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 50).map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-4 text-foreground">{m.productName}</td>
                      <td className="py-2 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.type === "entrada" ? "bg-success/10 text-success" :
                          m.type === "venda" ? "bg-primary/10 text-primary" :
                          m.type === "cancelamento" ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {m.type === "entrada" ? "Entrada" : m.type === "venda" ? "Venda" : m.type === "cancelamento" ? "Cancelamento" : "Saída"}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-foreground">
                        {m.type === "entrada" || m.type === "cancelamento" ? "+" : "-"}{m.quantity}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground text-xs">{m.reason}</td>
                      <td className="py-2 px-4 text-right text-muted-foreground text-xs tabular-nums">
                        {m.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Table */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                <th className="text-left py-2.5 px-4 font-medium">SKU</th>
                <th className="text-right py-2.5 px-4 font-medium">Qtd Atual</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor Unit.</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor Total</th>
                <th className="text-center py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{p.sku}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{p.stock}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price * p.stock)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      p.stock < 20 ? "bg-destructive/10 text-destructive" :
                      p.stock < 40 ? "bg-warning/10 text-warning" :
                      "bg-success/10 text-success"
                    }`}>
                      {p.stock < 20 ? "Crítico" : p.stock < 40 ? "Baixo" : "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entrada Manual de Estoque</DialogTitle>
            <DialogDescription>Selecione o produto e informe a quantidade a adicionar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-select">Produto</Label>
              <select
                id="product-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.stock} un</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="entry-qty">Quantidade</Label>
                <Input id="entry-qty" type="number" min="1" value={entryQty} onChange={(e) => setEntryQty(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-reason">Motivo</Label>
                <Input id="entry-reason" value={entryReason} onChange={(e) => setEntryReason(e.target.value)} placeholder="Ex: Compra fornecedor" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualEntry}>Confirmar Entrada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
