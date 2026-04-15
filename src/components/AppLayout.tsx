import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Users,
  DollarSign, BarChart3, Settings, ChevronLeft, ChevronRight, Store,
  CreditCard, FileText, LogOut, Menu, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", adminOnly: true },
  { icon: ShoppingCart, label: "PDV", path: "/pdv", adminOnly: false },
  { icon: Package, label: "Produtos", path: "/produtos", adminOnly: true },
  { icon: Warehouse, label: "Estoque", path: "/estoque", adminOnly: true },
  { icon: Users, label: "Clientes", path: "/clientes", adminOnly: true },
  { icon: CreditCard, label: "Caixa", path: "/caixa", adminOnly: false },
  { icon: ClipboardList, label: "Orçamento", path: "/orcamento", adminOnly: false },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro", adminOnly: true },
  { icon: FileText, label: "Contas a Pagar", path: "/contas-pagar", adminOnly: true },
  { icon: ClipboardList, label: "Orçamentos", path: "/orcamentos", adminOnly: true },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios", adminOnly: true },
  { icon: Settings, label: "Configurações", path: "/configuracoes", adminOnly: true },
];

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-auto">
        {visibleItems.map((item) => {
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

export function MobileTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="md:hidden p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
      <Menu className="h-5 w-5" strokeWidth={1.5} />
    </button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { companyName } = useTenant();

  return (
    <>
      <div className="flex min-h-screen bg-background">
        {/* Mobile drawer */}
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

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 flex flex-col">
          {/* Mobile top bar with hamburger */}
          <div className="md:hidden flex items-center gap-2 px-4 h-14 border-b border-border bg-card sticky top-0 z-20">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <Store className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm tracking-tight text-foreground truncate">{companyName || "itsega4"}</span>
          </div>
          <div className="flex-1">{children}</div>
          <footer className="border-t border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
            Todos os direitos reservados a{" "}
            <a href="https://it.sega4.com.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">it.sega4.com.br</a>
            {" "}— © 2026 IT.Sega4 — Automatize. Escale. Conquiste.
          </footer>
        </main>
      </div>
    </>
  );
}
