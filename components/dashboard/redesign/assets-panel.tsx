"use client"

/**
 * The working table: what you hold, how it splits, how your positions are
 * doing and what moved recently — four views of the same account, so they
 * share one panel and one set of tabs rather than four stacked cards.
 *
 * Copied from the preview (components/dashboard-unauth/assets-panel.tsx) on
 * real data: holdings from the wallet + spot account, positions from the
 * trading account, transactions from the ledger (the same query Recent Trades
 * uses, so no extra request). Row actions go to real places: Trade opens the
 * pair, Deposit and Withdraw open the wallet's receive and send dialogs. The
 * preview's "more" (⋮) button had no menu behind it, so it is not here.
 * States the preview never drew are kept: loading, nothing held, futures
 * closed, no positions, no transactions, and a failed ledger read.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDown01Icon,
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowUpRight01Icon,
  ChartLineData02Icon,
  CreditCardIcon,
  Invoice03Icon,
  PieChartIcon,
  Wallet02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { SendModal } from "@/components/crypto/SendModal"
import { formatPrice, formatQty, formatUSD } from "@/components/dashboard/redesign/format"
import { holdingValue, useDashboardData } from "@/components/dashboard/redesign/data"
import { ChangeChip, Figure, Icon, Panel, ViewSelect, type IconSvg, type ViewOption } from "@/components/dashboard/redesign/ui"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { chainLabel } from "@/lib/spot-market-search"

type Tab = "assets" | "portfolio" | "pnl" | "activity"

function tabs(counts: { assets?: number; pnl?: number; activity?: number }): ViewOption<Tab>[] {
  return [
    { key: "assets", label: "Assets", count: counts.assets, hint: "Every coin you hold", icon: Wallet02Icon },
    { key: "portfolio", label: "Portfolio", hint: "How your holdings split", icon: PieChartIcon },
    { key: "pnl", label: "P&L", count: counts.pnl, hint: "Open futures positions", icon: ChartLineData02Icon },
    { key: "activity", label: "Recent transactions", count: counts.activity, hint: "Deposits, swaps and sends", icon: Invoice03Icon },
  ]
}

/* ── States the preview never drew, in its empty-table style ───────────── */

