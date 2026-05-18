import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Building2, Printer, Receipt, Shield, Users, Monitor, ClipboardList, ChevronDown, DatabaseBackup, Lock, UserCheck, UserCog, Scale, UtensilsCrossed } from "lucide-react";
import EmpresaForm from "@/components/config/EmpresaForm";
import ImpressoraConfig from "@/components/config/ImpressoraConfig";
import VendaConfig from "@/components/config/VendaConfig";
import OperadoresConfig from "@/components/config/OperadoresConfig";
import TerminaisConfig from "@/components/config/TerminaisConfig";
import LogsConfig from "@/components/config/LogsConfig";
import BackupConfig from "@/components/config/BackupConfig";
import SegurancaConfig from "@/components/config/SegurancaConfig";
import VendedoresConfig from "@/components/config/VendedoresConfig";
import UsuariosConfig from "@/components/config/UsuariosConfig";
import BalancasConfig from "@/components/config/BalancasConfig";
import RestauranteConfig from "@/components/config/RestauranteConfig";
const tabs = [
  { id: "empresa", icon: Building2, label: "Empresa" },
  { id: "impressora", icon: Printer, label: "Impressora" },
  { id: "venda", icon: Receipt, label: "Venda / Fiscal" },
  { id: "restaurante", icon: UtensilsCrossed, label: "Restaurante" },
  { id: "usuarios_sistema", icon: UserCog, label: "Usuários" },
  { id: "operadores", icon: Users, label: "Operadores" },
  { id: "terminais", icon: Monitor, label: "Terminais" },
  { id: "seguranca", icon: Lock, label: "Segurança" },
  { id: "logs", icon: ClipboardList, label: "Logs" },
  { id: "backup", icon: DatabaseBackup, label: "Backup" },
  { id: "vendedores", icon: UserCheck, label: "Vendedores" },
  { id: "balancas", icon: Scale, label: "Balanças" },
  { id: "fiscal", icon: Shield, label: "Fiscal (NFC-e)" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Configuracoes() {
  const [active, setActive] = useState<TabId>("empresa");
  const activeTab = tabs.find((t) => t.id === active)!;

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Configurações" subtitle="Ajustes do sistema" />
      <div className="flex-1 overflow-auto">
        {/* Mobile: native selector avoids portal/overlay glitches on small screens */}
        <div className="md:hidden border-b border-border bg-card px-3 py-2">
          <label className="relative flex items-center gap-2 w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm font-medium text-foreground">
            <activeTab.icon className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <select
              value={active}
              onChange={(event) => setActive(event.target.value as TabId)}
              className="w-full appearance-none bg-transparent pr-8 text-foreground outline-none"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
          </label>
        </div>

        {/* Desktop: horizontal tabs */}
        <div className="hidden md:flex border-b border-border bg-card px-4 gap-1 overflow-x-auto">
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

        <div className="p-3 sm:p-6 max-w-4xl min-h-[240px]">
          {active === "empresa" && <EmpresaForm />}
          {active === "impressora" && <ImpressoraConfig />}
          {active === "venda" && <VendaConfig />}
          {active === "restaurante" && <RestauranteConfig />}
          {active === "usuarios_sistema" && <UsuariosConfig />}
          {active === "operadores" && <OperadoresConfig />}
          {active === "terminais" && <TerminaisConfig />}
          {active === "seguranca" && <SegurancaConfig />}
          {active === "logs" && <LogsConfig />}
          {active === "backup" && <BackupConfig />}
          {active === "vendedores" && <VendedoresConfig />}
          {active === "balancas" && <BalancasConfig />}
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
