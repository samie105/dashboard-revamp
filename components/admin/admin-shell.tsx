"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { AdminFrame } from "@/components/admin/admin-frame"
import { isAdminPublicPath } from "@/lib/admin/session-constants"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return isAdminPublicPath(pathname) ? <>{children}</> : <AdminFrame>{children}</AdminFrame>
}

