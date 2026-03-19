import { TopBar } from "@/components/TopBar";
import { mockProducts, formatBRL } from "@/lib/mock-data";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export default function Produtos() {
  const [search, setSearch] = useState("");
  const filtered = mockProducts.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Produtos" subtitle={`${mockProducts.length} produtos cadastrados`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-card px-3 h-9">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Novo Produto
          </button>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                <th className="text-left py-2.5 px-4 font-medium">SKU</th>
                <th className="text-left py-2.5 px-4 font-medium">Categoria</th>
                <th className="text-right py-2.5 px-4 font-medium">Preço</th>
                <th className="text-right py-2.5 px-4 font-medium">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{p.sku}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{p.category}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
