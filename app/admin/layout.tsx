import { Suspense } from "react"

import { DashScope } from "@/components/dash"
import { AdminNav } from "@/components/admin/admin-kit"

/**
 * The admin console frame: its own section sidebar (from lg; a strip above
 * the page on smaller screens) inside the app's usual frame. Who may see
 * these pages is decided by the backend (RBAC); every page renders its
 * answer, including "no access".
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto grid w-full max-w-[1720px] grid-cols-1 gap-4 p-4 md:gap-5 md:p-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">{children}</div>
    </DashScope>
  )
}
