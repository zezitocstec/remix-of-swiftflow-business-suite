import { Bell, Search } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { companyName } = useTenant();
  const { user } = useAuth();
  const initial = user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-card">
      <div>
        <h1 className="text-base font-semibold tracking-tight-display text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {companyName && (
          <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">{companyName}</span>
        )}
        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <Search className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors relative">
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
        </button>
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium ml-2">
          {initial}
        </div>
      </div>
    </header>
  );
}
