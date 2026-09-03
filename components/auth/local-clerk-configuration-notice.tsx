"use client"

import { useSyncExternalStore } from "react"

import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"

export function LocalClerkConfigurationNotice() {
  const isLocalhost = useSyncExternalStore(
    () => () => undefined,
    () => ["localhost", "127.0.0.1"].includes(window.location.hostname),
    () => false,
  )
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
  const isProductionKey = publishableKey.startsWith("pk_live_")
  const isMissingKey = publishableKey.length === 0

  // Under the dev bypass Clerk is deliberately not mounted, so the key being
  // production-only is expected — the notice would only mislead.
  if (DEV_AUTH_BYPASS) return null
  if (!isLocalhost || (!isProductionKey && !isMissingKey)) return null

  return (
    <div className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-2xl rounded-lg border border-amber-500/50 bg-amber-950/95 p-4 text-sm text-amber-50 shadow-2xl">
      <p className="font-semibold">Local Clerk login is not configured</p>
      <p className="mt-1 text-amber-100/80">
        {isProductionKey
          ? "This localhost session is using a Clerk production key. Clerk production keys only work on worldstreetgold.com."
          : "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing, so Clerk cannot mount the login form."}
      </p>
      <p className="mt-2 text-amber-100/80">Set a Clerk development `pk_test_…` key in `.env.local`, restart `pnpm dev`, then open `/login` again.</p>
    </div>
  )
}
