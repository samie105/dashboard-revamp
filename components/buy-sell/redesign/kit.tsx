"use client"

/**
 * Buy / Sell: the preview's page (components/buy-sell-unauth/*) as a skin
 * for the real fiat flows. Look only — every request, guard and poll stays in
 * the flow components (FiatBuyFlow, FiatSellRouter…), which render these
 * pieces in place of the classic ones when their variant is "redesign".
 *
 * What the preview shows with no real counterpart (agreed with the owner):
 *  · Limits card — "Min $5" is the product minimum (MINIMUM_BUY_USD); the
 *    $5,000 is display-only text, nothing is blocked above it. The usage bar
 *    is an empty track with "— used": there's no usage data to fill it.
 *  · "Why" card — the preview's three lines rewritten to be true of the flow
 *    (a quote doesn't reserve funds, fees exist, timing varies).
 *  · Recent orders — GET /fiat/orders. The order carries no paid / received
 *    amounts, so a row shows when it last moved where the preview shows
 *    figures. Not the reference: real references carry the provider's name.
 *  · The coin price card — not shown: the buyable assets come from
 *    /fiat/config and are stablecoins, which the preview never charts.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { AlertCircleIcon, Clock01Icon, Shield01Icon, Wallet02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Icon, Panel, PanelTitle, SLIDE, type IconSvg } from "@/components/dashboard/redesign/ui"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { useFiatConfig } from "@/hooks/crypto/useFiatConfig"
import { useFiatOrders } from "@/hooks/crypto/useFiatOrders"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import { MINIMUM_BUY_USD } from "@/lib/crypto-backend/fiat-onramp"
import { FIAT_ORDER_PAUSE_STATES, FIAT_ORDER_TERMINAL_STATES } from "@/lib/crypto-backend/fiat-poll-schedule"
import type { FiatOrder } from "@/lib/crypto-backend/types"

export type TradeMode = "buy" | "sell"

const PAGE: Record<TradeMode, { title: string; subtitle: string }> = {
  buy: { title: "Buy crypto", subtitle: "Pay locally and receive crypto directly in your Worldstreet wallet" },
  sell: { title: "Sell crypto", subtitle: "Send crypto from your Worldstreet wallet and get paid to your bank account" },
}

/** Display-only per-order cap, agreed with the owner. Not enforced. */
const DISPLAY_MAX_USD = 5000

/* ── Page frame ───────────────────────────────────────────────────────── */

/**
 * The page: heading, then the ticket beside the side column. `tabs` puts the
 * Buy | Sell switch at the top of the ticket (the order screen goes without,
 * as in the preview); `head` sits to its right (the quote clock).
 */
export function TradeFrame({ mode, tabs = true, head, children }: { mode: TradeMode; tabs?: boolean; head?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer [&_[role=option]]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 pb-28 md:gap-5 md:p-6 md:pb-6">
      <Rise>
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">{PAGE[mode].title}</h1>
          <p className="text-[14px] text-muted-foreground">{PAGE[mode].subtitle}</p>
        </div>
      </Rise>
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
          {/* overflow-visible: the pickers drop out of their rows. */}
          <Panel className="overflow-visible p-4 sm:p-6">
            <div className="flex flex-col gap-5">
              {tabs && (
                <div className="flex items-center justify-between gap-3">
                  <TradeTabs mode={mode} />
                  {head}
                </div>
              )}
              {children}
            </div>
          </Panel>
        </div>
        <SideColumn mode={mode} />
      </div>
    </DashScope>
  )
}

