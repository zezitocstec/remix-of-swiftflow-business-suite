export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  minStock?: number;
  category: string;
  barcode: string;
  imageUrl?: string;
  unidade?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  /** Quando true, item KG está sendo vendido como unidade (não como peso) */
  soldAsUnit?: boolean;
}

export const mockProducts: Product[] = [
  { id: "1", name: "Coca-Cola 350ml", sku: "BEB001", price: 5.50, stock: 120, minStock: 20, category: "Bebidas", barcode: "7891234560011" },
  { id: "2", name: "Pão Francês (un)", sku: "PAD001", price: 0.75, stock: 300, minStock: 50, category: "Padaria", barcode: "7891234560022" },
  { id: "3", name: "Arroz Tio João 5kg", sku: "GRA001", price: 28.90, stock: 45, minStock: 10, category: "Grãos", barcode: "7891234560033" },
  { id: "4", name: "Feijão Carioca 1kg", sku: "GRA002", price: 8.49, stock: 60, minStock: 15, category: "Grãos", barcode: "7891234560044" },
  { id: "5", name: "Leite Integral 1L", sku: "LAT001", price: 6.20, stock: 80, minStock: 20, category: "Laticínios", barcode: "7891234560055" },
  { id: "6", name: "Queijo Mussarela kg", sku: "LAT002", price: 42.90, stock: 15, minStock: 5, category: "Laticínios", barcode: "7891234560066" },
  { id: "7", name: "Sabão em Pó 1kg", sku: "LIM001", price: 12.50, stock: 35, minStock: 10, category: "Limpeza", barcode: "7891234560077" },
  { id: "8", name: "Papel Higiênico 12un", sku: "HIG001", price: 18.90, stock: 50, minStock: 15, category: "Higiene", barcode: "7891234560088" },
  { id: "9", name: "Café Pilão 500g", sku: "BEB002", price: 15.90, stock: 40, minStock: 10, category: "Bebidas", barcode: "7891234560099" },
  { id: "10", name: "Açúcar Cristal 1kg", sku: "GRA003", price: 5.20, stock: 70, minStock: 15, category: "Grãos", barcode: "7891234560100" },
  { id: "11", name: "Óleo de Soja 900ml", sku: "OLE001", price: 7.80, stock: 55, minStock: 10, category: "Óleos", barcode: "7891234560111" },
  { id: "12", name: "Macarrão Espaguete 500g", sku: "MAS001", price: 4.30, stock: 90, minStock: 20, category: "Massas", barcode: "7891234560122" },
];

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const dashboardData = {
  faturamentoHoje: 12450.80,
  vendasHoje: 47,
  ticketMedio: 264.91,
  produtosVendidos: 156,
  faturamentoSemana: [
    { dia: "Seg", valor: 8200 },
    { dia: "Ter", valor: 9500 },
    { dia: "Qua", valor: 7800 },
    { dia: "Qui", valor: 11200 },
    { dia: "Sex", valor: 14300 },
    { dia: "Sáb", valor: 18600 },
    { dia: "Dom", valor: 12450 },
  ],
  topProdutos: [
    { name: "Coca-Cola 350ml", vendas: 45, receita: 247.50 },
    { name: "Pão Francês", vendas: 120, receita: 90.00 },
    { name: "Arroz Tio João 5kg", vendas: 12, receita: 346.80 },
    { name: "Café Pilão 500g", vendas: 18, receita: 286.20 },
    { name: "Leite Integral 1L", vendas: 32, receita: 198.40 },
  ],
  alertas: [
    { tipo: "estoque", msg: "Queijo Mussarela: estoque baixo (15 un)" },
    { tipo: "estoque", msg: "Sabão em Pó: estoque baixo (35 un)" },
    { tipo: "caixa", msg: "Caixa 01 aberto há 8 horas" },
  ],
};
