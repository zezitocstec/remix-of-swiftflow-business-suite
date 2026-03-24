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

export interface Client {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  observacoes: string;
  creditLimit: number; // limite de crédito para fiado
  creditUsed: number;  // quanto já usou de fiado
  compras: number;
  total: number;
}

export interface DebtRecord {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  paid: number;
  saleDate: Date;
  payments: { id: string; amount: number; date: Date; method: string }[];
}

export interface CashRegister {
  id: string;
  operatorName: string;
  openedAt: Date;
  closedAt: Date | null;
  openingBalance: number;
  sales: { method: string; amount: number }[];
  withdrawals: { amount: number; reason: string; date: Date }[];
  deposits: { amount: number; reason: string; date: Date }[];
}

export interface SaleRecord {
  id: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  total: number;
  methods: { method: string; amount: number }[];
  clientId?: string;
  clientName?: string;
  date: Date;
}

interface ProductContextType {
  products: Product[];
  movements: StockMovement[];
  clients: Client[];
  debts: DebtRecord[];
  sales: SaleRecord[];
  cashRegister: CashRegister | null;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  sellProducts: (items: { productId: string; quantity: number }[], methods?: { method: string; amount: number }[], clientId?: string) => string;
  cancelSale: (saleId: string) => void;
  addStock: (productId: string, quantity: number, reason: string) => void;
  importXML: (xmlContent: string) => number;
  // Clients
  addClient: (client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  // Fiado
  createDebt: (clientId: string, amount: number) => string | null;
  payDebt: (debtId: string, amount: number, method: string) => void;
  // Cash register
  openCashRegister: (openingBalance: number, operatorName?: string) => void;
  closeCashRegister: () => CashRegister | null;
  addWithdrawal: (amount: number, reason: string) => void;
  addDeposit: (amount: number, reason: string) => void;
}

const ProductContext = createContext<ProductContextType | null>(null);

const saleRecords = new Map<string, { productId: string; quantity: number }[]>();

const initialClients: Client[] = [
  { id: "1", nome: "João Silva", cpfCnpj: "123.456.789-00", telefone: "(11) 99999-1234", email: "joao@email.com", dataNascimento: "1990-05-15", observacoes: "", creditLimit: 500, creditUsed: 0, compras: 12, total: 1580.40 },
  { id: "2", nome: "Maria Santos", cpfCnpj: "987.654.321-00", telefone: "(11) 98888-5678", email: "maria@email.com", dataNascimento: "1985-11-20", observacoes: "Cliente VIP", creditLimit: 1000, creditUsed: 0, compras: 8, total: 920.00 },
  { id: "3", nome: "Pedro Oliveira", cpfCnpj: "456.789.123-00", telefone: "(21) 97777-9012", email: "pedro@email.com", dataNascimento: "", observacoes: "", creditLimit: 300, creditUsed: 0, compras: 23, total: 3450.80 },
  { id: "4", nome: "Ana Costa", cpfCnpj: "321.654.987-00", telefone: "(31) 96666-3456", email: "ana@email.com", dataNascimento: "1992-03-08", observacoes: "", creditLimit: 200, creditUsed: 0, compras: 5, total: 430.20 },
];

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);

  const addMovement = useCallback((m: Omit<StockMovement, "id" | "date">) => {
    setMovements((prev) => [{ ...m, id: crypto.randomUUID(), date: new Date() }, ...prev]);
  }, []);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    setProducts((prev) => [...prev, { ...product, id: crypto.randomUUID() }]);
  }, []);

  const updateProduct = useCallback((id: string, data: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const sellProducts = useCallback(
    (items: { productId: string; quantity: number }[], methods?: { method: string; amount: number }[], clientId?: string) => {
      const saleId = crypto.randomUUID();
      saleRecords.set(saleId, items);

      setProducts((prev) =>
        prev.map((p) => {
          const sold = items.find((i) => i.productId === p.id);
          return sold ? { ...p, stock: Math.max(0, p.stock - sold.quantity) } : p;
        })
      );

      const saleItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        addMovement({
          productId: item.productId,
          productName: product?.name || "",
          type: "venda",
          quantity: item.quantity,
          reason: `Venda #${saleId.slice(0, 8)}`,
        });
        return { productId: item.productId, productName: product?.name || "", quantity: item.quantity, price: product?.price || 0 };
      });

      const total = saleItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const client = clientId ? clients.find((c) => c.id === clientId) : undefined;

      setSales((prev) => [{
        id: saleId, items: saleItems, total, methods: methods || [], clientId, clientName: client?.nome, date: new Date(),
      }, ...prev]);

      // Update client stats
      if (clientId) {
        setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, compras: c.compras + 1, total: c.total + total } : c));
      }

      // Update cash register
      if (cashRegister && methods) {
        setCashRegister((prev) => prev ? { ...prev, sales: [...prev.sales, ...methods] } : prev);
      }

      return saleId;
    },
    [products, clients, cashRegister, addMovement]
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
      addMovement({ productId, productName: product?.name || "", type: "entrada", quantity, reason });
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
          const existing = products.find((p) => (barcode && p.barcode === barcode) || p.sku === sku);
          if (existing) {
            addStock(existing.id, Math.round(quantity), `Importação XML - ${name}`);
          } else {
            const newId = crypto.randomUUID();
            setProducts((prev) => [...prev, { id: newId, name, sku, barcode: barcode === "SEM GTIN" ? "" : barcode, price, stock: Math.round(quantity), category: ncm ? "Importado" : "Outros" }]);
            addMovement({ productId: newId, productName: name, type: "entrada", quantity: Math.round(quantity), reason: "Importação XML (NF-e)" });
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

  // Client CRUD
  const addClient = useCallback((client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => {
    setClients((prev) => [...prev, { ...client, id: crypto.randomUUID(), compras: 0, total: 0, creditUsed: 0 }]);
  }, []);

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Fiado (debt)
  const createDebt = useCallback((clientId: string, amount: number): string | null => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;
    const available = client.creditLimit - client.creditUsed;
    if (amount > available) return null;

    const debtId = crypto.randomUUID();
    setDebts((prev) => [...prev, { id: debtId, clientId, clientName: client.nome, amount, paid: 0, saleDate: new Date(), payments: [] }]);
    setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, creditUsed: c.creditUsed + amount } : c));
    return debtId;
  }, [clients]);

  const payDebt = useCallback((debtId: string, amount: number, method: string) => {
    setDebts((prev) => prev.map((d) => {
      if (d.id !== debtId) return d;
      const newPaid = Math.min(d.amount, d.paid + amount);
      const actualPayment = newPaid - d.paid;
      // Restore credit
      setClients((pc) => pc.map((c) => c.id === d.clientId ? { ...c, creditUsed: Math.max(0, c.creditUsed - actualPayment) } : c));
      return { ...d, paid: newPaid, payments: [...d.payments, { id: crypto.randomUUID(), amount: actualPayment, date: new Date(), method }] };
    }));
  }, []);

  // Cash register
  const openCashRegister = useCallback((openingBalance: number) => {
    setCashRegister({ id: crypto.randomUUID(), openedAt: new Date(), closedAt: null, openingBalance, sales: [], withdrawals: [], deposits: [] });
  }, []);

  const closeCashRegister = useCallback(() => {
    if (!cashRegister) return null;
    const closed = { ...cashRegister, closedAt: new Date() };
    setCashRegister(null);
    return closed;
  }, [cashRegister]);

  const addWithdrawal = useCallback((amount: number, reason: string) => {
    setCashRegister((prev) => prev ? { ...prev, withdrawals: [...prev.withdrawals, { amount, reason, date: new Date() }] } : prev);
  }, []);

  const addDeposit = useCallback((amount: number, reason: string) => {
    setCashRegister((prev) => prev ? { ...prev, deposits: [...prev.deposits, { amount, reason, date: new Date() }] } : prev);
  }, []);

  return (
    <ProductContext.Provider value={{
      products, movements, clients, debts, sales, cashRegister,
      addProduct, updateProduct, deleteProduct, sellProducts, cancelSale, addStock, importXML,
      addClient, updateClient, deleteClient,
      createDebt, payDebt,
      openCashRegister, closeCashRegister, addWithdrawal, addDeposit,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts must be used within ProductProvider");
  return ctx;
}
