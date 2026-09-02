"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  ChartCandlestickIcon,
  Chart01Icon,
  Store01Icon,
  Book01Icon,
  UserGroup02Icon,
  Video01Icon,
  Brain01Icon,
  ArrowUpRight01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  DollarCircleIcon,
  EyeIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

/* ── Bottom nav ────────────────────────────────────────────────────────────
   Four destinations flanking the launcher. The centre slot is the WorldStreet
   mark — the one place in the bar that opens the wider ecosystem rather than
   going somewhere in this app. */
type BarItem = { label: string; href: string; icon: typeof Chart01Icon }

const BAR_LEFT: readonly BarItem[] = [
  { label: "Home", href: "/", icon: DashboardSquare01Icon },
  { label: "Trade", href: "/trade", icon: ChartCandlestickIcon },
]

/* Wallet was reachable only from the desktop sidebar, so on a phone
   /wallet/modern had no route to it at all — the self-custodial wallet, its
   addresses and its send flow were simply unreachable. It replaces Swap here:
   swapping is a thing you do WITH the wallet, and it keeps its own tab in the
   launcher and its own route. */
const BAR_RIGHT: readonly BarItem[] = [
  { label: "Portfolio", href: "/portfolio", icon: Chart01Icon },
  { label: "Wallet", href: "/wallet/modern", icon: Wallet01Icon },
]

/* ── Launcher contents — the Worldstreet ecosystem, and only that ──────────
   Dashboard sections (Assets, Markets, Settings, …) live in the sidebar and
   the bar; the W sheet is reserved for the family of apps. Mirrors the
   sidebar's Worldstreet group. */
interface EcosystemApp {
  name: string
  url: string
  icon: typeof Chart01Icon
}

