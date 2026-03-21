import { useMemo } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { formatBRL, type Product } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

interface ProductGridProps {
  products: Product[];
  search: string;
  setSearch: (v: string) => void;
  onAddToCart: (product: Product) => void;
  lastSaleId: string | null;
  onCancelLastSale: () => void;
}

export default function ProductGrid({
  products, search, setSearch, onAddToCart, lastSaleId, onCancelLastSale,
}: ProductGridProps) {
  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }, [search, products]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Search bar */}
      <div className="h-14 border-b border-border bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Buscar produto... (F1)"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground p-2 touch-manipulation">
            <X className="h-4 w-4" />
          </button>
        )}
        {lastSaleId && (
          <Button variant="outline" size="sm" onClick={onCancelLastSale} className="ml-1 text-destructive border-destructive/30 hover:bg-destructive/10 touch-manipulation">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-2 sm:p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => onAddToCart(product)}
              disabled={product.stock <= 0}
              className="rounded-lg border border-border bg-pos-card p-3 sm:p-4 text-left transition-all duration-100 hover:border-primary active:scale-[0.97] flex flex-col disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[5rem] select-none"
            >
              <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                {product.name}
              </span>
              <span className="text-xs text-muted-foreground mt-1">{product.sku}</span>
              <div className="flex items-baseline justify-between mt-auto pt-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(product.price)}
                </span>
                <span className={`text-xs tabular-nums ${product.stock <= 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {product.stock} un
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
