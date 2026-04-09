import { TopBar } from "@/components/TopBar";
import { formatBRL, type Product } from "@/lib/mock-data";
import { useProducts } from "@/contexts/ProductContext";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeScanner from "@/components/pdv/BarcodeScanner";
import ProductImageUpload from "@/components/produtos/ProductImageUpload";
import { supabase } from "@/integrations/supabase/client";

const categories = ["Bebidas", "Padaria", "Grãos", "Laticínios", "Limpeza", "Higiene", "Óleos", "Massas", "Hortifruti", "Carnes", "Importado", "Outros"];

const emptyForm = {
  name: "", sku: "", price: 0, stock: 0, minStock: 0, category: "Outros", barcode: "",
  ncm: "", cfop: "5102", cst: "", csosn: "", icms_aliquota: 0, pis_aliquota: 0,
  cofins_aliquota: 0, cest: "", descricao: "", origem: "0", unidade: "UN", imageUrl: "" as string | undefined,
};

export default function Produtos() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }, [search, products]);

  const openNew = () => { setEditingProduct(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, sku: p.sku, price: p.price, stock: p.stock, minStock: p.minStock || 0,
      category: p.category, barcode: p.barcode, imageUrl: p.imageUrl,
      ncm: (p as any).ncm || "", cfop: (p as any).cfop || "5102", cst: (p as any).cst || "",
      csosn: (p as any).csosn || "", icms_aliquota: (p as any).icms_aliquota || 0,
      pis_aliquota: (p as any).pis_aliquota || 0, cofins_aliquota: (p as any).cofins_aliquota || 0,
      cest: (p as any).cest || "", descricao: (p as any).descricao || "",
      origem: (p as any).origem || "0", unidade: (p as any).unidade || "UN",
    });
    setDialogOpen(true);
  };
  const openDelete = (p: Product) => { setDeletingProduct(p); setDeleteDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast({ title: "Erro", description: "Nome e SKU são obrigatórios.", variant: "destructive" });
      return;
    }
    if (editingProduct) {
      updateProduct(editingProduct.id, form);
      toast({ title: "Produto atualizado", description: `${form.name} foi atualizado.` });
    } else {
      addProduct(form);
      toast({ title: "Produto cadastrado", description: `${form.name} foi adicionado.` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingProduct) return;
    deleteProduct(deletingProduct.id);
    toast({ title: "Produto excluído", description: `${deletingProduct.name} foi removido.` });
    setDeleteDialogOpen(false);
    setDeletingProduct(null);
  };

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBarcodeScan = async (barcode: string) => {
    setScannerOpen(false);
    updateField("barcode", barcode);
    setLookingUp(true);

    try {
      const { data, error } = await supabase.functions.invoke("cosmos-lookup", {
        body: { barcode },
      });

      if (error || data?.error) {
        toast({
          title: "Produto não encontrado",
          description: data?.error || "Não foi possível consultar a API Cosmos.",
          variant: "destructive",
        });
        setLookingUp(false);
        return;
      }

      setForm((prev) => ({
        ...prev,
        barcode,
        name: data.name || prev.name,
        descricao: data.descricao || prev.descricao,
        ncm: data.ncm || prev.ncm,
        cest: data.cest || prev.cest,
        price: data.price || prev.price,
        unidade: data.unidade || prev.unidade,
        origem: data.origem || prev.origem,
      }));

      toast({ title: "Produto encontrado!", description: `${data.name} — NCM: ${data.ncm}` });
    } catch {
      toast({ title: "Erro", description: "Falha ao consultar API.", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  const openScannerForNew = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
    setTimeout(() => setScannerOpen(true), 300);
  };

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Produtos" subtitle={`${products.length} produtos cadastrados`} />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-card px-3 h-9 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground" placeholder="Buscar por nome, SKU ou código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={openScannerForNew} className="touch-manipulation">
            <Camera className="h-4 w-4" /> Escanear
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                <th className="text-left py-2.5 px-4 font-medium">SKU</th>
                <th className="text-left py-2.5 px-4 font-medium">Categoria</th>
                <th className="text-left py-2.5 px-4 font-medium">NCM</th>
                <th className="text-right py-2.5 px-4 font-medium">Preço</th>
                <th className="text-right py-2.5 px-4 font-medium">Estoque</th>
                <th className="text-center py-2.5 px-4 font-medium w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {filtered.map((p) => {
                const isLowStock = p.minStock !== undefined && p.stock <= p.minStock && p.stock > 0;
                const isOutOfStock = p.stock <= 0;
                return (
                  <tr key={p.id} className={`border-b border-border last:border-0 transition-colors ${
                    isLowStock ? "bg-warning/5 hover:bg-warning/10" : isOutOfStock ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-secondary/50"
                  }`}>
                    <td className="py-2.5 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted shrink-0" />
                        )}
                        {p.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{p.sku}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{p.category}</td>
                    <td className="py-2.5 px-4 text-muted-foreground font-mono text-xs">{(p as any).ncm || '—'}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 ${
                        isOutOfStock ? "text-destructive font-medium" : isLowStock ? "text-warning font-medium" : "text-foreground"
                      }`}>
                        {(isLowStock || isOutOfStock) && <AlertTriangle className="h-3.5 w-3.5" />}
                        {p.stock}
                        {p.minStock ? <span className="text-xs text-muted-foreground font-normal">/ mín {p.minStock}</span> : null}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>{editingProduct ? "Altere os dados do produto." : "Preencha os dados ou escaneie o código de barras."}</DialogDescription>
          </DialogHeader>

          {lookingUp && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-md px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando produto na API Cosmos...
            </div>
          )}

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
              <TabsTrigger value="fiscal">Dados Fiscais</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              {/* Image upload */}
              <ProductImageUpload imageUrl={form.imageUrl} onImageChange={(url) => updateField("imageUrl", url ?? "")} />

              {/* Barcode with scanner button */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input id="barcode" value={form.barcode} onChange={(e) => updateField("barcode", e.target.value)} placeholder="Ex: 7891234560011" />
                </div>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 touch-manipulation" onClick={() => setScannerOpen(true)} title="Escanear com câmera">
                  <Camera className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="name">Nome *</Label><Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ex: Coca-Cola 350ml" /></div>
                <div className="space-y-1.5"><Label htmlFor="sku">SKU *</Label><Input id="sku" value={form.sku} onChange={(e) => updateField("sku", e.target.value.toUpperCase())} placeholder="Ex: BEB001" /></div>
              </div>

              <div className="space-y-1.5"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" value={form.descricao} onChange={(e) => updateField("descricao", e.target.value)} placeholder="Descrição detalhada do produto" /></div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label htmlFor="price">Preço (R$)</Label><Input id="price" type="number" step="0.01" min="0" value={form.price || ""} onChange={(e) => updateField("price", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1.5"><Label htmlFor="stock">Estoque</Label><Input id="stock" type="number" min="0" value={form.stock || ""} onChange={(e) => updateField("stock", parseInt(e.target.value) || 0)} /></div>
                <div className="space-y-1.5"><Label htmlFor="minStock">Estoque Mín.</Label><Input id="minStock" type="number" min="0" value={form.minStock || ""} onChange={(e) => updateField("minStock", parseInt(e.target.value) || 0)} /></div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Categoria</Label>
                  <select id="category" value={form.category} onChange={(e) => updateField("category", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unidade">Unidade</Label>
                  <select id="unidade" value={form.unidade} onChange={(e) => updateField("unidade", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {["UN", "KG", "LT", "CX", "PCT", "MT", "M2", "M3", "DZ"].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="origem">Origem</Label>
                  <select id="origem" value={form.origem} onChange={(e) => updateField("origem", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="0">0 - Nacional</option>
                    <option value="1">1 - Estrangeira (importação direta)</option>
                    <option value="2">2 - Estrangeira (adquirida no mercado interno)</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="ncm">NCM</Label><Input id="ncm" value={form.ncm} onChange={(e) => updateField("ncm", e.target.value)} placeholder="Ex: 2202.10.00" /></div>
                <div className="space-y-1.5"><Label htmlFor="cest">CEST</Label><Input id="cest" value={form.cest} onChange={(e) => updateField("cest", e.target.value)} placeholder="Ex: 03.011.00" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="cfop">CFOP</Label><Input id="cfop" value={form.cfop} onChange={(e) => updateField("cfop", e.target.value)} placeholder="Ex: 5102" /></div>
                <div className="space-y-1.5"><Label htmlFor="cst">CST</Label><Input id="cst" value={form.cst} onChange={(e) => updateField("cst", e.target.value)} placeholder="Ex: 00" /></div>
              </div>

              <div className="space-y-1.5"><Label htmlFor="csosn">CSOSN (Simples Nacional)</Label><Input id="csosn" value={form.csosn} onChange={(e) => updateField("csosn", e.target.value)} placeholder="Ex: 102" /></div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label htmlFor="icms">ICMS (%)</Label><Input id="icms" type="number" step="0.01" min="0" value={form.icms_aliquota || ""} onChange={(e) => updateField("icms_aliquota", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1.5"><Label htmlFor="pis">PIS (%)</Label><Input id="pis" type="number" step="0.01" min="0" value={form.pis_aliquota || ""} onChange={(e) => updateField("pis_aliquota", parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1.5"><Label htmlFor="cofins">COFINS (%)</Label><Input id="cofins" type="number" step="0.01" min="0" value={form.cofins_aliquota || ""} onChange={(e) => updateField("cofins_aliquota", parseFloat(e.target.value) || 0)} /></div>
              </div>

              <p className="text-xs text-muted-foreground">
                💡 Dica: Ao escanear o código de barras, os campos NCM e CEST são preenchidos automaticamente via API Cosmos.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={lookingUp}>{editingProduct ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <strong>{deletingProduct?.name}</strong>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
    </div>
  );
}
