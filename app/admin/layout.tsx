import { DashScope } from "@/components/dash"
import { AdminFrame } from "@/components/admin/admin-frame"

/**
 * The admin console. It has its own frame (components/admin/admin-frame.tsx);
 * the app's frame is skipped for /admin in components/layout-shell.tsx. Who
 * may see these pages is decided by the backend (RBAC); every page renders
 * its answer, including "no access".
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer">
      <AdminFrame>{children}</AdminFrame>
    </DashScope>
  )
}
