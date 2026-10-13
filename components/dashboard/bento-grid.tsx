"use client"

import * as React from "react"
import Link from "next/link"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { MoreLink, Panel, PanelTitle } from "@/components/dashboard/redesign/ui"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"
import { CoinAvatar } from "@/components/ui/coin-avatar"


// TEMPORARILY OFF (2026-09-02): the house-token card is parked with the
// MnaBanner in app/page.tsx. Restore them together:
// import { WorldstreetTokenCard } from "@/components/dashboard/worldstreet-token-card"

/* ── The preview's panel header and list states, for blocks it doesn't have ─ */

function BlockHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <PanelTitle className="text-[17px]">{title}</PanelTitle>
        <span className="text-[12.5px] text-muted-foreground">{subtitle}</span>
      </div>
      <MoreLink icon={ArrowRight01Icon} href={href}>
        View all
      </MoreLink>
    </div>
  )
}

function BlockNote({ title, description, cta }: { title: string; description: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {cta && (
        <Link href={cta.href} className="mt-3 inline-flex h-9 items-center rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground/[0.16]">
          {cta.label}
        </Link>
      )}
    </div>
  )
}

function BlockLoading({ rows, label }: { rows: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-foreground/[0.04] px-1 py-3 last:border-b-0" style={{ opacity: 1 - i * 0.12 }}>
          <span className="skel size-9 shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="skel h-3 w-20 rounded-md" />
            <span className="skel h-2.5 w-28 rounded-md" />
          </span>
          <span className="skel h-3 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}

const ROW = "flex items-center gap-3 rounded-xl border-b border-foreground/[0.04] px-1 py-3 transition-colors last:border-b-0 hover:bg-foreground/[0.025]"

/* ========== Recent Trades ========== */
/**
 * The trades you have actually made — the same ledger the trade workspace's
 * Orders table reads.
 *
 * It called `getSpotTradeHistory`, which asks `/api/transactions/unified` for
 * `type=swap`. That endpoint does not exist on the crypto backend, so the card
 * showed "No spot trades yet" to users with a page of fills. It also carried a
 * Futures tab that could never have rows, because the venue serves no fill
 * history — two tabs, one impossible, neither populated.
 */
function RecentTrades() {
  const { records, loading } = useLedgerRecords()
  const registry = useSpotRegistry()
  const [now, setNow] = React.useState(() => Date.now())

  /* "2m ago" needs a now to measure against, and reading the clock during
     render makes the output non-idempotent — two renders in the same tick can
     disagree. The clock is state, ticking at the resolution these labels have. */
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const trades = React.useMemo(
    () =>
      records
        .map((record) => describeLedgerRecord(record, registry))
        .filter((row): row is LedgerRow => row !== null && row.kind === "trade")
        .slice(0, 5),
    [records, registry],
  )

  function since(iso: string | null) {
    if (!iso) return ""
    const diff = now - new Date(iso).getTime()
    if (!Number.isFinite(diff)) return ""
    if (diff < 60_000) return "Just now"
    const min = Math.floor(diff / 60_000)
    if (min < 60) return `${min}m ago`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <Panel className="flex flex-col gap-4 px-5 pb-3 pt-5" data-onboarding="dash-trades">
      <BlockHeader title="Recent Trades" subtitle="Your latest fills" href="/trade" />
      {loading && records.length === 0 ? (
        <BlockLoading rows={4} label="Loading trades" />
      ) : trades.length === 0 ? (
        <BlockNote title="No trades yet" description="Buy or sell anything and it lands here." cta={{ label: "Start trading", href: "/trade" }} />
      ) : (
        <div className="flex flex-1 flex-col">
          {trades.map((trade) => {
            const buy = trade.direction === "in"
            const explorer = trade.txHash ? explorerTxUrl(trade.networkId, trade.txHash) : null
            const body = (
              <>
                <CoinAvatar symbol={trade.symbol} src={trade.icon} size="lg" className="size-9 ring-1 ring-foreground/10" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium">{trade.symbol}</span>
                    <span
                      className={`text-[10px] font-bold uppercase ${buy ? "text-credit" : "text-debit"}`}
                    >
                      {buy ? "Buy" : "Sell"}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {chainLabel(trade.networkId)} · {since(trade.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {trade.amountText && (
                    <span className="text-[13.5px] font-semibold tabular-nums">
                      {trade.amountText}
                    </span>
                  )}
                  {trade.valueUsd !== null && (
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      ${trade.valueUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: trade.valueUsd < 1 ? 4 : 2,
                      })}
                    </span>
                  )}
                </span>
              </>
            )
            const className = ROW
            return explorer ? (
              <a
                key={trade.id}
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {body}
              </a>
            ) : (
              <div key={trade.id} className={className}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/* ========== Dashboard Grid ========== */
/**
 * What follows the preview's blocks. The markets table and the watchlist were
 * removed from the dashboard at the lead's request; Recent Trades stays.
 */
export function DashboardGrid() {
  return (
    <div className="rise w-full" style={{ "--rise-delay": "320ms" } as React.CSSProperties}>
      <RecentTrades />
    </div>
  )
}

