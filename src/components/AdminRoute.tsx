import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: string;
}

export default function AdminRoute({ children, fallback = "/pdv" }: AdminRouteProps) {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to={fallback} replace />;

  return <>{children}</>;
}
