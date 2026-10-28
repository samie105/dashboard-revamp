"use client"

/**
 * The admin console's own frame. /admin skips the app's frame
 * (components/layout-shell.tsx ADMIN_ROUTES), so none of the user product's
 * chrome shows here: no money actions, user rail, bottom bar or wallet
 * announcements. Desktop: a full-height sidebar (brand, sections, back to the
 * app, theme). Phones: a top bar with the same, and the sections as a strip.
 * Section links keep `?period=` so the chosen period follows the admin.
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Analytics01Icon, ArrowLeft01Icon, BankIcon, DashboardSquare01Icon, FileValidationIcon, UserGroupIcon, Wallet01Icon } from "@hugeicons/core-free-icons"

import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { href: "/admin", label: "Overview", icon: DashboardSquare01Icon },
  { href: "/admin/users", label: "Users", icon: UserGroupIcon },
  { href: "/admin/wallets", label: "Wallets", icon: Wallet01Icon },
  { href: "/admin/volume", label: "Volume", icon: Analytics01Icon },
  { href: "/admin/fiat", label: "Fiat", icon: BankIcon },
  { href: "/admin/audit", label: "Audit log", icon: FileValidationIcon },
] as const

function sectionActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
      <Image src="/worldstreet-logo/WorldStreet1.png" alt="" width={36} height={20} className="h-[18px] w-auto" priority />
      <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">WorldStreet</span>
      <span className="rounded-md border border-primary/30 bg-primary/[0.1] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-primary">Admin</span>
    </Link>
  )
}

const BACK_LINK = "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"

function SectionLinks({ layout }: { layout: "column" | "strip" }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const period = search.get("period")
  return (
    <ul className={cn(layout === "column" ? "flex flex-col gap-1" : "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1")}>
      {SECTIONS.map((s) => {
        const on = sectionActive(pathname, s.href)
        return (
          <li key={s.href} className="shrink-0">
            <Link
              href={period ? `${s.href}?period=${encodeURIComponent(period)}` : s.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                on ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={s.icon} className={cn("size-[18px]", on && "text-primary")} strokeWidth={1.8} />
              {s.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function AdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-foreground/[0.06] px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav aria-label="Admin sections" className="flex-1">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">Console</p>
          <React.Suspense fallback={null}>
            <SectionLinks layout="column" />
          </React.Suspense>
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-foreground/[0.06] pt-3">
          <Link href="/" className={BACK_LINK}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
            Back to app
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-foreground/[0.06] bg-background/90 px-4 pb-2 pt-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/" className={BACK_LINK} aria-label="Back to app">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">Back to app</span>
            </Link>
          </div>
        </div>
        <nav aria-label="Admin sections">
          <React.Suspense fallback={null}>
            <SectionLinks layout="strip" />
          </React.Suspense>
        </nav>
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-[1480px] flex-col gap-4 p-4 md:gap-5 md:p-6 lg:p-8">{children}</main>
    </div>
  )
}
