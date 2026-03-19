import { TopBar } from "@/components/TopBar";
import { Building2, Printer, Shield, Users } from "lucide-react";

const sections = [
  { icon: Building2, title: "Empresa", desc: "Razão social, CNPJ, endereço, logo" },
  { icon: Users, title: "Usuários", desc: "Gerenciar perfis e permissões" },
  { icon: Printer, title: "Impressora", desc: "Configurar impressora ESC/POS" },
  { icon: Shield, title: "Fiscal", desc: "NFC-e, CFOP, CST, CSOSN, NCM" },
];

export default function Configuracoes() {
  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Configurações" subtitle="Ajustes do sistema" />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((s) => (
            <button
              key={s.title}
              className="rounded-md border border-border bg-card p-5 text-left hover:border-primary transition-colors flex items-start gap-4"
            >
              <div className="p-2 rounded-md bg-secondary">
                <s.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
