"use client"

/**
 * The token page's market panels:
 *  · ChartPanel: Price (candles or line, 1H/6H/24H/7D/All) | Bonding curve;
 *  · WindowStats: change per rolling window (5m/1h/6h/24h), and the chosen
 *    window's volume and buys vs sells;
 *  · ActivityPanel: the live trade feed | holders.
 * Each reads through lib/launchpad-market/source.ts. Where the backend
 * doesn't serve a figure yet, the panel says so (and the chart opens on the
 * bonding curve, which is real); nothing is invented.
 */

import * as React from "react"
import { LinkSquare02Icon } from "@hugeicons/core-free-icons"

import { Icon, Panel, PillTabs, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { useLaunchCandles, useLaunchHolders, useLaunchTrades } from "@/hooks/launchpad/useLaunchpadMarket"
import { CHART_RANGES, isMarketUnavailable, MARKET_WINDOWS, type ChartRange, type LaunchMarketStats, type MarketWindow } from "@/lib/launchpad-market/types"
import { agoFrom } from "@/lib/launchpad-view"
import { compactCount, compactUsd, RANGE_LABEL, tinyPrice } from "@/lib/launchpad-market/view"
import { cn } from "@/lib/utils"
import { CandleChart, type ChartMode } from "../candle-chart"
import { BuySellBar, ChangeText } from "./board"

function Soon({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-foreground/[0.1] px-6 py-12 text-center">
      <p className="text-[13.5px] font-semibold text-foreground">{what} is coming soon</p>
      <p className="max-w-[44ch] text-[12.5px] text-muted-foreground">It appears here as soon as the launchpad starts serving it.</p>
    </div>
  )
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-[13px] text-debit">Couldn&apos;t load this right now.</p>
      <button type="button" onClick={onRetry} className="rounded-xl border border-foreground/[0.1] px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-foreground/[0.04]">Try again</button>
    </div>
  )
}

/* ── Chart ────────────────────────────────────────────────────────────── */

type ChartTab = "price" | "curve"

export function ChartPanel({ launchId, curve, live }: { launchId: string; curve: React.ReactNode; live: boolean }) {
  const [range, setRange] = React.useState<ChartRange>("24h")
  const [mode, setMode] = React.useState<ChartMode>("candles")
  const candles = useLaunchCandles(launchId, range)
  const priceUnavailable = isMarketUnavailable(candles.error)
  // Open on the price chart; on the curve while price history isn't served.
  const [picked, setPicked] = React.useState<ChartTab | null>(null)
  const tab: ChartTab = picked ?? (priceUnavailable && live ? "curve" : "price")

  return (
    <Panel className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-foreground/[0.06]">
        <UnderlineTabs
          id="lp-chart-tab"
          options={[{ key: "price" as const, label: "Price" }, ...(live ? [{ key: "curve" as const, label: "Bonding curve" }] : [])]}
          value={tab}
          onChange={setPicked}
          className="-mb-px"
        />
        {tab === "price" && !priceUnavailable && (
          <div className="flex items-center gap-2 pb-2">
            <PillTabs id="lp-chart-mode" size="sm" options={[{ key: "candles" as const, label: "Candles" }, { key: "line" as const, label: "Line" }]} value={mode} onChange={setMode} />
            <PillTabs id="lp-chart-range" size="sm" options={CHART_RANGES.map((r) => ({ key: r, label: RANGE_LABEL[r] }))} value={range} onChange={setRange} />
          </div>
        )}
      </div>
      {tab === "curve" ? (
        curve
      ) : priceUnavailable ? (
        <Soon what="Price history" />
      ) : candles.error ? (
        <Failed onRetry={() => void candles.refetch()} />
      ) : !candles.data ? (
        <span className="skel h-[340px] rounded-2xl" role="status" aria-label="Loading price chart" />
      ) : candles.data.length < 2 ? (
        <p className="px-2 py-16 text-center text-[13px] text-muted-foreground">Not enough trading in this range to draw a chart yet.</p>
      ) : (
        <div className={cn("transition-opacity", candles.isPlaceholderData && "opacity-55")}>
          <CandleChart candles={candles.data} mode={mode} />
        </div>
      )}
    </Panel>
  )
}

/* ── Rolling windows ──────────────────────────────────────────────────── */

export function WindowStats({ stats, loading, unavailable }: { stats: LaunchMarketStats | null; loading: boolean; unavailable: boolean }) {
  const [w, setW] = React.useState<MarketWindow>("24h")
  if (unavailable) return null
  if (loading || !stats) return <span className="skel h-[124px] rounded-[20px]" role="status" aria-label="Loading market stats" />
  const txns = stats.txns[w]
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div role="tablist" aria-label="Window" className="grid grid-cols-4 gap-1.5">
        {MARKET_WINDOWS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={w === k}
            onClick={() => setW(k)}
            className={cn("flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60", w === k ? "bg-foreground/[0.07] ring-1 ring-foreground/10" : "hover:bg-foreground/[0.04]")}
          >
            <span className="text-[11px] font-medium text-muted-foreground">{k}</span>
            <ChangeText value={stats.changePct[k]} className="text-[13.5px] font-semibold" />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[12.5px]">
        <span className="text-muted-foreground">Volume {w}</span>
        <span className="text-right font-semibold tabular-nums text-foreground">{compactUsd(stats.volumeUsd[w])}</span>
        <span className="text-muted-foreground">Trades {w}</span>
        <BuySellBar txns={txns} />
      </div>
    </Panel>
  )
}

