"use client"

/**
 * Home on a phone. The desktop composition stacked a greeting panel, a
 * verification card and a chart-sized portfolio panel before the first
 * number you act on — a full screen of preamble. Here the money is the
 * first thing on the page, the verbs sit under it, and the market is one
 * thumb-scroll away:
 *
 *   balance + P&L + Deposit → four round actions → one slim nudge → a
 *   tabbed market list (your holdings, hot, gainers, losers) → sentiment →
 *   recent trades.
 *
 * Same data as the desktop page (useDashboardData), same dialogs, same
 * privacy switch. Rendered under 768px only (dashboard.tsx).
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDataTransferHorizontalIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  CreditCardIcon,
  Download04Icon,
  HelpCircleIcon,
  SecurityCheckIcon,
  SentIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { SendModal } from "@/components/crypto/SendModal"
import { openWelcomeGuide } from "@/components/welcome-guide"
import { formatPrice, formatQty, formatUSD } from "@/components/dashboard/redesign/format"
import { holdingValue, useDashboardData } from "@/components/dashboard/redesign/data"
import { Icon, Panel, SLIDE, usePrivacy, type IconSvg } from "@/components/dashboard/redesign/ui"

/** The same destination as the desktop greeting's "Verify now". */
const VERIFICATION_URL = "https://www.worldstreetgold.com/verification"
const VERIFY_DISMISSED_KEY = "ws:home:verify-dismissed"

/* ── Balance ──────────────────────────────────────────────────────────── */

