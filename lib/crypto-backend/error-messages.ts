import { CryptoBackendError } from "./errors"

export type CryptoErrorAction =
  | "retry" | "setup-wallet" | "unlock" | "refresh-session"
  | "new-intent" | "view-existing" | "pay-gas" | "none"

export type CryptoErrorDescription = {
  title: string
  message: string
  action: CryptoErrorAction
  requestId?: string
}

export function describeCryptoError(error: unknown): CryptoErrorDescription {
  // Node 21+ exposes a global `navigator` with `onLine` left `undefined` (not
  // `false`), so a bare `!navigator.onLine` would misfire outside a browser.
  // Only trust an explicit `false` as an "offline" signal.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { title: "You're offline", message: "Check your connection and try again.", action: "retry" }
  }
  if (error instanceof CryptoBackendError) {
    const requestId = error.requestId
    switch (error.code) {
      case "AUTH_REQUIRED":
      case "UNAUTHORIZED":
        return { title: "Session expired", message: "Your sign-in session needs a refresh.", action: "refresh-session", requestId }
      case "WALLET_NOT_FOUND":
        return { title: "No wallet yet", message: "Create your Worldstreet wallet to continue.", action: "setup-wallet", requestId }
      case "USER_VERIFICATION_REQUIRED":
        return { title: "Verification needed", message: "Unlock your wallet on this device (or complete recovery) to authorize this step.", action: "unlock", requestId }
      case "INSUFFICIENT_FUNDS": {
        const d = error.details as { available?: string; requested?: string } | undefined
        const extra = d?.available && d?.requested ? ` Available: ${d.available}. Requested: ${d.requested}.` : ""
        return { title: "Not enough funds", message: `The amount exceeds what this account can spend.${extra}`, action: "none", requestId }
      }
      case "SPONSORSHIP_UNAVAILABLE":
        return { title: "Fee sponsorship unavailable", message: "Worldstreet can't cover this network fee right now. You can pay the fee yourself instead.", action: "pay-gas", requestId }
      case "RPC_UNAVAILABLE":
        return { title: "Network provider unavailable", message: "The network isn't responding. Your data is unchanged — try again shortly.", action: "retry", requestId }
      case "INTENT_EXPIRED":
        return { title: "Quote expired", message: "This quote expired before signing. Request a fresh one — nothing was sent.", action: "new-intent", requestId }
      case "DUPLICATE_REQUEST":
        return { title: "Already in progress", message: "This request was already submitted — showing the existing operation.", action: "view-existing", requestId }
      case "PROXY_DISABLED":
        return { title: "Wallet service disabled", message: "The modern wallet is switched off right now. Try again later.", action: "none", requestId }
    }
    if (error.status === 429) return { title: "Too many requests", message: "Give it a moment, then try again.", action: "retry", requestId }
    if (error.status >= 500) return { title: "Wallet service issue", message: "The wallet service hit a problem. Try again shortly.", action: "retry", requestId }
    return { title: "Something went wrong", message: error.message, action: "retry", requestId }
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { title: "Cancelled", message: "The request was cancelled.", action: "none" }
  }
  return { title: "Something went wrong", message: error instanceof Error ? error.message : "Unexpected error.", action: "retry" }
}
