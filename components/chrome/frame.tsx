"use client"

/**
 * The app's chrome: a top bar across the page and a rail down the left, the
 * redesign's frame (components/redesign/shell.tsx) on the real app.
 *
 * Copied from the preview's markup, with what the port rules require:
 *  · Real destinations only. Every route the old sidebar offered keeps a
 *    place (Portfolio, Buy / Sell Crypto, the ecosystem links, Vivid AI with
 *    its live dot). Rows with no page yet LIST but do not link ("Soon"), as
 *    the old sidebar did; none points at "#".
 *  · Real behaviour kept: Deposit / Withdraw open the wallet's own receive and
 *    send dialogs; the wallet and notifications popovers are the old navbar's
 *    (NavbarActions); the crypto total comes from usePortfolioTotal; sign-out
 *    is the real one; hovering Trade still warms the spot registry.
 *  · Nothing the preview invented: no UID, no "Unverified" badge, no card /
 *    Visa / Dollar Account buy methods, no "40×" or "4 resting".
 *  · Surfaces on tokens (.ds-topbar / .ds-rail, foreground alphas) instead of
 *    the preview's hard-coded near-black; the redesign's fonts are scoped to
 *    the chrome itself.
 *
 * Layout by width (the preview's): ≥1280 full rail (264px) + full top bar;
 * 1024+ icon rail (84px); <1024 no rail, a menu button opens it as a drawer
 * (the phone also keeps the app's bottom bar).
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Book01Icon,
  Brain01Icon,
  Cancel01Icon,
  ChartBarLineIcon,
  ChartCandlestickIcon,
  ChartLineData02Icon,
  ChartUpIcon,
  CheckmarkBadge01Icon,
  Coins01Icon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  Download04Icon,
  Exchange01Icon,
  EyeIcon,
  GameController01Icon,
  GiftIcon,
  HelpCircleIcon,
  Invoice03Icon,
  LinkSquare02Icon,
  Logout01Icon,
  Menu01Icon,
  PercentCircleIcon,
  RepeatIcon,
  Rocket01Icon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  SourceCodeIcon,
  Store01Icon,
  Upload04Icon,
  UserGroup02Icon,
  UserIcon,
  UserSwitchIcon,
  Video01Icon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons"
import { useVividOptional } from "@worldstreet/vivid-voice"

import { useAuth } from "@/components/auth-provider"
import { useDisplayName } from "@/hooks/useDisplayName"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { SendModal } from "@/components/crypto/SendModal"
import { NavbarActions } from "@/components/navbar-actions"
import { dashDisplay, dashSans } from "@/components/redesign/fonts"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { usePortfolioTotal } from "@/hooks/usePortfolioTotal"
import { getPrices } from "@/lib/actions"
import { prefetchSpotMarkets } from "@/lib/spot-markets"
import { cn } from "@/lib/utils"

type IconSvg = React.ComponentProps<typeof HugeiconsIcon>["icon"]

function Icon({ icon, className, strokeWidth = 1.7 }: { icon: IconSvg; className?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} className={cn("size-[18px] shrink-0", className)} />
}

/** The same spring the preview uses for every sliding indicator. */
const SLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const

/** The redesign's type, scoped to the chrome (the pages keep their own). */
const CHROME_FONTS = cn("dash-scope ws-icon-mono", dashSans.variable, dashDisplay.variable)
const CHROME_FONT_STYLE = { "--font-display": "var(--font-dash-display)" } as React.CSSProperties

const VERIFICATION_URL = "https://www.worldstreetgold.com/verification"

/* ── Navigation model ───────────────────────────────────────────────────── */

type WalletDialog = "receive" | "send"

type RailItem = {
  name: string
  icon: IconSvg
  /** A page in this app, or an external property (opens in a new tab). */
  href?: string
  /** Opens one of the wallet's own dialogs instead of navigating. */
  dialog?: WalletDialog
  /** No page yet: listed, not linked. */
  soon?: boolean
  chevron?: boolean
}
type RailGroup = {
  label?: string
  items: RailItem[]
  /** Left out of the phone drawer (below 768px); tablets and desktop keep it. */
  hideOnPhones?: boolean
}

const isExternal = (href: string) => /^https?:\/\//.test(href)

