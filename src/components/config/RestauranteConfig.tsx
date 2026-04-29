import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useProducts } from "@/contexts/ProductContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Percent, Coins, Save, Printer, ChefHat, Wine, X } from "lucide-react";
import { formatBRL } from "@/lib/mock-data";

const sb = supabase as any;

export interface RestaurantSettings {
  service_fee_enabled: boolean;
  service_fee_pct: number;
  couvert_enabled: boolean;
  couvert_amount: number;
  receipt_copies: 1 | 2 | 3;
  kitchen_print_enabled: boolean;
  kitchen_categories: string[];
  bar_categories: string[];
}

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  service_fee_enabled: false,
  service_fee_pct: 10,
  couvert_enabled: false,
  couvert_amount: 0,
  receipt_copies: 1,
  kitchen_print_enabled: false,
  kitchen_categories: [],
  bar_categories: [],
};

export async function loadRestaurantSettings(tenantId: string): Promise<RestaurantSettings> {
  const { data } = await sb
    .from("restaurant_settings")
    .select("service_fee_enabled, service_fee_pct, couvert_enabled, couvert_amount, receipt_copies, kitchen_print_enabled, kitchen_categories, bar_categories")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return DEFAULT_RESTAURANT_SETTINGS;
  const copiesRaw = Number(data.receipt_copies) || 1;
  const copies = (copiesRaw >= 1 && copiesRaw <= 3 ? copiesRaw : 1) as 1 | 2 | 3;
  return {
    service_fee_enabled: !!data.service_fee_enabled,
    service_fee_pct: Number(data.service_fee_pct) || 0,
    couvert_enabled: !!data.couvert_enabled,
    couvert_amount: Number(data.couvert_amount) || 0,
    receipt_copies: copies,
    kitchen_print_enabled: !!data.kitchen_print_enabled,
    kitchen_categories: Array.isArray(data.kitchen_categories) ? data.kitchen_categories : [],
    bar_categories: Array.isArray(data.bar_categories) ? data.bar_categories : [],
  };
}

