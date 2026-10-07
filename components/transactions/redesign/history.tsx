"use client"

/**
 * The preview's history workspace (components/transactions-unauth/history.tsx)
 * on the page's real list.
 *
 * ≥1536px  the selected transaction sits in a sticky side column
 * <1536px  selecting a row opens the same detail in a sheet
 *
 * The preview's controls, filtering the rows useUnifiedTransactions returns
 * (lib/transactions-view.ts), exactly as the preview filters its ledger. On
 * the live wallet path the hook already filtered in the browser, so the
 * request is the same list as before. The range defaults to All rather than
 * the preview's 30D, so nothing the page showed before is hidden on arrival.
 */

import * as React from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight01Icon, Cancel01Icon, Exchange01Icon, FileExportIcon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { DashScope } from "@/components/dash"
import { Figure, Icon, Panel, PanelTitle, PillTabs, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { GLYPH_ICON, StatusChip, TxDetail, fmtTime, kindTone, worthText } from "@/components/transactions/redesign/detail"
import {
  KIND_FILTERS,
  RANGE_FILTERS,
  STATUS_FILTERS,
  amountText,
  chainLabel,
  counterparty,
  dayLabel,
  directionOf,
  filterBase,
  filterKind,
  glyphOf,
  isStopped,
  transactionsCsv,
  typeLabel,
  type HistoryRange,
  type KindKey,
  type StatusKey,
} from "@/lib/transactions-view"
import type { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import type { UnifiedTransaction } from "@/types/transactions"

const WIDE = "(min-width: 1536px)"
const ROW_GRID = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_112px_minmax(0,1fr)_16px]"

/** The preview's CSV download, of the rows on screen. */
function exportCsv(rows: UnifiedTransaction[]) {
  const blob = new Blob([transactionsCsv(rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "worldstreet-transactions.csv"
  a.click()
  URL.revokeObjectURL(url)
}

/** The local clock, once mounted: day labels belong to the viewer's calendar. */
function useNow() {
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])
  return now
}

/* ── Row ──────────────────────────────────────────────────────────────── */

function TxRow({ tx, selected, onSelect }: { tx: UnifiedTransaction; selected: boolean; onSelect: () => void }) {
  const d = directionOf(tx)
  const network = chainLabel(tx.chain)
  const peer = counterparty(tx)
  const worth = tx.type === "swap" && tx.toToken && tx.toAmount != null ? `→ ${tx.toAmount} ${tx.toToken}` : worthText(tx)
  const showTo = tx.type === "swap" && tx.toToken && tx.toToken !== tx.token
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors md:gap-4",
        ROW_GRID,
        selected ? "bg-primary/[0.06]" : "hover:bg-foreground/[0.03]",
      )}
    >
      {selected && (
        <motion.span layoutId="tx-selected" transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary shadow-[0_0_10px_var(--primary)]" />
      )}

      {/* Type + assets */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative shrink-0">
          <span className={cn("flex size-10 items-center justify-center rounded-xl border", kindTone(tx))}>
            <Icon icon={GLYPH_ICON[glyphOf(tx)]} className="size-[18px]" strokeWidth={2} />
          </span>
          <CoinAvatar symbol={tx.token} size="sm" className="absolute -bottom-1 -right-1 size-[18px] ring-2 ring-card dark:ring-[color-mix(in_oklab,var(--card)_40%,var(--background))]" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-foreground">
            {typeLabel(tx)}
            <span className="font-medium text-muted-foreground">
              {tx.token}
              {showTo && <> → {tx.toToken}</>}
            </span>
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            {fmtTime(tx.createdAt)}
            {network && <span className="md:hidden"> · {network}</span>}
          </span>
        </span>
      </span>

      {/* Network + counterparty */}
      <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
        <span className="truncate text-[13px] text-foreground/85">{network ?? "—"}</span>
        <span className="truncate font-mono text-[11.5px] text-muted-foreground">{peer ?? "—"}</span>
      </span>

      {/* Status */}
      <span className="hidden md:block">
        <StatusChip tx={tx} />
      </span>

      {/* Amount */}
      <span className="flex flex-col items-end gap-0.5 tabular-nums">
        <span
          className={cn(
            "whitespace-nowrap text-[13.5px] font-semibold",
            isStopped(tx.status) ? "text-muted-foreground line-through decoration-debit/60" : d === "in" ? "text-credit" : "text-foreground",
          )}
        >
          <Figure mask="••••">{amountText(tx)}</Figure>
        </span>
        {(worth || tx.status !== "completed") && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground">
            {/* On a phone the status column is gone, so non-routine states ride here. */}
            {tx.status !== "completed" && <StatusChip tx={tx} className="md:hidden" />}
            {worth && <Figure mask="••••">{worth}</Figure>}
          </span>
        )}
      </span>

      <Icon icon={ArrowRight01Icon} className={cn("hidden size-4 transition-all duration-200 md:block", selected ? "text-primary" : "text-muted-foreground/30 group-hover:translate-x-0.5 group-hover:text-muted-foreground")} />
    </button>
  )
}