const RAIL: RailGroup[] = [
  {
    items: [
      { name: "Dashboard", href: "/", icon: DashboardSquare01Icon },
      { name: "Markets", href: "/trading/markets", icon: ChartBarLineIcon },
      { name: "Trade", href: "/trade", icon: Exchange01Icon, chevron: true },
      { name: "Futures", href: "/trade?market=futures", icon: ChartLineData02Icon, chevron: true },
      { name: "Swap", href: "/swap", icon: RepeatIcon },
      { name: "Bridge", href: "/bridge", icon: ArrowLeftRightIcon },
      { name: "Earn", icon: Coins01Icon, soon: true },
      { name: "Copy Trading", icon: UserSwitchIcon, soon: true },
      { name: "Launchpad", href: "/launchpad", icon: Rocket01Icon },
      { name: "Rewards", icon: GiftIcon, soon: true },
      { name: "Analytics", icon: Analytics01Icon, soon: true },
    ],
  },
  {
    label: "Wallet",
    items: [
      { name: "Wallet", href: "/wallet/modern", icon: Wallet02Icon },
      { name: "Portfolio", href: "/portfolio", icon: ChartCandlestickIcon },
      { name: "Transactions", href: "/transactions", icon: Invoice03Icon },
    ],
  },
  {
    label: "Fiat",
    items: [
      { name: "Buy Crypto", href: "/buy", icon: ArrowDownLeft01Icon },
      { name: "Sell Crypto", href: "/sell", icon: ArrowUpRight01Icon },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Verification", href: VERIFICATION_URL, icon: CheckmarkBadge01Icon },
      { name: "Settings", href: "/settings", icon: Settings01Icon },
      { name: "API Management", icon: SourceCodeIcon, soon: true },
      { name: "Help Center", icon: HelpCircleIcon, soon: true },
    ],
  },
  {
    // Other Worldstreet properties: the old sidebar's ecosystem rail.
    label: "Ecosystem",
    hideOnPhones: true,
    items: [
      { name: "Store", href: "https://shop.worldstreetgold.com", icon: Store01Icon },
      { name: "Academy", href: "https://academy.worldstreetgold.com", icon: Book01Icon },
      { name: "Social", href: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
      { name: "Xstream", href: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
      { name: "Forex Trading", href: "https://portal.worldstreetgold.com", icon: DollarCircleIcon },
      { name: "Vivid AI", href: "/vivid", icon: Brain01Icon },
      { name: "Vision", href: "https://vision.worldstreetgold.com", icon: EyeIcon },
      { name: "Arcade", href: "https://arcade.worldstreetgold.com", icon: GameController01Icon },
      { name: "Prediction", href: "https://prediction.worldstreetgold.com", icon: ChartUpIcon },
    ],
  },
]

type MenuEntry = { name: string; hint: string; href?: string; icon: IconSvg; soon?: boolean }
type TopItem = { name: string; href?: string; soon?: boolean; menu?: MenuEntry[] }

const TOP_NAV: TopItem[] = [
  { name: "Exchange", href: "/" },
  {
    name: "Trade",
    menu: [
      { name: "Spot", hint: "Buy and sell at market or limit", href: "/trade", icon: Exchange01Icon },
      { name: "Futures", hint: "Perpetual futures", href: "/trade?market=futures", icon: ChartLineData02Icon },
      { name: "Swap", hint: "Exchange one coin for another", href: "/swap", icon: ArrowLeftRightIcon },
      { name: "Copy Trading", hint: "Mirror proven traders", icon: UserSwitchIcon, soon: true },
    ],
  },
  { name: "Markets", href: "/trading/markets" },
  { name: "Earn", soon: true },
  {
    name: "Buy Crypto",
    menu: [
      { name: "Buy crypto", hint: "Pay in local currency or USD", href: "/buy", icon: ArrowDownLeft01Icon },
      { name: "Sell crypto", hint: "Cash out to local currency or USD", href: "/sell", icon: Upload04Icon },
    ],
  },
  {
    name: "More",
    menu: [
      { name: "Buy crypto", hint: "Pay in local currency or USD", href: "/buy", icon: ArrowDownLeft01Icon },
      { name: "Sell crypto", hint: "Cash out to local currency or USD", href: "/sell", icon: Upload04Icon },
      { name: "Launchpad", hint: "Discover and launch new tokens", href: "/launchpad", icon: Rocket01Icon },
      { name: "Bridge", hint: "Move assets across chains", href: "/bridge", icon: Activity01Icon },
      { name: "Rewards", hint: "Tasks, bonuses and airdrops", icon: GiftIcon, soon: true },
      { name: "Fees", hint: "Your tier and discounts", icon: PercentCircleIcon, soon: true },
    ],
  },
]

const ASSETS_MENU: MenuEntry[] = [
  { name: "Overview", hint: "Everything you hold", href: "/wallet/modern", icon: Wallet02Icon },
  { name: "Portfolio", hint: "How your holdings split", href: "/portfolio", icon: ChartCandlestickIcon },
  { name: "Transfer", hint: "Spot ⇄ Futures, on the trade page", href: "/trade", icon: ArrowLeftRightIcon },
]

const ORDERS_MENU: MenuEntry[] = [
  { name: "Open orders", hint: "On the trade page", href: "/trade", icon: Invoice03Icon },
  { name: "Transactions", hint: "Deposits, sends and swaps", href: "/transactions", icon: ArrowLeftRightIcon },
]

/** The old sidebar's route matching: a query-string row (Futures) points at a
 *  page another row owns, so it never lights by path alone. */
function isActiveRoute(pathname: string, href: string | undefined) {
  if (!href || isExternal(href)) return false
  if (href === "/") return pathname === "/"
  const [path, query] = href.split("?")
  if (query) return false
  return pathname === path || pathname.startsWith(`${path}/`)
}

/* ── Dropdown behaviour (the preview's useHoverMenu, unchanged) ───────────
   Opens on hover with a short grace period on leave, and on click for
   keyboards and touch. Hover is MOUSE-only. */

function useHoverMenu() {
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  const wrap = React.useRef<HTMLDivElement>(null)
  const hoverOpened = React.useRef(false)
  const pathname = usePathname()

  React.useEffect(() => setOpen(false), [pathname])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  const wrapProps = {
    ref: wrap,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return
      window.clearTimeout(timer.current)
      setOpen((was) => {
        if (!was) hoverOpened.current = true
        return true
      })
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setOpen(false), 140)
    },
  }

  const toggle = () => {
    if (hoverOpened.current) {
      hoverOpened.current = false
      setOpen(true)
      return
    }
    setOpen((v) => !v)
  }

  React.useEffect(() => {
    if (!open) hoverOpened.current = false
  }, [open])

  return { open, setOpen, toggle, wrapProps }
}

