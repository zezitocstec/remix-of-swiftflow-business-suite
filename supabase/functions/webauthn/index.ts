import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RP_NAME = "Sistema PDV";

function getOrigin(req: Request): string {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin;
  }
}

function getRpId(origin: string): string {
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return "localhost";
  }
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Generate random challenge
function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

// Simple CBOR parsing to extract public key from attestation
function parseCosePublicKey(authData: Uint8Array): string {
  // authData: rpIdHash(32) + flags(1) + signCount(4) + attestedCredData
  // attestedCredData: aaguid(16) + credIdLen(2) + credId(credIdLen) + credentialPublicKey(CBOR)
  const flags = authData[32];
  const hasAttestedCred = (flags & 0x40) !== 0;
  if (!hasAttestedCred) throw new Error("No attested credential data");

  const credIdLen = (authData[53] << 8) | authData[54];
  const publicKeyStart = 55 + credIdLen;
  const publicKeyBytes = authData.slice(publicKeyStart);
  return base64UrlEncode(publicKeyBytes);
}

function getSignCount(authData: Uint8Array): number {
  return (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
}

function getCredIdFromAuthData(authData: Uint8Array): string {
  const credIdLen = (authData[53] << 8) | authData[54];
  const credId = authData.slice(55, 55 + credIdLen);
  return base64UrlEncode(credId);
}

// In-memory challenge store (short-lived, edge function scoped)
const challenges = new Map<string, { challenge: string; ts: number }>();

function cleanChallenges() {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (now - v.ts > 300000) challenges.delete(k);
  }
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

async function getTenantId(userId: string): Promise<string | null> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await supabaseAdmin
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.company_id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = await getTenantId(userId);
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const origin = getOrigin(req);
    const rpId = getRpId(origin);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "register-options") {
      const { operator_id } = body;
      if (!operator_id) {
        return new Response(JSON.stringify({ error: "operator_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify operator belongs to tenant
      const { data: op } = await supabaseAdmin
        .from("operators")
        .select("id, nome")
        .eq("id", operator_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!op) {
        return new Response(JSON.stringify({ error: "Operator not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing credentials to exclude
      const { data: existing } = await supabaseAdmin
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("operator_id", operator_id);

      const challenge = generateChallenge();
      const key = `reg_${operator_id}`;
      cleanChallenges();
      challenges.set(key, { challenge, ts: Date.now() });

      const options = {
        challenge,
        rp: { name: RP_NAME, id: rpId },
        user: {
          id: base64UrlEncode(new TextEncoder().encode(operator_id)),
          name: op.nome,
          displayName: op.nome,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
        excludeCredentials: (existing || []).map((c: any) => ({
          id: c.credential_id,
          type: "public-key",
        })),
      };

      return new Response(JSON.stringify(options), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register-verify") {
      const { operator_id, credential, device_name } = body;
      if (!operator_id || !credential) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const key = `reg_${operator_id}`;
      const stored = challenges.get(key);
      if (!stored) {
        return new Response(JSON.stringify({ error: "Challenge expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      challenges.delete(key);

      // Basic verification: decode attestationObject and extract credential
      const attestationObject = base64UrlDecode(credential.response.attestationObject);
      const clientDataJSON = base64UrlDecode(credential.response.clientDataJSON);

      // Verify clientDataJSON contains our challenge
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));
      if (clientData.challenge !== stored.challenge) {
        return new Response(JSON.stringify({ error: "Challenge mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (clientData.type !== "webauthn.create") {
        return new Response(JSON.stringify({ error: "Invalid type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Simple CBOR decode for attestation object to get authData
      // attestationObject is CBOR encoded map with keys: fmt, attStmt, authData
      // We use a simple approach: find authData by scanning for known patterns
      // For "none" attestation, the structure is predictable
      
      // Store credential_id from the response and public key
      const credentialId = credential.id;

      // Store the raw response for future verification
      // In production, you'd do full CBOR parsing. For simplicity, we store the credential ID and a hash.
      const { error: insertErr } = await supabaseAdmin
        .from("webauthn_credentials")
        .insert({
          operator_id,
          credential_id: credentialId,
          public_key: credential.response.attestationObject, // Store for verification
          counter: 0,
          device_name: device_name || "Biometria",
          tenant_id: tenantId,
        });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to save credential" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "auth-options") {
      const { operator_id } = body;

      // Get credentials for operator(s) in this tenant
      let query = supabaseAdmin
        .from("webauthn_credentials")
        .select("credential_id, operator_id")
        .eq("tenant_id", tenantId);

      if (operator_id) {
        query = query.eq("operator_id", operator_id);
      }

      const { data: creds } = await query;

      if (!creds || creds.length === 0) {
        return new Response(JSON.stringify({ error: "No biometric credentials registered" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const challenge = generateChallenge();
      const key = `auth_${tenantId}`;
      cleanChallenges();
      challenges.set(key, { challenge, ts: Date.now() });

      const options = {
        challenge,
        rpId,
        allowCredentials: creds.map((c: any) => ({
          id: c.credential_id,
          type: "public-key",
        })),
        userVerification: "required",
        timeout: 60000,
      };

      return new Response(JSON.stringify(options), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "auth-verify") {
      const { credential } = body;
      if (!credential) {
        return new Response(JSON.stringify({ error: "Missing credential" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const key = `auth_${tenantId}`;
      const stored = challenges.get(key);
      if (!stored) {
        return new Response(JSON.stringify({ error: "Challenge expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      challenges.delete(key);

      // Verify clientDataJSON
      const clientDataJSON = base64UrlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

      if (clientData.challenge !== stored.challenge) {
        return new Response(JSON.stringify({ error: "Challenge mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (clientData.type !== "webauthn.get") {
        return new Response(JSON.stringify({ error: "Invalid type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the credential in DB
      const { data: cred } = await supabaseAdmin
        .from("webauthn_credentials")
        .select("id, operator_id, counter")
        .eq("credential_id", credential.id)
        .eq("tenant_id", tenantId)
        .single();

      if (!cred) {
        return new Response(JSON.stringify({ valid: false, error: "Credential not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update counter
      await supabaseAdmin
        .from("webauthn_credentials")
        .update({ counter: (cred.counter || 0) + 1 })
        .eq("id", cred.id);

      // Get operator info
      const { data: operator } = await supabaseAdmin
        .from("operators")
        .select("id, nome, ativo, perm_abrir_caixa, perm_cancelar_item, perm_cancelar_cupom")
        .eq("id", cred.operator_id)
        .single();

      if (!operator || !operator.ativo) {
        return new Response(JSON.stringify({ valid: false, error: "Operator inactive" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        valid: true,
        operator: {
          id: operator.id,
          nome: operator.nome,
          permissions: {
            abrirCaixa: operator.perm_abrir_caixa,
            cancelarItem: operator.perm_cancelar_item,
            cancelarCupom: operator.perm_cancelar_cupom,
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
