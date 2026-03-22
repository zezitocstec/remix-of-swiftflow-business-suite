import { useState, useCallback, useRef } from "react";
import { formatBRL, type Product, type CartItem } from "@/lib/mock-data";
import { useProducts } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RotateCcw } from "lucide-react";
import ProductGrid from "@/components/pdv/ProductGrid";
import CartPanel from "@/components/pdv/CartPanel";
import type { ParkedSale } from "@/components/pdv/types";
import { usePDVShortcuts } from "@/hooks/usePDVShortcuts";

export default function PDV() {
  const { products, sellProducts, cancelSale } = useProducts();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [discount, setDiscount] = useState<{ type: "percent" | "value"; amount: number }>({ type: "percent", amount: 0 });
  const [surcharge, setSurcharge] = useState<{ type: "percent" | "value"; amount: number }>({ type: "percent", amount: 0 });
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showParkDialog, setShowParkDialog] = useState(false);
  const [showRecallDialog, setShowRecallDialog] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Sem estoque", description: `${product.name} está sem estoque.`, variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Estoque insuficiente", variant: "destructive" });
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  }, []);

  const clearCart = () => {
    setCart([]);
    setDiscount({ type: "percent", amount: 0 });
    setSurcharge({ type: "percent", amount: 0 });
    setShowPayment(false);
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmount = discount.type === "percent" ? subtotal * (discount.amount / 100) : discount.amount;
  const surchargeAmount = surcharge.type === "percent" ? subtotal * (surcharge.amount / 100) : surcharge.amount;
  const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const finalizeSale = (methods: { method: string; amount: number }[]) => {
    const items = cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }));
    const saleId = sellProducts(items);
    setLastSaleId(saleId);
    const methodStr = methods.map((m) => `${m.method} ${formatBRL(m.amount)}`).join(" + ");
    toast({
      title: "Venda finalizada!",
      description: `${totalItems} itens — ${formatBRL(total)} via ${methodStr}.`,
    });
    clearCart();
  };

  const handleCancelSale = () => {
    if (lastSaleId) {
      cancelSale(lastSaleId);
      toast({ title: "Venda cancelada", description: "Estoque restaurado." });
      setLastSaleId(null);
    }
    setCancelDialogOpen(false);
  };

  const parkSale = (customerName: string) => {
    if (cart.length === 0) return;
    setParkedSales((prev) => [
      ...prev,
      { id: crypto.randomUUID(), items: [...cart], customerName, parkedAt: new Date(), discount, surcharge },
    ]);
    toast({ title: "Venda estacionada", description: `${customerName} — ${totalItems} itens guardados.` });
    clearCart();
  };

  const recallSale = (id: string) => {
    const sale = parkedSales.find((s) => s.id === id);
    if (!sale) return;
    setCart(sale.items);
    setDiscount(sale.discount);
    setSurcharge(sale.surcharge);
    setParkedSales((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Venda retomada", description: `${sale.customerName} — ${sale.items.length} itens.` });
  };

  // Keyboard shortcuts
  usePDVShortcuts({
    onSearch: () => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]');
      input?.focus();
    },
    onPark: () => {
      if (cart.length > 0) setShowParkDialog(true);
    },
    onRecall: () => {
      if (parkedSales.length > 0) setShowRecallDialog(true);
    },
    onFinalize: () => {
      if (cart.length > 0 && !showPayment) setShowPayment(true);
    },
    onCancel: () => {
      if (showPayment) setShowPayment(false);
    },
  });

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100vh-3.5rem)] sm:h-screen bg-pos-bg">
      <ProductGrid
        products={products}
        search={search}
        setSearch={setSearch}
        onAddToCart={addToCart}
        lastSaleId={lastSaleId}
        onCancelLastSale={() => setCancelDialogOpen(true)}
      />
      <CartPanel
        cart={cart}
        updateQty={updateQty}
        removeItem={removeItem}
        clearCart={clearCart}
        onFinalizeSale={finalizeSale}
        discount={discount}
        setDiscount={setDiscount}
        surcharge={surcharge}
        setSurcharge={setSurcharge}
        parkedSales={parkedSales}
        onParkSale={parkSale}
        onRecallSale={recallSale}
        showPayment={showPayment}
        setShowPayment={setShowPayment}
        showParkDialog={showParkDialog}
        setShowParkDialog={setShowParkDialog}
        showRecallDialog={showRecallDialog}
        setShowRecallDialog={setShowRecallDialog}
      />

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Última Venda</DialogTitle>
            <DialogDescription>O estoque será restaurado. Deseja continuar?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Não</Button>
            <Button variant="destructive" onClick={handleCancelSale}>Sim, cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