/** Buy | Sell — links between the two routes. */
export function TradeTabs({ mode }: { mode: TradeMode }) {
  return (
    <div role="tablist" className="grid w-[220px] shrink-0 grid-cols-2 gap-1 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.025] p-1">
      {(["buy", "sell"] as const).map((m) => (
        <Link
          key={m}
          role="tab"
          aria-selected={m === mode}
          href={m === "buy" ? "/buy" : "/sell"}
          scroll={false}
          className={cn(
            "relative flex h-10 items-center justify-center rounded-xl text-[14px] font-semibold capitalize transition-colors",
            m === mode ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === mode && <span className="dash-gold-btn absolute inset-0 rounded-xl" />}
          <span className="relative">{m}</span>
        </Link>
      ))}
    </div>
  )
}

/** A segmented switch in the preview's network-button style (rail choice). */
export function Segments<T extends string>({ label, options, value, onChange, id }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (key: T) => void; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">{label}</span>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={o.key === value}
            className={cn(
              "relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl border px-2 text-[13px] font-semibold transition-colors",
              o.key === value ? "border-primary/55 text-foreground" : "border-foreground/[0.07] text-muted-foreground hover:border-foreground/[0.14] hover:text-foreground",
            )}
          >
            {o.key === value && <motion.span layoutId={id} transition={SLIDE} className="absolute inset-0 rounded-xl bg-primary/[0.08]" />}
            <span className="relative truncate">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Stand-ins for the classic flow kit (same props) ──────────────────── */

/** UnavailablePanel's props and fallbacks (components/ui/flow.tsx), in the preview's look. */
export function TradeUnavailable({
  title,
  reason,
  tone = "warning",
  action,
}: {
  title: string
  reason?: string
  icon?: unknown
  tone?: "warning" | "muted"
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
      <span className={cn("flex size-14 items-center justify-center rounded-full", tone === "warning" ? "bg-warning/[0.12] text-warning" : "bg-foreground/[0.06] text-muted-foreground")}>
        <Icon icon={AlertCircleIcon} className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <span className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">{title}</span>
        <span className="text-[13.5px] leading-relaxed text-muted-foreground">{reason || "This is usually brief — check back in a few minutes."}</span>
      </div>
      {action ? (
        action.href ? (
          <Link href={action.href} className="dash-gold-btn flex h-11 items-center justify-center rounded-xl px-5 text-[14px] font-semibold">{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} className="dash-gold-btn h-11 rounded-xl px-5 text-[14px] font-semibold">{action.label}</button>
        )
      ) : (
        <Link href="/" className="flex h-11 items-center justify-center rounded-xl border border-foreground/[0.08] px-5 text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          Back to dashboard
        </Link>
      )}
    </div>
  )
}

/** FlowSkeleton, in the ticket's shapes. */
export function TradeSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="Loading">
      <span className="skel h-[132px] rounded-2xl" />
      <span className="skel h-[104px] rounded-2xl" />
      <span className="skel mt-3 h-[64px] rounded-2xl" />
      <span className="skel mt-3 h-[120px] rounded-2xl" />
      <span className="skel mt-3 h-[52px] rounded-2xl" />
    </div>
  )
}

/** AnnouncementBanner's props, in the preview's look. "info" is InlineNotice's neutral tone. */
export function TradeNotice({ title, detail, tone = "warning", action }: { title: string; detail?: React.ReactNode; tone?: "warning" | "error" | "info"; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3", tone === "error" ? "border-debit/30 bg-debit/[0.06]" : tone === "info" ? "border-foreground/[0.07] bg-foreground/[0.02]" : "border-warning/25 bg-warning/[0.06]")}>
      <Icon icon={AlertCircleIcon} className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-debit" : tone === "info" ? "text-muted-foreground" : "text-warning")} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px] leading-relaxed">
        <span className={cn(tone === "info" ? "text-foreground/90" : "font-semibold", tone === "error" ? "text-debit" : tone === "info" ? "" : "text-warning")}>{title}</span>
        {detail && <span className="text-muted-foreground">{detail}</span>}
        {action && (action.href ? (
          <Link href={action.href} className="self-start font-semibold text-foreground underline-offset-2 hover:underline">{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} className="self-start font-semibold text-foreground underline-offset-2 hover:underline">{action.label}</button>
        ))}
      </div>
    </div>
  )
}

/** FiatAction's props, as the preview's CTA: gold when it can act, neutral grey when blocked. */
export function TradeCta({ label, onClick, disabled, busy }: { label: string; onClick?: () => void; disabled?: boolean; busy?: boolean }) {
  const off = disabled || busy
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      aria-busy={busy || undefined}
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition-colors",
        off && !busy ? "border border-foreground/[0.07] bg-foreground/[0.04] text-muted-foreground" : "dash-gold-btn",
        busy && "opacity-80",
      )}
    >
      {busy && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {label}
    </button>
  )
}

/** A secondary action in the preview's outline style. */
export function TradeGhost({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center rounded-xl border border-foreground/[0.08] px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary disabled:opacity-45"
    >
      {label}
    </button>
  )
}

/* ── Side column ──────────────────────────────────────────────────────── */

function SideColumn({ mode }: { mode: TradeMode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-5">
      <div className="rise grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
        <LimitsCard mode={mode} />
        <WhyCard mode={mode} />
      </div>
      <div className="rise" style={{ "--rise-delay": "240ms" } as React.CSSProperties}>
        <RecentOrders />
      </div>
    </div>
  )
}

/** The $5 minimum is Buy's (MINIMUM_BUY_USD); there's no sell minimum in the code, so Sell doesn't show one. */
function LimitsCard({ mode }: { mode: TradeMode }) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Order limits</PanelTitle>
        {/* No usage data exists, so no percentage is claimed. */}
        <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">— used</span>
      </div>
      <span className="font-display text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
        ${DISPLAY_MAX_USD.toLocaleString("en-US")}
        <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">per order</span>
      </span>
      {/* The preview's usage bar, as an empty track: nothing reports what's been used. */}
      <span aria-hidden className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.07]" />
      <div className="mt-auto flex justify-between text-[12px] text-muted-foreground">
        {mode === "buy" ? <span>Min ${MINIMUM_BUY_USD} per order</span> : <span />}
        <span>Max ${DISPLAY_MAX_USD.toLocaleString("en-US")} per order</span>
      </div>
    </Panel>
  )
}

