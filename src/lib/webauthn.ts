import { supabase } from "@/integrations/supabase/client";

function getPermissionsPolicy(): { allowsFeature?: (feature: string) => boolean } | null {
  return ((document as any).permissionsPolicy || (document as any).featurePolicy || null) as {
    allowsFeature?: (feature: string) => boolean;
  } | null;
}

function isWebAuthnFeatureAllowed(feature: string): boolean {
  const policy = getPermissionsPolicy();
  if (!policy?.allowsFeature) return true;

  try {
    return policy.allowsFeature(feature);
  } catch {
    return true;
  }
}

function getWebAuthnContextError(mode: "create" | "get"): string | null {
  if (!window.isSecureContext) {
    return "A biometria exige conexão segura (HTTPS).";
  }

  if (!(navigator.credentials && window.PublicKeyCredential)) {
    return "Este dispositivo ou navegador não oferece suporte à biometria via WebAuthn.";
  }

  const feature = mode === "create" ? "publickey-credentials-create" : "publickey-credentials-get";
  if (!isWebAuthnFeatureAllowed(feature)) {
    return "A biometria está bloqueada dentro deste preview. Abra o app em uma aba própria ou publique o app para testar no Android.";
  }

  return null;
}

function getFriendlyWebAuthnError(err: any, mode: "create" | "get"): string {
  const rawMessage = err?.message || "";
  const actionText = mode === "create" ? "cadastrar" : "usar";

  if (
    rawMessage.includes("publickey-credentials-") &&
    rawMessage.includes("not enabled in this document")
  ) {
    return "A biometria está bloqueada dentro do preview do Lovable. Abra o app em uma aba própria ou publique o app para testar no Android.";
  }

  if (rawMessage.includes("Permissions Policy")) {
    return "A biometria foi bloqueada pela Permissions Policy do preview. Abra o app fora do editor para testar no Android.";
  }

  if (err?.name === "InvalidStateError") {
    return "Esta digital já está cadastrada neste dispositivo.";
  }

  if (err?.name === "SecurityError") {
    return "Erro de segurança: domínio inválido para WebAuthn.";
  }

  if (err?.name === "NotAllowedError") {
    return `A solicitação de biometria foi bloqueada ou cancelada pelo navegador. Se você estiver no preview do Lovable, abra o app fora do editor para ${actionText} a digital.`;
  }

  return rawMessage || "Erro inesperado";
}

// Check if WebAuthn is supported
export function isWebAuthnSupported(): boolean {
  return !!(navigator.credentials && window.PublicKeyCredential && window.isSecureContext);
}

// Check if platform authenticator (fingerprint/face) is available
export async function isPlatformAuthAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  if (!isWebAuthnFeatureAllowed("publickey-credentials-get")) return false;

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let str = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Register a new biometric credential for an operator
export async function registerBiometric(operatorId: string, deviceName?: string): Promise<{ success: boolean; error?: string }> {
  const contextError = getWebAuthnContextError("create");
  if (contextError) {
    return { success: false, error: contextError };
  }

  try {
    // 1. Get registration options from server
    const { data: options, error: optErr } = await supabase.functions.invoke("webauthn", {
      body: { action: "register-options", operator_id: operatorId },
    });

    if (optErr || !options?.challenge) {
      return { success: false, error: options?.error || "Erro ao obter opções de registro" };
    }

    // 2. Create credential using browser API
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64UrlToBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64UrlToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      authenticatorSelection: options.authenticatorSelection,
      timeout: options.timeout,
      attestation: options.attestation as AttestationConveyancePreference,
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: "Registro cancelado" };
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // 3. Send to server for verification
    const { data: result, error: verifyErr } = await supabase.functions.invoke("webauthn", {
      body: {
        action: "register-verify",
        operator_id: operatorId,
        device_name: deviceName || "Biometria",
        credential: {
          id: credential.id,
          rawId: bufferToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: bufferToBase64Url(response.attestationObject),
            clientDataJSON: bufferToBase64Url(response.clientDataJSON),
          },
        },
      },
    });

    if (verifyErr || !result?.success) {
      return { success: false, error: result?.error || "Erro ao registrar biometria" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[webauthn] register error:", err.name, err.message);
    return { success: false, error: getFriendlyWebAuthnError(err, "create") };
  }
}

// Authenticate using biometric
export async function authenticateBiometric(operatorId?: string): Promise<{
  valid: boolean;
  error?: string;
  operator?: { id: string; nome: string; permissions: { abrirCaixa: boolean; cancelarItem: boolean; cancelarCupom: boolean } };
}> {
  const contextError = getWebAuthnContextError("get");
  if (contextError) {
    return { valid: false, error: contextError };
  }

  try {
    // 1. Get auth options
    const { data: options, error: optErr } = await supabase.functions.invoke("webauthn", {
      body: { action: "auth-options", operator_id: operatorId },
    });

    if (optErr || !options?.challenge) {
      const errMsg = options?.error || (optErr as any)?.message || "";
      if (errMsg.includes("No biometric") || errMsg.includes("404")) {
        return { valid: false, error: "Nenhuma biometria cadastrada" };
      }
      return { valid: false, error: "Nenhuma biometria cadastrada" };
    }

    // 2. Get assertion from browser
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToBuffer(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials?.map((c: any) => ({
        id: base64UrlToBuffer(c.id),
        type: c.type as PublicKeyCredentialType,
      })),
      userVerification: options.userVerification as UserVerificationRequirement,
      timeout: options.timeout,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!assertion) {
      return { valid: false, error: "Autenticação cancelada" };
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    // 3. Verify on server
    const { data: result, error: verifyErr } = await supabase.functions.invoke("webauthn", {
      body: {
        action: "auth-verify",
        credential: {
          id: assertion.id,
          rawId: bufferToBase64Url(assertion.rawId),
          type: assertion.type,
          response: {
            authenticatorData: bufferToBase64Url(response.authenticatorData),
            clientDataJSON: bufferToBase64Url(response.clientDataJSON),
            signature: bufferToBase64Url(response.signature),
          },
        },
      },
    });

    if (verifyErr) {
      return { valid: false, error: "Erro de conexão" };
    }

    return result;
  } catch (err: any) {
    console.error("[webauthn] auth error:", err.name, err.message);
    return { valid: false, error: getFriendlyWebAuthnError(err, "get") };
  }
}
