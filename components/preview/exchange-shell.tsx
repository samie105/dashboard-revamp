"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ArrowDownLeft01Icon,
  ArrowDown01Icon,
  BarChartIcon,
  BotIcon,
  ChartCandlestickIcon,
  DashboardSquare01Icon,
  Exchange01Icon,
  File01Icon,
  GiftIcon,
  HelpCircleIcon,
  Menu01Icon,
  Notification03Icon,
  PieChartIcon,
  RepeatIcon,
  Rocket01Icon,
  Search01Icon,
  Settings02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"

type NavItem = {
  label: string
  href: string
  icon: typeof DashboardSquare01Icon
  soon?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: PREVIEW_ROUTES.dashboard, icon: DashboardSquare01Icon },
      { label: "Markets", href: PREVIEW_ROUTES.markets, icon: BarChartIcon },
      { label: "Trade", href: PREVIEW_ROUTES.trade, icon: Exchange01Icon },
      { label: "Futures", href: "#", icon: ChartCandlestickIcon, soon: true },
      { label: "Earn", href: PREVIEW_ROUTES.launchpad, icon: PieChartIcon },
      { label: "Copy Trading", href: "#", icon: UserMultipleIcon, soon: true },
      { label: "Launchpad", href: PREVIEW_ROUTES.launchpad, icon: Rocket01Icon },
      { label: "Rewards", href: "#", icon: GiftIcon, soon: true },
      { label: "Analytics", href: "#", icon: ChartCandlestickIcon, soon: true },
    ],
  },
  {
    label: "Wallet",
    items: [
      { label: "Deposit", href: PREVIEW_ROUTES.wallet, icon: ArrowDownLeft01Icon },
      { label: "Withdraw", href: PREVIEW_ROUTES.wallet, icon: Activity01Icon },
      { label: "Transfer", href: PREVIEW_ROUTES.bridge, icon: RepeatIcon },
      { label: "Transactions", href: PREVIEW_ROUTES.transactions, icon: File01Icon },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", href: "#", icon: Settings02Icon, soon: true },
      { label: "API Management", href: "#", icon: BotIcon, soon: true },
      { label: "Help Center", href: "#", icon: HelpCircleIcon, soon: true },
    ],
  },
]

const TOP_NAV = [
  { label: "Exchange", href: PREVIEW_ROUTES.dashboard },
  { label: "Trade", href: PREVIEW_ROUTES.trade },
  { label: "Markets", href: PREVIEW_ROUTES.markets },
  { label: "Earn", href: PREVIEW_ROUTES.launchpad },
]

const SEARCH_RESULTS = [
  { label: "BTC/USDT", detail: "Bitcoin · $62,835.12", href: `${PREVIEW_ROUTES.trade}?market=BTC-USDT` },
  { label: "ETH/USDT", detail: "Ethereum · $2,448.32", href: `${PREVIEW_ROUTES.trade}?market=ETH-USDT` },
  { label: "SOL/USDT", detail: "Solana · $143.21", href: `${PREVIEW_ROUTES.trade}?market=SOL-USDT` },
]

