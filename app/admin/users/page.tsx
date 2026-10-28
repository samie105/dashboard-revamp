import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminUsersPage } from "@/components/admin/users-page"

export const metadata: Metadata = { title: "Admin users", robots: { index: false, follow: false } }

/** Admin users. Access is decided by the backend (RBAC); this page renders its answer. */
export default function AdminUsersRoute() {
  return (
    <Suspense fallback={null}>
      <AdminUsersPage />
    </Suspense>
  )
}