function BalanceHead({ onDeposit }: { onDeposit: () => void }) {
  const { hidden, toggle } = usePrivacy()
  const { portfolio, history, dailyPnL, error } = useDashboardData()
  const total = portfolio.total
  const dayPct = history.changes.today
  const up = dailyPnL >= 0

  return (
    <section data-onboarding="dash-greeting" className="relative pt-1">
      <div className="relative flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-medium text-muted-foreground">Total assets</h2>
        <button
          type="button"
          onClick={toggle}
          aria-label={hidden ? "Show balances" : "Hide balances"}
          aria-pressed={hidden}
          className={cn(
            "-m-1.5 flex size-8 items-center justify-center rounded-full transition-colors active:bg-foreground/[0.06]",
            hidden ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Icon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-[16px]" />
        </button>
      </div>

      <div className="relative mt-1.5 flex items-center justify-between gap-3">
        <div className="min-w-0 font-display text-[36px] font-semibold leading-none tracking-[-0.045em] text-foreground tabular-nums min-[400px]:text-[40px]">
          {error ? (
            <span className="text-[15px] font-medium tracking-normal text-muted-foreground">Prices aren&apos;t loading</span>
          ) : hidden ? (
            <span className="tracking-[0.04em]">••••••</span>
          ) : (
            <RollingAmount value={formatUSD(total)} />
          )}
        </div>
        <button
          type="button"
          onClick={onDeposit}
          data-vivid-target="open-deposit"
          data-vivid-label="Show your wallet addresses to deposit crypto"
          className="ds-gold flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-[14.5px] font-semibold active:scale-[0.97]"
        >
          <Icon icon={Download04Icon} className="size-[17px]" strokeWidth={2} />
          Deposit
        </button>
      </div>

      <p className="relative mt-2.5 flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground">
        <span>Today&apos;s P&amp;L</span>
        {hidden ? (
          <span className="font-semibold text-foreground/80">••••</span>
        ) : dailyPnL === 0 && dayPct === null ? (
          <span className="font-semibold tabular-nums text-foreground/80">{formatUSD(0)}</span>
        ) : (
          <span className={cn("font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
            {`${up ? "+" : "−"}${formatUSD(Math.abs(dailyPnL))}`}
            {dayPct !== null && ` (${dayPct >= 0 ? "+" : "−"}${Math.abs(dayPct).toFixed(2)}%)`}
          </span>
        )}
      </p>
    </section>
  )
}

/* ── Actions ──────────────────────────────────────────────────────────── */

type Action = { label: string; icon: IconSvg; href?: string; onClick?: () => void; vivid?: { target: string; label: string } }

function ActionRow({ onSend }: { onSend: () => void }) {
  const actions: Action[] = [
    { label: "Buy", icon: CreditCardIcon, href: "/buy", vivid: { target: "go-fiat-buy", label: "Buy crypto with African local currency or USD" } },
    { label: "Send", icon: SentIcon, onClick: onSend, vivid: { target: "open-send", label: "Send crypto out of your wallet" } },
    { label: "Swap", icon: ArrowDataTransferHorizontalIcon, href: "/swap" },
    // The welcome guide asks people to reopen it from Home.
    { label: "Guide", icon: HelpCircleIcon, onClick: openWelcomeGuide, vivid: { target: "open-welcome-guide", label: "Open the guide to Worldstreet" } },
  ]
  return (
    <nav aria-label="Quick actions" data-onboarding="dash-actions" className="grid grid-cols-4 gap-2">
      {actions.map((a) => {
        const body = (
          <>
            <span className="flex size-[52px] items-center justify-center rounded-full border border-foreground/[0.08] bg-foreground/[0.045] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-colors group-active:border-primary/40 group-active:text-primary">
              <Icon icon={a.icon} className="size-[21px]" strokeWidth={1.8} />
            </span>
            <span className="text-[12px] font-medium text-foreground/85">{a.label}</span>
          </>
        )
        const cls = "group flex flex-col items-center gap-2 rounded-2xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        const vivid = a.vivid ? { "data-vivid-target": a.vivid.target, "data-vivid-label": a.vivid.label } : {}
        return a.href ? (
          <Link key={a.label} href={a.href} className={cls} {...vivid}>
            {body}
          </Link>
        ) : (
          <button key={a.label} type="button" onClick={a.onClick} className={cls} {...vivid}>
            {body}
          </button>
        )
      })}
    </nav>
  )
}

/* ── Verification nudge ───────────────────────────────────────────────────
   One line, dismissible. The app has no verification status to hide it by,
   so the person decides; the choice lives in this browser only. */

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(VERIFY_DISMISSED_KEY, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(VERIFY_DISMISSED_KEY, cb)
  }
}

function readDismissed() {
  try {
    return window.localStorage.getItem(VERIFY_DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function VerifyNudge() {
  // Server snapshot says "shown": most people haven't dismissed it, and the
  // strip appearing after hydration would shove the list under a thumb.
  const dismissed = React.useSyncExternalStore(subscribeStorage, readDismissed, () => false)
  const dismiss = () => {
    try {
      window.localStorage.setItem(VERIFY_DISMISSED_KEY, "1")
    } catch {
      /* blocked storage: it just comes back next visit */
    }
    window.dispatchEvent(new Event(VERIFY_DISMISSED_KEY))
  }

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--primary)_11%,transparent),color-mix(in_oklab,var(--primary)_3%,transparent))] py-2.5 pl-3 pr-1.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon icon={SecurityCheckIcon} className="size-[19px]" strokeWidth={1.9} />
            </span>
            <a href={VERIFICATION_URL} className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13.5px] font-semibold text-foreground">Verify your identity</span>
              <span className="truncate text-[12px] text-muted-foreground">Unlock higher limits and more features</span>
            </a>
            <a href={VERIFICATION_URL} aria-hidden tabIndex={-1} className="text-primary">
              <Icon icon={ArrowRight01Icon} className="size-[18px]" strokeWidth={2} />
            </a>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss verification reminder"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/[0.06]"
            >
              <Icon icon={Cancel01Icon} className="size-[15px]" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Market list ──────────────────────────────────────────────────────────
   One list, four views. Holdings leads when there are any: on Home the first
   question is "what do I own and how is it doing", the market second. */

type ListTab = "holdings" | "hot" | "gainers" | "losers"
const LIST_ROWS = 8

function ChangePill({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="flex h-8 min-w-[78px] items-center justify-center rounded-lg bg-foreground/[0.06] text-[13px] font-semibold text-muted-foreground">—</span>
  }
  const up = value >= 0
  return (
    <span
      className={cn(
        "flex h-8 min-w-[78px] items-center justify-center rounded-lg px-2 text-[13px] font-semibold tabular-nums text-white",
        up ? "bg-credit" : "bg-debit",
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

function RowSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 py-3">
      <span className="skel size-9 shrink-0 rounded-full" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="skel h-3 w-16 rounded-md" />
        <span className="skel h-2.5 w-24 rounded-md" />
      </span>
      <span className="skel h-8 w-[78px] rounded-lg" />
    </div>
  )
}

function MarketList() {
  const { coins, holdings, holdingsSettled } = useDashboardData()
  const { hidden } = usePrivacy()
  const owned = holdings.filter((h) => holdingValue(h) >= 0.01)
  const [picked, setPicked] = React.useState<ListTab | null>(null)
  // Until the person picks, follow the data: holdings once there are some.
  const tab: ListTab = picked ?? (holdingsSettled && owned.length > 0 ? "holdings" : "hot")

  const priced = coins.filter((c) => c.price > 0 && Number.isFinite(c.change24h))
  const hasMoves = priced.some((c) => c.change24h !== 0)
  const marketRows =
    tab === "hot"
      ? [...priced].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      : tab === "gainers"
        ? priced.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h)
        : priced.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h)

  const tabs: { key: ListTab; label: string }[] = [
    { key: "holdings", label: "Holdings" },
    { key: "hot", label: "Hot" },
    { key: "gainers", label: "Gainers" },
    { key: "losers", label: "Losers" },
  ]

  let body: React.ReactNode
  if (tab === "holdings") {
    body = !holdingsSettled ? (
      <>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </>
    ) : owned.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-8 text-center">
        <p className="text-[14px] font-semibold text-foreground">Nothing here yet</p>
        <p className="max-w-[260px] text-[12.5px] text-muted-foreground">Deposit or buy crypto and your coins show up here with their live value.</p>
        <Link href="/buy" className="mt-3 inline-flex h-9 items-center rounded-full border border-foreground/[0.1] px-4 text-[13px] font-semibold text-foreground active:bg-foreground/[0.05]">
          Buy crypto
        </Link>
      </div>
    ) : (
      owned.slice(0, LIST_ROWS).map((h) => (
        <Link key={h.symbol} href="/wallet/modern" className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 active:bg-foreground/[0.04]">
          <CoinAvatar symbol={h.symbol} size="lg" className="size-9 ring-1 ring-foreground/10" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[15px] font-semibold text-foreground">{h.symbol}</span>
            <span className="truncate text-[12px] tabular-nums text-muted-foreground">{hidden ? "••••" : formatQty(h.amount)}</span>
          </span>
          <span className="flex flex-col items-end leading-tight">
            <span className="text-[14.5px] font-semibold tabular-nums text-foreground">{hidden ? "••••" : formatUSD(holdingValue(h))}</span>
            <span className={cn("text-[12px] font-medium tabular-nums", h.changePct === null ? "text-muted-foreground" : h.changePct >= 0 ? "text-credit" : "text-debit")}>
              {h.changePct === null ? "—" : `${h.changePct >= 0 ? "+" : "−"}${Math.abs(h.changePct).toFixed(2)}%`}
            </span>
          </span>
        </Link>
      ))
    )
  } else if (priced.length === 0) {
    body = <p className="py-8 text-center text-[13px] text-muted-foreground">Market prices aren&apos;t available right now.</p>
  } else if (tab !== "hot" && (!hasMoves || marketRows.length === 0)) {
    body = (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        {!hasMoves ? "24-hour changes aren't available right now." : tab === "gainers" ? "Nothing is up in the last 24 hours." : "Nothing is down in the last 24 hours."}
      </p>
    )
  } else {
    body = marketRows.slice(0, LIST_ROWS).map((c) => (
      <Link key={c.id || c.symbol} href={`/trade?symbol=${encodeURIComponent(c.symbol)}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 active:bg-foreground/[0.04]">
        <CoinAvatar symbol={c.symbol} src={c.image} size="lg" className="size-9 ring-1 ring-foreground/10" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[15px] font-semibold text-foreground">
            {c.symbol}
            <span className="text-[12px] font-medium text-muted-foreground"> / USD</span>
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            {c.name}
            {c.volume24h > 0 && ` · ${formatUSD(c.volume24h, { compact: true })}`}
          </span>
        </span>
        <span className="text-right text-[14.5px] font-semibold tabular-nums text-foreground">{formatPrice(c.price)}</span>
        <ChangePill value={hasMoves ? c.change24h : null} />
      </Link>
    ))
  }

  return (
    <Panel className="flex flex-col px-4 pb-2 pt-3.5" data-onboarding="dash-markets">
      <div role="tablist" aria-label="Market list" className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setPicked(t.key)}
            className={cn(
              "relative h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition-colors",
              tab === t.key ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {tab === t.key && <motion.span layoutId="home-list-tab" transition={SLIDE} className="absolute inset-0 rounded-full bg-foreground/[0.07]" />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-foreground/[0.04]">{body}</div>

      <Link
        href={tab === "holdings" ? "/wallet/modern" : "/trading/markets"}
        className="mt-1 flex h-11 items-center justify-center gap-1 border-t border-foreground/[0.05] text-[13px] font-semibold text-primary"
      >
        {tab === "holdings" ? "View wallet" : "View all markets"}
        <Icon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
      </Link>
    </Panel>
  )
}

/* ── Composition ──────────────────────────────────────────────────────── */

export function MobileHome({ after }: { after?: React.ReactNode }) {
  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)
  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <BalanceHead onDeposit={() => setReceiveOpen(true)} />
      </div>
      <div className="rise" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <ActionRow onSend={() => setSendOpen(true)} />
      </div>
      {/* empty:hidden — once dismissed, no stray gap where the strip was. */}
      <div className="rise empty:hidden" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        <VerifyNudge />
      </div>
      <div className="rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
        <MarketList />
      </div>
      {after}
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
      <SendModal open={sendOpen} onOpenChange={setSendOpen} />
    </div>
  )
}

/** The loading shape of MobileHome, so the page doesn't flash the old panels. */
export function MobileHomeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 pt-1">
        <span className="skel h-3.5 w-24 rounded-md" />
        <div className="flex items-center justify-between gap-3">
          <span className="skel h-9 w-44 rounded-lg" />
          <span className="skel h-11 w-[118px] rounded-full" />
        </div>
        <span className="skel h-3 w-36 rounded-md" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="flex flex-col items-center gap-2 py-1">
            <span className="skel size-[52px] rounded-full" />
            <span className="skel h-2.5 w-10 rounded-md" />
          </span>
        ))}
      </div>
      <Panel className="flex flex-col px-4 pb-2 pt-3.5">
        <span className="skel mb-1 h-9 w-56 rounded-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </Panel>
    </div>
  )
}
