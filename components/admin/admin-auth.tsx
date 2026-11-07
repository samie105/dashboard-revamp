"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { ADMIN_DATA_IS_MOCK } from "@/lib/admin/source"
import { isAdminPublicPath } from "@/lib/admin/session-constants"
import type { AdminRole } from "@/lib/admin/types"

export type AdminAuthUser = {
  adminId: string
  email: string
  role: AdminRole | string
  label: string
  capabilities: string[]
}

type AdminAuthContextValue = {
  admin: AdminAuthUser | null
  isLoading: boolean
  error: string | null
  requestAccessLink: (email: string) => Promise<void>
  consumeAccessToken: (token: string) => Promise<AdminAuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AdminAuthContext = React.createContext<AdminAuthContextValue | null>(null)

const MOCK_ADMIN: AdminAuthUser = {
  adminId: "dev-admin",
  email: "admin@localhost",
  role: "super_admin",
  label: "admin@localhost",
  capabilities: ["admin:read", "admin:read_sensitive", "admin:finance", "admin:operations", "admin:reconcile", "admin:manage_roles"],
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({})) as Record<string, unknown>
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  const error = body.error
  if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") return (error as Record<string, string>).message
  return fallback
}

function adminFromBody(body: Record<string, unknown>): AdminAuthUser {
  const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {}
  const value = data.admin && typeof data.admin === "object" ? data.admin as Record<string, unknown> : {}
  return {
    adminId: typeof value.adminId === "string" ? value.adminId : "",
    email: typeof value.email === "string" ? value.email : "",
    role: typeof value.role === "string" ? value.role : "viewer",
    label: typeof value.label === "string" ? value.label : typeof value.email === "string" ? value.email : "Admin",
    capabilities: Array.isArray(value.capabilities) ? value.capabilities.filter((item): item is string => typeof item === "string") : [],
  }
}

export function useAdminAuth(): AdminAuthContextValue {
  const value = React.useContext(AdminAuthContext)
  if (!value) throw new Error("useAdminAuth must be used inside AdminAuthProvider")
  return value
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [admin, setAdmin] = React.useState<AdminAuthUser | null>(ADMIN_DATA_IS_MOCK ? MOCK_ADMIN : null)
  const [isLoading, setIsLoading] = React.useState(!ADMIN_DATA_IS_MOCK)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (ADMIN_DATA_IS_MOCK) {
      setAdmin(MOCK_ADMIN)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/auth/me", { cache: "no-store", credentials: "same-origin" })
      const body = await readResponse(response)
      if (!response.ok) {
        setAdmin(null)
        if (response.status !== 401) setError(errorMessage(body, "The admin session could not be checked."))
        else setError(null)
        return
      }
      setAdmin(adminFromBody(body))
      setError(null)
    } catch {
      setAdmin(null)
      setError("The admin service could not be reached.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // The accept page is exchanging a one-time token. Avoid racing that
    // exchange with a pre-existing /me request that would briefly clear the
    // newly created session.
    if (pathname === "/admin/accept") {
      setIsLoading(false)
      return
    }
    void refresh()
  }, [pathname, refresh])

  const requestAccessLink = React.useCallback(async (email: string) => {
    const response = await fetch("/api/admin/auth/request-link", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email }),
    })
    const body = await readResponse(response)
    if (!response.ok) throw new Error(errorMessage(body, "The access link could not be requested."))
  }, [])

  const consumeAccessToken = React.useCallback(async (token: string) => {
    const response = await fetch("/api/admin/auth/consume", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ token }),
    })
    const body = await readResponse(response)
    if (!response.ok) throw new Error(errorMessage(body, "This admin link is invalid or expired."))
    const nextAdmin = adminFromBody(body)
    if (!nextAdmin.adminId) throw new Error("The admin session response was invalid.")
    setAdmin(nextAdmin)
    setError(null)
    return nextAdmin
  }, [])

  const logout = React.useCallback(async () => {
    if (!ADMIN_DATA_IS_MOCK) {
      await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined)
    }
    setAdmin(null)
  }, [])

  const value = React.useMemo(() => ({ admin, isLoading, error, requestAccessLink, consumeAccessToken, logout, refresh }), [admin, isLoading, error, requestAccessLink, consumeAccessToken, logout, refresh])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { admin, isLoading, error, refresh } = useAdminAuth()
  const publicPath = isAdminPublicPath(pathname)

  React.useEffect(() => {
    if (!publicPath && !isLoading && !admin) {
      router.replace(`/admin/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [admin, isLoading, pathname, publicPath, router])

  if (publicPath || ADMIN_DATA_IS_MOCK) return <>{children}</>
  if (isLoading) {
    return <AuthLoadingState label="Checking admin session…" />
  }
  if (error && !admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-display text-2xl font-semibold">Admin session unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={() => void refresh()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>
        </div>
      </div>
    )
  }
  if (!admin) return <AuthLoadingState label="Redirecting to admin sign-in…" />
  return <>{children}</>
}

function AuthLoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 size-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

