"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

const PUBLIC_ROUTES = ["/login", "/register"]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to login when auth resolves with no session
  React.useEffect(() => {
    if (isLoaded && !isSignedIn && !PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
      router.replace("/login")
    }
  }, [isLoaded, isSignedIn, pathname, router])

  // Public routes bypass the gate entirely
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>
  }

  // Clerk still loading — silent background check
  if (!isLoaded) return null

  // Clerk loaded but no session — silent redirect
  if (!isSignedIn) return null

  return <>{children}</>
}
