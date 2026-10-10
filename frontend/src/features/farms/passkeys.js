// Passkey (WebAuthn) ceremonies. The phone's fingerprint or screen lock
// unlocks a key that never leaves the device; no SMS or password is needed.
import { farmApi } from "./api";

const toBuffer = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)).buffer;
};

const toBase64url = (buffer) => {
  let binary = "";
  for (const byte of new Uint8Array(buffer))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const passkeysSupported = () =>
  typeof window !== "undefined" &&
  Boolean(window.PublicKeyCredential && navigator.credentials?.create);

export async function platformAuthenticatorAvailable() {
  if (!passkeysSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function creationOptions(options) {
  return {
    ...options,
    challenge: toBuffer(options.challenge),
    user: { ...options.user, id: toBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((item) => ({
      ...item,
      id: toBuffer(item.id),
    })),
  };
}

function requestOptions(options) {
  return {
    ...options,
    challenge: toBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((item) => ({
      ...item,
      id: toBuffer(item.id),
    })),
  };
}

function serialize(credential) {
  const response = credential.response;
  const json = {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
    response: { clientDataJSON: toBase64url(response.clientDataJSON) },
  };
  if (response.attestationObject) {
    json.response.attestationObject = toBase64url(response.attestationObject);
    json.response.transports = response.getTransports?.() || [];
  } else {
    json.response.authenticatorData = toBase64url(response.authenticatorData);
    json.response.signature = toBase64url(response.signature);
    json.response.userHandle = response.userHandle
      ? toBase64url(response.userHandle)
      : null;
  }
  return json;
}

function explain(error) {
  if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
    const problem = new Error(
      "Fingerprint or screen lock was cancelled or timed out. Try again.",
    );
    problem.cancelled = true;
    return problem;
  }
  if (error?.name === "InvalidStateError")
    return new Error("This phone is already registered for this account.");
  if (error?.name === "SecurityError")
    return new Error(
      "Passkeys need a secure connection to this exact web address.",
    );
  return error;
}

async function create(options) {
  try {
    return serialize(
      await navigator.credentials.create({
        publicKey: creationOptions(options),
      }),
    );
  } catch (error) {
    throw explain(error);
  }
}

async function get(options) {
  try {
    return serialize(
      await navigator.credentials.get({ publicKey: requestOptions(options) }),
    );
  } catch (error) {
    throw explain(error);
  }
}

const deviceLabel = () => {
  const agent = navigator.userAgent || "";
  if (/Android/i.test(agent)) return "Android phone";
  if (/iPhone|iPad/i.test(agent)) return "iPhone";
  if (/Windows/i.test(agent)) return "Windows computer";
  if (/Macintosh/i.test(agent)) return "Mac";
  return "This device";
};

export async function createAccount({ displayName, contactMobile, language }) {
  const start = await farmApi("/auth/passkey/register/options", {
    method: "POST",
    body: {
      display_name: displayName,
      contact_mobile: contactMobile || null,
      preferred_language: language || "en",
      accept_policy_version: "2026-10-03",
    },
  });
  const credential = await create(start.options);
  return farmApi("/auth/passkey/register/verify", {
    method: "POST",
    body: {
      challenge_id: start.challenge_id,
      credential,
      device_label: deviceLabel(),
    },
  });
}

export async function signInWithPasskey() {
  const start = await farmApi("/auth/passkey/login/options", {
    method: "POST",
    body: {},
  });
  const credential = await get(start.options);
  return farmApi("/auth/passkey/login/verify", {
    method: "POST",
    body: { challenge_id: start.challenge_id, credential },
  });
}

export const recoverAccount = (code) =>
  farmApi("/auth/recovery", { method: "POST", body: { code } });

export const listDevices = () => farmApi("/me/passkeys");

export async function addThisDevice() {
  const start = await farmApi("/me/passkeys/options", {
    method: "POST",
    body: {},
  });
  const credential = await create(start.options);
  return farmApi("/me/passkeys/verify", {
    method: "POST",
    body: {
      challenge_id: start.challenge_id,
      credential,
      device_label: deviceLabel(),
    },
  });
}

export const removeDevice = (id) =>
  farmApi(`/me/passkeys/${id}`, { method: "DELETE" });

export const newRecoveryCode = () =>
  farmApi("/me/recovery-code", { method: "POST", body: {} });
