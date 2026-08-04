import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProduction = process.env.NODE_ENV === "production"
const LOGIN_URL = isProduction
  ? "https://www.worldstreetgold.com/login"
  : "/login"

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/register(.*)",
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

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook routes (called by external services)
  if (isWebhookRoute(req)) {
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

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
