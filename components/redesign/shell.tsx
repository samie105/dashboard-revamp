"use client"

/**
 * The dashboard preview's own chrome: the top bar and the left rail.
 *
 * /dashboard-unauth renders full-bleed (see FULL_BLEED_ROUTES in
 * layout-shell.tsx) and brings this frame with it, because the redesign moves
 * the primary navigation into a top bar — something the shared preview shell
 * cannot do without changing every other preview page at the same time. The
 * other previews keep the existing shell until they are redesigned too.
 *
 * Layout by width:
 *   ≥1280  full rail (248px) + full top bar
 *   1024+  icon rail (76px), top-bar links still visible
 *   <1024  no rail; a menu button opens it as a drawer, and the phone keeps
 *          the app's floating bottom bar
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  Analytics01Icon,
  BankIcon,
  ArrowDown01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  Copy01Icon,
  ChartBarLineIcon,
  ChartLineData02Icon,
  Coins01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  Download04Icon,
  Exchange01Icon,
  GiftIcon,
  HelpCircleIcon,
  Invoice03Icon,
  Logout01Icon,
  Menu01Icon,
  Notification02Icon,
  PercentCircleIcon,
  RepeatIcon,
  Rocket01Icon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  SourceCodeIcon,
  Tick02Icon,
  Upload04Icon,
  UserIcon,
  UserSwitchIcon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES, walletHref } from "@/components/preview/routes"
import {
  DEMO_USER,
  PORTFOLIO_TOTAL,
  formatUSD,
} from "@/components/dashboard-unauth/demo-data"
import { Icon, SLIDE, usePrivacy, type IconSvg } from "@/components/redesign/ui"

/* ── Navigation model ───────────────────────────────────────────────────── */

type RailItem = { name: string; href: string; icon: IconSvg; chevron?: boolean }
type RailGroup = { label?: string; items: RailItem[] }

