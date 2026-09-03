"use client"

/**
 * OrdersPanel — the one table under the spot chart.
 *
 * Spot used to render the perps drawer: "Positions" and "Open orders" as two
 * tabs, both permanently empty. Neither concept exists here — a swap settles
 * or it doesn't, and what you hold afterwards is a wallet balance, not a
 * position. Two tables that can only say "none" are worse than one that says
 * something, so they are replaced by the orders themselves.
 *
 * The list is the LEDGER's (`useSpotOrders`): the backend records one row per
 * broadcast and reconciles its status against the chain, so it is the only
 * thing that knows an order settled. The value is the CHAIN's: sizes are read
 * back out of base units at the token's own stated precision and priced live.
 *
 * On a phone the table carries only what identifies an order — market, size,
 * side — and everything else moves into a detail sheet behind the row. Seven
 * columns on a 390px screen is a horizontal scrollbar, which is a way of
 * hiding information while pretending not to.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  CardHeader,
  illustrations,
  Segmented,
  type SegmentedOption,
} from "@/components/ui/system"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { useSpotOrders, type SpotOrder } from "@/hooks/useSpotOrders"
import { useSpotRegistry, addressKey, type SpotRegistry } from "@/hooks/useSpotRegistry"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"
import { formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { nativeTokenFor } from "@/lib/native-token"

const TH =
  "px-4 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle whitespace-nowrap"
const TD = "px-4 py-2.5 text-[12px] tabular-nums"

/** Ledger status → what to call it and how to colour it. */
function statusOf(status: string): { label: string; className: string } {
  if (status === "confirmed") return { label: "Filled", className: "bg-credit-chip text-credit" }
  if (status === "failed") return { label: "Failed", className: "bg-debit-chip text-debit" }
  /* In flight. Neutral, at the RAISED step of the stone ladder — gold means
     brand, primary CTA or active state, and an order's status is none of those
     three, it is data. The step above "Unconfirmed" below is what separates
     "we are waiting on the chain" from "we could not reach it", without
     borrowing a colour that already means something else on this screen. */
  if (status === "submitted")
    return { label: "Filling", className: "bg-foreground/[0.08] text-foreground" }
  // 'unknown' is the reconciler saying it could not reach the chain — which is
  // not the same as "it didn't happen", and must not be dressed as either.
  return { label: "Unconfirmed", className: "bg-surface-sunken text-muted-foreground" }
}

/**
 * The tab strip's three buckets (`TradeView.orderTabs`), and why they are
 * these three and not "open / history / fills".
 *
 * That exchange triplet describes a venue with a book: an order rests, then
 * fills, and the fills are their own record. Nothing here rests — a swap is
 * broadcast and then it either settles or it doesn't — so those tabs would be
 * three names for one list, two of them permanently empty. What a trader
 * genuinely wants to separate on this venue is what is still moving from what
 * is done, and what is done from what went wrong. Every bucket below is read
 * off the ledger's own reconciled status; none of them is derived or guessed.
 */
type OrderFilter = "all" | "pending" | "filled" | "failed"

function bucketOf(status: string): Exclude<OrderFilter, "all"> {
  if (status === "confirmed") return "filled"
  if (status === "failed") return "failed"
  // 'submitted' and the reconciler's 'unknown' are both "we do not have an
  // answer yet", which is one thing to a reader even though it is two to the
  // backend.
  return "pending"
}

