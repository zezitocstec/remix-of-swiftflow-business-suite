import { useState } from "react";
import { Printer, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

interface PrinterInfo {
  name: string;
  status: "online" | "offline";
}

const mockPrinters: PrinterInfo[] = [
  { name: "EPSON TM-T20X", status: "online" },
  { name: "Elgin i9", status: "online" },
  { name: "Bematech MP-4200 TH", status: "offline" },
  { name: "Microsoft Print to PDF", status: "online" },
];

export default function ImpressoraConfig() {
  const [printers, setPrinters] = useState<PrinterInfo[]>(mockPrinters);
  const [selected, setSelected] = useState<string>("");
  const [scanning, setScanning] = useState(false);

  const scanPrinters = async () => {
    setScanning(true);
    // Simula detecção de impressoras locais
    await new Promise((r) => setTimeout(r, 1500));
    setPrinters(mockPrinters);
    setScanning(false);
    toast.success("Impressoras detectadas com sucesso");
  };

  const testPrint = () => {
    if (!selected) {
      toast.error("Selecione uma impressora primeiro");
      return;
    }
    toast.success(`Teste de impressão enviado para ${selected}`);
  };

  return (
    <div className="space-y-4">
      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
          <Printer className="h-3.5 w-3.5" /> Impressora Local
        </legend>

        <div className="flex items-center gap-2">
          <button
            onClick={scanPrinters}
            disabled={scanning}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Buscando..." : "Detectar Impressoras"}
          </button>
        </div>

        <div className="space-y-2">
          {printers.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setSelected(p.name);
                toast.info(`Impressora selecionada: ${p.name}`);
              }}
              className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                selected === p.name
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Printer className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        p.status === "online" ? "bg-green-500" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground capitalize">{p.status}</span>
                  </div>
                </div>
              </div>
              {selected === p.name && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>

        <button
          onClick={testPrint}
          className="h-9 px-4 rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          Imprimir Teste
        </button>
      </fieldset>
    </div>
  );
}
