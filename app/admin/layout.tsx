import { DashScope } from "@/components/dash"
import { AdminAuthGate, AdminAuthProvider } from "@/components/admin/admin-auth"
import { AdminShell } from "@/components/admin/admin-shell"

/**
 * The admin console. It has its own frame (components/admin/admin-frame.tsx);
 * the app's frame is skipped for /admin in components/layout-shell.tsx.
 * Admin sessions are independent from customer Clerk sessions; the backend
 * still decides role/capability access on every request.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer">
      <AdminAuthProvider>
        <AdminAuthGate>
          <AdminShell>{children}</AdminShell>
        </AdminAuthGate>
      </AdminAuthProvider>
    </DashScope>
  )
}
