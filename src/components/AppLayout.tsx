import { AppSidebar } from "./AppSidebar";
import AdminGate from "./AdminGate";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AdminGate>
  );
}