function isActive(pathname: string, href: string) {
  if (href === "#") return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavRow({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const active = isActive(pathname, item.href)
  const content = (
    <>
      <HugeiconsIcon icon={item.icon} className="preview-nav-icon" />
      <span className="preview-nav-label">{item.label}</span>
      {item.soon && <span className="preview-nav-soon">Soon</span>}
    </>
  )

  if (item.soon) {
    return (
      <span className="preview-nav-item preview-nav-item-disabled" aria-disabled="true" title={`${item.label} — coming soon`}>
        {content}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="preview-nav-item"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </Link>
  )
}

function PreviewNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <>
      <div className="preview-nav-brand">
        <Link href={PREVIEW_ROUTES.dashboard} onClick={onNavigate} className="preview-brand-link">
          <Image
            src="/worldstreet-logo/WorldStreet1.png"
            alt="WorldStreet"
            width={30}
            height={30}
            priority
            className="preview-brand-mark"
          />
          <span className="preview-brand-name">WorldStreet</span>
        </Link>
      </div>

      <div className="preview-nav-groups">
        {NAV_GROUPS.map((group) => (
          <section key={group.label} className="preview-nav-group" aria-label={group.label}>
            {group.label && <p className="preview-nav-section-label">{group.label}</p>}
            <div className="preview-nav-list">
              {group.items.map((item) => (
                <NavRow key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        ))}
      </div>

    </>
  )
}

export function PreviewExchangeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [searchFocused, setSearchFocused] = React.useState(false)
  const terminal = pathname === PREVIEW_ROUTES.trade || pathname.startsWith(`${PREVIEW_ROUTES.trade}/`)
  const searchResults = search.trim()
    ? SEARCH_RESULTS.filter((result) => `${result.label} ${result.detail}`.toLowerCase().includes(search.trim().toLowerCase()))
    : SEARCH_RESULTS

  React.useEffect(() => {
    setMobileOpen(false)
    setNotificationsOpen(false)
  }, [pathname])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        document.getElementById("preview-exchange-search")?.focus()
      }
      if (event.key === "Escape") {
        setSearchFocused(false)
        setNotificationsOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const closeNav = () => setMobileOpen(false)

  return (
    <div className={cn("preview-exchange", terminal && "preview-exchange-terminal")}>
      <header className="preview-topbar">
        <button
          type="button"
          className="preview-mobile-menu"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
        >
          <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
        </button>

        <Link href={PREVIEW_ROUTES.dashboard} className="preview-topbar-brand">
          <Image src="/worldstreet-logo/WorldStreet1.png" alt="WorldStreet" width={30} height={30} priority />
          <span>WorldStreet</span>
        </Link>

        <nav className="preview-top-nav" aria-label="Primary">
          {TOP_NAV.map((item) => {
            const active = item.label === "Exchange" ? pathname === PREVIEW_ROUTES.dashboard : isActive(pathname, item.href)
            return (
              <Link key={item.label} href={item.href} className="preview-top-nav-item" data-active={active ? "true" : undefined}>
                {item.label}
                {item.label === "Trade" && <HugeiconsIcon icon={ArrowDown01Icon} className="preview-top-nav-chevron" />}
              </Link>
            )
          })}
          <span className="preview-top-nav-item preview-top-nav-muted">Buy crypto <HugeiconsIcon icon={ArrowDown01Icon} className="preview-top-nav-chevron" /></span>
          <span className="preview-top-nav-item preview-top-nav-muted">More <HugeiconsIcon icon={ArrowDown01Icon} className="preview-top-nav-chevron" /></span>
        </nav>

        <div className="preview-topbar-search-wrap">
          <div className="preview-topbar-search">
            <HugeiconsIcon icon={Search01Icon} className="preview-topbar-search-icon" />
            <input
              id="preview-exchange-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Search markets, assets, features"
              aria-label="Search markets, assets, features"
            />
            <kbd>Ctrl K</kbd>
          </div>
          {searchFocused && (
            <div className="preview-search-popover">
              <p className="preview-search-heading">Markets</p>
              {searchResults.length > 0 ? searchResults.map((result) => (
                <Link key={result.label} href={result.href} className="preview-search-result" onClick={() => setSearchFocused(false)}>
                  <span className="preview-search-symbol">{result.label.split("/")[0]}</span>
                  <span>
                    <strong>{result.label}</strong>
                    <small>{result.detail}</small>
                  </span>
                </Link>
              )) : <span className="preview-search-empty">No markets match “{search}”.</span>}
              <span className="preview-search-hint">Press Esc to close</span>
            </div>
          )}
        </div>

        <div className="preview-topbar-actions">
          <Link href={PREVIEW_ROUTES.wallet} className="preview-deposit-button" aria-label="Deposit" title="Deposit">
            <HugeiconsIcon icon={ArrowDownLeft01Icon} className="h-4 w-4" />
            <span>Deposit</span>
          </Link>
          <Link href={PREVIEW_ROUTES.wallet} className="preview-top-action-link">Assets <HugeiconsIcon icon={ArrowDown01Icon} className="preview-top-action-chevron" /></Link>
          <Link href={PREVIEW_ROUTES.transactions} className="preview-top-action-link preview-orders-link">Orders <HugeiconsIcon icon={ArrowDown01Icon} className="preview-top-action-chevron" /></Link>
          <div className="preview-notification-wrap">
            <button
              type="button"
              className="preview-icon-button"
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <HugeiconsIcon icon={Notification03Icon} className="h-[18px] w-[18px]" />
              <span className="preview-notification-dot" />
            </button>
            {notificationsOpen && (
              <div className="preview-notification-popover">
                <div className="preview-popover-header"><strong>Notifications</strong><span>Demo</span></div>
                <div className="preview-notification-row"><span className="preview-status-dot" /> Market data is up to date <small>now</small></div>
                <div className="preview-notification-row"><span className="preview-status-dot preview-status-dot-muted" /> Complete identity verification to unlock trading <small>1h</small></div>
              </div>
            )}
          </div>
          <button type="button" className="preview-profile-button" onClick={() => setNotificationsOpen(false)} aria-label="Demo account">
            <span className="preview-profile-avatar">T</span>
            <HugeiconsIcon icon={ArrowDown01Icon} className="preview-profile-chevron" />
          </button>
        </div>
      </header>

      <div className="preview-exchange-body">
        {!terminal && (
          <>
            {mobileOpen && <button className="preview-mobile-scrim" aria-label="Close navigation" onClick={closeNav} />}
            <aside className={cn("preview-nav-rail", mobileOpen && "preview-nav-rail-open")}>
              <PreviewNav pathname={pathname} onNavigate={closeNav} />
            </aside>
          </>
        )}

        <main className="preview-exchange-main">
          {terminal && (
            <div className="preview-terminal-strip">
              <span className="preview-terminal-status"><span /> Demo market data</span>
              <span>All values are simulated for review</span>
              <Link href={PREVIEW_ROUTES.markets}>Back to markets</Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