/* ── Trades & holders ─────────────────────────────────────────────────── */

type ActivityTab = "trades" | "holders"

function txUrl(hash: string, devnet: boolean) {
  return `https://solscan.io/tx/${hash}${devnet ? "?cluster=devnet" : ""}`
}

export function ActivityPanel({ launchId, symbol, devnet, now }: { launchId: string; symbol: string; devnet: boolean; now: number }) {
  const [tab, setTab] = React.useState<ActivityTab>("trades")
  const trades = useLaunchTrades(launchId)
  const holders = useLaunchHolders(launchId)
  return (
    <Panel className="flex flex-col gap-2 pt-3">
      <div className="border-b border-foreground/[0.06] px-4 md:px-5">
        <UnderlineTabs
          id="lp-activity"
          options={[
            { key: "trades" as const, label: "Trades" },
            { key: "holders" as const, label: holders.data ? `Holders · ${holders.data.length}` : "Holders" },
          ]}
          value={tab}
          onChange={setTab}
          className="-mb-px"
        />
      </div>
      <div className="px-2 pb-3 md:px-3">
        {tab === "trades" ? (
          isMarketUnavailable(trades.error) ? (
            <div className="p-2"><Soon what="The trade feed" /></div>
          ) : trades.error ? (
            <Failed onRetry={() => void trades.refetch()} />
          ) : !trades.data ? (
            <div className="flex flex-col gap-2 p-2" role="status" aria-label="Loading trades">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="skel h-9 rounded-lg" />)}</div>
          ) : trades.data.length === 0 ? (
            <p className="px-2 py-10 text-center text-[13px] text-muted-foreground">No trades yet. Be the first to buy.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[560px] text-[12.5px] tabular-nums">
                <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Time</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Trader</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Side</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">SOL</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">${symbol}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Price</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium"><span className="sr-only">Transaction</span></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.data.map((t) => (
                    <tr key={t.id} className="border-t border-foreground/[0.04]">
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{agoFrom(t.at, now) || "now"}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn("font-mono text-[11.5px]", t.traderLabel === "You" ? "font-sans font-semibold text-primary" : "text-foreground/85")}>{t.traderLabel}</span>
                        {t.traderIsCreator && <span className="ml-1.5 rounded bg-primary/[0.12] px-1 text-[10px] font-bold uppercase text-primary">Dev</span>}
                      </td>
                      <td className={cn("px-2 py-1.5 font-semibold", t.side === "buy" ? "text-credit" : "text-debit")}>{t.side === "buy" ? "Buy" : "Sell"}</td>
                      <td className="px-2 py-1.5 text-right text-foreground">{t.solAmount.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-right text-foreground">{compactCount(t.tokenAmount)}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{tinyPrice(t.priceSol)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {t.txHash && (
                          <a href={txUrl(t.txHash, devnet)} target="_blank" rel="noopener noreferrer" aria-label="View transaction" className="inline-flex text-muted-foreground hover:text-foreground">
                            <Icon icon={LinkSquare02Icon} className="size-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : isMarketUnavailable(holders.error) ? (
          <div className="p-2"><Soon what="Holders" /></div>
        ) : holders.error ? (
          <Failed onRetry={() => void holders.refetch()} />
        ) : !holders.data ? (
          <div className="flex flex-col gap-2 p-2" role="status" aria-label="Loading holders">{[0, 1, 2, 3].map((i) => <span key={i} className="skel h-8 rounded-lg" />)}</div>
        ) : (
          <ol className="flex flex-col gap-1.5 p-2">
            {holders.data.map((h, i) => (
              <li key={`${h.label}-${i}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(80px,140px)_3.5rem] items-center gap-3 text-[12.5px]">
                <span className="text-right tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn("truncate", h.kind === "curve" ? "font-semibold text-foreground" : h.kind === "you" ? "font-semibold text-primary" : h.kind === "creator" ? "text-warning" : "font-mono text-[11.5px] text-foreground/85")}>{h.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden>
                  <span className={cn("block h-full rounded-full", h.kind === "curve" ? "bg-foreground/40" : h.kind === "creator" ? "bg-warning" : "bg-primary/70")} style={{ width: `${Math.min(100, h.pct)}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-foreground">{h.pct.toFixed(h.pct < 10 ? 2 : 1)}%</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  )
}