function timeOf(iso: string | null, long = false): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(
    undefined,
    long
      ? { dateStyle: "medium", timeStyle: "short" }
      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  )
}

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`
}

function shortAddress(address: string | null): string {
  if (!address) return "Unknown"
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export type ResolvedOrder = {
  order: SpotOrder
  symbol: string
  /** The market's icon, where the registry carries one. */
  icon: string | null
  side: "buy" | "sell" | null
  /** Amount received, at the received token's own stated precision. */
  size: number | null
  /** What that amount is denominated in. */
  unit: string
  valueUsd: number | null
}

/**
 * What a ledger row actually says.
 *
 * The record stores the amount RECEIVED. A buy receives the base token, so its
 * market is found from `buyToken`; a sell receives the quote, so it has to be
 * found from what it SPENT. Matching a sell on its received token was the bug
 * that labelled every sell "$1": all USDC-quoted markets share one quote
 * address, so USDC resolved to whichever market was indexed first.
 */
export function resolveOrder(order: SpotOrder, registry: SpotRegistry): ResolvedOrder {
  /* A native coin has no contract, so routers name it with a sentinel while
     the registry lists the WRAPPED market. Translate before looking up, and
     keep the native symbol and precision for display — a SOL trade should say
     SOL, not wSOL, and certainly not `1111…1111`. */
  const buyNative = nativeTokenFor(order.networkId, order.buyToken)
  const sellNative = nativeTokenFor(order.networkId, order.sellToken)
  const lookup = (address: string | null, native: ReturnType<typeof nativeTokenFor>) => {
    const key = native?.wrapped ?? address
    return key ? registry.byAddress.get(addressKey(order.networkId, key)) : undefined
  }

  const bought = lookup(order.buyToken, buyNative)
  const sold = bought ? undefined : lookup(order.sellToken, sellNative)
  const market = bought ?? sold

  /* A side is known the moment either leg is identified — and a native leg
     identifies itself, with or without a market behind it. */
  const side: "buy" | "sell" | null = bought || buyNative
    ? "buy"
    : sold || sellNative
      ? "sell"
      : null

  // What the order is ABOUT: the base token on a buy, the token sold on a sell.
  const subjectNative = side === "buy" ? buyNative : sellNative
  const symbol =
    subjectNative?.symbol ?? market?.symbol ?? shortAddress(order.buyToken)
  const icon = market?.icon ?? null

  /* Precision for the token RECEIVED. The native sentinel states its own;
     otherwise it is the registry's, and a registry that never stated it leaves
     the cell blank — a guessed exponent misstates an order by a billion. */
  const receivedNative = buyNative
  const decimals =
    receivedNative?.decimals ??
    (side === "buy" ? market?.baseDecimals : market?.quoteDecimals)
  const unit =
    receivedNative?.symbol ??
    (side === "buy" ? market?.symbol : market?.quote) ??
    ""

  if (decimals === undefined || !order.amount) {
    return { order, symbol, icon, side, size: null, unit, valueUsd: null }
  }

  const size = Number(formatCryptoAmount(order.amount, decimals, 9))
  /* A sell's proceeds are already dollars — every quote we trade against is a
     dollar stablecoin. A buy's are priced from the market, which for a native
     leg is the wrapped market: wSOL and SOL are the same price. */
  const valueUsd =
    side === "buy"
      ? market && market.price > 0
        ? size * market.price
        : null
      : size
  return { order, symbol, icon, side, size, unit, valueUsd }
}

function sizeText(row: ResolvedOrder): string {
  if (row.size === null) return "—"
  return `${row.size.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${row.unit}`
}

/* ── Detail modal ─────────────────────────────────────────────────────────
   Everything the narrow table leaves out, in the house modal — the same glass
   shell the order confirmation and the order ticket use, so a row's detail
   reads as part of the same product rather than a second idea about what a
   dialog is. `ResponsiveModal` owns the shape; this only picks the size. */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function OrderDetailModal({ row, onClose }: { row: ResolvedOrder | null; onClose: () => void }) {
  const order = row?.order
  const status = statusOf(order?.status ?? "")
  const explorer = order?.txHash ? explorerTxUrl(order.networkId, order.txHash) : null

  return (
    <ResponsiveModal open={Boolean(row)} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveModalContent className="sm:max-w-sm">
        {row && order && (
          <>
            <ResponsiveModalHeader className="items-center gap-2 pt-2 text-center">
              <CoinAvatar symbol={row.symbol} src={row.icon} size="lg" />
              <ResponsiveModalTitle className="text-[17px] font-semibold">
                {row.side === "sell" ? "Sold" : "Bought"} {row.symbol}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="divide-y divide-border/40 rounded-xl bg-surface-sunken/70 px-3.5">
              <DetailRow label="Placed" value={timeOf(order.createdAt, true)} />
              <DetailRow
                label="Side"
                value={
                  <span className={row.side === "sell" ? "text-debit" : "text-credit"}>
                    {row.side === "sell" ? "Sell" : row.side === "buy" ? "Buy" : "—"}
                  </span>
                }
              />
              <DetailRow label="Received" value={sizeText(row)} />
              <DetailRow label="Value" value={row.valueUsd !== null ? usd(row.valueUsd) : "—"} />
              <DetailRow label="Network" value={chainLabel(order.networkId)} />
              {order.router && <DetailRow label="Routed via" value={order.router} />}
            </div>

            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90"
              >
                View on {chainLabel(order.networkId)}
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
              </a>
            ) : (
              <p className="text-center text-[11px] text-subtle">
                No transaction hash was recorded for this order.
              </p>
            )}
          </>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/* ── Panel ──────────────────────────────────────────────────────────────── */

export function OrdersPanel({
  showTabs = false,
  className,
  style,
}: {
  /**
   * The status tab strip and the wider column set (`TradeView.orderTabs`).
   *
   * Simple gets one list of what you have placed and what became of it, which
   * is the whole question a first-time buyer has. Pro gets the buckets, the
   * counts, and the columns — time, side, value — that a narrow table
   * otherwise folds away behind a row's detail sheet.
   */
  showTabs?: boolean
  className?: string
  /** For the workspace's pane-entrance custom properties. */
  style?: React.CSSProperties
}) {
  const { orders, loading } = useSpotOrders()
  const registry = useSpotRegistry()
  const [detail, setDetail] = React.useState<ResolvedOrder | null>(null)
  const [filter, setFilter] = React.useState<OrderFilter>("all")

  const rows = React.useMemo(
    () => orders.map((order) => resolveOrder(order, registry)),
    [orders, registry],
  )

  /* Counts come off the WHOLE list, not the filtered one — a tab that says
     how many are in it has to keep saying so once you are standing in another
     one. */
  const counts = React.useMemo(() => {
    const out = { pending: 0, filled: 0, failed: 0 }
    for (const row of rows) out[bucketOf(row.order.status)] += 1
    return out
  }, [rows])

  const visible = React.useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((row) => bucketOf(row.order.status) === filter),
    [rows, filter],
  )

  /* Only offer a bucket that has something in it. A tab that can only ever
     answer "none" is the same broken-control lesson as a mode switch that
     changes nothing — so an empty bucket is simply not a tab yet. */
  const filterOptions = React.useMemo<SegmentedOption<OrderFilter>[]>(() => {
    const out: SegmentedOption<OrderFilter>[] = [{ key: "all", label: "All" }]
    if (counts.pending > 0) out.push({ key: "pending", label: `Pending · ${counts.pending}` })
    if (counts.filled > 0) out.push({ key: "filled", label: `Filled · ${counts.filled}` })
    if (counts.failed > 0) out.push({ key: "failed", label: `Failed · ${counts.failed}` })
    return out
  }, [counts])

  /* A bucket can empty out under the poll — the last pending order settles —
     and leaving the strip pointing at a tab that no longer exists strands the
     table on an empty list with no lit tab to explain it. */
  React.useEffect(() => {
    if (!filterOptions.some((option) => option.key === filter)) setFilter("all")
  }, [filterOptions, filter])

  const tabs = showTabs && filterOptions.length > 1

  /* Column visibility, one step earlier in Pro. Written out rather than
     computed so the class strings stay literal — Tailwind reads source text,
     not runtime concatenation. */
  const timeCol = showTabs ? "hidden sm:table-cell" : "hidden md:table-cell"
  const sideCol = showTabs ? "hidden md:table-cell" : "hidden lg:table-cell"
  const valueCol = showTabs ? "hidden lg:table-cell" : "hidden xl:table-cell"

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      style={style}
      data-vivid-target="orders-panel"
      data-vivid-label="Your spot orders and their on-chain status"
    >
      {/* The house `CardHeader`, not a local copy of one. It was hand-rolled
          here — a display-face h3, its own count chip, its own padding — which
          is how a screen ends up half a step off every card on the dashboard.
          The kit already has a title, a badge and a right-hand slot, and the
          tab strip drops straight into the third. */}
      <CardHeader
        title="Your orders"
        badge={
          rows.length > 0 ? (
            <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {rows.length}
            </span>
          ) : undefined
        }
        right={
          tabs ? (
            // Scrolls rather than wraps: four buckets at their longest ("Pending
            // · 12") outrun a 375px header, and a header that grows a second row
            // pushes the table it belongs to off the pane.
            <div className="scrollbar-none min-w-0 overflow-x-auto">
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={filterOptions}
                vividPrefix="orders-filter"
              />
            </div>
          ) : !loading && rows.length > 0 ? (
            <span className="shrink-0 text-[11.5px] text-subtle">Newest first</span>
          ) : undefined
        }
        className="shrink-0"
      />

      <div className="slim-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center py-8">
            {/* Neutral, never gold — a spinner is not a brand moment. */}
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
          </div>
        ) : visible.length === 0 ? (
          // The empty state carries the trade illustration beside its copy
          // rather than above it, so it fits the drawer's height instead of
          // asking the chart to give up space for a picture.
          <div className="flex h-full items-center justify-center gap-5 px-6 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local
                illustration, same as EmptyState's; the optimizer adds nothing */}
            <img
              src={illustrations.cryptoTrade}
              alt=""
              loading="lazy"
              className="h-20 w-20 shrink-0 object-contain"
            />
            <div className="flex max-w-xs flex-col gap-1">
              <span className="text-[14px] font-semibold">
                {rows.length === 0 ? "No orders yet" : "Nothing in this tab"}
              </span>
              <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                {rows.length === 0
                  ? "Every order you place shows up here with what you received and whether it went through."
                  : "Your other orders are still here — switch back to All to see them."}
              </span>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/30">
                {/* Narrow screens carry only what identifies an order; the
                    rest is one tap away rather than one sideways scroll.
                    Pro brings each column in one breakpoint earlier and adds
                    the router — but NEVER below `sm`, because seven columns on
                    a 390px screen is a horizontal scrollbar, which is a way of
                    hiding information while pretending not to. Pro is denser,
                    not narrower. */}
                <th className={cn(TH, timeCol)}>Time</th>
                <th className={TH}>Market</th>
                <th className={cn(TH, sideCol)}>Side</th>
                <th className={TH}>Received</th>
                <th className={cn(TH, valueCol)}>Value</th>
                {showTabs && (
                  <th className={cn(TH, "hidden xl:table-cell")}>Routed via</th>
                )}
                <th className={cn(TH, "hidden sm:table-cell")}>Status</th>
                <th className={cn(TH, "w-9 text-right")}>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const status = statusOf(row.order.status)
                return (
                  <tr
                    key={row.order.id}
                    className="border-b border-border/20 transition-colors last:border-0 hover:bg-accent/20"
                  >
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground", timeCol)}>
                      {timeOf(row.order.createdAt)}
                    </td>
                    <td className={TD}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CoinAvatar symbol={row.symbol} src={row.icon} size="sm" />
                        <span
                          className="truncate font-semibold"
                          // A token outside the registry keeps its address as
                          // its name; the full one is worth having on hover.
                          title={row.icon === null && row.side === null && row.order.buyToken
                            ? row.order.buyToken
                            : undefined}
                        >
                          {row.symbol}
                        </span>
                        {/* Below lg the side rides with the market instead of
                            taking a column of its own. */}
                        {row.side && (
                          <span
                            className={cn(
                              "shrink-0 text-[10px] font-bold uppercase lg:hidden",
                              row.side === "buy" ? "text-credit" : "text-debit",
                            )}
                          >
                            {row.side}
                          </span>
                        )}
                        <span className="hidden shrink-0 rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-medium text-subtle md:inline">
                          {chainLabel(row.order.networkId)}
                        </span>
                      </span>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap", sideCol)}>
                      {row.side ? (
                        <span
                          className={cn(
                            "font-semibold",
                            row.side === "buy" ? "text-credit" : "text-debit",
                          )}
                        >
                          {row.side === "buy" ? "Buy" : "Sell"}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      <span className="block truncate">{sizeText(row)}</span>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap", valueCol)}>
                      {row.valueUsd !== null ? usd(row.valueUsd) : "—"}
                    </td>
                    {showTabs && (
                      <td className={cn(TD, "hidden whitespace-nowrap text-muted-foreground xl:table-cell")}>
                        {row.order.router ?? "—"}
                      </td>
                    )}
                    <td className={cn(TD, "hidden whitespace-nowrap sm:table-cell")}>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className={cn(TD, "w-9 pl-0 pr-2 text-right")}>
                      <button
                        type="button"
                        onClick={() => setDetail(row)}
                        aria-label={`Details for this ${row.symbol} order`}
                        data-vivid-target={`order-details-${row.order.id}`}
                        data-vivid-label={`Open the details for this ${row.symbol} order`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-subtle transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <HugeiconsIcon icon={InformationCircleIcon} className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <OrderDetailModal row={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
