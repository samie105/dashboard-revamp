import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminFiatPage } from "@/components/admin/fiat-page"

export const metadata: Metadata = { title: "Admin fiat", robots: { index: false, follow: false } }

/** Admin fiat. Access is decided by the backend (RBAC); this page renders its answer. */
export default function AdminFiatRoute() {
  return (
    <Suspense fallback={null}>
      <AdminFiatPage />
    </Suspense>
  )
}
