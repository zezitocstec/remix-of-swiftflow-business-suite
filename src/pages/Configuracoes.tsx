import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Building2, Printer, Receipt, Shield, Users } from "lucide-react";
import EmpresaForm from "@/components/config/EmpresaForm";
import ImpressoraConfig from "@/components/config/ImpressoraConfig";
import VendaConfig from "@/components/config/VendaConfig";
import OperadoresConfig from "@/components/config/OperadoresConfig";

const tabs = [
  { id: "empresa", icon: Building2, label: "Empresa" },
  { id: "impressora", icon: Printer, label: "Impressora" },
  { id: "venda", icon: Receipt, label: "Venda / Fiscal" },
  { id: "usuarios", icon: Users, label: "Usuários" },
  { id: "fiscal", icon: Shield, label: "Fiscal (NFC-e)" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Configuracoes() {
  const [active, setActive] = useState<TabId>("empresa");

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Configurações" subtitle="Ajustes do sistema" />
      <div className="flex-1 overflow-auto">
        <div className="flex border-b border-border bg-card px-4 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-w-4xl">
          {active === "empresa" && <EmpresaForm />}
          {active === "impressora" && <ImpressoraConfig />}
          {active === "venda" && <VendaConfig />}
          {active === "usuarios" && (
            <div className="text-sm text-muted-foreground p-8 text-center">
              Módulo de gerenciamento de usuários e permissões — em breve.
            </div>
          )}
          {active === "fiscal" && (
            <div className="text-sm text-muted-foreground p-8 text-center">
              Configurações fiscais (NFC-e, CFOP, CST, CSOSN, NCM) — em breve.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
