import { auth } from "@clerk/nextjs/server"

/**
 * Proxy to worldstreet-crypto.
 *
 * The dashboard's crypto backend is moving to the standalone worldstreet-crypto
 * service (see plans/crypto-service-migration.md). This route forwards
 * allowlisted /api/* paths there, swapping the browser's Clerk session cookie
 * for the bearer token the service expects.
 *
 * Why a proxy rather than calling the service from the browser: it keeps the
 * cutover reversible one endpoint at a time, avoids a CORS surface, and means
 * ~50 existing fetch call sites don't change. Flattening to direct calls is a
 * later, optional step.
 *
 * HOW A CUTOVER WORKS
 * A specific route (app/api/wallet/balances/route.ts) takes precedence over
 * this catch-all, so migrating an endpoint is: add its prefix to FORWARDED,
 * delete the local route directory. Rolling back is restoring the directory.
 *
 * The allowlist is what makes that safe. Without it every unmatched /api/*
 * path would silently proxy — including webhook routes, which would get a 401
 * here (no Clerk session) instead of a 404, and read to the caller as a
 * retriable auth blip rather than "this endpoint is gone".
 *
 * It also makes a broken precedence assumption loud instead of silent: if
 * specific routes ever stopped winning, un-migrated paths would land here,
 * fail the allowlist check, and 404 visibly — rather than being quietly
 * forwarded to a service that may not implement them.
 */

const CRYPTO_API = process.env.CRYPTO_API_URL

/**
 * Paths (after `/api/`) served by worldstreet-crypto.
 *
 * A trailing slash means "this prefix and everything under it"; anything else
 * must match exactly. Exact-by-default matters — a bare "swap" prefix would
 * also capture a future "swap-history", forwarding a route nobody migrated.
 *
 * Add an entry in the same change that deletes the local route, never before:
 * an entry whose local route still exists does nothing (the specific route
 * wins), which reads as "migrated" in review when it isn't.
 */
const FORWARDED = [
  // No local route, and never had one — assets-client has been calling these
  // all along, so custom-token add was simply broken on web.
  "tokens/",

  // Verified line-for-line ports of the deleted local routes.
  "wallet/balances",
  "transactions/unified",
  "wallet-transfers",
  "swap",

  // Mobile-parity surfaces (the service is the only implementation).
  "prices",
  "trade/",
  "trading/spot/",
  "trading-wallet/",
  "agent/",
  "buy",
  "buy/",
  "sell",
  "sell/",

  // Privy wallet lifecycle. Zero callers in the dashboard — the frontend never
  // used them; wallets are provisioned server-side.
  "privy/get-wallet",
  "privy/get-wallet-by-clerk",
  "privy/onboarding",
  "privy/pregenerate-wallet",
  "privy/link-clerk",
  "privy/refresh-wallet",
  "privy/add-wallet-signer",

  // Sends. The service replaced the dashboard's per-chain /send routes with
  // one generic native send plus explicit per-chain token routes.
  "privy/wallet/send",
  "privy/wallet/solana/send-token",
  "privy/wallet/ethereum/send-token",
  "privy/wallet/tron/send-token",
]

function isForwarded(path: string): boolean {
  return FORWARDED.some((entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry,
  )
}

// worldstreet-wallet service (Dollar Account). The dashboard shows the user's
// USD balance as the Cash row, exactly like mobile's crypto home. Mobile calls
// the wallet service directly from the client; here the same read goes through
// this proxy so no CORS coordination is needed. Read-only by design — funding
// the Dollar Account happens on the Worldstreet home, not this dashboard.
const WALLET_API = process.env.WALLET_API_URL

async function forwardDollarBalances(userId: string, token: string) {
  if (!WALLET_API) {
    console.error("[crypto-proxy] WALLET_API_URL is not set — cannot fetch dollar balances")
    return Response.json({ error: "Wallet service is not configured" }, { status: 503 })
  }
  try {
    const res = await fetch(`${WALLET_API}/v1/wallet/${encodeURIComponent(userId)}/balances`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    })
  } catch (error) {
    console.error("[crypto-proxy] dollar balances failed:", error)
    return Response.json({ error: "Wallet service unreachable" }, { status: 502 })
  }
}

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  const path = segments.join("/")

  const isDollarBalances = path === "dollar/balances" && req.method === "GET"

  if (!isForwarded(path) && !isDollarBalances) {
    return new Response(null, { status: 404 })
  }

  if (isDollarBalances) {
    const { userId, getToken } = await auth()
    const token = await getToken()
    if (!userId || !token) return Response.json({ error: "Unauthorized" }, { status: 401 })
    return forwardDollarBalances(userId, token)
  }

  if (!CRYPTO_API) {
    console.error("[crypto-proxy] CRYPTO_API_URL is not set — cannot forward", path)
    return Response.json({ error: "Crypto service is not configured" }, { status: 503 })
  }

  const { getToken } = await auth()
  const token = await getToken()
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { search } = new URL(req.url)
  const hasBody = req.method !== "GET" && req.method !== "HEAD"

  let upstream: Response
  try {
    upstream = await fetch(`${CRYPTO_API}/api/${path}${search}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": req.headers.get("content-type") ?? "application/json",
      },
      body: hasBody ? await req.text() : undefined,
    })
  } catch (error) {
    console.error(`[crypto-proxy] ${req.method} ${path} failed:`, error)
    return Response.json({ error: "Crypto service unreachable" }, { status: 502 })
  }

  // Pass the upstream content-type through rather than forcing JSON, so a
  // streaming or non-JSON endpoint isn't silently corrupted later.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  })
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
}