function MenuPanel({ align, className, children }: { align: "left" | "right"; className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "absolute top-[calc(100%+8px)] z-50 origin-top rounded-2xl border border-foreground/[0.08] bg-popover/95 p-1.5 text-popover-foreground shadow-[0_24px_60px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl dark:shadow-[0_24px_60px_-12px_rgb(0_0_0/0.8)]",
        align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

function SoonChip() {
  return (
    <span className="shrink-0 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
      Soon
    </span>
  )
}

function NavMenu({
  label,
  entries,
  align = "left",
  className,
  active,
}: {
  label: string
  entries: MenuEntry[]
  align?: "left" | "right"
  className?: string
  active?: boolean
}) {
  const { open, setOpen, toggle, wrapProps } = useHoverMenu()

  return (
    <div {...wrapProps} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        className={cn(
          "relative flex h-10 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium transition-colors duration-200",
          open || active ? "text-foreground" : "text-foreground/75 hover:text-foreground",
        )}
      >
        {active && (
          <motion.span
            layoutId="chrome-topnav"
            transition={SLIDE}
            className="absolute inset-0 rounded-full border border-foreground/[0.09] bg-foreground/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
          />
        )}
        <span className="relative">{label}</span>
        <Icon icon={ArrowDown01Icon} className={cn("size-3.5 text-muted-foreground transition-transform duration-300", open && "rotate-180 text-foreground")} strokeWidth={2} />
      </button>
      <AnimatePresence>
        {open && (
          <MenuPanel align={align} className="w-[272px]">
            {entries.map((e) =>
              e.soon || !e.href ? (
                <span
                  key={e.name}
                  aria-disabled="true"
                  title={`${e.name} — coming soon`}
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2.5 opacity-50"
                >
                  <span className="flex size-9 items-center justify-center rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.03] text-muted-foreground">
                    <Icon icon={e.icon} className="size-[17px]" />
                  </span>
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="text-[13.5px] font-semibold text-foreground">{e.name}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{e.hint}</span>
                  </span>
                  <SoonChip />
                </span>
              ) : (
                <Link
                  key={e.name}
                  href={e.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  onPointerEnter={e.href === "/trade" ? prefetchSpotMarkets : undefined}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-foreground/[0.045]"
                >
                  <span className="flex size-9 items-center justify-center rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.03] text-muted-foreground transition-colors group-hover:text-primary">
                    <Icon icon={e.icon} className="size-[17px]" />
                  </span>
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="text-[13.5px] font-semibold text-foreground">{e.name}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{e.hint}</span>
                  </span>
                  <Icon icon={ArrowRight01Icon} className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              ),
            )}
          </MenuPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Search (the old navbar's: a field with ⌘K / Ctrl K to focus) ──────── */

function SearchField({ className }: { className?: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [mac, setMac] = React.useState(false)

  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <label
      className={cn(
        "group flex h-11 items-center gap-2.5 rounded-full border border-foreground/[0.07] bg-foreground/[0.03] pl-4 pr-1.5 transition-all duration-200",
        "hover:border-foreground/[0.12] focus-within:border-primary/45 focus-within:bg-foreground/[0.045] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)]",
        className,
      )}
    >
      <Icon icon={Search01Icon} className="size-[17px] text-muted-foreground transition-colors group-focus-within:text-primary" />
      <input
        ref={ref}
        type="search"
        placeholder="Search coins, pairs, or features…"
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur()
        }}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <kbd className="hidden h-7 shrink-0 items-center rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2 font-sans text-[11px] font-semibold text-muted-foreground sm:inline-flex">
        {mac ? "⌘ K" : "Ctrl K"}
      </kbd>
    </label>
  )
}

/* ── Account menu ─────────────────────────────────────────────────────── */

/* Security has no page yet. Settings is being built and opens in dev only
   until it's finished — it still wears "Soon" there. */
const ACCOUNT_LINKS: { name: string; href: string; icon: IconSvg; soon?: boolean }[] = [
  { name: "Profile", href: "/profile", icon: UserIcon },
  { name: "Security", href: "/security", icon: Shield01Icon, soon: true },
  { name: "Identity verification", href: VERIFICATION_URL, icon: CheckmarkBadge01Icon },
  { name: "Settings", href: "/settings", icon: Settings01Icon },
]

/** The old navbar's crypto total: the portfolio total from the one hook the
 *  dashboard also reads, priced from a 60s price poll. */
function useCryptoTotal() {
  const [prices, setPrices] = React.useState<Record<string, number>>({})
  React.useEffect(() => {
    let cancelled = false
    const load = () =>
      getPrices()
        .then((result) => {
          if (!cancelled) setPrices(result.prices)
        })
        .catch(() => {})
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])
  return usePortfolioTotal(prices)
}

function Avatar({ size }: { size: "sm" | "lg" }) {
  const { user } = useAuth()
  const name = useDisplayName()
  const box = size === "lg" ? "size-11 text-[16px]" : "size-9 text-[14px]"
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 font-display font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]", box)}>
      {user?.imageUrl ? (
        <Image src={user.imageUrl} alt="" width={44} height={44} className="size-full object-cover" unoptimized />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  )
}

function AccountMenu() {
  const { open, setOpen, toggle, wrapProps } = useHoverMenu()
  const { user, signOut } = useAuth()
  const { hidden } = useBalancePrivacy()
  const { total, loading } = useCryptoTotal()
  const name = useDisplayName()

  return (
    <div {...wrapProps} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        className={cn("group flex items-center gap-1.5 rounded-full p-0.5 pr-1 transition-colors hover:bg-foreground/[0.05]", open && "bg-foreground/[0.05]")}
      >
        <span className={cn("rounded-full ring-2 transition-[box-shadow] duration-200", open ? "ring-primary/50" : "ring-transparent")}>
          <Avatar size="sm" />
        </span>
        <Icon icon={ArrowDown01Icon} className={cn("hidden size-3.5 text-muted-foreground transition-transform duration-300 sm:block", open && "rotate-180 text-foreground")} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <MenuPanel align="right" className="w-[min(312px,calc(100vw-24px))] p-2">
            <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
              <Avatar size="lg" />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-display text-[15px] font-semibold text-foreground">{name}</span>
                {user?.email && <span className="mt-1 truncate text-[12px] font-medium text-muted-foreground">{user.email}</span>}
              </span>
            </div>

            {/* The crypto total, withheld until loaded so it never flashes a
                $0.00 it would have to correct. The Dollar Account is separate. */}
            {!loading && (
              <Link
                href="/wallet/modern"
                onClick={() => setOpen(false)}
                className="mx-1 mb-1.5 flex items-center justify-between rounded-xl border border-foreground/[0.06] bg-foreground/[0.025] px-3 py-2.5 transition-colors hover:border-foreground/[0.12]"
              >
                <span className="grid leading-tight">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Total crypto balance</span>
                  <span className="font-display text-[15px] font-semibold tabular-nums text-foreground">
                    {hidden ? "••••••" : total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </span>
                </span>
                <Icon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
              </Link>
            )}

            {ACCOUNT_LINKS.map((l) => {
              const ext = isExternal(l.href)
              const cls = "group flex h-10 items-center gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-foreground/85 transition-colors hover:bg-foreground/[0.045] hover:text-foreground"
              const inner = (
                <>
                  <Icon icon={l.icon} className="size-[17px] text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="flex-1">{l.name}</span>
                  {ext && <Icon icon={LinkSquare02Icon} className="size-3.5 text-muted-foreground/50" />}
                  {l.soon && <SoonChip />}
                </>
              )
              if (l.soon) {
                return (
                  <span
                    key={l.name}
                    role="menuitem"
                    aria-disabled="true"
                    title={`${l.name} — coming soon`}
                    className="flex h-10 cursor-not-allowed select-none items-center gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-muted-foreground/40"
                  >
                    <Icon icon={l.icon} className="size-[17px]" />
                    <span className="flex-1">{l.name}</span>
                    <SoonChip />
                  </span>
                )
              }
              return ext ? (
                <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => setOpen(false)} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={l.name} href={l.href} role="menuitem" onClick={() => setOpen(false)} className={cls}>
                  {inner}
                </Link>
              )
            })}

            <span aria-hidden className="mx-2.5 my-1.5 block h-px bg-foreground/[0.06]" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-debit transition-colors hover:bg-debit/[0.08]"
            >
              <Icon icon={Logout01Icon} className="size-[17px]" />
              Sign out
            </button>
          </MenuPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Top bar ──────────────────────────────────────────────────────────── */

function TopBar({ onMenu, onDeposit }: { onMenu: () => void; onDeposit: () => void }) {
  const pathname = usePathname()
  const active = TOP_NAV.find((i) => i.href && isActiveRoute(pathname, i.href))?.name
  const activeMenu = TOP_NAV.find((i) => i.menu?.some((e) => e.href && isActiveRoute(pathname, e.href)))?.name

  return (
    <header className={cn("ds-topbar relative z-40 flex h-[64px] shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:h-[72px] md:px-6", CHROME_FONTS)} style={CHROME_FONT_STYLE}>
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/[0.05] hover:text-foreground lg:hidden"
      >
        <Icon icon={Menu01Icon} className="size-5" />
      </button>

      <Link href="/" className="flex shrink-0 items-center gap-2.5 pr-1 sm:gap-3 sm:pr-2 xl:w-[224px]">
        <Image src="/worldstreet-logo/WorldStreet1.png" alt="" width={36} height={20} className="h-[18px] w-auto sm:h-[20px]" priority />
        <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground sm:text-[19px]">WorldStreet</span>
      </Link>

      <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
        {TOP_NAV.map((item) =>
          item.menu ? (
            <NavMenu
              key={item.name}
              label={item.name}
              entries={item.menu}
              active={!active && item.name === activeMenu}
              className={cn(item.name === "Trade" && "hidden xl:block", item.name === "Buy Crypto" && "hidden 2xl:block")}
            />
          ) : item.soon || !item.href ? (
            <span
              key={item.name}
              aria-disabled="true"
              title={`${item.name} — coming soon`}
              className={cn("relative h-10 cursor-not-allowed items-center rounded-full px-4 text-[14px] font-medium text-foreground/35", item.name === "Earn" ? "hidden 2xl:flex" : "flex")}
            >
              {item.name}
            </span>
          ) : (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex h-10 items-center rounded-full px-4 text-[14px] font-medium transition-colors duration-200",
                active === item.name ? "text-foreground" : "text-foreground/75 hover:text-foreground",
              )}
            >
              {active === item.name && (
                <motion.span
                  layoutId="chrome-topnav"
                  transition={SLIDE}
                  className="absolute inset-0 rounded-full border border-foreground/[0.09] bg-foreground/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                />
              )}
              <span className="relative">{item.name}</span>
            </Link>
          ),
        )}
      </nav>

      <div className="flex min-w-0 flex-1 justify-center md:px-2">
        <SearchField className="hidden w-full max-w-[380px] md:flex" />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        {/* Deposit: the wallet's own addresses, the same dialog everywhere. */}
        <button
          type="button"
          onClick={onDeposit}
          className="ds-gold group hidden h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold sm:flex"
        >
          <Icon icon={Download04Icon} className="size-[17px] transition-transform duration-300 group-hover:translate-y-0.5" strokeWidth={2} />
          Deposit
        </button>

        <NavMenu label="Assets" entries={ASSETS_MENU} align="right" className="hidden 2xl:block" />
        <NavMenu label="Orders" entries={ORDERS_MENU} align="right" className="hidden 2xl:block" />

        {/* The old navbar's wallet and notifications popovers (balances, wallet
            mode, announcements, the migration notice), in place of the
            preview's static bell. */}
        <div className="flex items-center">
          <NavbarActions />
        </div>

        <AccountMenu />
      </div>
    </header>
  )
}

/* ── Rail ─────────────────────────────────────────────────────────────── */

const VIVID_DOT: Record<string, string> = {
  connecting: "bg-yellow-400 animate-pulse",
  ready: "bg-emerald-400",
  listening: "bg-primary animate-pulse",
  processing: "bg-primary animate-pulse",
  speaking: "bg-emerald-400 animate-pulse",
}

function RailLink({
  item,
  active,
  compact,
  onNavigate,
  onDialog,
  trailing,
}: {
  item: RailItem
  active: boolean
  compact: boolean
  onNavigate?: () => void
  onDialog: (dialog: WalletDialog) => void
  trailing?: React.ReactNode
}) {
  // No page yet: the row LISTS (the rail doubles as a roadmap) but is dimmed,
  // not a link, takes no hover, and says "Soon".
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title={`${item.name} — coming soon`}
        className={cn(
          "relative flex h-11 cursor-not-allowed select-none items-center gap-3.5 rounded-xl text-[14px] font-medium text-muted-foreground/40",
          compact ? "justify-center" : "px-3.5",
        )}
      >
        <Icon icon={item.icon} className="relative size-[20px]" />
        {compact ? (
          <span aria-hidden className="absolute right-[18px] top-[10px] size-1.5 rounded-full bg-foreground/20" />
        ) : (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            <SoonChip />
          </>
        )}
      </span>
    )
  }

  const ext = item.href ? isExternal(item.href) : false
  const cls = cn(
    "group relative flex h-11 w-full items-center gap-3.5 rounded-xl text-[14px] font-medium transition-colors duration-200",
    compact ? "justify-center" : "px-3.5",
    active ? "text-primary" : "text-foreground/70 hover:text-foreground",
  )
  const inner = (
    <>
      {active ? (
        <motion.span layoutId={compact ? "chrome-rail-compact" : "chrome-rail"} transition={SLIDE} className="dash-rail-active absolute inset-0 rounded-xl" />
      ) : (
        <span className="absolute inset-0 rounded-xl bg-foreground/[0.035] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      )}
      <Icon icon={item.icon} className={cn("relative size-[20px] transition-transform duration-200", !active && "group-hover:scale-[1.06]")} />
      {!compact && (
        <>
          <span className={cn("relative flex-1 truncate text-left", active && "font-semibold")}>{item.name}</span>
          {trailing}
          {item.soon && <span className="relative"><SoonChip /></span>}
          {ext && <Icon icon={LinkSquare02Icon} className="relative size-3.5 text-muted-foreground/40" />}
          {item.chevron && <Icon icon={ArrowRight01Icon} className="relative size-3.5 text-muted-foreground/70" strokeWidth={2} />}
        </>
      )}
    </>
  )

  if (item.dialog) {
    const dialog = item.dialog
    return (
      <button
        type="button"
        title={compact ? item.name : undefined}
        onClick={() => {
          onNavigate?.()
          onDialog(dialog)
        }}
        className={cls}
      >
        {inner}
      </button>
    )
  }
  if (ext) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" title={compact ? item.name : undefined} onClick={onNavigate} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <Link
      href={item.href ?? "/"}
      title={compact ? item.name : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      // Hovering Trade is the earliest sign the spot registry is about to be needed.
      onPointerEnter={item.href === "/trade" ? prefetchSpotMarkets : undefined}
      className={cls}
    >
      {inner}
    </Link>
  )
}

function Rail({ compact, onNavigate, onDialog }: { compact: boolean; onNavigate?: () => void; onDialog: (dialog: WalletDialog) => void }) {
  const pathname = usePathname()
  const vivid = useVividOptional()
  const vividState = vivid?.state ?? "idle"
  const vividLive = vividState !== "idle" && vividState !== "error"

  return (
    <nav aria-label="Main" className={cn("flex flex-col pb-6", compact ? "gap-1 px-3" : "px-4")}>
      {RAIL.map((group, gi) => (
        <div key={gi} className={cn(gi > 0 && (compact ? "mt-3 border-t border-foreground/[0.06] pt-3" : "mt-5"), group.hideOnPhones && "max-md:hidden")}>
          {group.label && !compact && (
            <span className="mb-2 block px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">{group.label}</span>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const isVivid = item.name === "Vivid AI"
              return (
                <RailLink
                  key={item.name}
                  item={item}
                  active={isActiveRoute(pathname, item.href) || (isVivid && vividLive)}
                  compact={compact}
                  onNavigate={onNavigate}
                  onDialog={onDialog}
                  trailing={isVivid && vividLive ? <span className={cn("relative inline-block size-1.5 shrink-0 rounded-full", VIVID_DOT[vividState])} /> : undefined}
                />
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/* ── Frame ────────────────────────────────────────────────────────────── */

export function AppFrame({ children, onMainScroll }: { children: React.ReactNode; onMainScroll?: (e: React.UIEvent<HTMLElement>) => void }) {
  const [drawer, setDrawer] = React.useState(false)
  const [dialog, setDialog] = React.useState<WalletDialog | null>(null)
  const pathname = usePathname()
  const mainRef = React.useRef<HTMLElement>(null)
  /** The trading screen keeps the rail an icon strip at every width, as the
   *  preview does, so the chart, book and ticket get the room. */
  const iconRail = pathname === "/trade" || pathname.startsWith("/trade/")

  // The page scrolls inside <main>, not the window, so Next's scroll
  // restoration never touches it: start each route at the top.
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
    setDrawer(false)
  }, [pathname])

  React.useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawer])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <TopBar onMenu={() => setDrawer(true)} onDeposit={() => setDialog("receive")} />

      <div className="relative flex min-h-0 flex-1">
        <aside className={cn("ds-rail slim-scroll hidden shrink-0 overflow-y-auto pt-5 lg:block lg:w-[84px]", !iconRail && "xl:w-[264px]", CHROME_FONTS)} style={CHROME_FONT_STYLE}>
          <div className={iconRail ? undefined : "xl:hidden"}>
            <Rail compact onDialog={setDialog} />
          </div>
          {!iconRail && (
            <div className="hidden xl:block">
              <Rail compact={false} onDialog={setDialog} />
            </div>
          )}
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* iOS scroll-edge: content frosts as it slides under the bar. */}
          <div aria-hidden className="ws-scroll-edge pointer-events-none absolute inset-x-0 top-0 z-20 h-16" />
          {/* pb-28: the phone's floating bottom bar needs clearance. */}
          <main ref={mainRef} onScroll={onMainScroll} className="slim-scroll w-full min-w-0 flex-1 overflow-y-auto pb-28 lg:pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className={cn("slim-scroll fixed inset-y-0 left-0 z-[60] w-[288px] overflow-y-auto border-r border-foreground/[0.07] bg-background lg:hidden", CHROME_FONTS)}
              style={CHROME_FONT_STYLE}
            >
              <div className="flex h-[72px] items-center justify-between px-6">
                <span className="flex items-center gap-3">
                  <Image src="/worldstreet-logo/WorldStreet1.png" alt="" width={36} height={20} className="h-[20px] w-auto" />
                  <span className="font-display text-[18px] font-semibold tracking-[-0.025em]">WorldStreet</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label="Close navigation"
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                >
                  <Icon icon={Cancel01Icon} className="size-5" />
                </button>
              </div>
              <Rail compact={false} onNavigate={() => setDrawer(false)} onDialog={setDialog} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* The wallet's own dialogs, mounted once for the whole frame. */}
      <ModernReceiveModal open={dialog === "receive"} onOpenChange={(open) => setDialog(open ? "receive" : null)} />
      <SendModal open={dialog === "send"} onOpenChange={(open) => setDialog(open ? "send" : null)} />
    </div>
  )
}
