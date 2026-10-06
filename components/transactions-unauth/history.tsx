"use client"

/**
 * Transaction history with its detail — a list on the left, the selected
 * transaction on the right.
 *
 * ≥1536px  the detail is a sticky side column; selecting a row just swaps it
 * <1536px  selecting a row opens the same detail in a sheet (a bottom sheet
 *          on a phone, a side drawer on a tablet)
 *
 * Filters stack: type tab × status × date range × search. Every count shown
 * (tab badges, the "n of m" line, each day's entry count) is computed from the
 * same filtered list, so none of them can disagree.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight01Icon, Cancel01Icon, FileExportIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import {
  KIND_FILTERS,
  TRANSACTIONS,
  directionOf,
  formatUSD,
  usdOf,
  type Tx,
  type TxKind,
  type TxStatus,
} from "@/components/transactions-unauth/tx-data"
import {
  KIND_META,
  StatusChip,
  TxDetail,
  amountText,
  kindTone,
  truncateMiddle,
  useDayLabel,
} from "@/components/transactions-unauth/tx-detail"
import { Figure, Icon, Panel, PanelTitle, PillTabs, UnderlineTabs } from "@/components/redesign/ui"

type KindKey = TxKind | "all"
type StatusKey = TxStatus | "any"
type RangeKey = "7d" | "30d" | "all"

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, all: Infinity }
const WIDE = "(min-width: 1536px)"

/* ── CSV ──────────────────────────────────────────────────────────────── */

function exportCsv(rows: Tx[]) {
  const head = ["Reference", "Days ago", "Time", "Type", "Status", "Asset", "Amount", "To asset", "To amount", "Network", "Counterparty", "Hash", "Fee", "Fee asset", "USD value"]
  const esc = (v: unknown) => {
    const s = String(v ?? "")
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((t) =>
    [t.id, t.dayOffset, t.time, t.kind, t.status, t.asset, t.amount, t.toAsset, t.toAmount, t.network, t.counterparty, t.hash, t.fee, t.feeAsset, usdOf(t.asset, t.amount).toFixed(2)].map(esc).join(","),
  )
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "worldstreet-transactions-demo.csv"
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Row ──────────────────────────────────────────────────────────────── */

function TxRow({ tx, selected, onSelect }: { tx: Tx; selected: boolean; onSelect: () => void }) {
  const meta = KIND_META[tx.kind]
  const d = directionOf(tx.kind)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_112px_minmax(0,1fr)_16px] md:gap-4",
        selected ? "bg-primary/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      {selected && (
        <motion.span layoutId="tx-selected" transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary shadow-[0_0_10px_var(--primary)]" />
      )}

      {/* Type + assets */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative shrink-0">
          <span className={cn("flex size-10 items-center justify-center rounded-xl border", kindTone(tx.kind))}>
            <Icon icon={meta.icon} className="size-[18px]" strokeWidth={2} />
          </span>
          <CoinAvatar symbol={tx.asset} size="sm" className="absolute -bottom-1 -right-1 size-[18px] ring-2 ring-[#0f0f0f]" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-foreground">
            {meta.label}
            <span className="font-medium text-muted-foreground">
              {tx.asset}
              {tx.toAsset && <> → {tx.toAsset}</>}
            </span>
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            {tx.time}
            <span className="md:hidden"> · {tx.network}</span>
          </span>
        </span>
      </span>

      {/* Network + counterparty */}
      <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
        <span className="truncate text-[13px] text-foreground/85">{tx.network}</span>
        <span className="truncate font-mono text-[11.5px] text-muted-foreground">
          {tx.counterparty ? `${tx.kind === "deposit" ? "from" : "to"} ${truncateMiddle(tx.counterparty, 6, 4)}` : tx.kind === "transfer" ? "internal" : tx.kind === "trade" ? "order book" : "—"}
        </span>
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
            tx.status === "failed" ? "text-muted-foreground line-through decoration-debit/60" : d === "credit" ? "text-credit" : "text-foreground",
          )}
        >
          <Figure mask="••••">{amountText(tx)}</Figure>
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground">
          {/* On a phone the status column is gone, so non-routine states ride here. */}
          {tx.status !== "completed" && <StatusChip tx={tx} className="md:hidden" />}
          <Figure mask="••••">{tx.toAsset ? `→ ${tx.toAmount} ${tx.toAsset}` : formatUSD(usdOf(tx.asset, tx.amount))}</Figure>
        </span>
      </span>

      <Icon icon={ArrowRight01Icon} className={cn("hidden size-4 transition-all duration-200 md:block", selected ? "text-primary" : "text-muted-foreground/30 group-hover:translate-x-0.5 group-hover:text-muted-foreground")} />
    </button>
  )
}

/* ── Sheet (below 1536px) ─────────────────────────────────────────────── */

