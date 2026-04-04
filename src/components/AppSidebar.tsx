import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Users,
  DollarSign, BarChart3, Settings, ChevronLeft, ChevronRight, Store,
  CreditCard, FileText, LogOut, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <>
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-100",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border">
        <button onClick={() => signOut()} className={cn("flex items-center gap-3 w-full px-5 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors", collapsed && "justify-center px-0")}>
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { companyName } = useTenant();

  return (
    <>
      {/* Mobile hamburger button — rendered via TopBar slot, but we also need the Sheet here */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border flex flex-col [&>button]:hidden">
          <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
            <Store className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm tracking-tight text-foreground truncate">{companyName || "itsega4"}</span>
          </div>
          <NavContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className={cn("hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 h-screen sticky top-0", collapsed ? "w-16" : "w-56")}>
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <Store className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && <span className="font-semibold text-sm tracking-tight text-foreground truncate">{companyName || "itsega4"}</span>}
        </div>
        <NavContent collapsed={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center justify-center w-full h-10 text-muted-foreground hover:text-foreground transition-colors border-t border-border">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>
    </>
  );
}

// Export a hook-like component for the mobile trigger
export function useMobileSidebar() {
  return null;
}

export { navItems };
