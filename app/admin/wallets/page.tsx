import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminWalletsPage } from "@/components/admin/wallets-page"

export const metadata: Metadata = { title: "Admin wallets", robots: { index: false, follow: false } }

/** Admin wallets. Access is decided by the backend (RBAC); this page renders its answer. */
export default function AdminWalletsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminWalletsPage />
    </Suspense>
  )
}
