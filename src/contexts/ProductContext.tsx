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
  creditLimit: number;
  creditUsed: number;
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

export interface Operator {
  id: string;
  nome: string;
  pin: string;
  ativo: boolean;
  permissions: {
    abrirCaixa: boolean;
    cancelarItem: boolean;
    cancelarCupom: boolean;
  };
}

export interface Terminal {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Supplier {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
}

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  supplierId?: string;
  supplierName?: string;
  category: string;
  status: "pendente" | "pago";
  paidAt?: Date;
}

export interface ActionLog {
  id: string;
  type: "abertura_caixa" | "fechamento_caixa" | "venda" | "cancelamento_item" | "cancelamento_cupom" | "sangria" | "reforco";
  operatorId: string;
  operatorName: string;
  terminalId: string;
  terminalName: string;
  description: string;
  amount?: number;
  saleId?: string;
  authorizedBy?: string;
  date: Date;
}

export interface CashRegister {
  id: string;
  operatorId: string;
  operatorName: string;
  terminalId: string;
  terminalName: string;
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
  terminalId?: string;
  terminalName?: string;
  operatorId?: string;
  operatorName?: string;
  date: Date;
}

interface ProductContextType {
  products: Product[];
  movements: StockMovement[];
  clients: Client[];
  debts: DebtRecord[];
  sales: SaleRecord[];
  cashRegister: CashRegister | null;
  operators: Operator[];
  terminals: Terminal[];
  actionLogs: ActionLog[];
  adminPin: string;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  sellProducts: (items: { productId: string; quantity: number }[], methods?: { method: string; amount: number }[], clientId?: string, terminalId?: string, operatorId?: string) => string;
  cancelSale: (saleId: string) => void;
  addStock: (productId: string, quantity: number, reason: string) => void;
  importXML: (xmlContent: string) => number;
  addClient: (client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  createDebt: (clientId: string, amount: number) => string | null;
  payDebt: (debtId: string, amount: number, method: string) => void;
  openCashRegister: (openingBalance: number, operatorId: string, terminalId: string) => void;
  closeCashRegister: () => CashRegister | null;
  addWithdrawal: (amount: number, reason: string) => void;
  addDeposit: (amount: number, reason: string) => void;
  addOperator: (op: Omit<Operator, "id">) => void;
  updateOperator: (id: string, data: Partial<Operator>) => void;
  deleteOperator: (id: string) => void;
  addTerminal: (t: Omit<Terminal, "id">) => void;
  updateTerminal: (id: string, data: Partial<Terminal>) => void;
  deleteTerminal: (id: string) => void;
  addActionLog: (log: Omit<ActionLog, "id" | "date">) => void;
  setAdminPin: (pin: string) => void;
}

const ProductContext = createContext<ProductContextType | null>(null);

const saleRecords = new Map<string, { productId: string; quantity: number }[]>();

const initialClients: Client[] = [
  { id: "1", nome: "João Silva", cpfCnpj: "123.456.789-00", telefone: "(11) 99999-1234", email: "joao@email.com", dataNascimento: "1990-05-15", observacoes: "", creditLimit: 500, creditUsed: 0, compras: 12, total: 1580.40 },
  { id: "2", nome: "Maria Santos", cpfCnpj: "987.654.321-00", telefone: "(11) 98888-5678", email: "maria@email.com", dataNascimento: "1985-11-20", observacoes: "Cliente VIP", creditLimit: 1000, creditUsed: 0, compras: 8, total: 920.00 },
  { id: "3", nome: "Pedro Oliveira", cpfCnpj: "456.789.123-00", telefone: "(21) 97777-9012", email: "pedro@email.com", dataNascimento: "", observacoes: "", creditLimit: 300, creditUsed: 0, compras: 23, total: 3450.80 },
  { id: "4", nome: "Ana Costa", cpfCnpj: "321.654.987-00", telefone: "(31) 96666-3456", email: "ana@email.com", dataNascimento: "1992-03-08", observacoes: "", creditLimit: 200, creditUsed: 0, compras: 5, total: 430.20 },
];

const initialOperators: Operator[] = [
  { id: "op-admin", nome: "Administrador", pin: "1234", ativo: true, permissions: { abrirCaixa: true, cancelarItem: true, cancelarCupom: true } },
  { id: "op-1", nome: "Operador 1", pin: "0000", ativo: true, permissions: { abrirCaixa: true, cancelarItem: false, cancelarCupom: false } },
];

const initialTerminals: Terminal[] = [
  { id: "term-01", nome: "Caixa 01", ativo: true },
  { id: "term-02", nome: "Caixa 02", ativo: true },
];

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [terminals, setTerminals] = useState<Terminal[]>(initialTerminals);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [adminPin, setAdminPin] = useState("1234");