/** Loading rows in the row grid's footprint. */
function SkeletonRows({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5 px-1 pt-3 md:px-3" role="status" aria-label="Loading transactions">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 md:gap-4", ROW_GRID)} aria-hidden>
          <span className="flex items-center gap-3">
            <span className="skel size-10 shrink-0 rounded-xl" />
            <span className="flex flex-col gap-1.5">
              <span className="skel h-3.5 w-32 rounded" />
              <span className="skel h-3 w-16 rounded" />
            </span>
          </span>
          <span className="hidden flex-col gap-1.5 md:flex">
            <span className="skel h-3.5 w-20 rounded" />
            <span className="skel h-3 w-28 rounded" />
          </span>
          <span className="skel hidden h-5 w-20 rounded-md md:block" />
          <span className="flex flex-col items-end gap-1.5">
            <span className="skel h-3.5 w-24 rounded" />
            <span className="skel h-3 w-14 rounded" />
          </span>
          <span className="hidden md:block" />
        </div>
      ))}
    </div>
  )
}

/* ── Sheet (below 1536px) ─────────────────────────────────────────────── */

function DetailSheet({ tx, onClose }: { tx: UnifiedTransaction | null; onClose: () => void }) {
  // Portalled to <body>: the page sits inside <Rise> wrappers whose entrance
  // uses `transform`, which would make a "fixed" sheet relative to the list.
  // DashScope re-applies the page's type inside the portal.
  const [host, setHost] = React.useState<Element | null>(null)
  React.useEffect(() => setHost(document.body), [])

  // Lock the page's scroller (the frame's <main>) while the sheet is up.
  React.useEffect(() => {
    if (!tx) return
    const main = document.querySelector<HTMLElement>("main")
    if (!main) return
    const prev = main.style.overflowY
    main.style.overflowY = "hidden"
    return () => {
      main.style.overflowY = prev
    }
  }, [tx])

  React.useEffect(() => {
    if (!tx) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tx, onClose])

  if (!host) return null
  return createPortal(
    <DashScope className="ws-icon-mono">
      <AnimatePresence>
        {tx && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm 2xl:hidden"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Transaction details"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className={cn(
                "ds-panel slim-scroll fixed z-[70] overflow-y-auto p-5 shadow-[0_-20px_60px_-10px_rgb(0_0_0/0.6)] 2xl:hidden",
                // Phone: bottom sheet. Tablet: right-hand drawer.
                "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[24px] pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                "md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[440px] md:rounded-[24px]",
              )}
            >
              <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-foreground/15 md:hidden" />
              <TxDetail tx={tx} onClose={onClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashScope>,
    host,
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

type Model = ReturnType<typeof useUnifiedTransactions>

export function History({ model }: { model: Model }) {
  const { transactions, isLoading, isLoadingMore, hasMore, sentinelRef } = model
  const now = useNow()
  const [kind, setKind] = React.useState<KindKey>("all")
  const [status, setStatus] = React.useState<StatusKey>("any")
  const [range, setRange] = React.useState<HistoryRange>("all")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sheetTx, setSheetTx] = React.useState<UnifiedTransaction | null>(null)

  // Everything except the type tab — so each tab's badge counts what it
  // would show under the other filters.
  const base = React.useMemo(() => (now ? filterBase(transactions, { status, range, query }, now) : transactions), [transactions, status, range, query, now])
  const rows = React.useMemo(() => filterKind(base, kind), [base, kind])
  const filtered = kind !== "all" || status !== "any" || range !== "all" || Boolean(query)
  const filtersOn = status !== "any" || range !== "all" || Boolean(query)

  const groups = React.useMemo(() => {
    const out: { label: string; items: UnifiedTransaction[] }[] = []
    if (!now) return out
    for (const tx of rows) {
      const label = dayLabel(tx.createdAt, now)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(tx)
      else out.push({ label, items: [tx] })
    }
    return out
  }, [rows, now])

  // The newest row is selected until the reader picks one.
  const selected = transactions.find((t) => t.id === selectedId) ?? rows[0] ?? transactions[0] ?? null

  const select = (tx: UnifiedTransaction) => {
    setSelectedId(tx.id)
    if (!window.matchMedia(WIDE).matches) setSheetTx(tx)
  }
  const closeSheet = React.useCallback(() => setSheetTx(null), [])

  const tabs = KIND_FILTERS.map((f) => ({
    key: f.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {f.label}
        <span className="rounded-md bg-foreground/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {filterKind(base, f.key).length}
        </span>
      </span>
    ),
  }))

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 2xl:grid-cols-[minmax(0,1fr)_408px]">
      {/* overflow-clip, not hidden: hidden makes the panel a scroll
          container, and the sticky day headings would stick to it (i.e.
          never) instead of to the page. */}
      <Panel className="overflow-clip pb-2">
        <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <PanelTitle className="text-[17px]">History</PanelTitle>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {isLoading ? "Loading…" : `${rows.length} of ${transactions.length}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              className="flex h-9 items-center gap-2 rounded-xl border border-foreground/[0.08] px-3.5 text-[13px] font-semibold text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary disabled:opacity-40"
            >
              <Icon icon={FileExportIcon} className="size-4" />
              Export CSV
            </button>
          </div>

          <div className="border-b border-foreground/[0.06]">
            <UnderlineTabs id="tx-kinds" options={tabs} value={kind} onChange={setKind} className="scrollbar-none -mx-1 overflow-x-auto" />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40">
              <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
              <span className="sr-only">Search transactions</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search coin, network, hash or address"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <Icon icon={Cancel01Icon} className="size-4" />
                </button>
              )}
            </label>
            <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1">
              <PillTabs id="tx-status" size="sm" options={STATUS_FILTERS} value={status} onChange={setStatus} />
              <PillTabs id="tx-range" size="sm" options={RANGE_FILTERS} value={range} onChange={setRange} />
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus("any")
                    setRange("all")
                    setQuery("")
                  }}
                  className="shrink-0 whitespace-nowrap px-1 text-[12.5px] font-semibold text-primary hover:opacity-85"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoading || !now ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          filtered && transactions.length > 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
              <p className="text-[14px] font-semibold text-foreground">No transactions match</p>
              <p className="text-[13px] text-muted-foreground">Try another type, widen the date range, or clear the search.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] text-muted-foreground">
                <Icon icon={Exchange01Icon} className="size-5" />
              </span>
              <span className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold text-foreground">No transactions yet</p>
                <p className="text-[13px] text-muted-foreground">Deposits, withdrawals, swaps and transfers all land here.</p>
              </span>
              <Link href="/buy" className="ds-gold mt-1 inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold">
                Make a deposit
              </Link>
            </div>
          )
        ) : (
          <div className="flex flex-col pt-3">
            {/* Column heads, desktop only — they line up with the row grid. */}
            <div className={cn("hidden gap-4 px-7 pb-2 text-[12px] font-medium text-muted-foreground md:grid", ROW_GRID)}>
              <span>Transaction</span>
              <span>Network</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              {groups.map((group) => (
                <motion.section
                  key={group.label}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-y border-foreground/[0.04] bg-card/95 px-4 py-2 backdrop-blur md:px-7 dark:bg-[color-mix(in_oklab,var(--card)_48%,var(--background))]/95">
                    <span className="text-[12px] font-semibold text-foreground/80">{group.label}</span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 px-1 py-1.5 md:px-3">
                    {group.items.map((t) => (
                      <TxRow key={t.id} tx={t} selected={t.id === selected?.id} onSelect={() => select(t)} />
                    ))}
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && <Icon icon={Loading03Icon} className="size-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </Panel>

      {/* Wide screens: the detail lives beside the list and follows the scroll. */}
      <div className="hidden 2xl:block">
        <Panel className="sticky top-6 p-5">
          {selected ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <TxDetail tx={selected} />
              </motion.div>
            </AnimatePresence>
          ) : isLoading ? (
            <div className="flex flex-col gap-5" aria-hidden>
              <span className="flex items-center gap-3">
                <span className="skel size-11 rounded-2xl" />
                <span className="flex flex-col gap-1.5">
                  <span className="skel h-4 w-24 rounded" />
                  <span className="skel h-4 w-16 rounded-md" />
                </span>
              </span>
              <span className="skel h-20 w-full rounded-2xl" />
              <span className="skel h-28 w-full rounded-2xl" />
              <span className="skel h-40 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
              <p className="text-[14px] font-semibold text-foreground">No details yet</p>
              <p className="text-[13px] text-muted-foreground">
                {transactions.length === 0 ? "When a transaction lands, its progress and references show here." : "Pick a transaction to see where it is and how it got there."}
              </p>
            </div>
          )}
        </Panel>
      </div>

      <DetailSheet tx={sheetTx} onClose={closeSheet} />
    </div>
  )
}
