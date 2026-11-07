import * as React from "react"

import { AdminAcceptPage } from "@/components/admin/admin-accept-page"

export default function AdminAcceptRoute() {
  return (
    <React.Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-background p-6"><p className="text-sm text-muted-foreground">Verifying your admin link…</p></main>}>
      <AdminAcceptPage />
    </React.Suspense>
  )
}

