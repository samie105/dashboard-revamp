import type {
  PasskeyAuthenticationOptions,
  PasskeyRegistrationOptions,
} from "@/lib/crypto-backend"

import { fromBase64Url, toBase64Url } from "./encoding"
import { PASSKEY_PRF_SALT } from "./package-crypto"

type JsonCredentialOptions = Record<string, unknown>

export type SerializedPasskey = {
  response: Record<string, unknown>
  prfOutput?: Uint8Array
}

export type AuthenticatorAssertionFlags = {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backupState: boolean
}

function bytesFromJson(value: unknown) {
  if (typeof value !== "string") throw new Error("WebAuthn option is missing a base64url byte value")
  return fromBase64Url(value)
}

function serializeValue(value: unknown): unknown {
  if (value instanceof ArrayBuffer) return toBase64Url(value)
  if (ArrayBuffer.isView(value)) {
    return toBase64Url(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
  }
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serializeValue(child)]))
  }
  return value
}

function publicKeyOptions(options: JsonCredentialOptions, mode: "registration" | "authentication") {
  const publicKey: JsonCredentialOptions = {
    ...options,
    challenge: bytesFromJson(options.challenge),
    extensions: {
      ...(options.extensions as Record<string, unknown> | undefined),
      // This is an optional WebAuthn extension request. It never replaces the
      // authenticator assertion or gets sent as a signing key.
      prf: { eval: { first: PASSKEY_PRF_SALT } },
    },
  }

  if (mode === "registration") {
    const user = options.user as Record<string, unknown>
    publicKey.user = { ...user, id: bytesFromJson(user.id) }
    if (Array.isArray(options.excludeCredentials)) {
      publicKey.excludeCredentials = options.excludeCredentials.map((credential) => ({
        ...(credential as Record<string, unknown>),
        id: bytesFromJson((credential as Record<string, unknown>).id),
      }))
    }
  } else if (Array.isArray(options.allowCredentials)) {
    publicKey.allowCredentials = options.allowCredentials.map((credential) => ({
      ...(credential as Record<string, unknown>),
      id: bytesFromJson((credential as Record<string, unknown>).id),
    }))
  }

  return publicKey as unknown as PublicKeyCredentialCreationOptions & PublicKeyCredentialRequestOptions
}

function requirePublicKeyCredential(credential: Credential | null): PublicKeyCredential {
  if (!credential || !("response" in credential)) throw new Error("The passkey ceremony was cancelled")
  return credential as PublicKeyCredential
}

function extractPrfOutput(extensionResults: unknown): Uint8Array | undefined {
  if (!extensionResults || typeof extensionResults !== "object") return undefined
  const prf = (extensionResults as { prf?: { results?: { first?: unknown } } }).prf
  if (!prf?.results?.first || typeof prf.results.first !== "string") return undefined
  return fromBase64Url(prf.results.first)
}

export function readAuthenticatorAssertionFlags(response: Record<string, unknown>): AuthenticatorAssertionFlags | undefined {
  const authenticatorData = (response.response as Record<string, unknown> | undefined)?.authenticatorData
  if (typeof authenticatorData !== "string") return undefined

  try {
    const bytes = fromBase64Url(authenticatorData)
    if (bytes.length < 33) return undefined
    const flags = bytes[32] ?? 0
    return {
      userPresent: Boolean(flags & 0x01),
      userVerified: Boolean(flags & 0x04),
      backupEligible: Boolean(flags & 0x08),
      backupState: Boolean(flags & 0x10),
    }
  } catch {
    return undefined
  }
}

function serializeRegistrationCredential(credential: PublicKeyCredential): SerializedPasskey {
  const response = credential.response as AuthenticatorAttestationResponse
  const extensionResults = serializeValue(credential.getClientExtensionResults())
  return {
    response: {
      id: credential.id,
      rawId: toBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(response.clientDataJSON),
        attestationObject: toBase64Url(response.attestationObject),
        transports: typeof response.getTransports === "function" ? response.getTransports() : undefined,
      },
      clientExtensionResults: extensionResults,
    },
    prfOutput: extractPrfOutput(extensionResults),
  }
}

function serializeAuthenticationCredential(credential: PublicKeyCredential): SerializedPasskey {
  const response = credential.response as AuthenticatorAssertionResponse
  const extensionResults = serializeValue(credential.getClientExtensionResults())
  return {
    response: {
      id: credential.id,
      rawId: toBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.authenticatorData),
        signature: toBase64Url(response.signature),
        userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
      },
      clientExtensionResults: extensionResults,
    },
    prfOutput: extractPrfOutput(extensionResults),
  }
}

export async function createPasskeyCredential(options: PasskeyRegistrationOptions): Promise<SerializedPasskey> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkeys are not supported in this browser")
  }
  const credential = await navigator.credentials.create({
    publicKey: publicKeyOptions(options.options, "registration"),
  })
  return serializeRegistrationCredential(requirePublicKeyCredential(credential))
}

export async function getPasskeyAssertion(options: PasskeyAuthenticationOptions): Promise<SerializedPasskey> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkeys are not supported in this browser")
  }
  const credential = await navigator.credentials.get({
    publicKey: publicKeyOptions(options.options, "authentication"),
  })
  return serializeAuthenticationCredential(requirePublicKeyCredential(credential))
}
