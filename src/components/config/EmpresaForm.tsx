import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, Building2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface EmpresaData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
}

const initialData: EmpresaData = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  telefone: "",
  email: "",
};

function maskCNPJ(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCEP(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

const inputClass =
  "w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring";

export default function EmpresaForm() {
  const { tenantId } = useTenant();
  const [data, setData] = useState<EmpresaData>(initialData);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Load company data from Supabase
  useEffect(() => {
    if (!tenantId) { setLoadingData(false); return; }
    const load = async () => {
      setLoadingData(true);
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("id", tenantId)
        .single();
      if (company) {
        setData({
          cnpj: company.cnpj || "",
          razaoSocial: (company as any).razao_social || "",
          nomeFantasia: (company as any).nome_fantasia || "",
          inscricaoEstadual: (company as any).inscricao_estadual || "",
          inscricaoMunicipal: (company as any).inscricao_municipal || "",
          cep: (company as any).cep || "",
          logradouro: (company as any).logradouro || "",
          numero: (company as any).numero || "",
          complemento: (company as any).complemento || "",
          bairro: (company as any).bairro || "",
          cidade: (company as any).cidade || "",
          uf: (company as any).uf || "",
          telefone: company.telefone || "",
          email: company.email || "",
        });
      }
      setLoadingData(false);
    };
    load();
  }, [tenantId]);

  const update = (field: keyof EmpresaData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const buscarCNPJ = useCallback(async () => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return; }
    setLoadingCNPJ(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((prev) => ({
        ...prev,
        razaoSocial: json.razao_social || "",
        nomeFantasia: json.nome_fantasia || "",
        cep: json.cep ? maskCEP(json.cep) : prev.cep,
        logradouro: json.logradouro || "",
        numero: json.numero || "",
        complemento: json.complemento || "",
        bairro: json.bairro || "",
        cidade: json.municipio || "",
        uf: json.uf || "",
        telefone: json.ddd_telefone_1 || "",
      }));
      toast.success("Dados do CNPJ carregados");
    } catch {
      toast.error("Erro ao buscar CNPJ. Verifique e tente novamente.");
    } finally {
      setLoadingCNPJ(false);
    }
  }, [data.cnpj]);

  const buscarCEP = useCallback(async () => {
    const digits = data.cep.replace(/\D/g, "");
    if (digits.length !== 8) { toast.error("CEP deve ter 8 dígitos"); return; }
    setLoadingCEP(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((prev) => ({
        ...prev,
        logradouro: json.street || "",
        bairro: json.neighborhood || "",
        cidade: json.city || "",
        uf: json.state || "",
      }));
      toast.success("Endereço carregado pelo CEP");
    } catch {
      toast.error("Erro ao buscar CEP. Verifique e tente novamente.");
    } finally {
      setLoadingCEP(false);
    }
  }, [data.cep]);

  const handleSave = async () => {
    if (!tenantId) { toast.error("Empresa não encontrada"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").update({
        cnpj: data.cnpj,
        razao_social: data.razaoSocial,
        nome_fantasia: data.nomeFantasia,
        nome: data.nomeFantasia || data.razaoSocial || "Minha Empresa",
        inscricao_estadual: data.inscricaoEstadual,
        inscricao_municipal: data.inscricaoMunicipal,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        telefone: data.telefone,
        email: data.email,
        endereco: `${data.logradouro}, ${data.numero} ${data.complemento} - ${data.bairro}, ${data.cidade}/${data.uf} - ${data.cep}`.trim(),
      } as any).eq("id", tenantId);
      if (error) throw error;
      toast.success("Dados da empresa salvos com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identificação */}
      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Identificação
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">CNPJ</label>
            <div className="flex gap-2">
              <input className={`flex-1 ${inputClass}`} placeholder="00.000.000/0000-00" value={data.cnpj} onChange={(e) => update("cnpj", maskCNPJ(e.target.value))} />
              <button onClick={buscarCNPJ} disabled={loadingCNPJ} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                {loadingCNPJ ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Inscrição Estadual</label>
            <input className={inputClass} placeholder="Inscrição Estadual" value={data.inscricaoEstadual} onChange={(e) => update("inscricaoEstadual", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Razão Social</label>
            <input className={inputClass} placeholder="Razão Social" value={data.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome Fantasia</label>
            <input className={inputClass} placeholder="Nome Fantasia" value={data.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Inscrição Municipal</label>
            <input className={inputClass} placeholder="Inscrição Municipal" value={data.inscricaoMunicipal} onChange={(e) => update("inscricaoMunicipal", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Telefone</label>
              <input className={inputClass} placeholder="(00) 0000-0000" value={data.telefone} onChange={(e) => update("telefone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email</label>
              <input className={inputClass} placeholder="email@empresa.com" value={data.email} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Endereço */}
      <fieldset className="rounded-md border border-border p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Endereço
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">CEP</label>
            <div className="flex gap-2">
              <input className={`flex-1 ${inputClass}`} placeholder="00000-000" value={data.cep} onChange={(e) => update("cep", maskCEP(e.target.value))} />
              <button onClick={buscarCEP} disabled={loadingCEP} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                {loadingCEP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
              </button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-foreground">Logradouro</label>
            <input className={inputClass} placeholder="Rua, Avenida..." value={data.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Número</label>
            <input className={inputClass} placeholder="Nº" value={data.numero} onChange={(e) => update("numero", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Complemento</label>
            <input className={inputClass} placeholder="Sala, Bloco..." value={data.complemento} onChange={(e) => update("complemento", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Bairro</label>
            <input className={inputClass} placeholder="Bairro" value={data.bairro} onChange={(e) => update("bairro", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-foreground">Cidade</label>
              <input className={inputClass} placeholder="Cidade" value={data.cidade} onChange={(e) => update("cidade", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">UF</label>
              <input className={inputClass} placeholder="UF" value={data.uf} onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))} />
            </div>
          </div>
        </div>
      </fieldset>

      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Dados da Empresa
      </button>
    </div>
  );
}
