import { useMemo, useState, useEffect } from "react";
import { Search, X, RotateCcw, Users, AlertTriangle } from "lucide-react";
import { formatBRL, type Product } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import type { Client } from "@/contexts/ProductContext";
import CashRegisterControls from "./CashRegisterControls";

interface ProductGridProps {
  products: Product[];
  search: string;
  setSearch: (v: string) => void;
  onAddToCart: (product: Product) => void;
  lastSaleId: string | null;
  onCancelLastSale: () => void;
  selectedClient?: Client | null;
  onSelectClient?: () => void;
  onClearClient?: () => void;
  onOpenDebtors?: () => void;
  debtorCount?: number;
}

export default function ProductGrid({
  products, search, setSearch, onAddToCart, lastSaleId, onCancelLastSale,
  selectedClient, onSelectClient, onClearClient, onOpenDebtors, debtorCount,
}: ProductGridProps) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return products;
    const q = debouncedSearch.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }, [debouncedSearch, products]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
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

        {/* Client indicator */}
        {selectedClient ? (
          <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-medium shrink-0">
            <Users className="h-3 w-3" />
            <span className="max-w-[80px] truncate">{selectedClient.nome}</span>
            <button onClick={onClearClient} className="hover:text-destructive touch-manipulation"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSelectClient} className="text-xs shrink-0 touch-manipulation h-8">
            <Users className="h-3.5 w-3.5 mr-1" /> Cliente
          </Button>
        )}

        {/* Debtors shortcut (F4) */}
        {(debtorCount ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={onOpenDebtors} className="text-xs text-destructive shrink-0 touch-manipulation h-8" title="Devedores (F4)">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> {debtorCount}
          </Button>
        )}

        {/* Cash Register Controls */}
        <CashRegisterControls />

        {lastSaleId && (
          <Button variant="outline" size="sm" onClick={onCancelLastSale} className="ml-1 text-destructive border-destructive/30 hover:bg-destructive/10 touch-manipulation">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-2 sm:p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filtered.map((product) => {
            const isLowStock = product.minStock !== undefined && product.stock <= product.minStock && product.stock > 0;
            return (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                disabled={product.stock <= 0}
                className={`rounded-xl border p-3 sm:p-4 text-left transition-all duration-100 hover:border-primary active:scale-[0.96] active:bg-primary/5 flex flex-col disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[4.5rem] select-none ${
                  isLowStock ? "border-warning bg-warning/5" : "border-border bg-pos-card"
                }`}
              >
                <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                  {product.name}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{product.sku}</span>
                <div className="flex items-baseline justify-between mt-auto pt-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatBRL(product.price)}
                  </span>
                  <span className={`text-xs tabular-nums flex items-center gap-0.5 ${
                    product.stock <= 0 ? "text-destructive font-medium" : isLowStock ? "text-warning font-medium" : "text-muted-foreground"
                  }`}>
                    {isLowStock && <AlertTriangle className="h-3 w-3" />}
                    {product.stock} un
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
