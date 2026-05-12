import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function generateCode(): string {
  // 10 hex chars (~40 bits entropy). Format XXXXX-XXXXX
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.toUpperCase().replace(/[^A-F0-9]/g, ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "generate") {
      // Wipe existing and create 10 fresh codes
      await admin.from("mfa_backup_codes").delete().eq("user_id", userId);
      const codes: string[] = [];
      const rows: { user_id: string; code_hash: string }[] = [];
      for (let i = 0; i < 10; i++) {
        const c = generateCode();
        codes.push(c);
        rows.push({ user_id: userId, code_hash: await hashCode(c) });
      }
      const { error } = await admin.from("mfa_backup_codes").insert(rows);
      if (error) throw error;
      return new Response(JSON.stringify({ codes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { count } = await admin
        .from("mfa_backup_codes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("used_at", null);
      return new Response(JSON.stringify({ remaining: count ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "consume") {
      const code = String(body.code ?? "").trim();
      if (!code) {
        return new Response(JSON.stringify({ error: "Código obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = await hashCode(code);
      const { data: match, error: selErr } = await admin
        .from("mfa_backup_codes")
        .select("id")
        .eq("user_id", userId)
        .eq("code_hash", hash)
        .is("used_at", null)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!match) {
        return new Response(JSON.stringify({ error: "Código inválido ou já usado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Mark used
      await admin.from("mfa_backup_codes").update({ used_at: new Date().toISOString() }).eq("id", match.id);
      // Unenroll all TOTP factors for this user so they can sign in fully
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
      const totp = factors?.factors?.filter((f) => f.factor_type === "totp") ?? [];
      for (const f of totp) {
        await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      }
      return new Response(JSON.stringify({ ok: true, removed_factors: totp.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
