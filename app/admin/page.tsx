import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminOverviewPage } from "@/components/admin/overview-page"

export const metadata: Metadata = { title: "Admin overview", robots: { index: false, follow: false } }

/**
 * Admin overview. Who may see it is decided by the backend (RBAC); this page
 * renders the backend's answer, including "no access".
 */
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminOverviewPage />
    </Suspense>
  )
}
