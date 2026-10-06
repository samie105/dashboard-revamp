"use client"

/**
 * The buy / sell page body: the order form, and beside it what you'd want
 * to know before pressing the button — the coin's price, how much of today's
 * limit is left, and how your recent orders went.
 *
 * The coin choice lives here, not in the form, so the price card follows
 * whatever coin the form is set to.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { FlashIcon, Shield01Icon, Wallet02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  ASSETS,
  FIATS,
  LIMITS,
  RECENT_ORDERS,
  formatCoin,
  formatFiat,
  formatPrice,
  type Mode,
  type Order,
} from "@/components/buy-sell-unauth/trade-data"
import { Ticket } from "@/components/buy-sell-unauth/ticket"
import { ChangeChip, Figure, Icon, Panel, PanelTitle, Spark, type IconSvg } from "@/components/redesign/ui"

/* ── Price card ───────────────────────────────────────────────────────── */

function PriceCard({ symbol }: { symbol: string }) {
  const a = ASSETS.find((x) => x.symbol === symbol) ?? ASSETS[0]
  return (
    <Panel className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CoinAvatar symbol={a.symbol} size="lg" className="size-11 ring-1 ring-white/10" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[17px] font-semibold text-foreground">{a.name}</span>
            <span className="text-[12.5px] text-muted-foreground">{a.symbol} · 7 days</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <motion.span
            key={a.symbol}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground"
          >
            ${formatPrice(a.price)}
          </motion.span>
          <ChangeChip value={a.changePct} size="sm" />
        </div>
      </div>
      <motion.div key={`chart-${a.symbol}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <Spark points={a.series} width={600} height={120} tone="brand" fluid />
      </motion.div>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]">
        {[
          { k: "7d high", v: `$${formatPrice(a.high)}` },
          { k: "7d low", v: `$${formatPrice(a.low)}` },
          { k: "You hold", v: formatCoin(a.held, a.symbol) },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-1 bg-[#111] px-3.5 py-3">
            <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
            <dd className="truncate text-[13.5px] font-semibold tabular-nums text-foreground">
              {s.k === "You hold" ? <Figure mask="••••">{s.v}</Figure> : s.v}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/* ── Limits ───────────────────────────────────────────────────────────── */

function LimitsCard() {
  const used = LIMITS.usedTodayUsd / LIMITS.dailyUsd
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Today&apos;s limit</PanelTitle>
        <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{Math.round(used * 100)}% used</span>
      </div>
      <span className="font-display text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
        ${(LIMITS.dailyUsd - LIMITS.usedTodayUsd).toLocaleString("en-US")}
        <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">left of ${LIMITS.dailyUsd.toLocaleString("en-US")}</span>
      </span>
      <span className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: used }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-primary/70 to-primary"
        />
      </span>
      <div className="flex justify-between text-[12px] text-muted-foreground">
        <span>Min ${LIMITS.minUsd} per order</span>
        <span>Max ${LIMITS.maxUsd.toLocaleString("en-US")} per order</span>
      </div>
    </Panel>
  )
}

/* ── Why ──────────────────────────────────────────────────────────────── */

const REASONS: { icon: IconSvg; title: string; body: string }[] = [
  { icon: FlashIcon, title: "Delivered in minutes", body: "Most orders settle in under a minute." },
  { icon: Wallet02Icon, title: "No fee from your Dollar Account", body: "Card and bank carry a small, shown-upfront fee." },
  { icon: Shield01Icon, title: "Price locked when you confirm", body: "What you see is what you get — no slippage." },
]

function WhyCard() {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <PanelTitle className="text-[16px]">Why buy here</PanelTitle>
      <ul className="flex flex-col gap-3.5">
        {REASONS.map((r) => (
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

/* ── Recent orders ────────────────────────────────────────────────────── */

const ORDER_STATUS: Record<Order["status"], string> = {
  completed: "bg-credit/[0.1] text-credit",
  processing: "bg-warning/[0.12] text-warning",
  failed: "bg-debit/[0.12] text-debit",
}

function RecentOrders() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  const ago = (m: number) => (!ready ? " " : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`)

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex items-baseline justify-between px-2">
        <PanelTitle className="text-[16px]">Recent orders</PanelTitle>
        <span className="text-[12px] text-muted-foreground">Buy &amp; sell</span>
      </div>
      <ul className="flex flex-col">
        {RECENT_ORDERS.map((o) => {
          const fiat = FIATS.find((f) => f.code === o.fiat)!
          return (
            <li key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.025]">
              <CoinAvatar symbol={o.symbol} size="lg" className="size-9 ring-1 ring-white/10" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <span className={o.mode === "buy" ? "text-credit" : "text-debit"}>{o.mode === "buy" ? "Bought" : "Sold"}</span>
                  {o.symbol}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]", ORDER_STATUS[o.status])}>{o.status}</span>
                </span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {o.method} · {ago(o.minutesAgo)}
                </span>
              </span>
              <span className="flex flex-col items-end tabular-nums">
                <span className="text-[13px] font-semibold text-foreground"><Figure mask="••••">{formatCoin(o.amount, o.symbol)}</Figure></span>
                <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{formatFiat(o.fiatAmount, fiat, fiat.code === "NGN" ? 0 : 2)}</Figure></span>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ── Page body ────────────────────────────────────────────────────────── */

export function TradePage({ mode, initialAsset, initialMethod }: { mode: Mode; initialAsset?: string; initialMethod?: string }) {
  const valid = ASSETS.some((a) => a.symbol === initialAsset)
  const [asset, setAsset] = React.useState(valid ? initialAsset! : mode === "buy" ? "USDT" : "BTC")
  // Stablecoins hold $1 — there's no price to chart, so the card stands down
  // and the limits / reasons row moves up to fill its place.
  const showPrice = !ASSETS.find((a) => a.symbol === asset)?.stable

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <Ticket mode={mode} asset={asset} onAssetChange={setAsset} initialMethod={initialMethod} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <AnimatePresence initial={false}>
          {showPrice && (
            <motion.div
              key="price"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <PriceCard symbol={asset} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="rise grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
          <LimitsCard />
          <WhyCard />
        </div>
        <div className="rise" style={{ "--rise-delay": "240ms" } as React.CSSProperties}>
          <RecentOrders />
        </div>
      </div>
    </div>
  )
}

