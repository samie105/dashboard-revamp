"use client"

/**
 * The admin dashboard's shared pieces, in the redesign's language
 * (components/dash): the section tabs, the period picker, a stat tile with
 * its own skeleton, and one panel per non-figure state, so every admin screen
 * draws loading, refused, not connected, failed, empty and quiet periods the
 * same way.
 *
 * Access is the backend's call (RBAC): these screens only render what it
 * answers. A 403 shows "no access"; nothing here checks a role.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Chip, EmptyPanel, ErrorPanel, Panel, PillTabs, SkeletonBlock, StatePanel, UnavailableState } from "@/components/dash"
import { ADMIN_DATA_IS_MOCK } from "@/lib/admin/source"
import type { AdminPeriod } from "@/lib/admin/types"
import { PERIOD_OPTIONS, periodLong, type AdminViewState } from "@/lib/admin/view"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/wallets", label: "Wallets" },
] as const

/** Page title, the section tabs, and the "Demo data" tag while figures are mocked. */
export function AdminHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-4 px-1">
      <nav aria-label="Admin sections" className="flex items-center gap-1">
        {SECTIONS.map((s) => {
          const on = s.href === "/admin" ? pathname === "/admin" : pathname === s.href || pathname.startsWith(`${s.href}/`)
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                on ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">{title}</h1>
            {ADMIN_DATA_IS_MOCK && <Chip>Demo data</Chip>}
          </div>
          <p className="text-[14px] text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
    </div>
  )
}

export function PeriodTabs({ value, onChange }: { value: AdminPeriod; onChange: (period: AdminPeriod) => void }) {
  return <PillTabs label="Period" options={PERIOD_OPTIONS} value={value} onChange={onChange} />
}

/** One headline figure. `value` null draws its skeleton; `dim` while a new period loads. */
export function StatTile({ label, value, sub, dim = false }: { label: string; value: React.ReactNode | null; sub?: React.ReactNode; dim?: boolean }) {
  return (
    <Panel className={cn("flex min-w-0 flex-col gap-2 p-5 transition-opacity", dim && "opacity-55")} aria-busy={value === null || dim}>
      <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
      {value === null ? (
        <>
          <SkeletonBlock className="h-8 w-32" />
          <SkeletonBlock className="h-3 w-24" />
        </>
      ) : (
        <>
          <p className="truncate font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">{value}</p>
          {sub && <p className="truncate text-[12px] text-muted-foreground">{sub}</p>}
        </>
      )}
    </Panel>
  )
}

/**
 * The panel for every state that isn't figures. `subject` names what's
 * missing ("users", "wallets"); `onRetry` refetches.
 */
export function AdminStatePanel({ state, period, subject, onRetry }: { state: AdminViewState; period: AdminPeriod; subject: string; onRetry: () => void }) {
  switch (state.kind) {
    case "forbidden":
      return <StatePanel tone="warning" title="You don't have access to this" description="Your account doesn't have an admin role for this page. Ask an administrator if you need it." />
    case "signed-out":
      return <StatePanel tone="warning" title="Sign in again" description="Your session has ended. Sign in again to see admin data." />
    case "unavailable":
      return <UnavailableState title="Admin data isn't connected yet" description="These figures will appear once the admin service is wired up." />
    case "error":
      return <ErrorPanel title="Couldn't load admin data" message="Something went wrong on our side. Try again in a moment." onRetry={onRetry} reference={state.requestId} />
    case "empty":
      return <EmptyPanel title={`No ${subject} yet`} description={`Once people sign up, ${subject} will show here.`} />
    case "no-data":
      return <EmptyPanel title="No activity in this period" description={`Nothing happened in ${periodLong(period)}. Try a longer period.`} />
    default:
      return null
  }
}

/** States that replace the figures entirely (rather than sitting beside them). */
export function blocksFigures(state: AdminViewState): boolean {
  return state.kind === "forbidden" || state.kind === "signed-out" || state.kind === "unavailable" || state.kind === "error" || state.kind === "empty"
}

export const ADMIN_PAGE = "ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6"
