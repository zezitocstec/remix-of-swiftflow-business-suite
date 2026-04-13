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
    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    // LIST USERS
    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 100 });
      if (error) throw error;

      // Get roles
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      // Get company memberships
      const { data: members } = await adminClient.from("company_members").select("user_id, company_id");
      const memberMap: Record<string, string> = {};
      (members || []).forEach((m: any) => { memberMap[m.user_id] = m.company_id; });

      const result = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: roleMap[u.id] || "user",
        has_company: !!memberMap[u.id],
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER
    if (action === "create") {
      const { email, password, role } = params;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      // Assign role
      const userRole = role || "user";
      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: userRole,
      });

      // Get caller's company to add membership
      const { data: callerMember } = await adminClient
        .from("company_members")
        .select("company_id")
        .eq("user_id", caller.id)
        .single();

      if (callerMember) {
        await adminClient.from("company_members").insert({
          user_id: newUser.user.id,
          company_id: callerMember.company_id,
          role: userRole === "admin" ? "owner" : "member",
        });
      }

      return new Response(JSON.stringify({ id: newUser.user.id, email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLE
    if (action === "update_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id e role obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent removing own admin
      if (user_id === caller.id && role !== "admin") {
        return new Response(JSON.stringify({ error: "Você não pode remover seu próprio acesso admin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert role
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .single();

      if (existing) {
        await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
      } else {
        await adminClient.from("user_roles").insert({ user_id, role });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (action === "delete") {
      const { user_id } = params;
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