function DetailSheet({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  // Portalled to the frame root. Rendered in place, the sheet sits inside the
  // page's <Rise> entrance wrapper, whose animation uses `transform` — and a
  // transformed ancestor becomes the containing block for `position: fixed`.
  // The "fixed" sheet was pinned to the bottom of the (long) list instead of
  // the screen. `.dash-root` carries the fonts and isn't transformed, so the
  // sheet keeps the page's type and finally sits on the viewport.
  const [host, setHost] = React.useState<Element | null>(null)
  React.useEffect(() => setHost(document.querySelector(".dash-root") ?? document.body), [])

  // Lock the page's scroller while the sheet is up, so a swipe inside the
  // sheet doesn't scroll the list behind it.
  React.useEffect(() => {
    if (!tx) return
    const main = document.querySelector<HTMLElement>(".dash-root main")
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
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm 2xl:hidden"
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
              "slim-scroll fixed z-50 overflow-y-auto border-white/[0.08] bg-[#0f0f0f] p-5 shadow-[0_-20px_60px_-10px_rgb(0_0_0/0.8)] 2xl:hidden",
              // Phone: bottom sheet. Tablet: right-hand drawer.
              "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[24px] border-t pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              "md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[440px] md:rounded-[24px] md:border",
            )}
          >
            <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/15 md:hidden" />
            <TxDetail tx={tx} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    host,
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function History() {
  const [kind, setKind] = React.useState<KindKey>("all")
  const [status, setStatus] = React.useState<StatusKey>("any")
  const [range, setRange] = React.useState<RangeKey>("30d")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string>(TRANSACTIONS[0].id)
  const [sheetTx, setSheetTx] = React.useState<Tx | null>(null)
  const dayLabel = useDayLabel()

  // Everything except the type tab — so each tab's badge counts what it
  // would show under the other filters.
  const base = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return TRANSACTIONS.filter(
      (t) =>
        (status === "any" || t.status === status) &&
        t.dayOffset < RANGE_DAYS[range] &&
        (!q ||
          [t.asset, t.toAsset, t.hash, t.counterparty, t.network, KIND_META[t.kind].label]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q))),
    )
  }, [status, range, query])

  const rows = kind === "all" ? base : base.filter((t) => t.kind === kind)
  const groups = React.useMemo(() => {
    const m = new Map<number, Tx[]>()
    rows.forEach((t) => m.set(t.dayOffset, [...(m.get(t.dayOffset) ?? []), t]))
    return [...m.entries()]
  }, [rows])

  const selected = TRANSACTIONS.find((t) => t.id === selectedId) ?? TRANSACTIONS[0]
  const filtersOn = status !== "any" || range !== "30d" || !!query

  const select = (tx: Tx) => {
    setSelectedId(tx.id)
    if (!window.matchMedia(WIDE).matches) setSheetTx(tx)
  }
  const closeSheet = React.useCallback(() => setSheetTx(null), [])

  const tabs = KIND_FILTERS.map((f) => ({
    key: f.key as KindKey,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {f.label}
        <span className="rounded-md bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {f.key === "all" ? base.length : base.filter((t) => t.kind === f.key).length}
        </span>
      </span>
    ),
  }))

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 2xl:grid-cols-[minmax(0,1fr)_408px]">
      {/* overflow-clip, not hidden: hidden makes the panel a scroll
          container, and the sticky day headings would stick to it (i.e.
          never) instead of to the page. clip rounds the corners just the same. */}
      <Panel className="overflow-clip pb-2">
        <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <PanelTitle className="text-[17px]">History</PanelTitle>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {rows.length} of {TRANSACTIONS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-[13px] font-semibold text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary disabled:opacity-40"
            >
              <Icon icon={FileExportIcon} className="size-4" />
              Export CSV
            </button>
          </div>

          <div className="border-b border-white/[0.06]">
            <UnderlineTabs id="tx-kinds" options={tabs} value={kind} onChange={setKind} className="scrollbar-none -mx-1 overflow-x-auto" />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 transition-colors focus-within:border-primary/40">
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
              <PillTabs
                id="tx-status"
                size="sm"
                options={[
                  { key: "any", label: "Any" },
                  { key: "completed", label: "Completed" },
                  { key: "pending", label: "Pending" },
                  { key: "failed", label: "Failed" },
                ]}
                value={status}
                onChange={setStatus}
              />
              <PillTabs
                id="tx-range"
                size="sm"
                options={[
                  { key: "7d", label: "7D" },
                  { key: "30d", label: "30D" },
                  { key: "all", label: "All" },
                ]}
                value={range}
                onChange={setRange}
              />
              {filtersOn && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus("any")
                    setRange("30d")
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

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-[14px] font-semibold text-foreground">No transactions match</p>
            <p className="text-[13px] text-muted-foreground">Try another type, widen the date range, or clear the search.</p>
          </div>
        ) : (
          <div className="flex flex-col pt-3">
            {/* Column heads, desktop only — they line up with the row grid. */}
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_112px_minmax(0,1fr)_16px] gap-4 px-7 pb-2 text-[12px] font-medium text-muted-foreground md:grid">
              <span>Transaction</span>
              <span>Network</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              {groups.map(([day, list]) => (
                <motion.section
                  key={day}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-y border-white/[0.04] bg-[#111]/95 px-4 py-2 backdrop-blur md:px-7">
                    <span className="text-[12px] font-semibold text-foreground/80">{dayLabel(day)}</span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      {list.length} {list.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 px-1 py-1.5 md:px-3">
                    {list.map((t) => (
                      <TxRow key={t.id} tx={t} selected={t.id === selected.id} onSelect={() => select(t)} />
                    ))}
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Panel>

      {/* Wide screens: the detail lives beside the list and follows the scroll. */}
      <div className="hidden 2xl:block">
        <Panel className="sticky top-6 p-5">
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
        </Panel>
      </div>

      <DetailSheet tx={sheetTx} onClose={closeSheet} />
    </div>
  )
}
