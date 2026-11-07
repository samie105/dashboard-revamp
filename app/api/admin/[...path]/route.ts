import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isCryptoProxyEnabled } from "@/lib/crypto-backend/config"
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session-constants"

const CRYPTO_API = process.env.CRYPTO_API_URL?.replace(/\/+$/, "")
const PROXY_TIMEOUT_MS = 15_000

// Admin forwarding is intentionally separate from the customer proxy. The
// backend URL and opaque session never enter browser JavaScript, and every
// path remains explicitly allowlisted.
const ALLOWED_PATHS: Record<string, RegExp[]> = {
  GET: [
    /^auth\/me$/,
    /^overview$/,
    /^users$/,
    /^users\/[A-Za-z0-9_-]+$/,
    /^wallets$/,
    /^wallets\/[A-Za-z0-9_-]+$/,
    /^wallets\/[A-Za-z0-9_-]+\/balances$/,
    /^balances\/summary$/,
    /^transactions$/,
    /^transactions\/[A-Za-z0-9_-]+$/,
    /^volume$/,
    /^fiat$/,
    /^fiat\/orders$/,
    /^fiat\/orders\/[A-Za-z0-9_-]+$/,
    /^providers\/health$/,
    /^audit$/,
    /^controls$/,
    /^jobs\/[A-Za-z0-9_-]+$/,
    /^admins$/,
  ],
  POST: [
    /^auth\/request-link$/,
    /^auth\/consume$/,
    /^auth\/logout$/,
    /^audit\/client-events$/,
    /^jobs\/balance-reconciliation$/,
    /^jobs\/[A-Za-z0-9_-]+\/cancel$/,
    /^transactions\/[A-Za-z0-9_-]+\/reconcile$/,
    /^admins\/invitations$/,
    /^admins\/[A-Za-z0-9_-]+\/revoke$/,
  ],
  PATCH: [
    /^admins\/[A-Za-z0-9_-]+$/,
  ],
  PUT: [
    /^controls\/(wallet_operations|launchpad_solana|launchpad_ethereum|launchpad_intertrain)$/,
  ],
}

const PUBLIC_ADMIN_AUTH_PATHS = new Set(["auth/request-link", "auth/consume"])

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

function isAllowed(method: string, path: string) {
  return (ALLOWED_PATHS[method] ?? []).some((pattern) => pattern.test(path))
}

function responseHeaders(upstream: Response) {
  const headers = new Headers()
  for (const name of ["content-type", "x-request-id", "retry-after", "etag"]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

const FORWARDED_HEADERS = ["content-type", "accept", "idempotency-key", "if-match", "x-request-id"]

async function sessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
}

function cookieOptions(expiresAt?: string) {
  const parsed = expiresAt ? Date.parse(expiresAt) : Number.NaN
  const maxAge = Number.isFinite(parsed) ? Math.max(60, Math.floor((parsed - Date.now()) / 1_000)) : 8 * 60 * 60
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }
}

function withClearedCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 })
  return response
}

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/")

  if (!isAllowed(req.method, path)) return new Response(null, { status: 404 })
  if (!isCryptoProxyEnabled) return jsonError("Crypto backend proxy is disabled", 404, "CRYPTO_PROXY_DISABLED")
  if (!CRYPTO_API) return jsonError("Crypto service is not configured", 503, "CRYPTO_SERVICE_UNCONFIGURED")

  const token = await sessionCookie()
  if (!PUBLIC_ADMIN_AUTH_PATHS.has(path) && !token) return jsonError("Admin session required", 401, "UNAUTHORIZED")

  const upstreamHeaders = new Headers({
    accept: req.headers.get("accept") ?? "application/json",
  })
  if (token) upstreamHeaders.set("authorization", `Bearer ${token}`)
  for (const header of FORWARDED_HEADERS) {
    const value = req.headers.get(header)
    if (value && header !== "accept") upstreamHeaders.set(header, value)
  }

  const { search } = new URL(req.url)
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  let upstream: Response
  try {
    upstream = await fetch(`${CRYPTO_API}/v1/admin/${path}${search}`, {
      method: req.method,
      headers: upstreamHeaders,
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
  } catch {
    return jsonError("Crypto service unreachable", 502, "CRYPTO_SERVICE_UNREACHABLE")
  }

  // The consume response is the only place where the backend returns the
  // opaque session. Store it in a cookie and remove it from the browser body.
  if (path === "auth/consume") {
    const body = await upstream.json().catch(() => ({})) as Record<string, unknown>
    const data = body.data && typeof body.data === "object" ? { ...(body.data as Record<string, unknown>) } : {}
    const sessionToken = typeof data.sessionToken === "string" ? data.sessionToken : undefined
    const expiresAt = typeof data.expiresAt === "string" ? data.expiresAt : undefined
    delete data.sessionToken
    const response = NextResponse.json({ ...body, data }, { status: upstream.status, headers: responseHeaders(upstream) })
    if (upstream.ok && sessionToken) response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, cookieOptions(expiresAt))
    return response
  }

  const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders(upstream) })
  if (path === "auth/logout" || upstream.status === 401) return withClearedCookie(response)
  return response
}

export { forward as GET, forward as PATCH, forward as POST, forward as PUT }

