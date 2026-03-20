import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { mockProducts as initialProducts, type Product } from "@/lib/mock-data";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: "entrada" | "saida" | "cancelamento" | "venda";
  quantity: number;
  reason: string;
  date: Date;
}

interface ProductContextType {
  products: Product[];
  movements: StockMovement[];
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  sellProducts: (items: { productId: string; quantity: number }[]) => string;
  cancelSale: (saleId: string) => void;
  addStock: (productId: string, quantity: number, reason: string) => void;
  importXML: (xmlContent: string) => number;
}

const ProductContext = createContext<ProductContextType | null>(null);

// Store sale items for cancellation
const saleRecords = new Map<string, { productId: string; quantity: number }[]>();

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const addMovement = useCallback((m: Omit<StockMovement, "id" | "date">) => {
    setMovements((prev) => [
      { ...m, id: crypto.randomUUID(), date: new Date() },
      ...prev,
    ]);
  }, []);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const newProduct: Product = { ...product, id: crypto.randomUUID() };
    setProducts((prev) => [...prev, newProduct]);
  }, []);

  const updateProduct = useCallback((id: string, data: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const sellProducts = useCallback(
    (items: { productId: string; quantity: number }[]) => {
      const saleId = crypto.randomUUID();
      saleRecords.set(saleId, items);

      setProducts((prev) =>
        prev.map((p) => {
          const sold = items.find((i) => i.productId === p.id);
          return sold ? { ...p, stock: Math.max(0, p.stock - sold.quantity) } : p;
        })
      );

      items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        addMovement({
          productId: item.productId,
          productName: product?.name || "",
          type: "venda",
          quantity: item.quantity,
          reason: `Venda #${saleId.slice(0, 8)}`,
        });
      });

      return saleId;
    },
    [products, addMovement]
  );

  const cancelSale = useCallback(
    (saleId: string) => {
      const items = saleRecords.get(saleId);
      if (!items) return;

      setProducts((prev) =>
        prev.map((p) => {
          const returned = items.find((i) => i.productId === p.id);
          return returned ? { ...p, stock: p.stock + returned.quantity } : p;
        })
      );

      items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        addMovement({
          productId: item.productId,
          productName: product?.name || "",
          type: "cancelamento",
          quantity: item.quantity,
          reason: `Cancelamento venda #${saleId.slice(0, 8)}`,
        });
      });

      saleRecords.delete(saleId);
    },
    [products, addMovement]
  );

  const addStock = useCallback(
    (productId: string, quantity: number, reason: string) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: p.stock + quantity } : p))
      );
      const product = products.find((p) => p.id === productId);
      addMovement({
        productId,
        productName: product?.name || "",
        type: "entrada",
        quantity,
        reason,
      });
    },
    [products, addMovement]
  );

  const importXML = useCallback(
    (xmlContent: string) => {
      let count = 0;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, "text/xml");
        const items = doc.querySelectorAll("det");

        items.forEach((det) => {
          const prod = det.querySelector("prod");
          if (!prod) return;

          const name = prod.querySelector("xProd")?.textContent || "Produto importado";
          const sku = prod.querySelector("cProd")?.textContent || `IMP${Date.now()}`;
          const barcode = prod.querySelector("cEAN")?.textContent || "";
          const price = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
          const quantity = parseFloat(prod.querySelector("qCom")?.textContent || "0");
          const ncm = prod.querySelector("NCM")?.textContent || "";

          // Check if product already exists by barcode or SKU
          const existing = products.find(
            (p) => (barcode && p.barcode === barcode) || p.sku === sku
          );

          if (existing) {
            // Just add stock
            addStock(existing.id, Math.round(quantity), `Importação XML - ${name}`);
          } else {
            const newId = crypto.randomUUID();
            const newProduct: Product = {
              id: newId,
              name,
              sku,
              barcode: barcode === "SEM GTIN" ? "" : barcode,
              price,
              stock: Math.round(quantity),
              category: ncm ? "Importado" : "Outros",
            };
            setProducts((prev) => [...prev, newProduct]);
            addMovement({
              productId: newId,
              productName: name,
              type: "entrada",
              quantity: Math.round(quantity),
              reason: "Importação XML (NF-e)",
            });
          }
          count++;
        });
      } catch (e) {
        console.error("Erro ao processar XML:", e);
      }
      return count;
    },
    [products, addStock, addMovement]
  );

  return (
    <ProductContext.Provider
      value={{
        products,
        movements,
        addProduct,
        updateProduct,
        deleteProduct,
        sellProducts,
        cancelSale,
        addStock,
        importXML,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts must be used within ProductProvider");
  return ctx;
}
