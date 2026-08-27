export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function randomBytes(length: number): Uint8Array {
  const output = new Uint8Array(length)
  crypto.getRandomValues(output)
  return output
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

export function toBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function fromBase64Url(value: string): Uint8Array {
  // Recovery secrets are normally unpadded base64url, but users commonly
  // paste padded base64, line-wrapped text, or a value with surrounding
  // whitespace. Normalize all accepted forms before decoding instead of
  // relying on a fixed `===` suffix (which rejects some valid lengths).
  const normalized = value.trim().replace(/\s+/g, "").replace(/=+$/g, "").replace(/-/g, "+").replace(/_/g, "/")
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+$/.test(normalized)) {
    throw new Error("Recovery secret is not valid base64url text")
  }

  const padding = "=".repeat((4 - (normalized.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(normalized + padding)
  } catch {
    throw new Error("Recovery secret is not valid base64url text")
  }

  const output = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index)
  return output
}

export function wipeBytes(value: Uint8Array | undefined) {
  if (value) value.fill(0)
}
