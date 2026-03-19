import { useState } from "react";
import { FileText, Receipt, Upload, FileUp } from "lucide-react";
import { toast } from "sonner";

type SaleMode = "fiscal" | "pdf";

export default function VendaConfig() {
  const [saleMode, setSaleMode] = useState<SaleMode>("pdf");
  const [importedFiles, setImportedFiles] = useState<{ name: string; type: string }[]>([]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const accepted: { name: string; type: string }[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xml" || ext === "pdf") {
        accepted.push({ name: file.name, type: ext.toUpperCase() });
      } else {
        toast.error(`Arquivo "${file.name}" não suportado. Use XML ou PDF.`);
      }
    }

    if (accepted.length > 0) {
      setImportedFiles((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} arquivo(s) importado(s) com sucesso`);
    }
    e.target.value = "";
  };

  const handleSave = () => {
    toast.success(`Modo de venda configurado: ${saleMode === "fiscal" ? "NFC-e (Fiscal)" : "Cupom PDF"}`);
  };

  return (
    <div className="space-y-6">
      {/* Modo de finalização */}
      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5" /> Modo de Finalização da Venda
        </legend>

        <p className="text-xs text-muted-foreground">
          Escolha como as vendas serão finalizadas no PDV.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setSaleMode("fiscal")}
            className={`flex items-start gap-3 rounded-md border p-4 text-left transition-colors ${
              saleMode === "fiscal"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Receipt className="h-5 w-5 text-primary mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-foreground">NFC-e (Fiscal)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Emite nota fiscal eletrônica ao consumidor. Requer certificado digital A1 e configuração SEFAZ.
              </p>
            </div>
          </button>

          <button
            onClick={() => setSaleMode("pdf")}
            className={`flex items-start gap-3 rounded-md border p-4 text-left transition-colors ${
              saleMode === "pdf"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <FileText className="h-5 w-5 text-primary mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-foreground">Cupom PDF</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gera cupom em PDF para impressão ou envio digital. Não possui validade fiscal.
              </p>
            </div>
          </button>
        </div>

        <button
          onClick={handleSave}
          className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
        >
          Salvar Configuração
        </button>
      </fieldset>

      {/* Importação de Arquivos */}
      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Importação de Arquivos
        </legend>

        <p className="text-xs text-muted-foreground">
          Importe notas fiscais (XML) ou documentos (PDF) para entrada automática de produtos e dados.
        </p>

        <label className="flex flex-col items-center justify-center w-full h-32 rounded-md border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-secondary/30">
          <FileUp className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground">Clique para importar</span>
          <span className="text-xs text-muted-foreground mt-1">XML ou PDF</span>
          <input
            type="file"
            accept=".xml,.pdf"
            multiple
            onChange={handleFileImport}
            className="hidden"
          />
        </label>

        {importedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Arquivos importados ({importedFiles.length})
            </p>
            <div className="space-y-1">
              {importedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  {f.type === "XML" ? (
                    <FileText className="h-4 w-4 text-orange-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-foreground flex-1 truncate">{f.name}</span>
                  <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                    {f.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
