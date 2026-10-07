"use client"

/**
 * "My holdings" / "My positions": a block the preview doesn't have, so it
 * follows the table in the preview's table language. Same data and rules as
 * before (components/trading/markets-client.tsx): shown only while loading
 * or when there is something to show; value is balance × live price; PnL is
 * "—" where cost basis isn't recorded.
 */

import * as React from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Figure, MoreLink, Panel, PanelTitle } from "@/components/dashboard/redesign/ui"
import { price, qty, usd, pctSigned, UNKNOWN } from "@/lib/num"
import { formatPrice } from "@/lib/markets-view"
import type { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import type { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"

type Positions = ReturnType<typeof useHyperliquidPositions>["positions"]
type Holdings = ReturnType<typeof useHyperliquidBalance>["balances"]

function Shell({ title, count, children }: { title: string; count: number | null; children: React.ReactNode }) {
  return (
    <Panel className="pb-2">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-5 md:px-6">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle className="text-[17px]">{title}</PanelTitle>
          {count !== null && <span className="text-[13px] tabular-nums text-muted-foreground">{count}</span>}
        </div>
        <MoreLink href="/portfolio" icon={ArrowRight01Icon}>
          View all
        </MoreLink>
      </div>
      {children}
    </Panel>
  )
}

function Loading() {
  return (
    <div className="flex flex-col px-5 pt-2" role="status" aria-label="Loading">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-foreground/[0.045] py-3.5 first:border-t-0" aria-hidden>
          <span className="skel size-8 rounded-full" />
          <span className="skel h-3.5 w-24 rounded" />
          <span className="ml-auto skel h-3.5 w-20 rounded" />
        </div>
      ))}
    </div>
  )
}

const TH = "py-3 pr-5 text-right font-medium"

export function MyHoldings({ holdings, loading, priceOf }: { holdings: Holdings; loading: boolean; priceOf: (symbol: string) => number | null }) {
  if (!loading && holdings.length === 0) return null
  return (
    <Shell title="My holdings" count={loading ? null : holdings.length}>
      {loading ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto pt-1">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[12px] font-medium text-muted-foreground">
                <th className="py-3 pl-6 font-medium">Asset</th>
                <th className={TH}>Balance</th>
                <th className={cn(TH, "hidden sm:table-cell")}>Entry price</th>
                <th className={TH}>Value</th>
                <th className={cn(TH, "pr-6")}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((b) => {
                const live = priceOf(b.coin)
                const up = (b.unrealizedPnl ?? 0) >= 0
                return (
                  <tr key={b.coin} className="text-[13.5px] tabular-nums">
                    <td className="ds-cell pl-6">
                      <span className="flex items-center gap-3">
                        <CoinAvatar symbol={b.coin} size="lg" className="size-8 ring-1 ring-foreground/10" />
                        <span className="font-semibold text-foreground">{b.coin}</span>
                      </span>
                    </td>
                    <td className="ds-cell pr-5 text-right text-foreground/90"><Figure>{qty(b.total)}</Figure></td>
                    <td className="ds-cell hidden pr-5 text-right text-muted-foreground sm:table-cell">{price(b.entryPrice)}</td>
                    <td className="ds-cell pr-5 text-right font-semibold text-foreground">
                      <Figure>{usd(live !== null ? b.total * live : b.currentValue)}</Figure>
                    </td>
                    <td className="ds-cell pr-6 text-right">
                      {b.unrealizedPnl === null ? (
                        <span className="text-muted-foreground/50" title="Cost basis isn't recorded for spot holdings yet">{UNKNOWN}</span>
                      ) : (
                        <span className="flex flex-col items-end">
                          <span className={cn("font-semibold", up ? "text-credit" : "text-debit")}>
                            <Figure>{`${up ? "+" : ""}${usd(b.unrealizedPnl)}`}</Figure>
                          </span>
                          <span className={cn("text-[11.5px]", up ? "text-credit/70" : "text-debit/70")}>{pctSigned(b.unrealizedPnlPercent)}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  )
}

export function MyPositions({ positions, loading }: { positions: Positions; loading: boolean }) {
  if (!loading && positions.length === 0) return null
  return (
    <Shell title="My positions" count={loading ? null : positions.length}>
      {loading ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto pt-1">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[12px] font-medium text-muted-foreground">
                <th className="py-3 pl-6 font-medium">Contract</th>
                <th className={TH}>Size</th>
                <th className={TH}>Entry</th>
                <th className={cn(TH, "hidden sm:table-cell")}>Liq. price</th>
                <th className={TH}>Value</th>
                <th className={cn(TH, "pr-6")}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const size = parseFloat(pos.szi)
                const long = size > 0
                const pnl = parseFloat(pos.unrealizedPnl)
                const roe = parseFloat(pos.returnOnEquity) * 100
                const up = pnl >= 0
                return (
                  <tr key={pos.coin} className="text-[13.5px] tabular-nums">
                    <td className="ds-cell pl-6">
                      <span className="flex items-center gap-3">
                        <span className={cn("inline-flex size-5 items-center justify-center rounded-md text-[10px] font-bold", long ? "bg-credit/[0.13] text-credit" : "bg-debit/[0.13] text-debit")}>
                          {long ? "L" : "S"}
                        </span>
                        <CoinAvatar symbol={pos.coin} size="lg" className="size-8 ring-1 ring-foreground/10" />
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold text-foreground">{pos.coin}-PERP</span>
                          <span className="text-[12px] text-muted-foreground">{pos.leverage ? `${pos.leverage.value}×` : ""}</span>
                        </span>
                      </span>
                    </td>
                    <td className="ds-cell pr-5 text-right text-foreground/90">{Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="ds-cell pr-5 text-right text-muted-foreground">${formatPrice(parseFloat(pos.entryPx))}</td>
                    <td className="ds-cell hidden pr-5 text-right text-muted-foreground sm:table-cell">{pos.liquidationPx ? `$${formatPrice(parseFloat(pos.liquidationPx))}` : UNKNOWN}</td>
                    <td className="ds-cell pr-5 text-right font-semibold text-foreground">
                      <Figure>{`$${parseFloat(pos.positionValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Figure>
                    </td>
                    <td className="ds-cell pr-6 text-right">
                      <span className="flex flex-col items-end">
                        <span className={cn("font-semibold", up ? "text-credit" : "text-debit")}>
                          <Figure>{`${up ? "+" : ""}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Figure>
                        </span>
                        <span className={cn("text-[11.5px]", up ? "text-credit/70" : "text-debit/70")}>
                          {up ? "+" : ""}
                          {roe.toFixed(2)}%
                        </span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  )
}
