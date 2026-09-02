"use client"

/**
 * OrdersPanel — the one table under the spot chart.
 *
 * Spot used to render the perps drawer: "Positions" and "Open orders" as two
 * tabs, both permanently empty. Neither concept exists here — a swap settles
 * or it doesn't, and what you hold afterwards is a wallet balance, not a
 * position. Two tables that can only say "none" are worse than one table that
 * says something, so they are replaced by the orders themselves.
 *
 * The list is the LEDGER's (`useSpotOrders`): the backend records one row per
 * broadcast and reconciles its status against the chain, so it is the only
 * thing that knows an order settled. The value is the CHAIN's: the size is
 * read back out of base units at the token's own precision and priced from the
 * live registry, never from whatever the amount was worth when it was placed.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { useSpotOrders, type SpotOrder } from "@/hooks/useSpotOrders"
import { useSpotRegistry, addressKey, type RegistryRow } from "@/hooks/useSpotRegistry"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"
import { formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"

const TH =
  "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-subtle whitespace-nowrap"
const TD = "px-3 py-2 text-[11.5px] tabular-nums whitespace-nowrap"

/** Ledger status → what to call it and how to colour it. */
function statusOf(status: string): { label: string; className: string } {
  if (status === "confirmed") return { label: "Filled", className: "bg-credit-chip text-credit" }
  if (status === "failed") return { label: "Failed", className: "bg-debit-chip text-debit" }
  if (status === "submitted")
    return { label: "Filling", className: "bg-primary/[0.12] text-primary" }
  // 'unknown' is the reconciler saying it could not reach the chain — which is
  // not the same as "it didn't happen", and must not be dressed up as either.
  return { label: "Unconfirmed", className: "bg-surface-sunken text-muted-foreground" }
}

function timeOf(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`
}

/**
 * What an order row actually says, resolved from the registry.
 *
 * The ledger records the amount RECEIVED, in the received token's own base
 * units — so a buy's amount is in the base token and a sell's is in the quote.
 * Which one it is decides the side, the precision to read it back at, and
 * whether the value is a price multiplication or already dollars.
 */
function resolve(order: SpotOrder, market: RegistryRow | undefined) {
  if (!market || !order.buyToken) return null
  const received = addressKey(order.networkId, order.buyToken)
  const isBase = market.address
    ? received === addressKey(order.networkId, market.address)
    : false
  const side: "buy" | "sell" = isBase ? "buy" : "sell"
  const decimals = isBase ? market.baseDecimals : market.quoteDecimals
  if (decimals === undefined || !order.amount) {
    return { side, market, size: null, unit: isBase ? market.symbol : market.quote, value: null }
  }
  const size = Number(formatCryptoAmount(order.amount, decimals, 9))
  // A buy's proceeds are priced; a sell's already are dollars, since every
  // quote we trade against is a dollar stablecoin.
  const value = isBase ? (market.price > 0 ? size * market.price : null) : size
  return { side, market, size, unit: isBase ? market.symbol : market.quote, value }
}

function Row({ order, market }: { order: SpotOrder; market: RegistryRow | undefined }) {
  const status = statusOf(order.status)
  const explorer = order.txHash ? explorerTxUrl(order.networkId, order.txHash) : null
  const view = resolve(order, market)

  return (
    <tr className="border-b border-border/20 last:border-0">
      <td className={cn(TD, "text-muted-foreground")}>{timeOf(order.createdAt)}</td>
      <td className={TD}>
        <span className="flex items-center gap-2">
          <CoinAvatar symbol={market?.symbol ?? "?"} size="sm" />
          <span className="font-semibold">
            {market?.symbol ?? shortAddress(order.buyToken)}
          </span>
          <span className="rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-medium text-subtle">
            {chainLabel(order.networkId)}
          </span>
        </span>
      </td>
      <td className={TD}>
        {view ? (
          <span className={view.side === "buy" ? "font-semibold text-credit" : "font-semibold text-debit"}>
            {view.side === "buy" ? "Buy" : "Sell"}
          </span>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </td>
      <td className={TD}>
        {/* Blank rather than a number we cannot stand behind: without the
            token's stated precision, base units are unreadable. */}
        {view?.size !== null && view
          ? `${view.size.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${view.unit}`
          : "—"}
      </td>
      <td className={TD}>{view?.value != null ? usd(view.value) : "—"}</td>
      <td className={TD}>
        <span
          className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}
        >
          {status.label}
        </span>
      </td>
      <td className={cn(TD, "text-right")}>
        {explorer ? (
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            View
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </td>
    </tr>
  )
}

function shortAddress(address: string | null): string {
  if (!address) return "Unknown"
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function OrdersPanel({ className }: { className?: string }) {
  const { orders, loading } = useSpotOrders()
  const registry = useSpotRegistry()

  const marketFor = React.useCallback(
    (order: SpotOrder) =>
      order.buyToken
        ? registry.byAddress.get(addressKey(order.networkId, order.buyToken))
        : undefined,
    [registry],
  )

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2">
        <h3 className="text-[12px] font-semibold">Orders</h3>
        <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {orders.length}
        </span>
      </div>

      <div className="slim-scroll min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <p className="px-3 py-8 text-center text-[11.5px] text-muted-foreground">
            No spot orders yet — the ones you place appear here with their
            on-chain status.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border/30">
                <th className={TH}>Time</th>
                <th className={TH}>Market</th>
                <th className={TH}>Side</th>
                <th className={TH}>Received</th>
                <th className={TH}>Value</th>
                <th className={TH}>Status</th>
                <th className={cn(TH, "text-right")}>Tx</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Row key={order.id} order={order} market={marketFor(order)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
