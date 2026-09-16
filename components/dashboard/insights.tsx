"use client"

/**
 * Insights — four readouts, each answering one question with one figure.
 *
 * Every number is real and already on the client. Nothing here calls anything
 * the dashboard was not calling anyway: holdings come from `useWalletBalances`
 * and `useTradeAccount`, valuations from the price feed the hero already
 * polls, and the chain split from `usePortfolioTotal`.
 *
 * The preview version of this row carried a Fear & Greed dial and a monthly
 * traded-volume chart. Neither ships here, and that is deliberate — the
 * backend serves no sentiment index and no volume aggregate, so both would
 * have to be invented. A dashboard that shows one made-up figure among three
 * real ones teaches people not to trust the other three.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, Eyebrow, Skel, WeightBar, allocationColor } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { usePortfolioTotal } from "@/hooks/usePortfolioTotal"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { fetchPrices } from "@/lib/crypto-api"
import { chainLabel } from "@/lib/spot-market-search"
import type { CoinData } from "@/lib/actions"

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function compactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function priceOf(prices: Record<string, number>, symbol: string): number {
  return prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
}

/** A card that has nothing to say yet says so, rather than showing a zero. */
function Blank({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex flex-1 items-center px-4 pb-4 text-[12.5px] leading-relaxed text-muted-foreground">
      {children}
    </span>
  )
}

