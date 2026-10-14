import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import {
  DASHBOARD_TEST_SESSION_COOKIE,
  verifyDashboardTestSession,
} from "@/lib/dashboard-test-auth"
import { SERVER_DASHBOARD_TEST_MODE } from "@/lib/dashboard-test-mode"

const isProduction = process.env.NODE_ENV === "production"
const LOGIN_URL = isProduction
  ? "https://www.worldstreetgold.com/login"
  : "/login"

// Routes that don't require authentication.
//
// The *-unauth routes are DESIGN PREVIEWS: redesigned
// screens rendered entirely from the dummy data under components/*-unauth/.
// They touch no wallet, no ledger and no market feed, so there is nothing
// behind them to protect, and they are deliberately reachable without a
// session so the layouts can be reviewed and shared. Both are noindex'd (see
// each page's metadata). AuthGate carries matching entries — the two lists
// have to agree, or the middleware waves the request through and the gate
// then bounces it to /login on the client.
const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/register(.*)",
  "/dashboard-unauth",
  "/wallet-unauth",
  "/transactions-unauth",
  "/markets-unauth",
  "/trade-unauth",
  "/swap-unauth",
  "/bridge-unauth",
  "/buy-unauth",
  "/sell-unauth",
  "/settings-unauth",
  // (.*) because this preview has sub-routes — /create and /[launchId].
  "/launchpad-unauth(.*)",
])

// The crypto backend's health/readiness probes are public by design. They are
// used by local smoke tests and platform checks; wallet and security routes
// remain protected by the API branch below.
const isCryptoHealthRoute = createRouteMatcher([
  "/api/crypto/health",
  "/api/crypto/ready",
])

// Everything under /api (webhooks excepted, below) is authenticated and answers
// in JSON. It is matched as one prefix rather than an endpoint-by-endpoint list
// because the list has to stay in sync with FORWARDED in
// app/api/[...path]/route.ts, and a path missing from it doesn't fail loudly —
// it falls through to the page branch and hands fetch() an HTML login page.
const isApiRoute = createRouteMatcher(["/api/(.*)"])

// Webhook/cron routes that should NOT require auth (called by external services)
const isWebhookRoute = createRouteMatcher([
  "/api/webhooks(.*)",
])

const isDashboardTestLogin = createRouteMatcher(["/test/login"])
const isDashboardTestSessionApi = createRouteMatcher(["/api/test/session"])

async function dashboardTestMiddleware(req: NextRequest) {
  // This function is only selected when the deployment has explicitly opted
  // into the dashboard-test host. The access key itself is never sent to
  // Clerk or to the crypto backend; only the fixed dummy bearer token is.
  if (isDashboardTestLogin(req) || isDashboardTestSessionApi(req)) {
    return NextResponse.next()
  }

  // Keep the design previews shareable on the test host. Normal dashboard
  // routes below still require the scoped HTTP-only test session.
  if (isPublicRoute(req) && !req.nextUrl.pathname.startsWith("/login") && !req.nextUrl.pathname.startsWith("/register")) {
    return NextResponse.next()
  }

  if (req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/test/login", req.url))
  }

  const secret = process.env.WORLDSTREET_DASHBOARD_TEST_AUTH_SECRET
  const session = req.cookies.get(DASHBOARD_TEST_SESSION_COOKIE)?.value
  const valid = await verifyDashboardTestSession(session, secret)
  if (valid) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Dashboard test session required" } },
      { status: 401 },
    )
  }

  const login = new URL("/test/login", req.url)
  login.searchParams.set("returnTo", `${req.nextUrl.pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(login)
}

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook routes (called by external services)
  if (isWebhookRoute(req)) {
    return NextResponse.next()
  }

  if (isCryptoHealthRoute(req)) {
    return NextResponse.next()
  }

  // API before pages. An expired session on /api/* has to come back as a JSON
  // 401 the client can recognise: fetch() follows a redirect, so answering with
  // one returns the login page's HTML under a 200, which every JSON caller
  // parses into null and then dereferences. The redirect branch below is for
  // navigations only.
  if (isApiRoute(req)) {
    try {
      await auth.protect()
    } catch {
      if (req.nextUrl.pathname.startsWith("/api/crypto/")) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
          { status: 401 },
        )
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (!isPublicRoute(req)) {
    try {
      await auth.protect()
    } catch {
      // Token invalid/expired/missing → redirect to login
      if (isProduction) {
        return NextResponse.redirect(LOGIN_URL)
      }
      return NextResponse.redirect(new URL(LOGIN_URL, req.url))
    }
  }
})

// Under the dev bypass, clerkMiddleware() must never wrap the request: with a
// domain-locked production key it dead-ends every route at /login before the
// handler's own checks could run. Every request waves through — the mocked
// server seams answer downstream. (Inert outside development builds.)
export default SERVER_DASHBOARD_TEST_MODE
  ? dashboardTestMiddleware
  : DEV_AUTH_BYPASS
    ? () => NextResponse.next()
    : clerkAuthMiddleware

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
