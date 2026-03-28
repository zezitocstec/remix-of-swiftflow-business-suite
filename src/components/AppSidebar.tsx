import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Users,
  DollarSign, BarChart3, Settings, ChevronLeft, ChevronRight, Store,
  CreditCard, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "PDV", path: "/pdv" },
  { icon: Package, label: "Produtos", path: "/produtos" },
  { icon: Warehouse, label: "Estoque", path: "/estoque" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: CreditCard, label: "Caixa", path: "/caixa" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: FileText, label: "Contas a Pagar", path: "/contas-pagar" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={cn("flex flex-col border-r border-border bg-card transition-all duration-200 h-screen sticky top-0", collapsed ? "w-16" : "w-56")}>
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <Store className="h-5 w-5 text-primary shrink-0" />
        {!collapsed && <span className="font-semibold text-sm tracking-tight text-foreground">itsega4</span>}
      </div>
      <nav className="flex-1 py-2 space-y-0.5 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}
              className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors">
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