const REASONS: Record<TradeMode, { icon: IconSvg; title: string; body: string }[]> = {
  buy: [
    { icon: Shield01Icon, title: "See the price first", body: "Rate, fees and expiry are shown before you order." },
    { icon: Wallet02Icon, title: "Straight to your wallet", body: "Crypto lands in your Worldstreet wallet." },
    { icon: Clock01Icon, title: "Track every step", body: "Your order updates until it's done." },
  ],
  sell: [
    { icon: Shield01Icon, title: "Review before you sign", body: "Check the amount and destination before anything is sent." },
    { icon: Wallet02Icon, title: "Signed from your wallet", body: "You approve the transfer in your Worldstreet wallet." },
    { icon: Clock01Icon, title: "Track every step", body: "Your order updates until it's done." },
  ],
}

function WhyCard({ mode }: { mode: TradeMode }) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <PanelTitle className="text-[16px]">{mode === "buy" ? "Why buy here" : "Why sell here"}</PanelTitle>
      <ul className="flex flex-col gap-3.5">
        {REASONS[mode].map((r) => (
          <li key={r.title} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary">
              <Icon icon={r.icon} className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold text-foreground">{r.title}</span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{r.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ── Recent orders (GET /fiat/orders) ─────────────────────────────────── */

const RECENT_LIMIT = 50
const RECENT_SHOWN = 5

function statusTone(state: string): string {
  if (state === "completed") return "bg-credit/[0.1] text-credit"
  if (FIAT_ORDER_TERMINAL_STATES.has(state)) return "bg-debit/[0.12] text-debit"
  if (FIAT_ORDER_PAUSE_STATES.has(state)) return "bg-warning/[0.12] text-warning"
  return "bg-warning/[0.12] text-warning"
}

function ago(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const m = Math.max(0, Math.round((now - t) / 60_000))
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

function RecentOrders() {
  const orders = useFiatOrders(RECENT_LIMIT)
  const config = useFiatConfig()
  // Relative times only after mount, so server and client render the same.
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => setNow(Date.now()), [])

  // The order's `asset` is the provider asset id; the symbol comes from the
  // matching /fiat/config asset route, when there is one.
  const symbolOf = (asset: string) => config.data?.assetRoutes?.find((r) => r.providerAssetId === asset)?.symbol
  const rows = [...(orders.data ?? [])]
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))
    .slice(0, RECENT_SHOWN)

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex items-baseline justify-between px-2">
        <PanelTitle className="text-[16px]">Recent orders</PanelTitle>
        <span className="text-[12px] text-muted-foreground">Buy &amp; sell</span>
      </div>
      {orders.isLoading ? (
        <ul className="flex flex-col" aria-busy aria-label="Loading orders">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-2 py-2.5">
              <span className="skel size-9 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="skel h-3.5 w-40 rounded" />
                <span className="skel h-3 w-24 rounded" />
              </span>
            </li>
          ))}
        </ul>
      ) : orders.error && !orders.data ? (
        <div className="flex flex-col gap-3 px-2 pb-2">
          <FiatErrorDetail error={describeFiatError(orders.error)} />
          <button type="button" onClick={() => void orders.refetch()} className="self-start text-[13px] font-semibold text-foreground underline-offset-2 hover:underline">
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-2 pb-3 text-[13px] text-muted-foreground">No orders yet. Your buys and sells will show here.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((o) => <OrderRow key={o.id} order={o} symbol={symbolOf(o.asset)} now={now} />)}
        </ul>
      )}
    </Panel>
  )
}

/** "ach" → "ACH", "BANK" → "Bank". */
const channelLabel = (c: string) => (c.length <= 3 ? c.toUpperCase() : humanizeValue(c))

function OrderRow({ order: o, symbol, now }: { order: FiatOrder; symbol?: string; now: number | null }) {
  const buy = o.direction === "onramp"
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-foreground/[0.025]">
      {symbol ? (
        <CoinAvatar symbol={symbol} size="lg" className="size-9 ring-1 ring-foreground/10" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground">
          <Icon icon={Wallet02Icon} className="size-4" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-semibold">
          <span className={buy ? "text-credit" : "text-debit"}>{buy ? "Bought" : "Sold"}</span>
          {symbol ?? "crypto"}
          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]", statusTone(o.state))}>{humanizeValue(o.state)}</span>
        </span>
        <span className="truncate text-[12px] text-muted-foreground">
          {buy ? `Paid in ${o.currency}` : `Paid out in ${o.currency}`} · {channelLabel(o.channel)}
        </span>
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{now === null ? "" : ago(o.updatedAt || o.createdAt, now)}</span>
    </li>
  )
}