const RAIL: RailGroup[] = [
  {
    items: [
      {
        name: "Dashboard",
        href: PREVIEW_ROUTES.dashboard,
        icon: DashboardSquare01Icon,
      },
      { name: "Markets", href: PREVIEW_ROUTES.markets, icon: ChartBarLineIcon },
      {
        name: "Trade",
        href: `${PREVIEW_ROUTES.trade}?market=spot`,
        icon: Exchange01Icon,
        chevron: true,
      },
      {
        name: "Futures",
        href: `${PREVIEW_ROUTES.trade}?market=futures`,
        icon: ChartLineData02Icon,
        chevron: true,
      },
      // In the rail (not only the top bar's menus) because the rail is the
      // phone's only navigation — without these, a phone couldn't swap or
      // bridge at all.
      { name: "Swap", href: PREVIEW_ROUTES.swap, icon: RepeatIcon },
      { name: "Bridge", href: PREVIEW_ROUTES.bridge, icon: ArrowLeftRightIcon },
      { name: "Earn", href: "#", icon: Coins01Icon },
      { name: "Copy Trading", href: "#", icon: UserSwitchIcon },
      { name: "Launchpad", href: PREVIEW_ROUTES.launchpad, icon: Rocket01Icon },
      { name: "Rewards", href: "#", icon: GiftIcon },
      { name: "Analytics", href: "#", icon: Analytics01Icon },
    ],
  },
  {
    label: "Wallet",
    // One wallet page, four ways in: the overview, and the three actions,
    // each opening the page's action panel on its own tab.
    items: [
      { name: "Wallet", href: walletHref(), icon: Wallet02Icon },
      { name: "Deposit", href: walletHref("deposit"), icon: Download04Icon },
      { name: "Withdraw", href: walletHref("withdraw"), icon: Upload04Icon },
      {
        name: "Transfer",
        href: walletHref("transfer"),
        icon: ArrowLeftRightIcon,
      },
      {
        name: "Transactions",
        href: PREVIEW_ROUTES.transactions,
        icon: Invoice03Icon,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Settings", href: PREVIEW_ROUTES.settings, icon: Settings01Icon },
      { name: "API Management", href: "#", icon: SourceCodeIcon },
      { name: "Help Center", href: "#", icon: HelpCircleIcon },
    ],
  },
]

type MenuEntry = { name: string; hint: string; href: string; icon: IconSvg }
type TopItem = { name: string; href?: string; menu?: MenuEntry[] }

const TOP_NAV: TopItem[] = [
  { name: "Exchange", href: PREVIEW_ROUTES.dashboard },
  {
    name: "Trade",
    menu: [
      {
        name: "Spot",
        hint: "Buy and sell at market or limit",
        href: `${PREVIEW_ROUTES.trade}?market=spot`,
        icon: Exchange01Icon,
      },
      {
        name: "Futures",
        hint: "Up to 40× on perpetuals",
        href: `${PREVIEW_ROUTES.trade}?market=futures`,
        icon: ChartLineData02Icon,
      },
      {
        name: "Swap",
        hint: "One tap, any pair",
        href: PREVIEW_ROUTES.swap,
        icon: ArrowLeftRightIcon,
      },
      {
        name: "Copy Trading",
        hint: "Mirror proven traders",
        href: "#",
        icon: UserSwitchIcon,
      },
    ],
  },
  { name: "Markets", href: PREVIEW_ROUTES.markets },
  { name: "Earn", href: "#" },
  {
    name: "Buy Crypto",
    menu: [
      {
        name: "Dollar Account",
        hint: "No fee · instant",
        href: `${PREVIEW_ROUTES.buy}?method=dollar`,
        icon: Wallet02Icon,
      },
      {
        name: "Card",
        hint: "Visa, Mastercard · 1.8%",
        href: `${PREVIEW_ROUTES.buy}?method=card`,
        icon: CreditCardIcon,
      },
      {
        name: "Bank transfer",
        hint: "Pay in naira · 0.5%",
        href: `${PREVIEW_ROUTES.buy}?method=bank`,
        icon: BankIcon,
      },
      {
        name: "Sell crypto",
        hint: "Cash out to your account or bank",
        href: PREVIEW_ROUTES.sell,
        icon: Upload04Icon,
      },
    ],
  },
  {
    name: "More",
    // Buy / Sell lead here as well as in their own menu: "Buy Crypto" only
    // fits the bar at 2xl, and "More" is there from lg up.
    menu: [
      {
        name: "Buy crypto",
        hint: "Card, bank or Dollar Account",
        href: PREVIEW_ROUTES.buy,
        icon: CreditCardIcon,
      },
      {
        name: "Sell crypto",
        hint: "Cash out in dollars or naira",
        href: PREVIEW_ROUTES.sell,
        icon: Upload04Icon,
      },
      {
        name: "Launchpad",
        hint: "Early access to new tokens",
        href: PREVIEW_ROUTES.launchpad,
        icon: Rocket01Icon,
      },
      {
        name: "Bridge",
        hint: "Move assets across chains",
        href: PREVIEW_ROUTES.bridge,
        icon: ArrowLeftRightIcon,
      },
      {
        name: "Rewards",
        hint: "Tasks, bonuses and airdrops",
        href: "#",
        icon: GiftIcon,
      },
      {
        name: "Fees",
        hint: "Your tier and discounts",
        href: "#",
        icon: PercentCircleIcon,
      },
    ],
  },
]

const ASSETS_MENU: MenuEntry[] = [
  {
    name: "Overview",
    hint: "Everything you hold",
    href: PREVIEW_ROUTES.wallet,
    icon: Wallet02Icon,
  },
  {
    name: "Deposit",
    hint: "Crypto to your address",
    href: walletHref("deposit"),
    icon: Download04Icon,
  },
  {
    name: "Transfer",
    hint: "Between your accounts",
    href: walletHref("transfer"),
    icon: ArrowLeftRightIcon,
  },
]

const ORDERS_MENU: MenuEntry[] = [
  { name: "Open orders", hint: "4 resting", href: "#", icon: Invoice03Icon },
  {
    name: "Order history",
    hint: "Fills and cancels",
    href: "#",
    icon: Analytics01Icon,
  },
  {
    name: "Transactions",
    hint: "Deposits and withdrawals",
    href: PREVIEW_ROUTES.transactions,
    icon: ArrowLeftRightIcon,
  },
]

/* ── Dropdown behaviour ───────────────────────────────────────────────────
   Opens on hover with a short grace period on leave (so a diagonal mouse
   path to the panel doesn't close it), and on click for keyboards and touch.

   Hover is MOUSE-only. On a phone a tap fires pointerenter and then click, so
   a hover handler that also listened to touch would open the menu on enter
   and the click would immediately toggle it shut again. */

function useHoverMenu() {
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  const wrap = React.useRef<HTMLDivElement>(null)
  // Set when hover opened the menu. The click that usually follows a hover
  // must then CONFIRM the open state, not toggle it — otherwise moving onto
  // the button and clicking it opens and instantly closes the menu.
  const hoverOpened = React.useRef(false)
  const pathname = usePathname()

  // Navigating away closes whatever was open — the frame persists across
  // routes, so a menu left open would otherwise follow you to the next page.
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

  /** The trigger's click: confirms a hover-open, otherwise toggles (touch,
   *  keyboard, or a second click to dismiss). */
  const toggle = () => {
    if (hoverOpened.current) {
      hoverOpened.current = false
      setOpen(true)
      return
    }
    setOpen((v) => !v)
  }

  // Closing by any route clears the flag, so the next click starts fresh.
  React.useEffect(() => {
    if (!open) hoverOpened.current = false
  }, [open])

  return { open, setOpen, toggle, wrapProps }
}

/** The shared panel motion and surface for every dropdown in the top bar. */
function MenuPanel({
  align,
  className,
  children,
}: {
  align: "left" | "right"
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "absolute top-[calc(100%+8px)] z-50 origin-top rounded-2xl border border-white/[0.08] bg-[#121212]/95 p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl",
        align === "right"
          ? "right-0 origin-top-right"
          : "left-0 origin-top-left",
        className
      )}
    >
      {children}
    </motion.div>
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
  /** The current page lives under this menu — show the same capsule the
   *  plain links use, so the bar still says where you are. */
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
          "flex h-10 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium transition-colors duration-200",
          "relative",
          open || active
            ? "text-foreground"
            : "text-foreground/75 hover:text-foreground"
        )}
      >
        {active && (
          <motion.span
            layoutId="dash-topnav"
            transition={SLIDE}
            className="absolute inset-0 rounded-full border border-white/[0.09] bg-white/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
          />
        )}
        <span className="relative">{label}</span>
        <Icon
          icon={ArrowDown01Icon}
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-300",
            open && "rotate-180 text-foreground"
          )}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence>
        {open && (
          <MenuPanel align={align} className="w-[272px]">
            {entries.map((e) => (
              <Link
                key={e.name}
                href={e.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.045]"
              >
                <span className="flex size-9 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors group-hover:text-primary">
                  <Icon icon={e.icon} className="size-[17px]" />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="text-[13.5px] font-semibold text-foreground">
                    {e.name}
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {e.hint}
                  </span>
                </span>
                <Icon
                  icon={ArrowRight01Icon}
                  className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                />
              </Link>
            ))}
          </MenuPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Search ───────────────────────────────────────────────────────────── */

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
        "group flex h-11 items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.03] pr-1.5 pl-4 transition-all duration-200",
        "focus-within:border-primary/45 focus-within:bg-white/[0.045] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)] hover:border-white/[0.12]",
        className
      )}
    >
      <Icon
        icon={Search01Icon}
        className="size-[17px] text-muted-foreground transition-colors group-focus-within:text-primary"
      />
      <input
        ref={ref}
        type="search"
        placeholder="Search coins, pairs, or features…"
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <kbd className="hidden h-7 shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 font-sans text-[11px] font-semibold text-muted-foreground sm:inline-flex">
        {mac ? "⌘ K" : "Ctrl K"}
      </kbd>
    </label>
  )
}

