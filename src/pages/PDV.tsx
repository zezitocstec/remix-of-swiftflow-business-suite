import { useState, useMemo, useCallback } from "react";
import { mockProducts, formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function PDV() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!search) return mockProducts;
    const q = search.toLowerCase();
    return mockProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    );
  }, [search]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === id
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  }, []);

  const subtotal = cart.reduce(
    (sum, i) => sum + i.product.price * i.quantity * (1 - i.discount / 100),
    0
  );
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const clearCart = () => {
    setCart([]);
    setShowPayment(false);
  };

  return (
    <div className="flex h-screen bg-pos-bg">
      {/* Product Grid - col-span-8 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search Bar */}
        <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Buscar produto por nome, SKU ou código de barras... (F1)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Products */}
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="rounded-md border border-border bg-pos-card p-3 text-left transition-all duration-100 hover:border-primary active:scale-[0.98] flex flex-col"
              >
                <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                  {product.name}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{product.sku}</span>
                <div className="flex items-baseline justify-between mt-auto pt-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatBRL(product.price)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {product.stock} un
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart - col-span-4 */}
      <div className="w-80 lg:w-96 border-l border-border bg-card flex flex-col">
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          <span className="text-sm font-semibold text-foreground">
            Carrinho ({totalItems})
          </span>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-destructive hover:underline font-medium"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="popLayout">
            {cart.map((item) => (
              <motion.div
                key={item.product.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-border px-4 py-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="text-muted-foreground hover:text-destructive p-1 -mr-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums font-medium text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatBRL(item.product.price * item.quantity)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <p className="text-sm">Nenhum item no carrinho</p>
              <p className="text-xs mt-1">Clique em um produto para adicionar</p>
            </div>
          )}
        </div>

        {/* Total + Payment */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-sm tabular-nums text-foreground">{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-base font-semibold text-foreground">Total</span>
            <span className="text-xl font-bold tabular-nums tracking-tight-display text-foreground">
              {formatBRL(subtotal)}
            </span>
          </div>

          {!showPayment ? (
            <button
              onClick={() => cart.length > 0 && setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full h-12 rounded-md bg-accent text-accent-foreground font-semibold text-sm transition-all duration-100 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Finalizar Venda (Espaço)
            </button>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Forma de pagamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Banknote, label: "Dinheiro" },
                  { icon: QrCode, label: "PIX" },
                  { icon: CreditCard, label: "Crédito" },
                  { icon: Smartphone, label: "Débito" },
                ].map((method) => (
                  <button
                    key={method.label}
                    onClick={clearCart}
                    className="flex items-center gap-2 p-3 rounded-md border border-border hover:border-primary hover:bg-secondary transition-all duration-100 active:scale-[0.98]"
                  >
                    <method.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-foreground">{method.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPayment(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
