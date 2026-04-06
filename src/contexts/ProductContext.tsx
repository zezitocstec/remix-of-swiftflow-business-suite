import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import type { Product, CartItem } from "@/lib/mock-data";

export type { Product, CartItem };

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
  cupomInicio?: number;
  cupomAtual?: number;
  cupomFim?: number;
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
  cupomNumero?: number;
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
  suppliers: Supplier[];
  bills: Bill[];
  adminPin: string;
  loading: boolean;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  sellProducts: (items: { productId: string; quantity: number }[], methods?: { method: string; amount: number }[], clientId?: string, terminalId?: string, operatorId?: string) => Promise<string>;
  cancelSale: (saleId: string) => Promise<void>;
  addStock: (productId: string, quantity: number, reason: string) => Promise<void>;
  importXML: (xmlContent: string) => Promise<number>;
  addClient: (client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => Promise<void>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  createDebt: (clientId: string, amount: number) => Promise<string | null>;
  payDebt: (debtId: string, amount: number, method: string) => Promise<void>;
  openCashRegister: (openingBalance: number, operatorId: string, terminalId: string) => Promise<void>;
  closeCashRegister: () => Promise<CashRegister | null>;
  addWithdrawal: (amount: number, reason: string) => Promise<void>;
  addDeposit: (amount: number, reason: string) => Promise<void>;
  addOperator: (op: Omit<Operator, "id">) => Promise<void>;
  updateOperator: (id: string, data: Partial<Operator>) => Promise<void>;
  deleteOperator: (id: string) => Promise<void>;
  addTerminal: (t: Omit<Terminal, "id">) => Promise<void>;
  updateTerminal: (id: string, data: Partial<Terminal>) => Promise<void>;
  deleteTerminal: (id: string) => Promise<void>;
  addActionLog: (log: Omit<ActionLog, "id" | "date">) => Promise<void>;
  setAdminPin: (pin: string) => void;
  addSupplier: (s: Omit<Supplier, "id">) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addBill: (b: Omit<Bill, "id">) => Promise<void>;
  payBill: (id: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [adminPin, setAdminPinState] = useState(() => localStorage.getItem("adminPin") || "1234");

  const setAdminPin = useCallback((pin: string) => {
    setAdminPinState(pin);
    localStorage.setItem("adminPin", pin);
  }, []);
  const [loading, setLoading] = useState(true);

  // ─── Load all data from Supabase on tenant change ───
  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [
        prodRes, clientRes, termRes, opRes, supplierRes, billRes,
        saleRes, movRes, logRes, debtRes, cashRes
      ] = await Promise.all([
        supabase.from("products").select("*").eq("tenant_id", tenantId),
        supabase.from("clients").select("*").eq("tenant_id", tenantId),
        supabase.from("terminals").select("*").eq("tenant_id", tenantId),
        supabase.from("operators").select("id, nome, ativo, perm_abrir_caixa, perm_cancelar_item, perm_cancelar_cupom, tenant_id").eq("tenant_id", tenantId),
        supabase.from("suppliers").select("*").eq("tenant_id", tenantId),
        supabase.from("bills").select("*").eq("tenant_id", tenantId).order("due_date", { ascending: false }),
        supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("stock_movements").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("action_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("debts").select("*").eq("tenant_id", tenantId),
        supabase.from("cash_registers").select("*").eq("tenant_id", tenantId).is("closed_at", null).limit(1).maybeSingle(),
      ]);

      if (cancelled) return;

      // Map DB rows to app types
      setProducts((prodRes.data || []).map(r => ({
        id: r.id, name: r.name, sku: r.sku || "", barcode: r.barcode || "",
        price: Number(r.price), stock: r.stock, minStock: r.min_stock ?? undefined,
        category: r.category || "Outros", imageUrl: r.image_url ?? undefined,
      })));

      setClients((clientRes.data || []).map(r => ({
        id: r.id, nome: r.nome, cpfCnpj: r.cpf_cnpj || "", telefone: r.telefone || "",
        email: r.email || "", dataNascimento: r.data_nascimento || "", observacoes: r.observacoes || "",
        creditLimit: Number(r.credit_limit), creditUsed: Number(r.credit_used),
        compras: r.compras, total: Number(r.total),
      })));

      setTerminals((termRes.data || []).map(r => ({
        id: r.id, nome: r.nome, ativo: r.ativo,
        cupomInicio: r.cupom_inicio, cupomAtual: r.cupom_atual, cupomFim: r.cupom_fim,
      })));

      setOperators((opRes.data || []).map(r => ({
        id: r.id, nome: r.nome, pin: "", ativo: r.ativo,
        permissions: {
          abrirCaixa: r.perm_abrir_caixa,
          cancelarItem: r.perm_cancelar_item,
          cancelarCupom: r.perm_cancelar_cupom,
        },
      })));

      setSuppliers((supplierRes.data || []).map(r => ({
        id: r.id, nome: r.nome, cnpj: r.cnpj || "", telefone: r.telefone || "", email: r.email || "",
      })));

      setBills((billRes.data || []).map(r => ({
        id: r.id, description: r.description, amount: Number(r.amount),
        dueDate: new Date(r.due_date), supplierId: r.supplier_id ?? undefined,
        supplierName: r.supplier_name ?? undefined, category: r.category || "outros",
        status: r.status as "pendente" | "pago", paidAt: r.paid_at ? new Date(r.paid_at) : undefined,
      })));

      setMovements((movRes.data || []).map(r => ({
        id: r.id, productId: r.product_id || "", productName: r.product_name,
        type: r.type as StockMovement["type"], quantity: r.quantity,
        reason: r.reason || "", date: new Date(r.created_at),
      })));

      setActionLogs((logRes.data || []).map(r => ({
        id: r.id, type: r.type as ActionLog["type"],
        operatorId: r.operator_id, operatorName: r.operator_name,
        terminalId: r.terminal_id, terminalName: r.terminal_name,
        description: r.description, amount: r.amount ? Number(r.amount) : undefined,
        saleId: r.sale_id ?? undefined, authorizedBy: r.authorized_by ?? undefined,
        date: new Date(r.created_at),
      })));

      // Load sale items for each sale
      const salesData = saleRes.data || [];
      if (salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        const [itemsRes, paymentsRes] = await Promise.all([
          supabase.from("sale_items").select("*").in("sale_id", saleIds),
          supabase.from("sale_payments").select("*").in("sale_id", saleIds),
        ]);
        const itemsBySale = new Map<string, typeof itemsRes.data>();
        (itemsRes.data || []).forEach(item => {
          const arr = itemsBySale.get(item.sale_id) || [];
          arr.push(item);
          itemsBySale.set(item.sale_id, arr);
        });
        const paymentsBySale = new Map<string, typeof paymentsRes.data>();
        (paymentsRes.data || []).forEach(p => {
          const arr = paymentsBySale.get(p.sale_id) || [];
          arr.push(p);
          paymentsBySale.set(p.sale_id, arr);
        });

        setSales(salesData.map(s => ({
          id: s.id, total: Number(s.total), cupomNumero: s.cupom_numero ?? undefined,
          clientId: s.client_id ?? undefined, clientName: s.client_name ?? undefined,
          terminalId: s.terminal_id ?? undefined, terminalName: s.terminal_name ?? undefined,
          operatorId: s.operator_id ?? undefined, operatorName: s.operator_name ?? undefined,
          date: new Date(s.created_at),
          items: (itemsBySale.get(s.id) || []).map(i => ({
            productId: i.product_id || "", productName: i.product_name,
            quantity: i.quantity, price: Number(i.price),
          })),
          methods: (paymentsBySale.get(s.id) || []).map(p => ({
            method: p.method, amount: Number(p.amount),
          })),
        })));
      } else {
        setSales([]);
      }

      // Load debts with payments
      const debtsData = debtRes.data || [];
      if (debtsData.length > 0) {
        const debtIds = debtsData.map(d => d.id);
        const { data: dpData } = await supabase.from("debt_payments").select("*").in("debt_id", debtIds);
        const payByDebt = new Map<string, any[]>();
        (dpData || []).forEach(p => {
          const arr = payByDebt.get(p.debt_id) || [];
          arr.push(p);
          payByDebt.set(p.debt_id, arr);
        });
        setDebts(debtsData.map(d => ({
          id: d.id, clientId: d.client_id, clientName: d.client_name,
          amount: Number(d.amount), paid: Number(d.paid), saleDate: new Date(d.sale_date),
          payments: (payByDebt.get(d.id) || []).map(p => ({
            id: p.id, amount: Number(p.amount), date: new Date(p.created_at), method: p.method,
          })),
        })));
      } else {
        setDebts([]);
      }

      // Load open cash register with withdrawals/deposits
      if (cashRes.data) {
        const cr = cashRes.data;
        const [wRes, dRes, spRes] = await Promise.all([
          supabase.from("cash_withdrawals").select("*").eq("cash_register_id", cr.id),
          supabase.from("cash_deposits").select("*").eq("cash_register_id", cr.id),
          supabase.from("sale_payments").select("method, amount").eq("tenant_id", tenantId),
        ]);
        // Get sales payments linked to this cash register
        const salesForCR = salesData.filter(s => s.cash_register_id === cr.id);
        const saleIdsForCR = salesForCR.map(s => s.id);
        const { data: crPayments } = saleIdsForCR.length > 0
          ? await supabase.from("sale_payments").select("*").in("sale_id", saleIdsForCR)
          : { data: [] };

        setCashRegister({
          id: cr.id,
          operatorId: cr.operator_id || "",
          operatorName: cr.operator_name,
          terminalId: cr.terminal_id || "",
          terminalName: cr.terminal_name,
          openedAt: new Date(cr.opened_at),
          closedAt: null,
          openingBalance: Number(cr.opening_balance),
          sales: (crPayments || []).map(p => ({ method: p.method, amount: Number(p.amount) })),
          withdrawals: (wRes.data || []).map(w => ({ amount: Number(w.amount), reason: w.reason || "", date: new Date(w.created_at) })),
          deposits: (dRes.data || []).map(d => ({ amount: Number(d.amount), reason: d.reason || "", date: new Date(d.created_at) })),
        });
      } else {
        setCashRegister(null);
      }

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [tenantId]);

  // ─── Helper to add movement ───
  const addMovementToDB = useCallback(async (m: Omit<StockMovement, "id" | "date">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("stock_movements").insert({
      product_id: m.productId, product_name: m.productName,
      type: m.type, quantity: m.quantity, reason: m.reason, tenant_id: tenantId,
    }).select("id, created_at").single();
    if (data) {
      setMovements(prev => [{ ...m, id: data.id, date: new Date(data.created_at) }, ...prev]);
    }
  }, [tenantId]);

  // ─── Products CRUD ───
  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("products").insert({
      name: product.name, sku: product.sku, barcode: product.barcode,
      price: product.price, stock: product.stock, min_stock: product.minStock ?? 0,
      category: product.category, image_url: product.imageUrl, tenant_id: tenantId,
    }).select().single();
    if (data) setProducts(prev => [...prev, { id: data.id, name: data.name, sku: data.sku || "", barcode: data.barcode || "", price: Number(data.price), stock: data.stock, minStock: data.min_stock ?? undefined, category: data.category || "Outros", imageUrl: data.image_url ?? undefined }]);
  }, [tenantId]);

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.sku !== undefined) updates.sku = data.sku;
    if (data.barcode !== undefined) updates.barcode = data.barcode;
    if (data.price !== undefined) updates.price = data.price;
    if (data.stock !== undefined) updates.stock = data.stock;
    if (data.minStock !== undefined) updates.min_stock = data.minStock;
    if (data.category !== undefined) updates.category = data.category;
    if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
    updates.updated_at = new Date().toISOString();
    await supabase.from("products").update(updates).eq("id", id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const addStock = useCallback(async (productId: string, quantity: number, reason: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStock = product.stock + quantity;
    await supabase.from("products").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", productId);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    await addMovementToDB({ productId, productName: product.name, type: "entrada", quantity, reason });
  }, [products, tenantId, addMovementToDB]);

  // ─── Sell Products ───
  const sellProducts = useCallback(async (
    items: { productId: string; quantity: number }[],
    methods?: { method: string; amount: number }[],
    clientId?: string, terminalId?: string, operatorId?: string
  ): Promise<string> => {
    if (!tenantId) return "";

    const saleItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { productId: item.productId, productName: product?.name || "", quantity: item.quantity, price: product?.price || 0 };
    });
    const total = saleItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const client = clientId ? clients.find(c => c.id === clientId) : undefined;
    const terminal = terminalId ? terminals.find(t => t.id === terminalId) : undefined;
    const operator = operatorId ? operators.find(o => o.id === operatorId) : undefined;

    // Get next cupom number for terminal
    let cupomNumero: number | undefined;
    if (terminal?.cupomAtual != null) {
      cupomNumero = terminal.cupomAtual;
      const nextCupom = terminal.cupomAtual + 1;
      await supabase.from("terminals").update({ cupom_atual: nextCupom }).eq("id", terminal.id);
      setTerminals(prev => prev.map(t => t.id === terminal.id ? { ...t, cupomAtual: nextCupom } : t));
    }

    // Insert sale
    const { data: saleData } = await supabase.from("sales").insert({
      total, cupom_numero: cupomNumero ?? null,
      client_id: clientId ?? null, client_name: client?.nome ?? null,
      terminal_id: terminalId ?? null, terminal_name: terminal?.nome ?? null,
      operator_id: operatorId ?? null, operator_name: operator?.nome ?? null,
      cash_register_id: cashRegister?.id ?? null, tenant_id: tenantId,
    }).select("id, created_at").single();

    if (!saleData) return "";
    const saleId = saleData.id;

    // Insert sale items
    await supabase.from("sale_items").insert(
      saleItems.map(i => ({ sale_id: saleId, product_id: i.productId, product_name: i.productName, quantity: i.quantity, price: i.price, tenant_id: tenantId }))
    );

    // Insert payments
    if (methods?.length) {
      await supabase.from("sale_payments").insert(
        methods.map(m => ({ sale_id: saleId, method: m.method, amount: m.amount, tenant_id: tenantId }))
      );
    }

    // Update product stock
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const newStock = Math.max(0, product.stock - item.quantity);
        await supabase.from("products").update({ stock: newStock }).eq("id", item.productId);
        await addMovementToDB({ productId: item.productId, productName: product.name, type: "venda", quantity: item.quantity, reason: `Venda #${saleId.slice(0, 8)}` });
      }
    }

    // Update local state
    setProducts(prev => prev.map(p => {
      const sold = items.find(i => i.productId === p.id);
      return sold ? { ...p, stock: Math.max(0, p.stock - sold.quantity) } : p;
    }));

    setSales(prev => [{
      id: saleId, items: saleItems, total, methods: methods || [], cupomNumero,
      clientId, clientName: client?.nome, terminalId, terminalName: terminal?.nome,
      operatorId, operatorName: operator?.nome, date: new Date(saleData.created_at),
    }, ...prev]);

    // Update client stats
    if (clientId) {
      const c = clients.find(c => c.id === clientId);
      if (c) {
        await supabase.from("clients").update({ compras: c.compras + 1, total: Number(c.total) + total }).eq("id", clientId);
        setClients(prev => prev.map(cl => cl.id === clientId ? { ...cl, compras: cl.compras + 1, total: cl.total + total } : cl));
      }
    }

    // Update cash register sales in local state
    if (cashRegister && methods) {
      setCashRegister(prev => prev ? { ...prev, sales: [...prev.sales, ...methods] } : prev);
    }

    return saleId;
  }, [products, clients, terminals, operators, cashRegister, tenantId, addMovementToDB]);

  // ─── Cancel Sale ───
  const cancelSale = useCallback(async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    for (const item of sale.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const newStock = product.stock + item.quantity;
        await supabase.from("products").update({ stock: newStock }).eq("id", item.productId);
        await addMovementToDB({ productId: item.productId, productName: item.productName, type: "cancelamento", quantity: item.quantity, reason: `Cancelamento venda #${saleId.slice(0, 8)}` });
      }
    }
    setProducts(prev => prev.map(p => {
      const returned = sale.items.find(i => i.productId === p.id);
      return returned ? { ...p, stock: p.stock + returned.quantity } : p;
    }));
  }, [sales, products, addMovementToDB]);

  // ─── Import XML ───
  const importXML = useCallback(async (xmlContent: string): Promise<number> => {
    if (!tenantId) return 0;
    let count = 0;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, "text/xml");
      const items = doc.querySelectorAll("det");
      for (const det of Array.from(items)) {
        const prod = det.querySelector("prod");
        if (!prod) continue;
        const name = prod.querySelector("xProd")?.textContent || "Produto importado";
        const sku = prod.querySelector("cProd")?.textContent || `IMP${Date.now()}`;
        const barcode = prod.querySelector("cEAN")?.textContent || "";
        const price = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
        const quantity = parseFloat(prod.querySelector("qCom")?.textContent || "0");
        const ncm = prod.querySelector("NCM")?.textContent || "";
        const existing = products.find(p => (barcode && p.barcode === barcode) || p.sku === sku);
        if (existing) {
          await addStock(existing.id, Math.round(quantity), `Importação XML - ${name}`);
        } else {
          await addProduct({ name, sku, barcode: barcode === "SEM GTIN" ? "" : barcode, price, stock: Math.round(quantity), category: ncm ? "Importado" : "Outros" });
        }
        count++;
      }
    } catch (e) {
      console.error("Erro ao processar XML:", e);
    }
    return count;
  }, [products, tenantId, addStock, addProduct]);

  // ─── Clients CRUD ───
  const addClient = useCallback(async (client: Omit<Client, "id" | "compras" | "total" | "creditUsed">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("clients").insert({
      nome: client.nome, cpf_cnpj: client.cpfCnpj, telefone: client.telefone,
      email: client.email, data_nascimento: client.dataNascimento, observacoes: client.observacoes,
      credit_limit: client.creditLimit, credit_used: 0, compras: 0, total: 0, tenant_id: tenantId,
    }).select().single();
    if (data) setClients(prev => [...prev, { id: data.id, nome: data.nome, cpfCnpj: data.cpf_cnpj || "", telefone: data.telefone || "", email: data.email || "", dataNascimento: data.data_nascimento || "", observacoes: data.observacoes || "", creditLimit: Number(data.credit_limit), creditUsed: 0, compras: 0, total: 0 }]);
  }, [tenantId]);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    const updates: any = {};
    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.cpfCnpj !== undefined) updates.cpf_cnpj = data.cpfCnpj;
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.dataNascimento !== undefined) updates.data_nascimento = data.dataNascimento;
    if (data.observacoes !== undefined) updates.observacoes = data.observacoes;
    if (data.creditLimit !== undefined) updates.credit_limit = data.creditLimit;
    await supabase.from("clients").update(updates).eq("id", id);
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  // ─── Debts ───
  const createDebt = useCallback(async (clientId: string, amount: number): Promise<string | null> => {
    if (!tenantId) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    const available = client.creditLimit - client.creditUsed;
    if (amount > available) return null;
    const { data } = await supabase.from("debts").insert({
      client_id: clientId, client_name: client.nome, amount, paid: 0, tenant_id: tenantId,
    }).select("id, sale_date").single();
    if (!data) return null;
    await supabase.from("clients").update({ credit_used: client.creditUsed + amount }).eq("id", clientId);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, creditUsed: c.creditUsed + amount } : c));
    setDebts(prev => [...prev, { id: data.id, clientId, clientName: client.nome, amount, paid: 0, saleDate: new Date(data.sale_date), payments: [] }]);
    return data.id;
  }, [clients, tenantId]);

  const payDebt = useCallback(async (debtId: string, amount: number, method: string) => {
    if (!tenantId) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    const newPaid = Math.min(debt.amount, debt.paid + amount);
    const actualPayment = newPaid - debt.paid;
    await supabase.from("debt_payments").insert({ debt_id: debtId, amount: actualPayment, method, tenant_id: tenantId });
    await supabase.from("debts").update({ paid: newPaid }).eq("id", debtId);
    await supabase.from("clients").update({ credit_used: Math.max(0, (clients.find(c => c.id === debt.clientId)?.creditUsed || 0) - actualPayment) }).eq("id", debt.clientId);
    setClients(prev => prev.map(c => c.id === debt.clientId ? { ...c, creditUsed: Math.max(0, c.creditUsed - actualPayment) } : c));
    setDebts(prev => prev.map(d => d.id === debtId ? { ...d, paid: newPaid, payments: [...d.payments, { id: crypto.randomUUID(), amount: actualPayment, date: new Date(), method }] } : d));
  }, [debts, clients, tenantId]);

  // ─── Cash Register ───
  const openCashRegister = useCallback(async (openingBalance: number, operatorId: string, terminalId: string) => {
    if (!tenantId) return;
    const op = operators.find(o => o.id === operatorId);
    const term = terminals.find(t => t.id === terminalId);
    const { data } = await supabase.from("cash_registers").insert({
      operator_id: operatorId, operator_name: op?.nome || "Operador",
      terminal_id: terminalId, terminal_name: term?.nome || "Caixa",
      opening_balance: openingBalance, tenant_id: tenantId,
    }).select("id, opened_at").single();
    if (data) {
      setCashRegister({
        id: data.id, operatorId, operatorName: op?.nome || "Operador",
        terminalId, terminalName: term?.nome || "Caixa",
        openedAt: new Date(data.opened_at), closedAt: null,
        openingBalance, sales: [], withdrawals: [], deposits: [],
      });
    }
  }, [operators, terminals, tenantId]);

  const closeCashRegister = useCallback(async (): Promise<CashRegister | null> => {
    if (!cashRegister) return null;
    await supabase.from("cash_registers").update({ closed_at: new Date().toISOString() }).eq("id", cashRegister.id);
    const closed = { ...cashRegister, closedAt: new Date() };
    setCashRegister(null);
    return closed;
  }, [cashRegister]);

  const addWithdrawal = useCallback(async (amount: number, reason: string) => {
    if (!cashRegister || !tenantId) return;
    await supabase.from("cash_withdrawals").insert({ cash_register_id: cashRegister.id, amount, reason, tenant_id: tenantId });
    setCashRegister(prev => prev ? { ...prev, withdrawals: [...prev.withdrawals, { amount, reason, date: new Date() }] } : prev);
  }, [cashRegister, tenantId]);

  const addDeposit = useCallback(async (amount: number, reason: string) => {
    if (!cashRegister || !tenantId) return;
    await supabase.from("cash_deposits").insert({ cash_register_id: cashRegister.id, amount, reason, tenant_id: tenantId });
    setCashRegister(prev => prev ? { ...prev, deposits: [...prev.deposits, { amount, reason, date: new Date() }] } : prev);
  }, [cashRegister, tenantId]);

  // ─── Operators CRUD ───
  const addOperator = useCallback(async (op: Omit<Operator, "id">) => {
    if (!tenantId) { console.error("addOperator: no tenantId"); return; }
    const { data, error } = await supabase.from("operators").insert({
      nome: op.nome, pin: op.pin, ativo: op.ativo,
      perm_abrir_caixa: op.permissions.abrirCaixa,
      perm_cancelar_item: op.permissions.cancelarItem,
      perm_cancelar_cupom: op.permissions.cancelarCupom,
      tenant_id: tenantId,
    }).select("id, nome, ativo, perm_abrir_caixa, perm_cancelar_item, perm_cancelar_cupom").single();
    if (error) console.error("addOperator error:", error);
    if (data) setOperators(prev => [...prev, { id: data.id, nome: data.nome, pin: "", ativo: data.ativo, permissions: { abrirCaixa: data.perm_abrir_caixa, cancelarItem: data.perm_cancelar_item, cancelarCupom: data.perm_cancelar_cupom } }]);
  }, [tenantId]);

  const updateOperator = useCallback(async (id: string, data: Partial<Operator>) => {
    const updates: any = {};
    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.pin !== undefined && data.pin !== "") updates.pin = data.pin;
    if (data.ativo !== undefined) updates.ativo = data.ativo;
    if (data.permissions) {
      updates.perm_abrir_caixa = data.permissions.abrirCaixa;
      updates.perm_cancelar_item = data.permissions.cancelarItem;
      updates.perm_cancelar_cupom = data.permissions.cancelarCupom;
    }
    const { error } = await supabase.from("operators").update(updates).eq("id", id);
    if (error) console.error("updateOperator error:", error);
    setOperators(prev => prev.map(o => o.id === id ? { ...o, ...data, pin: "" } : o));
  }, []);

  const deleteOperator = useCallback(async (id: string) => {
    const { error } = await supabase.from("operators").delete().eq("id", id);
    if (error) console.error("deleteOperator error:", error);
    setOperators(prev => prev.filter(o => o.id !== id));
  }, []);

  // ─── Terminals CRUD ───
  const addTerminal = useCallback(async (t: Omit<Terminal, "id">) => {
    if (!tenantId) { console.error("addTerminal: no tenantId"); return; }
    const { data, error } = await supabase.from("terminals").insert({
      nome: t.nome, ativo: t.ativo,
      cupom_inicio: t.cupomInicio ?? 100000,
      cupom_atual: t.cupomAtual ?? t.cupomInicio ?? 100000,
      cupom_fim: t.cupomFim ?? 999999,
      tenant_id: tenantId,
    }).select().single();
    if (error) console.error("addTerminal error:", error);
    if (data) setTerminals(prev => [...prev, { id: data.id, nome: data.nome, ativo: data.ativo, cupomInicio: data.cupom_inicio, cupomAtual: data.cupom_atual, cupomFim: data.cupom_fim }]);
  }, [tenantId]);

  const updateTerminal = useCallback(async (id: string, data: Partial<Terminal>) => {
    const updates: any = {};
    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.ativo !== undefined) updates.ativo = data.ativo;
    if (data.cupomInicio !== undefined) updates.cupom_inicio = data.cupomInicio;
    if (data.cupomAtual !== undefined) updates.cupom_atual = data.cupomAtual;
    if (data.cupomFim !== undefined) updates.cupom_fim = data.cupomFim;
    await supabase.from("terminals").update(updates).eq("id", id);
    setTerminals(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const deleteTerminal = useCallback(async (id: string) => {
    await supabase.from("terminals").delete().eq("id", id);
    setTerminals(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Action Logs ───
  const addActionLog = useCallback(async (log: Omit<ActionLog, "id" | "date">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("action_logs").insert({
      type: log.type, operator_id: log.operatorId, operator_name: log.operatorName,
      terminal_id: log.terminalId, terminal_name: log.terminalName,
      description: log.description, amount: log.amount ?? null,
      sale_id: log.saleId ?? null, authorized_by: log.authorizedBy ?? null,
      tenant_id: tenantId,
    }).select("id, created_at").single();
    if (data) setActionLogs(prev => [{ ...log, id: data.id, date: new Date(data.created_at) }, ...prev]);
  }, [tenantId]);

  // ─── Suppliers & Bills ───
  const addSupplier = useCallback(async (s: Omit<Supplier, "id">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("suppliers").insert({
      nome: s.nome, cnpj: s.cnpj, telefone: s.telefone, email: s.email, tenant_id: tenantId,
    }).select().single();
    if (data) setSuppliers(prev => [...prev, { id: data.id, nome: data.nome, cnpj: data.cnpj || "", telefone: data.telefone || "", email: data.email || "" }]);
  }, [tenantId]);

  const deleteSupplier = useCallback(async (id: string) => {
    await supabase.from("suppliers").delete().eq("id", id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, []);

  const addBill = useCallback(async (b: Omit<Bill, "id">) => {
    if (!tenantId) return;
    const { data } = await supabase.from("bills").insert({
      description: b.description, amount: b.amount, due_date: b.dueDate.toISOString(),
      supplier_id: b.supplierId ?? null, supplier_name: b.supplierName ?? null,
      category: b.category, status: b.status, paid_at: b.paidAt?.toISOString() ?? null,
      tenant_id: tenantId,
    }).select().single();
    if (data) setBills(prev => [...prev, { id: data.id, description: data.description, amount: Number(data.amount), dueDate: new Date(data.due_date), supplierId: data.supplier_id ?? undefined, supplierName: data.supplier_name ?? undefined, category: data.category || "outros", status: data.status as "pendente" | "pago", paidAt: data.paid_at ? new Date(data.paid_at) : undefined }]);
  }, [tenantId]);

  const payBill = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from("bills").update({ status: "pago", paid_at: now }).eq("id", id);
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: "pago" as const, paidAt: new Date(now) } : b));
  }, []);

  const deleteBill = useCallback(async (id: string) => {
    await supabase.from("bills").delete().eq("id", id);
    setBills(prev => prev.filter(b => b.id !== id));
  }, []);

  return (
    <ProductContext.Provider value={{
      products, movements, clients, debts, sales, cashRegister, operators, terminals, actionLogs, suppliers, bills, adminPin, loading,
      addProduct, updateProduct, deleteProduct, sellProducts, cancelSale, addStock, importXML,
      addClient, updateClient, deleteClient,
      createDebt, payDebt,
      openCashRegister, closeCashRegister, addWithdrawal, addDeposit,
      addOperator, updateOperator, deleteOperator,
      addTerminal, updateTerminal, deleteTerminal,
      addActionLog, setAdminPin,
      addSupplier, deleteSupplier, addBill, payBill, deleteBill,
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
