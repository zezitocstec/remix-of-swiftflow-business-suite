import { useState } from "react";
import { Download, Upload, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export default function BackupConfig() {
  const { tenantId } = useTenant();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

        // Delete existing data for this tenant
        await supabase.from(table).delete().eq("tenant_id", tenantId);

        // Re-insert with correct tenant_id
        const cleaned = rows.map((r: any) => ({ ...r, tenant_id: tenantId }));
        // Insert in batches of 100
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

  return (
    <div className="space-y-6">
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

      <div className="rounded-md border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Restaurar Dados</h3>
        <p className="text-xs text-muted-foreground">
          Importa um arquivo de backup JSON previamente exportado. <strong className="text-destructive">Atenção:</strong> os dados atuais serão substituídos.
        </p>
        <div className="flex items-center gap-3">
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
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Restauração
            </DialogTitle>
            <DialogDescription>
              Esta ação irá <strong>substituir todos os dados atuais</strong> (produtos, clientes, operadores, terminais, fornecedores e contas) pelos dados do arquivo de backup. Esta ação não pode ser desfeita.
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
    </div>
  );
}
