"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

const PUBLIC_ROUTES = ["/login", "/register"]
const LOGIN_URL =
  process.env.NODE_ENV === "production"
    ? "https://www.worldstreetgold.com/login"
    : "/login"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  /* Hooks before early returns, always: three of the four branches below
     return before this point, so an effect placed lower would run on some
     renders and not others. */
  React.useEffect(() => {
    if (!isPublic && isLoaded && !isSignedIn) window.location.href = LOGIN_URL
  }, [isPublic, isLoaded, isSignedIn])

  // Public routes bypass the gate entirely
  if (isPublic) {
    return <>{children}</>
  }

  // Clerk still loading — show loading state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center animate-in fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Verifying identity...</p>
        </div>
      </div>
    )
  }

  // Clerk loaded but no session → hard redirect to login.
  //
  // The assignment used to happen inline in the render body, which is a side
  // effect during render: React is free to render a component twice, or to
  // start a render and throw it away, so a navigation fired from there can
  // double-fire or never fire at all. In an effect it happens exactly once,
  // after the "Redirecting…" frame the user actually sees.
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center animate-in fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
