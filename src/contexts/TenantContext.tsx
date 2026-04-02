import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TenantContextType {
  tenantId: string | null;
  companyName: string | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({ tenantId: null, companyName: null, loading: true });

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTenantId(null);
      setCompanyName(null);
      setLoading(false);
      return;
    }

    const loadOrCreateCompany = async () => {
      setLoading(true);
      try {
        // Check if user already has a company
        const { data: membership, error: memErr } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (memErr) console.error("Error fetching membership:", memErr);

        if (membership?.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("id, nome")
            .eq("id", membership.company_id)
            .single();

          if (company) {
            setTenantId(company.id);
            setCompanyName(company.nome);
            setLoading(false);
            return;
          }
        }

        // Auto-create a company for new users via atomic RPC
        const { data: newCompanyId, error: rpcError } = await supabase
          .rpc("create_company_with_membership", {
            p_nome: `Empresa de ${user.email?.split("@")[0] || "Usuário"}`,
          });

        if (rpcError || !newCompanyId) {
          console.error("Failed to create company:", rpcError);
          setLoading(false);
          return;
        }

        // Fetch company name
        const { data: newCompany } = await supabase
          .from("companies")
          .select("id, nome")
          .eq("id", newCompanyId)
          .single();

        setTenantId(newCompanyId);
        setCompanyName(newCompany?.nome || null);
      } catch (err) {
        console.error("TenantContext error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrCreateCompany();
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenantId, companyName, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
