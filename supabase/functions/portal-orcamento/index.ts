import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, token, senha } = body;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup quote by token
    const { data: orc, error: orcErr } = await supabaseAdmin
      .from("orcamentos")
      .select("*")
      .eq("portal_token", token)
      .single();

    if (orcErr || !orc) {
      return new Response(JSON.stringify({ error: "Orçamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify password
    if (!senha || senha !== orc.portal_senha) {
      return new Response(JSON.stringify({ error: "Senha incorreta" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "view") {
      // Fetch items
      const { data: items } = await supabaseAdmin
        .from("orcamento_items")
        .select("*")
        .eq("orcamento_id", orc.id);

      // Fetch company info
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("nome, nome_fantasia, cnpj, telefone, email, logradouro, numero, bairro, cidade, uf, cep")
        .eq("id", orc.tenant_id)
        .single();

      return new Response(JSON.stringify({
        orcamento: {
          numero: orc.numero,
          client_name: orc.client_name,
          vendedor_name: orc.vendedor_name,
          subtotal: orc.subtotal,
          total: orc.total,
          desconto_tipo: orc.desconto_tipo,
          desconto_valor: orc.desconto_valor,
          observacoes: orc.observacoes,
          validade: orc.validade,
          status: orc.status,
          autorizado: orc.autorizado,
          created_at: orc.created_at,
        },
        items: items || [],
        company: company || null,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      if (orc.status === "convertido" || orc.status === "expirado") {
        return new Response(JSON.stringify({ error: `Orçamento já está ${orc.status}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("orcamentos")
        .update({ autorizado: true, status: "autorizado", updated_at: new Date().toISOString() })
        .eq("id", orc.id);

      // Log
      await supabaseAdmin.from("orcamento_historico").insert({
        orcamento_id: orc.id,
        orcamento_numero: orc.numero,
        acao: "aprovado_cliente",
        descricao: `Orçamento aprovado pelo cliente via portal`,
        tenant_id: orc.tenant_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      if (orc.status === "convertido") {
        return new Response(JSON.stringify({ error: "Orçamento já foi convertido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("orcamentos")
        .update({ status: "expirado", updated_at: new Date().toISOString() })
        .eq("id", orc.id);

      await supabaseAdmin.from("orcamento_historico").insert({
        orcamento_id: orc.id,
        orcamento_numero: orc.numero,
        acao: "recusado_cliente",
        descricao: `Orçamento recusado pelo cliente via portal`,
        tenant_id: orc.tenant_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
