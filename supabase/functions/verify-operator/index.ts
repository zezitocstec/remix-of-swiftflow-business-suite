import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const PERMISSION_MAP: Record<string, string> = {
  cancelarItem: "perm_cancelar_item",
  cancelarCupom: "perm_cancelar_cupom",
  abrirCaixa: "perm_abrir_caixa",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.user.id;

    // Parse body
    const body = await req.json();
    const { operator_id, pin, required_permission } = body;

    if (!operator_id || typeof operator_id !== "string") {
      return new Response(JSON.stringify({ error: "operator_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!pin || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "pin is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (required_permission && !PERMISSION_MAP[required_permission]) {
      return new Response(JSON.stringify({ error: "Invalid permission type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's tenant
    const { data: membership } = await supabaseAdmin
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!membership?.company_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify PIN server-side using the existing RPC
    const { data: pinValid } = await supabaseAdmin.rpc("verify_operator_pin", {
      p_operator_id: operator_id,
      p_pin: pin,
    });

    if (!pinValid) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid PIN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch operator (excluding pin) and verify tenant match
    const { data: operator, error: opErr } = await supabaseAdmin
      .from("operators")
      .select("id, nome, ativo, perm_abrir_caixa, perm_cancelar_item, perm_cancelar_cupom, tenant_id")
      .eq("id", operator_id)
      .eq("tenant_id", membership.company_id)
      .single();

    if (opErr || !operator) {
      return new Response(
        JSON.stringify({ valid: false, error: "Operator not found in your tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!operator.ativo) {
      return new Response(
        JSON.stringify({ valid: false, error: "Operator is inactive" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check specific permission if requested
    if (required_permission) {
      const dbColumn = PERMISSION_MAP[required_permission];
      const hasPermission = (operator as Record<string, unknown>)[dbColumn] === true;
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ valid: false, error: "Operator lacks required permission", hasPermission: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        operator: {
          id: operator.id,
          nome: operator.nome,
        },
        hasPermission: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
