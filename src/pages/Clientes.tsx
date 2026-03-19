import { TopBar } from "@/components/TopBar";
import { Plus, Search } from "lucide-react";

const mockClientes = [
  { id: "1", nome: "João Silva", cpf: "123.456.789-00", telefone: "(11) 99999-1234", email: "joao@email.com", compras: 12, total: 1580.40 },
  { id: "2", nome: "Maria Santos", cpf: "987.654.321-00", telefone: "(11) 98888-5678", email: "maria@email.com", compras: 8, total: 920.00 },
  { id: "3", nome: "Pedro Oliveira", cpf: "456.789.123-00", telefone: "(21) 97777-9012", email: "pedro@email.com", compras: 23, total: 3450.80 },
  { id: "4", nome: "Ana Costa", cpf: "321.654.987-00", telefone: "(31) 96666-3456", email: "ana@email.com", compras: 5, total: 430.20 },
];

export default function Clientes() {
  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Clientes" subtitle={`${mockClientes.length} clientes cadastrados`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-card px-3 h-9">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground" placeholder="Buscar cliente..." />
          </div>
          <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Novo Cliente
          </button>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Nome</th>
                <th className="text-left py-2.5 px-4 font-medium">CPF</th>
                <th className="text-left py-2.5 px-4 font-medium">Telefone</th>
                <th className="text-left py-2.5 px-4 font-medium">Email</th>
                <th className="text-right py-2.5 px-4 font-medium">Compras</th>
                <th className="text-right py-2.5 px-4 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {mockClientes.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{c.nome}</td>
                  <td className="py-2.5 px-4 text-muted-foreground tabular-nums">{c.cpf}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{c.telefone}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{c.email}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{c.compras}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">
                    {c.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
