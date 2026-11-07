"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useAdminAuth } from "@/components/admin/admin-auth"

export function AdminAcceptPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { consumeAccessToken } = useAdminAuth()
  const [state, setState] = React.useState<"loading" | "error">("loading")
  const [error, setError] = React.useState<string | null>(null)
  const consumed = React.useRef(false)
  const token = params.get("token")

  React.useEffect(() => {
    if (consumed.current) return
    consumed.current = true
    if (!token) {
      setState("error")
      setError("This admin link is missing its token.")
      return
    }
    // Remove the one-time credential from the visible URL and browser history
    // before exchanging it with the backend.
    window.history.replaceState(null, "", "/admin/accept")
    void consumeAccessToken(token)
      .then(() => router.replace("/admin"))
      .catch((reason) => {
        setState("error")
        setError(reason instanceof Error ? reason.message : "This admin link is invalid or expired.")
      })
  }, [consumeAccessToken, router, token])

  if (state === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 size-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none" />
          <p className="text-sm text-muted-foreground">Verifying your admin link…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Admin link unavailable</h1>
        <p className="text-sm leading-6 text-muted-foreground">{error}</p>
        <a href="/admin/login" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Request another link</a>
      </div>
    </main>
  )
}

