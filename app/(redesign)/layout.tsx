import { cn } from "@/lib/utils"
import { dashDisplay, dashSans } from "@/components/redesign/fonts"
import { DashboardFrame } from "@/components/redesign/shell"
import { PrivacyProvider } from "@/components/redesign/ui"

/**
 * The redesign's frame, mounted once for every page in this group.
 *
 * A route group's layout is NOT re-rendered when you navigate between its
 * pages — only the page slot swaps — so the top bar and the rail keep their
 * state (open menus, the drawer, the sliding active marker) and never flash.
 * That is the whole reason these previews live under app/(redesign)/; the
 * parentheses keep the group out of the URL.
 *
 * Every figure on these pages is invented and they are reachable without a
 * session, so each page carries a "Demo data" tag in its own heading.
 */
export default function RedesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn("dash-root ws-icon-mono", dashSans.variable, dashDisplay.variable)}
      style={{ "--font-display": "var(--font-dash-display)" } as React.CSSProperties}
    >
      <PrivacyProvider>
        <DashboardFrame>{children}</DashboardFrame>
      </PrivacyProvider>
    </div>
  )
}
