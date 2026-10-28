import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminAuditPage } from "@/components/admin/audit-page"

export const metadata: Metadata = { title: "Admin audit log", robots: { index: false, follow: false } }

/** Admin audit log. Access is decided by the backend (RBAC); this page renders its answer. */
export default function AdminAuditRoute() {
  return (
    <Suspense fallback={null}>
      <AdminAuditPage />
    </Suspense>
  )
}
