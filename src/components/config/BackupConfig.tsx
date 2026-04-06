import { useState } from "react";
import { Download, Upload, Loader2, AlertTriangle, Trash2, RotateCcw, Building2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const BACKUP_TABLES = [
  "products",
  "clients",
  "operators",
  "terminals",
  "suppliers",
  "bills",
] as const;

const RESET_SECTIONS = [
  { id: "vendas", label: "Vendas e Caixas", tables: ["sale_items", "sale_payments", "sales", "cash_deposits", "cash_withdrawals", "cash_registers", "action_logs"] },
  { id: "estoque", label: "Estoque e Produtos", tables: ["stock_movements", "sale_items", "products"] },
  { id: "clientes", label: "Clientes e Dívidas", tables: ["debt_payments", "debts", "clients"] },
  { id: "financeiro", label: "Contas a Pagar e Fornecedores", tables: ["bills", "suppliers"] },
  { id: "config", label: "Configurações (Operadores e Terminais)", tables: ["webauthn_credentials", "operators", "terminals"] },
] as const;

export default function BackupConfig() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { adminPin } = useProducts();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Reset state
  const [resetDialog, setResetDialog] = useState(false);
  const [selectedResets, setSelectedResets] = useState<string[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // New company state
  const [newCompanyDialog, setNewCompanyDialog] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyConfirmText, setNewCompanyConfirmText] = useState("");

  // Admin PIN verification state
  const [pinDialog, setPinDialog] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pendingAction, setPendingAction] = useState<"reset" | "newCompany" | null>(null);

  const handleExport = async () => {
    if (!tenantId) return;
    setExporting(true);
    try {
      const backup: Record<string, any[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data } = await supabase.from(table).select("*").eq("tenant_id", tenantId);
        backup[table] = data || [];
      }
      backup._meta = [{ exportedAt: new Date().toISOString(), tenantId, version: 1 }];

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmDialog(true);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!pendingFile || !tenantId) return;
    setConfirmDialog(false);
    setImporting(true);
    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);

      if (!backup._meta || !Array.isArray(backup._meta)) {
        throw new Error("Arquivo de backup inválido");
      }

      let imported = 0;
      for (const table of BACKUP_TABLES) {
        const rows = backup[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        await supabase.from(table).delete().eq("tenant_id", tenantId);

        const cleaned = rows.map((r: any) => ({ ...r, tenant_id: tenantId }));
        for (let i = 0; i < cleaned.length; i += 100) {
          const batch = cleaned.slice(i, i + 100);
          await supabase.from(table).insert(batch);
        }
        imported += rows.length;
      }

      toast.success(`Backup restaurado! ${imported} registros importados. Recarregue a página.`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "arquivo inválido"));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const toggleResetSection = (id: string) => {
    setSelectedResets((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAllResets = () => {
    if (selectedResets.length === RESET_SECTIONS.length) {
      setSelectedResets([]);
    } else {
      setSelectedResets(RESET_SECTIONS.map((s) => s.id));
    }
  };

  const requestPinForAction = (action: "reset" | "newCompany") => {
    setPendingAction(action);
    setPinValue("");
    setPinDialog(true);
  };

  const handlePinSubmit = () => {
    if (pinValue !== adminPin) {
      toast.error("PIN incorreto. Acesso negado.");
      setPinValue("");
      return;
    }
    setPinDialog(false);
    setPinValue("");
    if (pendingAction === "reset") {
      setResetDialog(true);
      setSelectedResets([]);
      setResetConfirmText("");
    } else if (pendingAction === "newCompany") {
      setNewCompanyDialog(true);
      setNewCompanyName("");
      setNewCompanyConfirmText("");
    }
    setPendingAction(null);
  };

  const handleReset = async () => {
    if (!tenantId || selectedResets.length === 0) return;
    setResetting(true);
    try {
      const tablesToDelete = new Set<string>();
      for (const section of RESET_SECTIONS) {
        if (selectedResets.includes(section.id)) {
          section.tables.forEach((t) => tablesToDelete.add(t));
        }
      }

      // Delete in order (respecting dependencies — children first)
      const orderedTables = [
        "debt_payments", "debts",
        "sale_items", "sale_payments", "sales",
        "cash_deposits", "cash_withdrawals", "cash_registers",
        "action_logs",
        "stock_movements",
        "webauthn_credentials",
        "products", "clients", "operators", "terminals",
        "bills", "suppliers",
      ];

      for (const table of orderedTables) {
        if (tablesToDelete.has(table)) {
          await supabase.from(table as any).delete().eq("tenant_id", tenantId);
        }
      }

      toast.success("Dados resetados com sucesso! Recarregue a página.");
      setResetDialog(false);
      setSelectedResets([]);
      setResetConfirmText("");
    } catch (err: any) {
      toast.error("Erro ao resetar: " + (err.message || ""));
    } finally {
      setResetting(false);
    }
  };

  const handleNewCompany = async () => {
    if (!newCompanyName.trim() || !tenantId || !user) return;
    setCreatingCompany(true);
    try {
      // First, wipe ALL data from current company
      const allTables = [
        "debt_payments", "debts",
        "sale_items", "sale_payments", "sales",
        "cash_deposits", "cash_withdrawals", "cash_registers",
        "action_logs", "stock_movements", "webauthn_credentials",
        "products", "clients", "operators", "terminals",
        "bills", "suppliers",
      ];

      for (const table of allTables) {
        await supabase.from(table as any).delete().eq("tenant_id", tenantId);
      }

      // Update company info with new name and clear all fields
      await supabase.from("companies").update({
        nome: newCompanyName.trim(),
        nome_fantasia: "",
        razao_social: "",
        cnpj: "",
        inscricao_estadual: "",
        inscricao_municipal: "",
        telefone: "",
        email: "",
        endereco: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
      } as any).eq("id", tenantId);

      toast.success(`Empresa "${newCompanyName.trim()}" criada! Recarregue a página para começar do zero.`);
      setNewCompanyDialog(false);
      setNewCompanyName("");
      setNewCompanyConfirmText("");

      // Force reload to refresh all contexts
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setCreatingCompany(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Exportar Dados (Backup)</h3>
        <p className="text-xs text-muted-foreground">
          Exporta produtos, clientes, operadores, terminais, fornecedores e contas a pagar em formato JSON.
        </p>
        <Button onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar Backup
        </Button>
      </div>

      {/* Import */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Restaurar Dados</h3>
        <p className="text-xs text-muted-foreground">
          Importa um arquivo de backup JSON previamente exportado. <strong className="text-destructive">Atenção:</strong> os dados atuais serão substituídos.
        </p>
        <Button variant="outline" className="gap-2 relative" disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Selecionar Arquivo
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={importing}
          />
        </Button>
      </div>

      {/* Reset */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Resetar Dados
        </h3>
        <p className="text-xs text-muted-foreground">
          Apague seletivamente os dados do sistema. Escolha quais áreas deseja limpar.
        </p>
        <Button
          variant="destructive"
          className="gap-2"
          onClick={() => { setResetDialog(true); setSelectedResets([]); setResetConfirmText(""); }}
        >
          <RotateCcw className="h-4 w-4" />
          Resetar Dados
        </Button>
      </div>

      {/* New Company */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Nova Empresa
        </h3>
        <p className="text-xs text-muted-foreground">
          Limpa <strong>todos</strong> os dados e recomeça com uma nova empresa do zero. Todos os produtos, vendas, clientes, configurações e dados financeiros serão apagados permanentemente.
        </p>
        <Button
          variant="destructive"
          className="gap-2"
          onClick={() => { setNewCompanyDialog(true); setNewCompanyName(""); setNewCompanyConfirmText(""); }}
        >
          <Building2 className="h-4 w-4" />
          Iniciar Nova Empresa
        </Button>
      </div>

      {/* Confirm Import Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Restauração
            </DialogTitle>
            <DialogDescription>
              Esta ação irá <strong>substituir todos os dados atuais</strong> pelos dados do arquivo de backup. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmDialog(false); setPendingFile(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleImport}>
              Restaurar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Resetar Dados
            </DialogTitle>
            <DialogDescription>
              Selecione as áreas que deseja apagar. Esta ação é <strong>irreversível</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <button
              onClick={selectAllResets}
              className="text-xs font-medium text-primary hover:underline"
            >
              {selectedResets.length === RESET_SECTIONS.length ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
            {RESET_SECTIONS.map((section) => (
              <label
                key={section.id}
                className="flex items-center gap-3 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedResets.includes(section.id)}
                  onChange={() => toggleResetSection(section.id)}
                  className="rounded border-input"
                />
                <span className="text-sm text-foreground">{section.label}</span>
              </label>
            ))}
          </div>

          {selectedResets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Digite <strong className="text-destructive">RESETAR</strong> para confirmar:
              </p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESETAR"
                className="text-sm"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting || selectedResets.length === 0 || resetConfirmText !== "RESETAR"}
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apagar Dados Selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Company Dialog */}
      <Dialog open={newCompanyDialog} onOpenChange={setNewCompanyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Iniciar Nova Empresa
            </DialogTitle>
            <DialogDescription>
              <strong className="text-destructive">ATENÇÃO:</strong> Todos os dados da empresa atual serão apagados permanentemente (produtos, vendas, clientes, estoque, configurações, financeiro). Recomenda-se fazer um backup antes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nome da Nova Empresa</label>
              <Input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ex: Minha Nova Loja"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Digite <strong className="text-destructive">NOVA EMPRESA</strong> para confirmar:
              </p>
              <Input
                value={newCompanyConfirmText}
                onChange={(e) => setNewCompanyConfirmText(e.target.value)}
                placeholder="NOVA EMPRESA"
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewCompanyDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleNewCompany}
              disabled={creatingCompany || !newCompanyName.trim() || newCompanyConfirmText !== "NOVA EMPRESA"}
            >
              {creatingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar e Recomeçar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
