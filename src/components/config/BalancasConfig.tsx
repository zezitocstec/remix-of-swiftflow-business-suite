import { useState } from "react";
import { Scale, Usb, Cable, RefreshCw, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const MARCAS = [
  { value: "prix", label: "Toledo Prix" },
  { value: "toledo", label: "Toledo" },
  { value: "filizola", label: "Filizola" },
  { value: "urano", label: "Urano" },
  { value: "digitron", label: "Digitron" },
  { value: "elgin", label: "Elgin" },
  { value: "outra", label: "Outra" },
];

const MODELOS: Record<string, string[]> = {
  prix: ["Prix 3 Plus", "Prix 4 Uno", "Prix 5 Plus", "Prix 6", "Prix Toledo Fit"],
  toledo: ["Toledo 2090", "Toledo 2180", "Toledo 8217", "Toledo 9091"],
  filizola: ["Filizola Platina", "Filizola CS-15", "Filizola MF"],
  urano: ["Urano POP-S", "Urano POP-Z", "Urano US 15/2"],
  digitron: ["Digitron DG-15", "Digitron DG-30"],
  elgin: ["Elgin SA-110", "Elgin DP-15"],
  outra: ["Genérica"],
};

const PROTOCOLOS = [
  { value: "toledo", label: "Toledo (padrão)" },
  { value: "filizola", label: "Filizola" },
  { value: "cas", label: "CAS" },
  { value: "urano", label: "Urano" },
];

const BAUD_RATES = ["1200", "2400", "4800", "9600", "19200", "38400", "57600", "115200"];
const DATA_BITS = ["7", "8"];
const PARIDADES = [
  { value: "none", label: "Nenhuma" },
  { value: "even", label: "Par" },
  { value: "odd", label: "Ímpar" },
];
const STOP_BITS = ["1", "2"];

interface BalancaConfig {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  conexao: "serial" | "usb";
  protocolo: string;
  porta: string;
  baudRate: string;
  dataBits: string;
  paridade: string;
  stopBits: string;
  ativa: boolean;
}

export default function BalancasConfig() {
  const [balancas, setBalancas] = useState<BalancaConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [conexao, setConexao] = useState<"serial" | "usb">("serial");
  const [protocolo, setProtocolo] = useState("toledo");
  const [porta, setPorta] = useState("COM1");
  const [baudRate, setBaudRate] = useState("9600");
  const [dataBits, setDataBits] = useState("8");
  const [paridade, setParidade] = useState("none");
  const [stopBits, setStopBits] = useState("1");

  const resetForm = () => {
    setNome(""); setMarca(""); setModelo(""); setConexao("serial");
    setProtocolo("toledo"); setPorta("COM1"); setBaudRate("9600");
    setDataBits("8"); setParidade("none"); setStopBits("1");
    setShowForm(false);
  };

  const handleAdd = () => {
    if (!nome.trim() || !marca) {
      toast.error("Preencha o nome e a marca da balança");
      return;
    }
    const newBalanca: BalancaConfig = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      marca, modelo, conexao, protocolo, porta,
      baudRate, dataBits, paridade, stopBits, ativa: true,
    };
    setBalancas((prev) => [...prev, newBalanca]);
    toast.success("Balança adicionada com sucesso");
    resetForm();
  };

  const handleDelete = (id: string) => {
    setBalancas((prev) => prev.filter((b) => b.id !== id));
    toast.success("Balança removida");
  };

  const toggleAtiva = (id: string) => {
    setBalancas((prev) => prev.map((b) => b.id === id ? { ...b, ativa: !b.ativa } : b));
  };

  const handleTest = async (b: BalancaConfig) => {
    setTesting(b.id);
    await new Promise((r) => setTimeout(r, 2000));
    setTesting(null);
    toast.info(`Teste de leitura da balança "${b.nome}" — funcionalidade disponível via aplicação desktop`);
  };

  const marcaLabel = (v: string) => MARCAS.find((m) => m.value === v)?.label ?? v;
  const modelosDisponiveis = marca ? (MODELOS[marca] || []) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Balanças</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure as balanças conectadas via USB ou porta serial</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Balança
          </Button>
        )}
      </div>

      {showForm && (
        <fieldset className="rounded-md border border-border p-4 space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Nova Balança
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nome / Identificação</label>
              <Input placeholder="Ex: Balança Açougue" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Marca</label>
              <Select value={marca} onValueChange={(v) => { setMarca(v); setModelo(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                <SelectContent>
                  {MARCAS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Modelo</label>
              <Select value={modelo} onValueChange={setModelo} disabled={!marca}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                <SelectContent>
                  {modelosDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Tipo de Conexão</label>
              <Select value={conexao} onValueChange={(v: "serial" | "usb") => setConexao(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="serial"><span className="flex items-center gap-1.5"><Cable className="h-3.5 w-3.5" /> Serial (RS-232)</span></SelectItem>
                  <SelectItem value="usb"><span className="flex items-center gap-1.5"><Usb className="h-3.5 w-3.5" /> USB</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Protocolo de Comunicação</label>
              <Select value={protocolo} onValueChange={setProtocolo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROTOCOLOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Porta</label>
              <Input placeholder={conexao === "serial" ? "COM1" : "/dev/ttyUSB0"} value={porta} onChange={(e) => setPorta(e.target.value)} />
            </div>
          </div>

          {conexao === "serial" && (
            <fieldset className="rounded-md border border-border/50 p-3 space-y-3">
              <legend className="text-xs font-medium text-muted-foreground px-1.5">Parâmetros da Porta Serial</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Baud Rate</label>
                  <Select value={baudRate} onValueChange={setBaudRate}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{BAUD_RATES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Data Bits</label>
                  <Select value={dataBits} onValueChange={setDataBits}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{DATA_BITS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Paridade</label>
                  <Select value={paridade} onValueChange={setParidade}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PARIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Stop Bits</label>
                  <Select value={stopBits} onValueChange={setStopBits}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STOP_BITS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleAdd}>Salvar Balança</Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </fieldset>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Marca / Modelo</TableHead>
              <TableHead>Conexão</TableHead>
              <TableHead>Porta</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balancas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma balança configurada
                </TableCell>
              </TableRow>
            ) : balancas.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell>
                  <span className="text-xs">{marcaLabel(b.marca)}</span>
                  {b.modelo && <span className="text-xs text-muted-foreground ml-1">— {b.modelo}</span>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs">
                    {b.conexao === "usb" ? <Usb className="h-3 w-3" /> : <Cable className="h-3 w-3" />}
                    {b.conexao === "usb" ? "USB" : "Serial"}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-mono">{b.porta}</TableCell>
                <TableCell><Switch checked={b.ativa} onCheckedChange={() => toggleAtiva(b.id)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => handleTest(b)} disabled={testing === b.id}>
                    <RefreshCw className={`h-4 w-4 ${testing === b.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border border-border/50 bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Nota:</strong> A comunicação com a balança requer que a aplicação desktop (agente local) esteja instalada e em execução. 
          O agente faz a ponte entre o navegador e a porta serial/USB da balança. 
          Protocolos suportados: Toledo, Filizola, CAS e Urano. 
          Consulte o manual da balança para os parâmetros corretos de comunicação serial.
        </p>
      </div>
    </div>
  );
}