export function DashboardInsights({ coins }: { coins: CoinData[] }) {
  const { hidden } = useBalancePrivacy()
  const { balances: onChainBalances } = useWalletBalances()
  const { balances: hlAccountBalances, positions } = useTradeAccount()

  /* The hero polls prices on a 30s timer; this reads the same endpoint once
     on mount rather than starting a second clock. Valuations here are a
     snapshot for ranking, not a live ticker. */
  const [prices, setPrices] = React.useState<Record<string, number>>({})
  React.useEffect(() => {
    let cancelled = false
    fetchPrices()
      .then((res) => {
        if (cancelled) return
        const merged: Record<string, number> = { ...res.prices }
        for (const c of res.coins) {
          const key = c.symbol.toUpperCase()
          if (merged[key] === undefined && c.price > 0) merged[key] = c.price
        }
        setPrices(merged)
      })
      .catch(() => {
        /* the other three cards do not depend on this */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { chainTotals, onChain: onChainTotal, onChainSettled } = usePortfolioTotal(prices)

  const spotTokens = React.useMemo(
    () => (hlAccountBalances?.spotTokens ?? []).filter((t) => t.total > 0),
    [hlAccountBalances],
  )

  /* One valued row per symbol, ranked. Holdings and spot are the same coin
     from a person's point of view, so they add rather than compete. */
  const ranked = React.useMemo(() => {
    const bySymbol = new Map<string, number>()
    const add = (symbol: string, qty: number) => {
      const value = qty * priceOf(prices, symbol)
      if (!(value > 0)) return
      bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + value)
    }
    for (const b of onChainBalances) add(b.symbol, b.balance)
    for (const t of spotTokens) add(t.symbol, t.total)
    const rows = [...bySymbol.entries()].map(([symbol, value]) => ({ symbol, value }))
    rows.sort((a, b) => b.value - a.value)
    const total = rows.reduce((s, r) => s + r.value, 0)
    return { rows, total }
  }, [onChainBalances, spotTokens, prices])

  /** 24h change for a symbol, from the same coin list the hero prices with. */
  const changeOf = React.useCallback(
    (symbol: string) =>
      coins.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())?.change24h ?? null,
    [coins],
  )

  /* Best and worst of what you actually hold — not of the market, which is a
     different question and one the Markets card already answers. */
  const movers = React.useMemo(() => {
    const withChange = ranked.rows
      .map((r) => ({ ...r, change: changeOf(r.symbol) }))
      .filter((r): r is { symbol: string; value: number; change: number } => r.change !== null)
    if (withChange.length === 0) return null
    /* The enrichment that supplies 24h change is often missing, and then every
       coin reads exactly 0. A best and a worst that are both "+0.00%" is not a
       mover; it is a gap wearing a number, so the card keeps its empty state. */
    if (withChange.every((r) => r.change === 0)) return null
    const sorted = [...withChange].sort((a, b) => b.change - a.change)
    return { best: sorted[0], worst: sorted[sorted.length - 1], count: sorted.length }
  }, [ranked, changeOf])

  const chains = React.useMemo(() => {
    const rows = Object.entries(chainTotals ?? {})
      .map(([id, value]) => ({ id, value: value as number }))
      .filter((r) => r.value > 0)
    rows.sort((a, b) => b.value - a.value)
    return { rows, total: rows.reduce((s, r) => s + r.value, 0) }
  }, [chainTotals])

  const top = ranked.rows[0]
  const loading = !onChainSettled

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* ── Top holding ─────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Top holding" subtitle="Your largest single position" />
        {loading ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Skel className="h-8 w-8 rounded-full" />
            <Skel className="h-6 w-28" />
            <Skel className="h-2 w-full" />
          </div>
        ) : !top ? (
          <Blank>Nothing held yet. Your biggest coin shows up here once you own one.</Blank>
        ) : (
          <div className="flex flex-1 flex-col justify-between gap-4 px-4 pb-4">
            <div className="flex items-center gap-3">
              <CoinAvatar symbol={top.symbol} size="lg" />
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold">{top.symbol}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  {ranked.rows.length} {ranked.rows.length === 1 ? "asset" : "assets"} held
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[24px] font-light tabular-nums">
                  {hidden ? "••••" : usd(top.value)}
                </span>
                {changeOf(top.symbol) !== null && (
                  <span
                    className={cn(
                      "text-[13px] font-medium tabular-nums",
                      changeOf(top.symbol)! >= 0 ? "text-credit" : "text-debit",
                    )}
                  >
                    {changeOf(top.symbol)! >= 0 ? "+" : ""}
                    {changeOf(top.symbol)!.toFixed(2)}%
                  </span>
                )}
              </div>
              <WeightBar pct={(top.value / (ranked.total || 1)) * 100} rank={0} />
              <span className="text-[12px] text-muted-foreground">
                {((top.value / (ranked.total || 1)) * 100).toFixed(1)}% of your crypto
              </span>
            </div>
          </div>
        )}
      </CardShell>

      {/* ── Movers, among what you own ──────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Your movers" subtitle="Best and worst today" />
        {loading ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
          </div>
        ) : !movers ? (
          <Blank>
            No 24-hour figures for the coins you hold yet. This fills in once the price feed covers them.
          </Blank>
        ) : (
          <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
            {[
              { row: movers.best, label: "Best" },
              ...(movers.count > 1 ? [{ row: movers.worst, label: "Worst" }] : []),
            ].map(({ row, label }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl bg-foreground/[0.05] p-2.5">
                <CoinAvatar symbol={row.symbol} size="md" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[13px] font-semibold">{row.symbol}</span>
                  <span className="text-[11px] text-muted-foreground">{label} today</span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      row.change >= 0 ? "text-credit" : "text-debit",
                    )}
                  >
                    {row.change >= 0 ? "+" : ""}
                    {row.change.toFixed(2)}%
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {hidden ? "••••" : compactUsd(row.value)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardShell>

      {/* ── Where it lives ─────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Across chains" subtitle="Where your coins sit" />
        {loading ? (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Skel className="h-1.5 w-full rounded-full" />
            <Skel className="h-3 w-32" />
            <Skel className="h-3 w-24" />
          </div>
        ) : chains.rows.length === 0 ? (
          <Blank>Nothing on-chain yet. Each network you hold on appears here with its share.</Blank>
        ) : (
          <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
            <span className="flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
              {chains.rows.map((c, i) => (
                <span
                  key={c.id}
                  style={{ width: `${(c.value / chains.total) * 100}%`, background: allocationColor(i) }}
                />
              ))}
            </span>
            <div className="flex flex-col gap-1.5">
              {chains.rows.slice(0, 4).map((c, i) => (
                <span key={c.id} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: allocationColor(i) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{chainLabel(c.id)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {((c.value / chains.total) * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
            <span className="mt-auto text-[12px] text-muted-foreground">
              {chains.rows.length} {chains.rows.length === 1 ? "network" : "networks"} ·{" "}
              {hidden ? "••••" : usd(onChainTotal)}
            </span>
          </div>
        )}
      </CardShell>

      {/* ── Futures exposure ───────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <CardHeader title="Open risk" subtitle="Positions on the venue" />
        {positions.length === 0 ? (
          <div className="flex flex-1 flex-col justify-between gap-3 px-4 pb-4">
            <span className="text-[12.5px] leading-relaxed text-muted-foreground">
              No open positions. Anything you open on the futures venue is listed here with its size.
            </span>
            <Link
              href="/trade"
              className="ws-icon-mono inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Open the desk
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
            <Eyebrow className="text-[11px]">{positions.length} open</Eyebrow>
            {positions.slice(0, 3).map((p) => (
              <div
                key={`${p.symbol}-${p.size}`}
                className="flex items-center gap-2.5 rounded-xl bg-foreground/[0.05] p-2.5"
              >
                <CoinAvatar symbol={p.symbol} size="md" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[13px] font-semibold">{p.symbol}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {Math.abs(p.size).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11.5px] font-semibold uppercase",
                    p.size >= 0 ? "text-credit" : "text-debit",
                  )}
                >
                  {p.size >= 0 ? "Long" : "Short"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardShell>
    </div>
  )
}
