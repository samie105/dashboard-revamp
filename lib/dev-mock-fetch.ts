/**
 * Dev-only: answers the crypto client from the mock backend running IN THE
 * BROWSER, instead of over a fetch to the proxy route.
 *
 * Part of the dev bypasses (see lib/dev-auth-bypass.ts) and, like them, lives
 * only on the preview/demo branches. Never merge them.
 *
 * ── Why the network hop had to go ──────────────────────────────────────────
 * The mock is stateful, and the proxy route runs on a serverless function
 * once the demo is deployed. Function instances are recycled between requests,
 * so the wallet created by one call routinely no longer existed by the next.
 * Setup is the worst case: nine round trips, with the browser spending seconds
 * between them generating five keys and running a 600k-iteration derivation.
 * The ceremony died at "Setting up your accounts" with "create the wallet
 * first" — the instance holding the wallet was simply gone.
 *
 * Answering in the browser makes that failure structurally impossible: there
 * is one copy of the state, in the tab that is using it, and it outlives every
 * request because it never leaves the page. It also means two people opening
 * the demo link get their own independent wallet rather than fighting over one
 * server's, which is what you want from a shared demo anyway.
 *
 * The mock module is untouched by this: it already speaks in `Request` and
 * `Response`, both of which are browser types, and never reads the URL beyond
 * the path. So the same dispatcher serves both callers.
 */

import {
  devMockCryptoApiResponse,
  persistMockCryptoState,
  resetMockCryptoState,
} from "./dev-mock-crypto-backend"

/** Mirrors the proxy route's prefix — everything after it is the mock path. */
const PROXY_PREFIX = "/api/crypto/"

export const devMockFetch: typeof fetch = async (input, init) => {
  const request = new Request(input as RequestInfo, init)
  // Relative URLs are the norm here; `new Request` has already resolved them
  // against the document, so pathname is always populated.
  const { pathname } = new URL(request.url)

  if (!pathname.startsWith(PROXY_PREFIX)) {
    return fetch(input as RequestInfo, init)
  }

  const path = pathname.slice(PROXY_PREFIX.length)
  const response = await devMockCryptoApiResponse(request, path)

  // Persist AFTER the handler, so whatever it mutated is what gets written.
  // Cheap enough to do unconditionally: the payload is a few KB and this runs
  // once per API call, not per frame.
  persistMockCryptoState()

  // A null response means the mock doesn't implement this path. Answering 404
  // matches what the proxy route does with an unlisted path, so the client's
  // error handling is identical in both places.
  return response ?? new Response(null, { status: 404 })
}

/**
 * Re-running the ceremony needs a way back to "no wallet yet", and the old one
 * no longer reaches: `GET /api/crypto/dev/reset` in the address bar hits the
 * SERVER copy of the mock, which is not the copy the page is talking to any
 * more. The wallet lives in this tab, so the reset has to be callable from it.
 *
 *   __wsResetWallet()   in the console — wipes the mock and the cached
 *                       encrypted package, then reloads.
 */
if (typeof window !== "undefined") {
  ;(window as typeof window & { __wsResetWallet?: () => void }).__wsResetWallet = () => {
    resetMockCryptoState()
    // The browser's own copy of the encrypted package outlives the mock, and a
    // leftover one would have the app holding a wallet the backend forgot.
    indexedDB?.deleteDatabase("worldstreet-crypto-wallet")
    window.location.reload()
  }
}
