import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminVolumePage } from "@/components/admin/volume-page"

export const metadata: Metadata = { title: "Admin volume", robots: { index: false, follow: false } }

/** Admin volume. Access is decided by the backend (RBAC); this page renders its answer. */
export default function AdminVolumeRoute() {
  return (
    <Suspense fallback={null}>
      <AdminVolumePage />
    </Suspense>
  )
}