function TableNote({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

function TableLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col px-4 pb-3 md:px-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 border-t border-foreground/[0.045] first:border-t-0" style={{ opacity: 1 - i * 0.15 }}>
          <span className="skel size-7 shrink-0 rounded-full" />
          <span className="skel h-3 w-24 rounded-md" />
          <span className="skel ml-auto h-3 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}

const SMALL_BALANCE = 10 // USD

/* ── Assets ─────────────────────────────────────────────────────────────── */

const ROW_ACTION =
  "relative text-[13px] font-semibold text-primary transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 hover:text-primary hover:after:scale-x-100"

function RowAction({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) {
  return href ? (
    <Link href={href} className={ROW_ACTION}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={ROW_ACTION}>
      {children}
    </button>
  )
}

type RowActions = { onDeposit: () => void; onWithdraw: () => void }

function AssetsTable({ query, hideSmall, onDeposit, onWithdraw }: { query: string; hideSmall: boolean } & RowActions) {
  const { holdings: HOLDINGS, holdingsSettled } = useDashboardData()
  const [sortDesc, setSortDesc] = React.useState(true)
  const q = query.trim().toLowerCase()
  const rows = HOLDINGS.filter(
    (h) =>
      (!hideSmall || holdingValue(h) >= SMALL_BALANCE) &&
      (!q || h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)),
  ).sort((a, b) => (sortDesc ? holdingValue(b) - holdingValue(a) : holdingValue(a) - holdingValue(b)))

  if (!holdingsSettled) return <TableLoading label="Loading your assets" />
  /* With no rows, the table keeps its columns and the message sits in its
     body — the preview's structure, never replaced by a bare message. */
  const note =
    HOLDINGS.length === 0 ? (
      <TableNote
        title="Nothing held yet"
        body="Coins you buy or receive show up here with what they're worth."
        action={<Link href="/buy" className="ds-gold inline-flex h-9 items-center rounded-[10px] px-3.5 text-[13px] font-semibold">Buy crypto</Link>}
      />
    ) : rows.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-14 text-center">
        <p className="text-[14px] font-semibold text-foreground">{query ? <>No assets match “{query}”</> : `Every balance is under $${SMALL_BALANCE}`}</p>
        <p className="text-[13px] text-muted-foreground">{query ? "Try a ticker like BTC, or a name like Solana." : "Untick “Hide small balances” to see them."}</p>
      </div>
    ) : null

  return (
    <>
      {/* Desktop: a real table, columns aligned on tabular figures. */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[12px] font-medium text-muted-foreground">
              <th className="w-[60px] pb-3 pl-6 font-medium">#</th>
              <th className="w-[24%] pb-3 font-medium">Asset</th>
              <th className="pb-3 font-medium">Total Balance</th>
              <th className="hidden pb-3 font-medium xl:table-cell">Available</th>
              <th className="hidden pb-3 font-medium xl:table-cell">In Order</th>
              <th className="pb-3 font-medium">
                <button
                  type="button"
                  onClick={() => setSortDesc((v) => !v)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  USD Value
                  <Icon icon={ArrowDown01Icon} className={cn("size-3.5 transition-transform duration-300", !sortDesc && "rotate-180")} strokeWidth={2} />
                </button>
              </th>
              <th className="w-[252px] pb-3 pr-6 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {note && (
              <tr>
                <td colSpan={7} className="ds-cell h-auto">
                  {note}
                </td>
              </tr>
            )}
            <AnimatePresence initial={false}>
              {rows.map((h, i) => (
                <motion.tr
                  key={h.symbol}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="group text-[13.5px] tabular-nums"
                >
                  <td className="ds-cell pl-6 text-muted-foreground">{i + 1}</td>
                  <td className="ds-cell">
                    <span className="flex items-center gap-3">
                      <CoinAvatar symbol={h.symbol} size="lg" className="size-7 ring-1 ring-foreground/10" />
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="font-semibold text-foreground">{h.symbol}</span>
                        <span className="truncate text-[12.5px] text-muted-foreground">{h.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="ds-cell text-foreground/90"><Figure>{formatQty(h.amount)}</Figure></td>
                  <td className="ds-cell hidden text-foreground/90 xl:table-cell"><Figure>{formatQty(h.amount - h.inOrder)}</Figure></td>
                  <td className="ds-cell hidden text-foreground/60 xl:table-cell"><Figure>{formatQty(h.inOrder)}</Figure></td>
                  <td className="ds-cell font-semibold text-foreground"><Figure>{formatUSD(holdingValue(h))}</Figure></td>
                  <td className="ds-cell pr-6">
                    <span className="flex items-center gap-5">
                      <RowAction href={`/trade?symbol=${encodeURIComponent(h.symbol)}`}>Trade</RowAction>
                      <RowAction onClick={onDeposit}>Deposit</RowAction>
                      <RowAction onClick={onWithdraw}>Withdraw</RowAction>
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Phone: a list. Seven columns at 375px is a spreadsheet, not a screen. */}
      {note && <div className="md:hidden">{note}</div>}
      <ul className="flex flex-col md:hidden">
        {rows.map((h) => (
          <li key={h.symbol} className="flex items-center gap-3 border-t border-foreground/[0.05] px-4 py-3.5 first:border-t-0">
            <CoinAvatar symbol={h.symbol} size="lg" className="size-9 ring-1 ring-foreground/10" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-semibold text-foreground">{h.symbol}</span>
              <span className="truncate text-[12px] text-muted-foreground">{h.name}</span>
            </span>
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-[14px] font-semibold text-foreground"><Figure>{formatUSD(holdingValue(h))}</Figure></span>
              <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{h.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}</Figure></span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ── Portfolio split ───────────────────────────────────────────────────── */

function Allocation() {
  const { holdings, holdingsSettled } = useDashboardData()
  const rows = holdings.filter((h) => holdingValue(h) > 0)
  const HOLDINGS_TOTAL = rows.reduce((sum, h) => sum + holdingValue(h), 0)
  if (!holdingsSettled) return <TableLoading label="Loading your portfolio split" />
  if (rows.length === 0) return <TableNote title="Nothing to break down yet" body="Once you hold a coin, this shows what share of your balance each one is." />
  return (
    <ul className="flex flex-col gap-1 px-4 pb-4 md:px-6">
      {rows.map((h, i) => {
        const share = holdingValue(h) / HOLDINGS_TOTAL
        return (
          <li key={h.symbol} className="grid grid-cols-[minmax(120px,180px)_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-foreground/[0.025]">
            <span className="flex items-center gap-3">
              <CoinAvatar symbol={h.symbol} size="lg" className="size-7 ring-1 ring-foreground/10" />
              <span className="text-[13.5px] font-semibold">{h.symbol}</span>
            </span>
            <span className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.05]">
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(share, 0.006) }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 origin-left rounded-full"
                style={{ background: `color-mix(in oklab, var(--primary) ${Math.max(10, Math.round(100 - i * 9))}%, var(--muted))` }}
              />
            </span>
            <span className="flex w-[150px] items-baseline justify-end gap-3 tabular-nums">
              <span className="text-[13px] text-muted-foreground"><Figure mask="••••">{formatUSD(holdingValue(h), { maxFrac: 0 })}</Figure></span>
              <span className="w-14 text-right text-[13.5px] font-semibold">{(share * 100).toFixed(1)}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ── P&L ───────────────────────────────────────────────────────────────── */

function Positions() {
  const { positions, portfolio } = useDashboardData()
  if (!portfolio.futuresOpen) return <TableNote title="Futures is closed" body="Open positions appear here once the futures venue opens." />
  if (!portfolio.futuresSettled) return <TableLoading label="Loading your positions" />
  if (positions.length === 0) {
    return (
      <TableNote
        title="No open positions"
        body="Anything you open on the futures venue is listed here with its P&L."
        action={<Link href="/trade" className="text-[13px] font-semibold text-primary hover:opacity-85">Open the desk →</Link>}
      />
    )
  }
  /* The preview's Position shape, from the venue's real fields. */
  const POSITIONS = positions.map((p) => ({
    symbol: p.symbol,
    side: p.side,
    leverage: p.leverage.value,
    size: p.notionalUsd,
    entry: p.entryPrice,
    mark: p.markPrice,
    pnl: p.unrealizedPnl,
    pnlPct: p.returnOnEquity * 100,
  }))
  return (
    <div className="px-2 pb-3 md:px-4">
      {/* Phone: one card per position — the five-column table used to slide
          sideways, headers and all. */}
      <ul className="flex flex-col md:hidden">
        {POSITIONS.map((p) => (
          <li key={`${p.symbol}-${p.side}`} className="flex flex-col gap-3 border-t border-foreground/[0.05] px-2 py-3.5 first:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <CoinAvatar symbol={p.symbol} size="lg" className="size-8 ring-1 ring-foreground/10" />
                <span className="font-semibold">{p.symbol}-PERP</span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", p.side === "long" ? "bg-credit/[0.13] text-credit" : "bg-debit/[0.13] text-debit")}>
                  {p.side} {p.leverage}×
                </span>
              </span>
              <ChangeChip value={p.pnlPct} size="sm" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] tabular-nums">
              {[
                ["Unrealised PnL", <span key="p" className={cn("font-semibold", p.pnl >= 0 ? "text-credit" : "text-debit")}><Figure mask="••••">{`${p.pnl >= 0 ? "+" : "−"}${formatUSD(Math.abs(p.pnl))}`}</Figure></span>],
                ["Size", <Figure key="s">{formatUSD(p.size)}</Figure>],
                ["Entry", formatPrice(p.entry)],
                ["Mark", formatPrice(p.mark)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex flex-col gap-0.5">
                  <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
                  <dd className="font-semibold text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-[13.5px] tabular-nums md:table">
        <thead>
          <tr className="text-[12px] text-muted-foreground">
            {["Market", "Size", "Entry", "Mark", "Unrealised PnL"].map((h, i) => (
              <th key={h} className={cn("px-3 pb-3 font-medium", i === 4 && "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((p) => (
            <tr key={`${p.symbol}-${p.side}`} className="transition-colors hover:bg-foreground/[0.02]">
              <td className="ds-cell px-3">
                <span className="flex items-center gap-3">
                  <CoinAvatar symbol={p.symbol} size="lg" className="size-7 ring-1 ring-foreground/10" />
                  <span className="font-semibold">{p.symbol}-PERP</span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase", p.side === "long" ? "bg-credit/[0.13] text-credit" : "bg-debit/[0.13] text-debit")}>
                    {p.side} {p.leverage}×
                  </span>
                </span>
              </td>
              <td className="ds-cell px-3"><Figure>{formatUSD(p.size)}</Figure></td>
              <td className="ds-cell px-3 text-muted-foreground">{formatPrice(p.entry)}</td>
              <td className="ds-cell px-3">{formatPrice(p.mark)}</td>
              <td className="ds-cell px-3 text-right">
                <span className="inline-flex items-center gap-2.5">
                  <span className={cn("font-semibold", p.pnl >= 0 ? "text-credit" : "text-debit")}>
                    <Figure mask="••••">{`${p.pnl >= 0 ? "+" : "−"}${formatUSD(Math.abs(p.pnl))}`}</Figure>
                  </span>
                  <ChangeChip value={p.pnlPct} size="sm" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Activity ──────────────────────────────────────────────────────────── */

/** The preview's Activity shape, from a ledger row. */
type Activity = {
  id: string
  kind: "receive" | "send" | "swap" | "buy"
  title: string
  detail: string
  amount: string
  usd: string | null
  direction: "credit" | "debit" | "neutral"
  minutesAgo: number | null
  status: string
  href: string | null
}

/** Ledger statuses that mean "still moving" (the same set the activity card used). */
const PENDING_STATUSES = new Set(["submitted", "pending", "processing"])

function toActivity(row: LedgerRow, now: number): Activity {
  const at = row.createdAt ? new Date(row.createdAt).getTime() : NaN
  return {
    id: row.id,
    kind: row.kind === "trade" ? "swap" : row.direction === "in" ? "receive" : "send",
    title: `${row.label} ${row.symbol}`,
    detail: chainLabel(row.networkId),
    amount: row.amountText ?? "",
    usd: row.valueUsd !== null ? formatUSD(row.valueUsd) : null,
    direction: row.direction === "in" ? "credit" : row.direction === "out" ? "debit" : "neutral",
    minutesAgo: Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 60_000)) : null,
    status: row.status,
    href: row.txHash ? explorerTxUrl(row.networkId, row.txHash) : null,
  }
}

const KIND_ICON: Record<Activity["kind"], IconSvg> = {
  receive: ArrowDownLeft01Icon,
  send: ArrowUpRight01Icon,
  swap: ArrowLeftRightIcon,
  buy: CreditCardIcon,
}

function useAgo() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  return (m: number | null) => {
    if (!ready || m === null) return " "
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.round(m / 60)}h ago`
    return `${Math.round(m / 1440)}d ago`
  }
}

type ActivityState = { rows: Activity[]; loading: boolean; failed: boolean; refetch: () => void }

/** The ledger, as the preview's Activity rows. Shared query: no extra request. */
function useActivity(): ActivityState {
  const { records, loading, error, refetch } = useLedgerRecords()
  const registry = useSpotRegistry()
  /* "3h ago" needs a clock that ticks as state, not one read during render. */
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const rows = React.useMemo(
    () =>
      records
        .map((record) => describeLedgerRecord(record, registry))
        .filter((row): row is LedgerRow => row !== null)
        .slice(0, 8)
        .map((row) => toActivity(row, now)),
    [records, registry, now],
  )
  return { rows, loading: loading && records.length === 0, failed: Boolean(error) && records.length === 0, refetch: () => void refetch() }
}

function RecentActivity({ activity }: { activity: ActivityState }) {
  const ago = useAgo()
  const { rows: ACTIVITY, loading, failed, refetch } = activity
  if (loading) return <TableLoading label="Loading your transactions" />
  if (failed) {
    return (
      <TableNote
        title="Your transactions didn't load"
        body="Check your connection and try again."
        action={<button type="button" onClick={refetch} className="text-[13px] font-semibold text-primary hover:opacity-85">Try again</button>}
      />
    )
  }
  if (ACTIVITY.length === 0) return <TableNote title="No transactions yet" body="Deposits, sends, swaps and trades appear here as they happen." />
  return (
    <ul className="flex flex-col px-2 pb-3 md:px-4">
      {ACTIVITY.map((a) => {
        const row = (
          <>
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border",
              a.direction === "credit" && "border-credit/20 bg-credit/[0.08] text-credit",
              a.direction === "debit" && "border-debit/20 bg-debit/[0.08] text-debit",
              a.direction === "neutral" && "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/80",
            )}
          >
            <Icon icon={KIND_ICON[a.kind]} className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 truncate text-[13.5px] font-semibold">
              {a.title}
              {/* Not in the preview: a movement still in flight, or one that failed. */}
              {PENDING_STATUSES.has(a.status) && <span className="rounded-md bg-warning/[0.12] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-warning">Pending</span>}
              {a.status === "failed" && <span className="rounded-md bg-debit/[0.12] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-debit">Failed</span>}
            </span>
            <span className="truncate text-[12px] text-muted-foreground">
              {a.detail} · {ago(a.minutesAgo)}
            </span>
          </span>
          <span className="flex flex-col items-end tabular-nums">
            <span className={cn("text-[13.5px] font-semibold", a.direction === "credit" ? "text-credit" : a.direction === "debit" ? "text-foreground" : "text-foreground")}>
              <Figure mask="••••">{a.amount}</Figure>
            </span>
            {a.usd && <span className="text-[12px] text-muted-foreground"><Figure mask="••••">{a.usd}</Figure></span>}
          </span>
          </>
        )
        const cls = "flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-foreground/[0.025]"
        return (
          <li key={a.id}>
            {a.href ? (
              <a href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {row}
              </a>
            ) : (
              <div className={cls}>{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

export function AssetsPanel() {
  const [tab, setTab] = React.useState<Tab>("assets")
  const [query, setQuery] = React.useState("")
  const [hideSmall, setHideSmall] = React.useState(false)
  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)
  const { holdings, holdingsSettled, positions, portfolio } = useDashboardData()
  const activity = useActivity()
  // Counts only once their figure is known, so a loading view never says "0".
  const TABS = tabs({
    assets: holdingsSettled ? holdings.length : undefined,
    pnl: portfolio.futuresOpen && portfolio.futuresSettled ? positions.length : undefined,
    activity: activity.loading || activity.failed ? undefined : activity.rows.length,
  })

  return (
    <Panel className="overflow-visible pb-2">
      {/* One dropdown picks the view — the four-tab row overflowed (and
          scrolled) on a phone. Search and the small-balance filter follow
          the Assets view only, where they apply. */}
      <div className="flex flex-col gap-3 border-b border-foreground/[0.06] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <ViewSelect options={TABS} value={tab} onChange={setTab} />

        {tab === "assets" && (
          <div className="flex items-center gap-4">
            <label className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-foreground/[0.07] bg-foreground/[0.025] px-3 transition-colors focus-within:border-primary/40 md:w-[200px] md:flex-none">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets…"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
            </label>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-foreground/80 select-none">
              <input type="checkbox" className="peer sr-only" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} />
              <span className="flex size-[18px] items-center justify-center rounded-[5px] border border-foreground/20 text-transparent transition-all duration-200 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                <Icon icon={Tick02Icon} className="size-3" strokeWidth={3} />
              </span>
              Hide small balances
            </label>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pt-3"
        >
          {tab === "assets" && <AssetsTable query={query} hideSmall={hideSmall} onDeposit={() => setReceiveOpen(true)} onWithdraw={() => setSendOpen(true)} />}
          {tab === "portfolio" && <Allocation />}
          {tab === "pnl" && <Positions />}
          {tab === "activity" && <RecentActivity activity={activity} />}
        </motion.div>
      </AnimatePresence>
      {/* The wallet's own receive and send dialogs, mounted once. */}
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
      <SendModal open={sendOpen} onOpenChange={setSendOpen} />
    </Panel>
  )
}
