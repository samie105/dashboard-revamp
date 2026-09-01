/**
 * Functions rather than constants so Next's build-time env inlining and
 * vitest's env stubbing both work. NEXT_PUBLIC_* only — this module is
 * imported from client components.
 */
export function cryptoBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CRYPTO_BACKEND_URL ||
    "https://crypto-backend.worldstreetgold.com"
  )
}

export function selfCustodyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SELF_CUSTODY_ENABLED === "1"
}
