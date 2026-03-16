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

// API routes that require authentication
const isProtectedApi = createRouteMatcher([
  "/api/profile(.*)",
  "/api/wallet(.*)",
  "/api/trades(.*)",
  "/api/swap(.*)",
  "/api/p2p(.*)",
  "/api/admin(.*)",
  "/api/deposit(.*)",
  "/api/withdraw(.*)",
])

// Webhook routes that should NOT require auth (called by external services)
const isWebhookRoute = createRouteMatcher([
  "/api/webhooks(.*)",
  "/api/deposit/webhook",
])

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook routes (called by external services)
  if (isWebhookRoute(req)) {
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

  if (isProtectedApi(req)) {
    try {
      await auth.protect()
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