const ECOSYSTEM_APPS: readonly EcosystemApp[] = [
  { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon },
  { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon },
  { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
  { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
  { name: "Forex", url: "https://portal.worldstreetgold.com", icon: DollarCircleIcon },
  { name: "Vision", url: "https://vision.worldstreetgold.com", icon: EyeIcon },
]

const LOGO_SRC = "/worldstreet-logo/WorldStreet1.png"

/* Entrance beats (ms): header first, then the grid deals out, Vivid lands
   last. Outro delays run the other way — the bottom leaves first, pouring
   out ahead of the glass — and every beat + its 180ms duration fits inside
   the popup's 300ms exit transition, which is what Base UI waits on. */
const beat = (inDelay: number, outDelay: number) =>
  ({
    "--ws-launch-delay": `${inDelay}ms`,
    "--ws-out-delay": `${outDelay}ms`,
  }) as React.CSSProperties

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)

  const closeMenu = React.useCallback(() => setMenuOpen(false), [])

  const renderBarItem = (item: BarItem) => {
    const active = isActivePath(pathname, item.href)
    return (
      <Link
        key={item.label}
        href={item.href}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 transition-all active:scale-95 motion-reduce:active:scale-100",
          active
            ? "bg-accent text-foreground shadow-sm ring-1 ring-foreground/[0.08]"
            : "text-muted-foreground",
        )}
      >
        <HugeiconsIcon icon={item.icon} className={cn("h-5 w-5", active && "text-primary")} />
        <span className="text-[10px] font-semibold leading-none">{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* ── Bottom Nav — a floating glass capsule, iOS-26 style: inset from
             the edges, content scrolls UNDER it, the active tab lives in a
             raised lozenge. ── */}
      <nav className="pointer-events-none fixed inset-x-4 bottom-3 z-50 md:hidden safe-area-bottom">
        <div className="ws-glass ws-glass-edge pointer-events-auto relative mx-auto flex max-w-sm items-center justify-between gap-0.5 rounded-full p-1.5 shadow-[0_18px_44px_-16px_rgb(0_0_0/0.65)] ring-1 ring-foreground/10">
          {BAR_LEFT.map(renderBarItem)}

          {/* ── The mark — the bar's anchor. Gold because it's the brand,
                 lit because it's open. ── */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  aria-label="Worldstreet apps"
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 transition-all active:scale-95 motion-reduce:active:scale-100",
                    menuOpen
                      ? "bg-primary/[0.14] text-foreground ring-1 ring-primary/25"
                      : "text-muted-foreground",
                  )}
                />
              }
            >
              {/* The W is a wide mark, so it gets a 24×20 box rather than the
                  20×20 the line icons sit in — that's what makes its optical
                  weight match theirs instead of reading as a smaller sibling. */}
              {/* Plain <img>, deliberately not next/image: a 24px static PNG
                  gains nothing from the optimizer, and the optimizer is one
                  more thing that can fail — which it did (the W vanished from
                  the bar while every line icon kept rendering). */}
              <span className="flex h-5 w-6 items-center justify-center">
                <img
                  src={LOGO_SRC}
                  alt=""
                  width={24}
                  height={11}
                  className={cn(
                    "h-auto w-6 object-contain transition-opacity",
                    menuOpen ? "opacity-100" : "opacity-90",
                  )}
                />
              </span>
              <span className="text-[10px] font-semibold leading-none">Apps</span>
            </SheetTrigger>

            {/* ── Launcher sheet — the Worldstreet ecosystem ── */}
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="gap-0 rounded-t-[26px] p-0 duration-[380ms]"
            >
              {/* The bloom — a gold wash lighting the sheet's crown as it
                  arrives. Atmosphere behind everything, never interactive. */}
              <div
                aria-hidden
                className="ws-launch-glow pointer-events-none absolute inset-x-0 top-0 h-44 rounded-t-[26px] bg-[radial-gradient(85%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_13%,transparent)_0%,transparent_72%)]"
              />

              {/* Grab handle */}
              <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-foreground/15" />

              {/* Header — the W lands with its rotational settle, the words
                  follow a beat behind. */}
              <div className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-4">
                <span className="ws-launch" style={beat(40, 120)}>
                  <img
                    src={LOGO_SRC}
                    alt=""
                    width={34}
                    height={16}
                    className="ws-badge-pop h-auto w-[34px] shrink-0 object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <SheetTitle
                    className="ws-launch font-display text-[16px] font-semibold tracking-[-0.01em]"
                    style={beat(90, 110)}
                  >
                    WorldStreet
                  </SheetTitle>
                  <SheetDescription
                    className="ws-launch text-[11px] leading-tight text-muted-foreground"
                    style={beat(130, 100)}
                  >
                    One account, every app
                  </SheetDescription>
                </div>
                <button
                  onClick={closeMenu}
                  aria-label="Close"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </button>
              </div>

              {/* The apps — six tiles dealing in top-to-bottom. All external:
                  each opens its corner of the ecosystem in a new tab. */}
              <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-3 gap-1.5">
                  {ECOSYSTEM_APPS.map((app, i) => (
                    <a
                      key={app.name}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={beat(170 + i * 45, 16 + (5 - i) * 14)}
                      className="ws-launch relative flex flex-col items-center gap-2 rounded-2xl bg-foreground/[0.04] px-1.5 py-3.5 transition-colors active:scale-[0.96] active:bg-foreground/[0.08] motion-reduce:active:scale-100"
                    >
                      <span className="flex size-11 items-center justify-center rounded-[14px] bg-foreground/[0.06] text-muted-foreground">
                        <HugeiconsIcon icon={app.icon} className="size-[21px]" />
                      </span>
                      <span className="text-center text-[11px] font-semibold leading-tight text-foreground/80">
                        {app.name}
                      </span>
                      <HugeiconsIcon
                        icon={ArrowUpRight01Icon}
                        className="absolute right-2 top-2 size-3 text-muted-foreground/40"
                      />
                    </a>
                  ))}
                </div>

                {/* Vivid — the one in-app door, so it closes the sheet instead
                    of opening a tab, and it gets the wide closing tile. */}
                <Link
                  href="/vivid"
                  onClick={closeMenu}
                  style={beat(450, 0)}
                  className={cn(
                    "ws-launch mt-1.5 flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 transition-colors active:scale-[0.98] motion-reduce:active:scale-100",
                    isActivePath(pathname, "/vivid")
                      ? "bg-primary/[0.12] ring-primary/25"
                      : "bg-primary/[0.06] ring-primary/15 active:bg-primary/[0.1]",
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/[0.16] text-primary">
                    <HugeiconsIcon icon={Brain01Icon} className="size-[21px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-tight text-foreground">
                      Vivid AI
                    </span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      AI-powered insights
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 shrink-0 text-primary/70"
                  />
                </Link>
              </div>
            </SheetContent>
          </Sheet>

          {BAR_RIGHT.map(renderBarItem)}
        </div>
      </nav>
    </>
  )
}