/* ── Account menu ─────────────────────────────────────────────────────────
   Hover on a mouse, tap on a phone (the shared useHoverMenu). Identity first
   — who is signed in and the UID support will ask for — then the one thing
   the account still needs, then the destinations, then the way out. */

const ACCOUNT_LINKS: {
  name: string
  href: string
  icon: IconSvg
  badge?: string
}[] = [
  // Deep links into the Settings page's sections.
  { name: "Profile", href: `${PREVIEW_ROUTES.settings}?section=profile`, icon: UserIcon },
  { name: "Security", href: `${PREVIEW_ROUTES.settings}?section=security`, icon: Shield01Icon },
  {
    name: "Identity verification",
    href: `${PREVIEW_ROUTES.settings}?section=verification`,
    icon: CheckmarkBadge01Icon,
    badge: "Required",
  },
  { name: "Referrals", href: "#", icon: GiftIcon },
  { name: "API Management", href: "#", icon: SourceCodeIcon },
  { name: "Settings", href: PREVIEW_ROUTES.settings, icon: Settings01Icon },
]

function AccountMenu() {
  const { open, setOpen, toggle, wrapProps } = useHoverMenu()
  const { hidden } = usePrivacy()
  const [copied, setCopied] = React.useState(false)

  const copyUid = () => {
    navigator.clipboard?.writeText(DEMO_USER.uid).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div {...wrapProps} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        className={cn(
          "group flex items-center gap-1.5 rounded-full p-0.5 pr-1 transition-colors hover:bg-white/[0.05]",
          open && "bg-white/[0.05]"
        )}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a3d] to-[#f26b1d] font-display text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ring-2 transition-[box-shadow] duration-200",
            open ? "ring-primary/50" : "ring-transparent"
          )}
        >
          {DEMO_USER.initial}
        </span>
        <Icon
          icon={ArrowDown01Icon}
          className={cn(
            "hidden size-3.5 text-muted-foreground transition-transform duration-300 sm:block",
            open && "rotate-180 text-foreground"
          )}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {open && (
          <MenuPanel
            align="right"
            className="w-[min(312px,calc(100vw-24px))] p-2"
          >
            <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a3d] to-[#f26b1d] font-display text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
                {DEMO_USER.initial}
              </span>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-display text-[15px] font-semibold text-foreground">
                  {DEMO_USER.full}
                </span>
                <button
                  type="button"
                  onClick={copyUid}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted-foreground tabular-nums transition-colors hover:text-foreground"
                >
                  UID {DEMO_USER.uid}
                  <Icon
                    icon={copied ? Tick02Icon : Copy01Icon}
                    className={cn("size-3.5", copied && "text-credit")}
                  />
                </button>
              </span>
            </div>

            <div className="mx-1 mb-1.5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <span className="grid leading-tight">
                <span className="text-[11.5px] font-medium text-muted-foreground">
                  Total balance
                </span>
                <span className="font-display text-[15px] font-semibold text-foreground tabular-nums">
                  {hidden ? "••••••" : formatUSD(PORTFOLIO_TOTAL)}
                </span>
              </span>
              <span className="rounded-md border border-warning/30 bg-warning/[0.1] px-2 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-warning uppercase">
                Unverified
              </span>
            </div>

            {ACCOUNT_LINKS.map((l) => (
              <Link
                key={l.name}
                href={l.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex h-10 items-center gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.045] hover:text-foreground"
              >
                <Icon
                  icon={l.icon}
                  className="size-[17px] text-muted-foreground transition-colors group-hover:text-primary"
                />
                <span className="flex-1">{l.name}</span>
                {l.badge && (
                  <span className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] text-primary uppercase">
                    {l.badge}
                  </span>
                )}
              </Link>
            ))}

            <span
              aria-hidden
              className="mx-2.5 my-1.5 block h-px bg-white/[0.06]"
            />

            <button
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
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

function TopBar({ onMenu }: { onMenu: () => void }) {
  // Read from the URL, not local state: the frame outlives the page, so the
  // capsule has to follow whatever route actually rendered.
  const pathname = usePathname()
  const active = TOP_NAV.find(
    (i) => i.href && i.href !== "#" && pathname === i.href
  )?.name
  // A page reached from a menu (Swap → Trade, Buy / Sell → Buy Crypto) lights
  // that menu instead. First match wins, so Buy / Sell — which also sit in
  // More — highlight Buy Crypto, and only one capsule is ever on.
  const activeMenu = TOP_NAV.find((i) =>
    i.menu?.some((e) => e.href.split("?")[0] === pathname)
  )?.name

  return (
    <header className="dash-topbar relative z-40 flex h-[64px] shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:h-[72px] md:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-white/[0.05] hover:text-foreground lg:hidden"
      >
        <Icon icon={Menu01Icon} className="size-5" />
      </button>

      <Link
        href={PREVIEW_ROUTES.dashboard}
        className="flex shrink-0 items-center gap-2.5 pr-1 sm:gap-3 sm:pr-2 xl:w-[224px]"
      >
        <Image
          src="/worldstreet-logo/WorldStreet1.png"
          alt=""
          width={36}
          height={20}
          className="h-[18px] w-auto sm:h-[20px]"
          priority
        />
        <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground sm:text-[19px]">
          WorldStreet
        </span>
      </Link>

      {/* Primary links. The capsule marks the page you are on and slides
          between links as you navigate; menus stay bare. */}
      <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
        {TOP_NAV.map((item) =>
          item.menu ? (
            <NavMenu
              key={item.name}
              label={item.name}
              entries={item.menu}
              active={!active && item.name === activeMenu}
              className={cn(
                item.name === "Trade" && "hidden xl:block",
                item.name === "Buy Crypto" && "hidden 2xl:block"
              )}
            />
          ) : (
            <Link
              key={item.name}
              href={item.href ?? "#"}
              className={cn(
                "relative flex h-10 items-center rounded-full px-4 text-[14px] font-medium transition-colors duration-200",
                active === item.name
                  ? "text-foreground"
                  : "text-foreground/75 hover:text-foreground",
                // Earn and Buy Crypto wait for 2xl: at 1280 they squeezed the
                // search field down to "Search co".
                item.name === "Earn" && "hidden 2xl:flex"
              )}
            >
              {active === item.name && (
                <motion.span
                  layoutId="dash-topnav"
                  transition={SLIDE}
                  className="absolute inset-0 rounded-full border border-white/[0.09] bg-white/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                />
              )}
              <span className="relative">{item.name}</span>
            </Link>
          )
        )}
      </nav>

      <div className="flex min-w-0 flex-1 justify-center md:px-2">
        <SearchField className="hidden w-full max-w-[380px] md:flex" />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <button
          type="button"
          aria-label="Search"
          className="hidden size-10 items-center justify-center rounded-full text-foreground/80 hover:bg-white/[0.05] min-[400px]:flex md:hidden"
        >
          <Icon icon={Search01Icon} className="size-5" />
        </button>

        <Link
          href={walletHref("deposit")}
          className="dash-gold-btn group hidden h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold sm:flex"
        >
          <Icon
            icon={Download04Icon}
            className="size-[17px] transition-transform duration-300 group-hover:translate-y-0.5"
            strokeWidth={2}
          />
          Deposit
        </Link>

        <NavMenu
          label="Assets"
          entries={ASSETS_MENU}
          align="right"
          className="hidden 2xl:block"
        />
        <NavMenu
          label="Orders"
          entries={ORDERS_MENU}
          align="right"
          className="hidden 2xl:block"
        />

        <button
          type="button"
          aria-label="Notifications, 3 unread"
          className="relative flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-white/[0.05] hover:text-foreground"
        >
          <Icon icon={Notification02Icon} className="size-[21px]" />
          <span className="absolute top-[8px] right-[9px] flex size-[9px] items-center justify-center rounded-full bg-[#ff5b3a] ring-2 ring-background" />
        </button>

        <AccountMenu />
      </div>
    </header>
  )
}

/* ── Rail ─────────────────────────────────────────────────────────────── */

function RailLink({
  item,
  active,
  compact,
  onNavigate,
}: {
  item: RailItem
  active: boolean
  compact: boolean
  onNavigate?: () => void
}) {
  // No page yet ("#"): the row still LISTS — people look for these, and the
  // rail doubles as a roadmap — but it's dimmed, not a link, takes no hover,
  // and says "Soon". A live-looking link to nowhere is worse than either.
  if (item.href === "#") {
    return (
      <span
        aria-disabled="true"
        title={`${item.name} — coming soon`}
        className={cn(
          "relative flex h-11 cursor-not-allowed items-center gap-3.5 rounded-xl text-[14px] font-medium text-muted-foreground/40 select-none",
          compact ? "justify-center" : "px-3.5"
        )}
      >
        <Icon icon={item.icon} className="relative size-[20px]" />
        {compact ? (
          // Icon-only rail: a small dot where the label would say it.
          <span
            aria-hidden
            className="absolute top-[10px] right-[18px] size-1.5 rounded-full bg-white/20"
          />
        ) : (
          <>
            <span className="flex-1 truncate">{item.name}</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-muted-foreground/60 uppercase">
              Soon
            </span>
          </>
        )}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      title={compact ? item.name : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-11 items-center gap-3.5 rounded-xl text-[14px] font-medium transition-colors duration-200",
        compact ? "justify-center" : "px-3.5",
        active ? "text-primary" : "text-foreground/70 hover:text-foreground"
      )}
    >
      {active ? (
        <motion.span
          layoutId={compact ? "dash-rail-compact" : "dash-rail"}
          transition={SLIDE}
          className="dash-rail-active absolute inset-0 rounded-xl"
        />
      ) : (
        <span className="absolute inset-0 rounded-xl bg-white/[0.035] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      )}
      <Icon
        icon={item.icon}
        className={cn(
          "relative size-[20px] transition-transform duration-200",
          !active && "group-hover:scale-[1.06]"
        )}
      />
      {!compact && (
        <>
          <span
            className={cn(
              "relative flex-1 truncate",
              active && "font-semibold"
            )}
          >
            {item.name}
          </span>
          {item.chevron && (
            <Icon
              icon={ArrowRight01Icon}
              className="relative size-3.5 text-muted-foreground/70"
              strokeWidth={2}
            />
          )}
        </>
      )}
    </Link>
  )
}

/** Does this row describe the current URL? Path AND `?action=` must match,
 *  so on the wallet page exactly one of Wallet / Deposit / Withdraw /
 *  Transfer lights up — the one you came in by. Placeholder rows ("#")
 *  never match. */
function isActive(
  href: string,
  pathname: string,
  search: URLSearchParams | null
) {
  if (href === "#") return false
  const url = new URL(href, "http://x")
  // A bare row also owns its sub-pages (Launchpad → /launchpad-unauth/create).
  if (url.pathname !== pathname && !(url.search === "" && pathname.startsWith(`${url.pathname}/`))) return false
  // Every param the row names must match the URL (Trade = ?market=spot,
  // Futures = ?market=futures; Deposit = ?action=deposit) …
  for (const [k, v] of url.searchParams) if (search?.get(k) !== v) return false
  // … and a bare row (Wallet) must not light while an action row applies.
  return url.searchParams.has("action") || !search?.get("action")
}

/** The rail with the live query string. useSearchParams needs a Suspense
 *  boundary above it, so the frame renders <Rail search={null}> as the
 *  fallback — the same rail, minus the action-row highlight, for a frame. */
function LiveRail(props: { compact: boolean; onNavigate?: () => void }) {
  const search = useSearchParams()
  return <Rail {...props} search={search} />
}

function RailSlot(props: { compact: boolean; onNavigate?: () => void }) {
  return (
    <React.Suspense fallback={<Rail {...props} search={null} />}>
      <LiveRail {...props} />
    </React.Suspense>
  )
}

function Rail({
  compact,
  onNavigate,
  search,
}: {
  compact: boolean
  onNavigate?: () => void
  search: URLSearchParams | null
}) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Dashboard"
      className={cn("flex flex-col pb-6", compact ? "gap-1 px-3" : "px-4")}
    >
      {RAIL.map((group, gi) => (
        <div
          key={gi}
          className={cn(
            gi > 0 &&
              (compact ? "mt-3 border-t border-white/[0.06] pt-3" : "mt-5")
          )}
        >
          {group.label && !compact && (
            <span className="mb-2 block px-3.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground/60 uppercase">
              {group.label}
            </span>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((item) => (
              <RailLink
                key={item.name}
                item={item}
                active={isActive(item.href, pathname, search)}
                compact={compact}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

/* ── Frame ────────────────────────────────────────────────────────────── */

/** Lets a page that hides the top bar (the phone trading terminal) still open
 *  the navigation drawer from its own header. */
const FrameContext = React.createContext<{ openNav: () => void }>({
  openNav: () => {},
})
export const useFrame = () => React.useContext(FrameContext)

export function DashboardFrame({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = React.useState(false)
  const pathname = usePathname()
  const mainRef = React.useRef<HTMLElement>(null)
  const dense = pathname === PREVIEW_ROUTES.trade
  // Settings is a focused, full-screen page: no top bar, no rail at any
  // width. It brings its own slim header with a close button.
  const isolated = pathname === PREVIEW_ROUTES.settings

  // Remember the last page that wasn't Settings, so Settings' close button
  // can return there. (document.referrer only changes on full page loads,
  // not on in-app navigation — this frame sees every route change.)
  React.useEffect(() => {
    if (isolated) return
    try {
      window.sessionStorage.setItem("ws:redesign:last-page", window.location.pathname + window.location.search)
    } catch {
      /* blocked storage just means Close falls back to the dashboard */
    }
  }, [pathname, isolated])
  const frameValue = React.useMemo(
    () => ({ openNav: () => setDrawer(true) }),
    []
  )

  // The page scrolls inside <main>, not the window, so Next's own scroll
  // restoration never touches it: without this, going from the bottom of the
  // dashboard to Markets would land you at the bottom of Markets.
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
    <FrameContext.Provider value={frameValue}>
      <div className="relative flex h-dvh flex-col overflow-hidden">
        {/* Atmosphere: a low gold bloom behind the hero row and a cooler one
          at the far corner, both well under any text. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 left-[18%] h-[520px] w-[820px] rounded-full bg-[radial-gradient(closest-side,rgba(250,204,21,0.075),transparent)]" />
          <div className="absolute top-[30%] -right-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(250,204,21,0.035),transparent)]" />
        </div>

        {/* On a phone the trading terminal is isolated: it brings its own
          compact header (with a menu button into this same drawer), so the
          shared top bar steps aside and the chart gets the height. */}
        {!isolated && (
          <div className={cn(dense && "hidden lg:block")}>
            <TopBar onMenu={() => setDrawer(true)} />
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          {/* The trading terminal wants every pixel for the chart and the book,
            so on that page the rail stays an icon strip at every width. Same
            component either way — it just doesn't unfold. */}
          <aside
            className={cn(
              "dash-rail slim-scroll hidden shrink-0 overflow-y-auto pt-5 lg:block lg:w-[84px]",
              isolated && "!hidden",
              !dense && "xl:w-[264px]"
            )}
          >
            <div className={cn(!dense && "xl:hidden")}>
              <RailSlot compact />
            </div>
            {!dense && (
              <div className="hidden xl:block">
                <RailSlot compact={false} />
              </div>
            )}
          </aside>

          <main
            ref={mainRef}
            className="slim-scroll min-w-0 flex-1 overflow-y-auto pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          >
            {children}
          </main>
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
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                key="drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="slim-scroll fixed inset-y-0 left-0 z-50 w-[288px] overflow-y-auto border-r border-white/[0.07] bg-[#0c0c0c] lg:hidden"
              >
                <div className="flex h-[72px] items-center justify-between px-6">
                  <span className="flex items-center gap-3">
                    <Image
                      src="/worldstreet-logo/WorldStreet1.png"
                      alt=""
                      width={36}
                      height={20}
                      className="h-[20px] w-auto"
                    />
                    <span className="font-display text-[18px] font-semibold tracking-[-0.025em]">
                      WorldStreet
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawer(false)}
                    aria-label="Close navigation"
                    className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  >
                    <Icon icon={Cancel01Icon} className="size-5" />
                  </button>
                </div>
                <RailSlot compact={false} onNavigate={() => setDrawer(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </FrameContext.Provider>
  )
}
