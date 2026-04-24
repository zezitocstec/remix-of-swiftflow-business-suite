import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface PrintLogEntry {
  tenant_id: string;
  table_id?: string | null;
  table_numero: number;
  table_nome?: string | null;
  order_id?: string | null;
  sale_id?: string | null;
  operator_id?: string | null;
  operator_name?: string | null;
  copies_requested: number;
  copies_printed: number;
  ok: boolean;
  total_amount: number;
  error_message?: string | null;
  printed_at?: string;
  /** When true, this log entry came from a manual reprint (not the initial close). */
  is_reprint?: boolean;
}

const LS_KEY = "restaurant_print_logs_offline_v1";

function pushLocal(entry: PrintLogEntry) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr: PrintLogEntry[] = raw ? JSON.parse(raw) : [];
    arr.unshift({ ...entry, printed_at: entry.printed_at ?? new Date().toISOString() });
    // Cap at 500 entries to bound storage.
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 500)));
  } catch (e) {
    console.warn("[print-log] localStorage fallback failed:", e);
  }
}

export function readLocalPrintLogs(): PrintLogEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PrintLogEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persists a print attempt outcome. Tries the DB table first; on failure
 * (table missing, RLS, offline) falls back to localStorage so the report
 * still has data to show.
 */
export async function logPrintAttempt(entry: PrintLogEntry): Promise<void> {
  const payload = { ...entry, printed_at: entry.printed_at ?? new Date().toISOString() };
  try {
    const { error } = await sb.from("restaurant_print_logs").insert(payload);
    if (error) {
      console.warn("[print-log] DB insert failed, falling back to localStorage:", error.message);
      pushLocal(payload);
    }
  } catch (e: any) {
    console.warn("[print-log] DB insert threw, falling back to localStorage:", e?.message);
    pushLocal(payload);
  }
}

export async function fetchPrintLogs(tenantId: string, limit = 200): Promise<PrintLogEntry[]> {
  try {
    const { data, error } = await sb
      .from("restaurant_print_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("printed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const remote = (data ?? []) as PrintLogEntry[];
    // Merge with local fallback (dedupe on printed_at + table_numero + total_amount)
    const local = readLocalPrintLogs().filter((l) => l.tenant_id === tenantId);
    const seen = new Set(remote.map((r) => `${r.printed_at}|${r.table_numero}|${r.total_amount}`));
    const merged = [
      ...remote,
      ...local.filter((l) => !seen.has(`${l.printed_at}|${l.table_numero}|${l.total_amount}`)),
    ];
    merged.sort((a, b) => (b.printed_at || "").localeCompare(a.printed_at || ""));
    return merged.slice(0, limit);
  } catch (e) {
    console.warn("[print-log] fetch failed, using localStorage only:", e);
    return readLocalPrintLogs()
      .filter((l) => l.tenant_id === tenantId)
      .slice(0, limit);
  }
}