export default function RestauranteConfig() {
  const { tenantId } = useTenant();
  const { products } = useProducts();
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_RESTAURANT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // All distinct categories existing in product registry
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [products]);

  const toggleCategory = (list: "kitchen_categories" | "bar_categories", cat: string) => {
    setSettings((s) => {
      const cur = s[list] || [];
      const next = cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat];
      return { ...s, [list]: next };
    });
  };

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) return;
    setLoading(true);
    loadRestaurantSettings(tenantId).then((s) => {
      if (!cancelled) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tenantId]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    const { error } = await sb
      .from("restaurant_settings")
      .upsert({ tenant_id: tenantId, ...settings }, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      // Notify open ComandaDialog instances to refresh without page reload.
      window.dispatchEvent(
        new CustomEvent("restaurant-settings-changed", { detail: { tenantId, settings } })
      );
      toast({ title: "Configurações salvas", description: "Aplicado a novas comandas." });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Restaurante</h2>
        <p className="text-sm text-muted-foreground">
          Configurações padrão aplicadas a toda comanda nova (taxa de serviço e couvert).
        </p>
      </div>

      {/* ─── Taxa de serviço ─── */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Percent className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="rs-fee-enabled" className="text-sm font-medium text-foreground cursor-pointer">
              Taxa de serviço (garçom)
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativada, virá pré-marcada em toda comanda nova com o percentual abaixo.
              Acrescido proporcionalmente em divisões de conta.
            </p>
          </div>
          <Switch
            id="rs-fee-enabled"
            checked={settings.service_fee_enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, service_fee_enabled: v }))}
          />
        </div>
        <div className="flex items-center gap-2 pl-8">
          <Label htmlFor="rs-fee-pct" className="text-sm text-foreground w-28">Percentual</Label>
          <Input
            id="rs-fee-pct"
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={settings.service_fee_pct}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n >= 0 && n <= 100) {
                setSettings((s) => ({ ...s, service_fee_pct: n }));
              }
            }}
            className="w-24 tabular-nums"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      {/* ─── Couvert ─── */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Coins className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="rs-couvert-enabled" className="text-sm font-medium text-foreground cursor-pointer">
              Couvert artístico
            </Label>
            <p className="text-xs text-muted-foreground">
              Valor fixo cobrado <b>por pessoa</b>. Ao dividir a conta, multiplicado pelo número de pessoas.
              Se não houver divisão, conta como 1 pessoa.
            </p>
          </div>
          <Switch
            id="rs-couvert-enabled"
            checked={settings.couvert_enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, couvert_enabled: v }))}
          />
        </div>
        <div className="flex items-center gap-2 pl-8">
          <Label htmlFor="rs-couvert-amount" className="text-sm text-foreground w-28">Valor por pessoa</Label>
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            id="rs-couvert-amount"
            type="number"
            min={0}
            step="0.01"
            value={settings.couvert_amount}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n >= 0) {
                setSettings((s) => ({ ...s, couvert_amount: n }));
              }
            }}
            className="w-32 tabular-nums"
          />
          {settings.couvert_enabled && settings.couvert_amount > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              ({formatBRL(settings.couvert_amount)} × pessoas)
            </span>
          )}
        </div>
      </div>

      {/* ─── KDS / Impressão para cozinha e bar ─── */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <ChefHat className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-medium text-foreground">
              Impressão automática para cozinha / bar
            </Label>
            <p className="text-xs text-muted-foreground">
              Ao adicionar um item à comanda, o sistema dispara um cupom de produção
              para a estação correspondente com base na <b>categoria do produto</b>.
              Itens já enviados não são reimpressos.
            </p>
          </div>
          <Switch
            checked={settings.kitchen_print_enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, kitchen_print_enabled: v }))}
          />
        </div>

        {settings.kitchen_print_enabled && (
          <>
            <CategoryPicker
              icon={<ChefHat className="h-4 w-4" />}
              label="Categorias da Cozinha"
              all={allCategories}
              selected={settings.kitchen_categories}
              onToggle={(c) => toggleCategory("kitchen_categories", c)}
            />
            <CategoryPicker
              icon={<Wine className="h-4 w-4" />}
              label="Categorias do Bar"
              all={allCategories}
              selected={settings.bar_categories}
              onToggle={(c) => toggleCategory("bar_categories", c)}
            />
            {allCategories.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Nenhuma categoria de produto cadastrada. Cadastre produtos com categorias (ex.: "Cozinha", "Bebidas") para usar este recurso.
              </p>
            )}
          </>
        )}
      </div>

      {/* ─── Vias de impressão ─── */}
      <div className="rounded-md border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Printer className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="rs-copies" className="text-sm font-medium text-foreground">
              Vias do cupom ao fechar mesa
            </Label>
            <p className="text-xs text-muted-foreground">
              Quantidade de vias impressas automaticamente quando uma mesa é finalizada
              (ex.: 1 estabelecimento + 1 cliente). Aplicado a todas as mesas novas.
            </p>
          </div>
          <Select
            value={String(settings.receipt_copies)}
            onValueChange={(v) =>
              setSettings((s) => ({ ...s, receipt_copies: (Number(v) as 1 | 2 | 3) }))
            }
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 via</SelectItem>
              <SelectItem value="2">2 vias</SelectItem>
              <SelectItem value="3">3 vias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

function CategoryPicker({
  icon, label, all, selected, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  all: string[];
  selected: string[];
  onToggle: (c: string) => void;
}) {
  return (
    <div className="space-y-2 pl-8">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        <span>{label}</span>
        <Badge variant="outline" className="ml-1 text-[10px]">{selected.length}</Badge>
      </div>
      {all.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {all.map((c) => {
            const on = selected.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onToggle(c)}
                className={
                  "text-xs rounded-full border px-2.5 py-1 transition-colors " +
                  (on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted")
                }
              >
                {c}{on && <X className="inline-block h-3 w-3 ml-1" />}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">— sem categorias —</p>
      )}
    </div>
  );
}
