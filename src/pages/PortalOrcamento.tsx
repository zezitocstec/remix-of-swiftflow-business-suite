import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, CheckCircle, X, FileText, Store, Calendar, User, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  autorizado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  convertido: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  expirado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  aprovado_cliente: "bg-green-100 text-green-800",
};

interface PortalData {
  orcamento: {
    numero: number;
    client_name: string | null;
    vendedor_name: string | null;
    subtotal: number;
    total: number;
    desconto_tipo: string;
    desconto_valor: number;
    observacoes: string;
    validade: string;
    status: string;
    autorizado: boolean;
    created_at: string;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    desconto_tipo: string;
    desconto_valor: number;
    total: number;
  }>;
  company: {
    nome: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    telefone: string | null;
    email: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
}

export default function PortalOrcamento() {
  const { token } = useParams<{ token: string }>();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState<"approved" | "rejected" | null>(null);

  const handleLogin = async () => {
    if (!senha.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data: res, error: err } = await supabase.functions.invoke("portal-orcamento", {
        body: { action: "view", token, senha },
      });
      if (err || res?.error) {
        setError(res?.error || "Erro ao acessar orçamento");
      } else {
        setData(res);
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "approve" | "reject") => {
    setActionLoading(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("portal-orcamento", {
        body: { action, token, senha },
      });
      if (err || res?.error) {
        setError(res?.error || "Erro ao processar ação");
      } else {
        setActionDone(action === "approve" ? "approved" : "rejected");
        if (data) {
          setData({
            ...data,
            orcamento: {
              ...data.orcamento,
              status: action === "approve" ? "autorizado" : "expirado",
              autorizado: action === "approve",
            },
          });
        }
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setActionLoading(false);
    }
  };

  // Login screen
  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-lg font-bold text-foreground">Portal do Orçamento</h1>
              <p className="text-sm text-muted-foreground">Digite a senha para acessar o orçamento</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Senha do orçamento"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="pl-10"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleLogin} disabled={loading || !senha.trim()} className="w-full">
                {loading ? "Verificando..." : "Acessar Orçamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orc = data.orcamento;
  const company = data.company;
  const canAct = orc.status === "rascunho" || orc.status === "autorizado";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Company header */}
        {company && (
          <div className="text-center space-y-1 border-b border-border pb-4">
            <div className="flex items-center justify-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">{company.nome_fantasia || company.nome}</h1>
            </div>
            {company.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>}
            {company.telefone && <p className="text-xs text-muted-foreground">{company.telefone}</p>}
            {company.logradouro && (
              <p className="text-xs text-muted-foreground">
                {company.logradouro}{company.numero ? `, ${company.numero}` : ""} - {company.bairro} - {company.cidade}/{company.uf}
              </p>
            )}
          </div>
        )}

        {/* Quote header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Orçamento #{orc.numero}</h2>
            <p className="text-xs text-muted-foreground">
              {format(new Date(orc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
          <Badge className={statusColors[orc.status] || "bg-muted text-muted-foreground"}>
            {orc.status === "autorizado" ? "Aprovado" : orc.status.charAt(0).toUpperCase() + orc.status.slice(1)}
          </Badge>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          {orc.client_name && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium text-foreground">{orc.client_name}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Validade</p>
                <p className="text-sm font-medium text-foreground">{format(new Date(orc.validade), "dd/MM/yyyy")}</p>
              </div>
            </CardContent>
          </Card>
          {orc.vendedor_name && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Vendedor</p>
                  <p className="text-sm font-medium text-foreground">{orc.vendedor_name}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Items table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center w-16">Qtd</TableHead>
                  <TableHead className="text-right w-24">Unitário</TableHead>
                  <TableHead className="text-right w-24">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">{formatBRL(item.unit_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatBRL(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatBRL(orc.subtotal)}</span>
            </div>
            {orc.desconto_valor > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto ({orc.desconto_tipo === "percent" ? `${orc.desconto_valor}%` : formatBRL(orc.desconto_valor)})</span>
                <span>-{formatBRL(orc.subtotal - orc.total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
              <span>Total</span>
              <span className="text-primary">{formatBRL(orc.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Observations */}
        {orc.observacoes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{orc.observacoes}</p>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        {actionDone ? (
          <Card>
            <CardContent className="p-4 text-center space-y-2">
              {actionDone === "approved" ? (
                <>
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
                  <p className="font-bold text-foreground">Orçamento Aprovado!</p>
                  <p className="text-sm text-muted-foreground">A empresa será notificada da sua aprovação.</p>
                </>
              ) : (
                <>
                  <X className="h-10 w-10 text-destructive mx-auto" />
                  <p className="font-bold text-foreground">Orçamento Recusado</p>
                  <p className="text-sm text-muted-foreground">A empresa será notificada.</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : canAct ? (
          <div className="flex gap-3">
            <Button
              onClick={() => handleAction("approve")}
              disabled={actionLoading}
              className="flex-1 h-12 text-base"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Aprovar
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction("reject")}
              disabled={actionLoading}
              className="flex-1 h-12 text-base"
            >
              <X className="h-5 w-5 mr-2" />
              Recusar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
