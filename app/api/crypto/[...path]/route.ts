import { auth } from "@clerk/nextjs/server"
import { isCryptoProxyEnabled } from "@/lib/crypto-backend/config"

const CRYPTO_API = process.env.CRYPTO_API_URL?.replace(/\/+$/, "")
const PROXY_TIMEOUT_MS = 15_000

const ALLOWED_PATHS: Record<string, RegExp[]> = {
  GET: [
    /^auth\/me$/,
    /^wallets\/me$/,
    /^networks$/,
    /^wallets\/me\/package$/,
    /^recovery\/status$/,
    /^devices$/,
    /^transactions$/,
    /^transactions\/intents\/[^/]+$/,
    /^transactions\/[^/]+$/,
    /^wallets\/me\/accounts\/[^/]+\/balances$/,
    /^wallets\/me\/balances$/,
    /^wallets\/me\/sessions$/,
    /^sponsorship\/config$/,
    /^sponsorship\/operations\/[^/]+$/,
    /^trading\/spot\/markets$/,
    /^trading\/spot\/lifi\/quote$/,
    /^trading\/hyperliquid\/markets$/,
    /^trading\/hyperliquid\/account$/,
    /^trading\/hyperliquid\/intents\/[^/]+$/,
    /^bridge\/intertrain\/usdc\/status$/,
  ],
  POST: [
    /^wallets$/,
    /^wallets\/me\/accounts\/prepare$/,
    /^wallets\/me\/authorize$/,
    /^wallets\/me\/authorize\/recovery\/start$/,
    /^wallets\/me\/authorize\/recovery$/,
    /^wallets\/me\/package$/,
    /^wallets\/me\/rotate$/,
    /^passkeys\/registration\/options$/,
    /^passkeys\/registration\/verify$/,
    /^passkeys\/authentication\/options$/,
    /^passkeys\/authentication\/verify$/,
    /^recovery\/start$/,
    /^recovery\/complete$/,
    /^devices\/enrollment\/start$/,
    /^devices\/enrollment\/complete$/,
    /^devices\/[^/]+\/revoke$/,
    /^wallets\/me\/sessions$/,
    /^wallets\/me\/sessions\/[^/]+\/revoke$/,
    /^wallets\/me\/sessions\/revoke-all$/,
    /^transactions\/intents$/,
    /^transactions\/intents\/[^/]+\/simulate$/,
    /^transactions\/intents\/[^/]+\/submit$/,
    /^sponsorship\/quote$/,
    /^sponsorship\/operations\/[^/]+\/prepare$/,
    /^sponsorship\/operations\/[^/]+\/submit$/,
    /^trading\/spot\/evm\/intents$/,
    /^trading\/spot\/solana\/intents$/,
    /^trading\/spot\/lifi\/intents$/,
    /^trading\/hyperliquid\/deposit\/intents$/,
    /^trading\/hyperliquid\/intents$/,
    /^trading\/hyperliquid\/intents\/[^/]+\/submit$/,
    /^bridge\/intertrain\/usdc\/intents$/,
  ],
}

const FORWARDED_HEADERS = [
  "content-type",
  "accept",
  "idempotency-key",
  "x-request-id",
  // WebAuthn uses the browser origin to select a valid relying-party ID.
  // Keep it intact when the dashboard proxies passkey ceremonies upstream.
  "origin",
  "x-wallet-authorization",
  "x-wallet-session-token",
]

function jsonError(message: string, status: number, code: string) {
  return Response.json({ success: false, error: { code, message } }, { status })
}

function isAllowed(method: string, path: string) {
  return (ALLOWED_PATHS[method] ?? []).some((pattern) => pattern.test(path))
}

function responseHeaders(upstream: Response) {
  const headers = new Headers()
  const contentType = upstream.headers.get("content-type")
  const requestId = upstream.headers.get("x-request-id")
  const retryAfter = upstream.headers.get("retry-after")

  if (contentType) headers.set("content-type", contentType)
  if (requestId) headers.set("x-request-id", requestId)
  if (retryAfter) headers.set("retry-after", retryAfter)
  return headers
}

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/")

  if (!isCryptoProxyEnabled) {
    return jsonError("Crypto backend proxy is disabled", 404, "CRYPTO_PROXY_DISABLED")
  }

  // Health is deliberately public so Docker, local scripts, and load balancers
  // can verify the service without manufacturing a Clerk session.
  if (req.method === "GET" && (path === "health" || path === "ready")) {
    if (!CRYPTO_API) return jsonError("Crypto service is not configured", 503, "CRYPTO_SERVICE_UNCONFIGURED")

    try {
      const upstream = await fetch(`${CRYPTO_API}/${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      })
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders(upstream),
      })
    } catch {
      return jsonError("Crypto service unreachable", 502, "CRYPTO_SERVICE_UNREACHABLE")
    }
  }

  if (!isAllowed(req.method, path)) {
    return new Response(null, { status: 404 })
  }

  if (!CRYPTO_API) {
    return jsonError("Crypto service is not configured", 503, "CRYPTO_SERVICE_UNCONFIGURED")
  }

  const token = await (await auth()).getToken()
  if (!token) return jsonError("Unauthorized", 401, "UNAUTHORIZED")

  const upstreamHeaders = new Headers({
    authorization: `Bearer ${token}`,
    accept: req.headers.get("accept") ?? "application/json",
  })

  for (const header of FORWARDED_HEADERS) {
    const value = req.headers.get(header)
    if (value && header !== "accept") upstreamHeaders.set(header, value)
  }

  const { search } = new URL(req.url)
  const hasBody = req.method !== "GET" && req.method !== "HEAD"

  try {
    const upstream = await fetch(`${CRYPTO_API}/v1/${path}${search}`, {
      method: req.method,
      headers: upstreamHeaders,
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream),
    })
  } catch {
    return jsonError("Crypto service unreachable", 502, "CRYPTO_SERVICE_UNREACHABLE")
  }
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
}
