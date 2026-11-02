import { auth } from "@clerk/nextjs/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { DASHBOARD_TEST_USER, SERVER_DASHBOARD_TEST_MODE } from "@/lib/dashboard-test-mode"
import { isAllowedCopyRoute } from "@/lib/copy-trading/proxy-routes"

/**
 * Proxy to the isolated copy-trading service (worldstreet-copy-trading).
 *
 * The service trusts a shared bearer token plus an `x-user-id` header, so this
 * route is the only place that header is ever set: from the Clerk session, never
 * from anything the browser sent. Only the allowlisted dashboard surface is
 * forwarded; the service's `internal/*` ingestion endpoints are unreachable.
 */
const BASE = process.env.COPY_TRADING_API_URL
const TOKEN = process.env.COPY_TRADING_SERVICE_TOKEN

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  const path = segments.join("/")
  if (!isAllowedCopyRoute(req.method, path)) return new Response(null, { status: 404 })

  const userId = DEV_AUTH_BYPASS || SERVER_DASHBOARD_TEST_MODE ? DASHBOARD_TEST_USER.userId : (await auth()).userId
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (!BASE || !TOKEN) {
    console.error("[copy-trading-proxy] COPY_TRADING_API_URL / COPY_TRADING_SERVICE_TOKEN not set")
    return Response.json({ error: "Copy trading is not configured" }, { status: 503 })
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE"
  let upstream: Response
  try {
    upstream = await fetch(`${BASE}/${path}${new URL(req.url).search}`, {
      method: req.method,
      headers: { Authorization: `Bearer ${TOKEN}`, "x-user-id": userId, "Content-Type": "application/json" },
      body: hasBody ? await req.text() : undefined,
    })
  } catch (error) {
    console.error(`[copy-trading-proxy] ${req.method} ${path} failed:`, error)
    return Response.json({ error: "Copy trading is unreachable" }, { status: 502 })
  }
  return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" } })
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE }
