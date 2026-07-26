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
 * Path prefixes (after `/api/`) served by worldstreet-crypto.
 *
 * Add a prefix here in the same change that deletes the local route, never
 * before — an entry whose local route still exists does nothing, which reads
 * as "migrated" in review when it isn't.
 *
 * `tokens/` has no local route at all: components/assets/assets-client.tsx
 * calls /api/tokens/metadata and /api/tokens/custom, which only ever existed
 * on the service. Custom-token add has been broken on web; forwarding it is
 * a pure fix with no endpoint to regress.
 */
const FORWARDED = ["tokens/"]

function isForwarded(path: string): boolean {
  return FORWARDED.some((prefix) => path === prefix || path.startsWith(prefix))
}

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  const path = segments.join("/")

  if (!isForwarded(path)) {
    return new Response(null, { status: 404 })
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