  const addActionLog = useCallback((log: Omit<ActionLog, "id" | "date">) => {
    setActionLogs((prev) => [{ ...log, id: crypto.randomUUID(), date: new Date() }, ...prev]);
  }, []);

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
    (items: { productId: string; quantity: number }[], methods?: { method: string; amount: number }[], clientId?: string, terminalId?: string, operatorId?: string) => {
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
      const terminal = terminalId ? terminals.find((t) => t.id === terminalId) : undefined;
      const operator = operatorId ? operators.find((o) => o.id === operatorId) : undefined;

      setSales((prev) => [{
        id: saleId, items: saleItems, total, methods: methods || [],
        clientId, clientName: client?.nome,
        terminalId, terminalName: terminal?.nome,
        operatorId, operatorName: operator?.nome,
        date: new Date(),
      }, ...prev]);

      if (clientId) {
        setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, compras: c.compras + 1, total: c.total + total } : c));
      }

      if (cashRegister && methods) {
        setCashRegister((prev) => prev ? { ...prev, sales: [...prev.sales, ...methods] } : prev);
      }

      return saleId;
    },
    [products, clients, cashRegister, terminals, operators, addMovement]
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

  const addClient = useCallback((client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => {
    setClients((prev) => [...prev, { ...client, id: crypto.randomUUID(), compras: 0, total: 0, creditUsed: 0 }]);
  }, []);

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

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
      setClients((pc) => pc.map((c) => c.id === d.clientId ? { ...c, creditUsed: Math.max(0, c.creditUsed - actualPayment) } : c));
      return { ...d, paid: newPaid, payments: [...d.payments, { id: crypto.randomUUID(), amount: actualPayment, date: new Date(), method }] };
    }));
  }, []);

  // Cash register
  const openCashRegister = useCallback((openingBalance: number, operatorId: string, terminalId: string) => {
    const op = operators.find(o => o.id === operatorId);
    const term = terminals.find(t => t.id === terminalId);
    setCashRegister({
      id: crypto.randomUUID(), operatorId, operatorName: op?.nome || "Operador",
      terminalId, terminalName: term?.nome || "Caixa",
      openedAt: new Date(), closedAt: null, openingBalance, sales: [], withdrawals: [], deposits: [],
    });
  }, [operators, terminals]);

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

  // Operators CRUD
  const addOperator = useCallback((op: Omit<Operator, "id">) => {
    setOperators((prev) => [...prev, { ...op, id: crypto.randomUUID() }]);
  }, []);
  const updateOperator = useCallback((id: string, data: Partial<Operator>) => {
    setOperators((prev) => prev.map((o) => (o.id === id ? { ...o, ...data } : o)));
  }, []);
  const deleteOperator = useCallback((id: string) => {
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Terminals CRUD
  const addTerminal = useCallback((t: Omit<Terminal, "id">) => {
    setTerminals((prev) => [...prev, { ...t, id: crypto.randomUUID() }]);
  }, []);
  const updateTerminal = useCallback((id: string, data: Partial<Terminal>) => {
    setTerminals((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }, []);
  const deleteTerminal = useCallback((id: string) => {
    setTerminals((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ProductContext.Provider value={{
      products, movements, clients, debts, sales, cashRegister, operators, terminals, actionLogs, adminPin,
      addProduct, updateProduct, deleteProduct, sellProducts, cancelSale, addStock, importXML,
      addClient, updateClient, deleteClient,
      createDebt, payDebt,
      openCashRegister, closeCashRegister, addWithdrawal, addDeposit,
      addOperator, updateOperator, deleteOperator,
      addTerminal, updateTerminal, deleteTerminal,
      addActionLog, setAdminPin,
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
