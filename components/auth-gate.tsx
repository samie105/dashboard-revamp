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

  // Public routes bypass the gate entirely
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
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

  // Clerk loaded but no session → hard redirect to login
  if (!isSignedIn) {
    if (typeof window !== "undefined") {
      window.location.href = LOGIN_URL
    }
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
