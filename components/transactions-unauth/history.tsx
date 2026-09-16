"use client"

/**
 * The history list.
 *
 * Read the live page's rows and the faults are all in one place:
 *
 *   · a swap renders as "→ 0x0000…0000" — the zero address, printed in full,
 *     where the PAIR belongs. A swap's content is "0.0016 ETH became 5.40
 *     USDC"; the counterparty of an AMM trade is not a fact anyone wants.
 *   · amounts carry no dollar value, so every row has to be priced in the
 *     reader's head
 *   · one row reads "-0.00 Unknown" — an unresolved symbol and an amount
 *     rounded past the point of meaning
 *   · fees appear nowhere
 *   · every status is a green "Completed" pill, which spends the money-in
 *     colour on the fact that nothing went wrong
 *   · the row is a label on the far left and figures on the far right with a
 *     third of the screen of nothing in between
 *
 * So: swaps show both legs, every row carries its USD value, fees and hashes
 * live in an expandable detail, and only a genuine exception takes a colour.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ArrowDataTransferHorizontalIcon,
  CoinsSwapIcon,
  ChartLineData01Icon,
  Search01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  LinkSquare02Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, CardHeader, EmptyState, Segmented, Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import {
  KIND_FILTERS,
  RANGE_FILTERS,
  STATUS_FILTERS,
  TRANSACTIONS,
  directionOf,
  formatAmount,
  formatUSD,
  usdOf,
  type Tx,
  type TxKind,
  type TxStatus,
} from "@/components/transactions-unauth/tx-data"

const KIND_ICON = {
  deposit: ArrowDownLeft01Icon,
  withdrawal: ArrowUpRight01Icon,
  swap: CoinsSwapIcon,
  trade: ChartLineData01Icon,
  transfer: ArrowDataTransferHorizontalIcon,
} as const

const KIND_LABEL: Record<TxKind, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  swap: "Swap",
  trade: "Trade",
  transfer: "Transfer",
}

function truncate(s: string, head = 6, tail = 4) {
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
}

/**
 * Day-group headings.
 *
 * "Today" and "Yesterday" are facts about the DATA (offset 0 and 1) so they
 * render on the server. A real date is a fact about the viewer's calendar, so
 * offsets of 2 or more start as "5 days ago" and become "Mon, Sep 14" once
 * mounted. Formatting a date during SSR is the classic hydration mismatch.
 */
function useDayLabel() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return React.useCallback(
    (offset: number) => {
      if (offset === 0) return "Today"
      if (offset === 1) return "Yesterday"
      if (!mounted) return `${offset} days ago`
      const d = new Date()
      d.setDate(d.getDate() - offset)
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d)
    },
    [mounted],
  )
}

/* ── Status ───────────────────────────────────────────────────────────────── */

function StatusPill({ tx }: { tx: Tx }) {
  if (tx.status === "pending" && tx.confirmations) {
    const [seen, need] = tx.confirmations
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-chip px-2 py-1 text-[11.5px] font-semibold text-warning">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
        {seen}/{need}
      </span>
    )
  }
  if (tx.status === "failed") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-debit-chip px-2 py-1 text-[11.5px] font-semibold text-debit">
        Failed
      </span>
    )
  }
  // Neutral on purpose. "Nothing went wrong" is the default case, and a green
  // pill on 28 of 30 rows makes the two that DID go wrong harder to find.
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-foreground/[0.07] px-2 py-1 text-[11.5px] font-medium text-muted-foreground">
      Completed
    </span>
  )
}

/* ── One row ──────────────────────────────────────────────────────────────── */

function Row({ tx, dayLabel }: { tx: Tx; dayLabel: string }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const dir = directionOf(tx.kind)
  const usd = usdOf(tx.asset, tx.amount)
  const isPair = Boolean(tx.toAsset && tx.toAmount)
  const sign = dir === "credit" ? "+" : dir === "debit" ? "−" : ""

  const copyHash = () => {
    navigator.clipboard?.writeText(tx.hash).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={cn("transition-colors", open ? "bg-accent/30" : "hover:bg-accent/40")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          // Direction is what the glyph means, so it opts out of the global
          // two-tone gold treatment.
          className={cn(
            "ws-icon-mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            dir === "credit" && "bg-credit-chip text-credit",
            dir === "debit" && "bg-debit-chip text-debit",
            dir === "neutral" && "bg-convert-chip text-primary",
          )}
        >
          <HugeiconsIcon icon={KIND_ICON[tx.kind]} className="h-[17px] w-[17px]" />
        </span>

        {/* What happened. A swap says what it BECAME — the live page prints the
            zero address here instead. */}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            {/* nowrap, not truncate: these five labels are short and known, and
                a clipped "Withdraw…" tells you less than a slightly narrower
                meta line below it. */}
            <span className="whitespace-nowrap text-[13.5px] font-semibold leading-tight">
              {KIND_LABEL[tx.kind]}
            </span>
            {/* The pair with its coin marks needs ~120px it does not have on a
                phone — at 375px the symbols were rendering 5px wide. It moves
                into the meta line as plain text below `sm`. */}
            {isPair && (
              <span className="hidden min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground sm:flex">
                <CoinAvatar symbol={tx.asset} size="sm" />
                <span className="truncate">{tx.asset}</span>
                <span aria-hidden>→</span>
                <CoinAvatar symbol={tx.toAsset!} size="sm" />
                <span className="truncate">{tx.toAsset}</span>
              </span>
            )}
          </span>
          <span className="truncate text-[11.5px] leading-tight text-muted-foreground">
            {isPair && (
              <span className="sm:hidden">
                {tx.asset} → {tx.toAsset} ·{" "}
              </span>
            )}
            {tx.network} · {tx.time}
            {tx.counterparty && !isPair && (
              // Hidden on a phone: it was eating the line and it is one tap
              // away in the row detail, in full, with a copy control.
              <span className="hidden sm:inline">
                {" · "}
                {tx.kind === "deposit" ? "from" : "to"}{" "}
                <span className="font-mono">{truncate(tx.counterparty)}</span>
              </span>
            )}
          </span>
        </span>

        <span className="hidden shrink-0 sm:block">
          <StatusPill tx={tx} />
        </span>

        {/* The figures. Token amount AND dollar value — the live page gives
            only the first, so every row has to be priced in your head. */}
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "whitespace-nowrap text-[13.5px] font-semibold tabular-nums",
              dir === "credit" && "text-credit",
              dir === "debit" && "text-debit",
              dir === "neutral" && "text-foreground",
              tx.status === "failed" && "text-muted-foreground line-through",
            )}
          >
            {sign}
            {formatAmount(tx.amount)} {tx.asset}
          </span>
          <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground">
            {isPair ? `→ ${formatAmount(tx.toAmount!)} ${tx.toAsset}` : formatUSD(usd)}
          </span>
        </span>

        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            "ws-icon-mono h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/25 px-4 pb-4 pt-3 sm:grid-cols-4 sm:pl-16">
          <Detail label="Status">
            <StatusPill tx={tx} />
          </Detail>
          <Detail label="Network fee">
            <span className="text-[12.5px] tabular-nums">
              {formatAmount(tx.fee)} {tx.feeAsset}
              <span className="text-muted-foreground"> · {formatUSD(usdOf(tx.feeAsset, tx.fee))}</span>
            </span>
          </Detail>
          <Detail label="Value then">
            <span className="text-[12.5px] tabular-nums">{formatUSD(usd)}</span>
          </Detail>
          <Detail label="Date">
            <span className="text-[12.5px]">
              {dayLabel} · {tx.time}
            </span>
          </Detail>
          {tx.counterparty && (
            <Detail label={tx.kind === "deposit" ? "From" : "To"} span>
              <span className="break-all font-mono text-[12px] text-muted-foreground">{tx.counterparty}</span>
            </Detail>
          )}
          <Detail label="Transaction hash" span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono text-[12px] text-muted-foreground">{tx.hash}</span>
              <button
                type="button"
                onClick={copyHash}
                className={cn(
                  "ws-icon-mono inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors",
                  copied ? "text-credit" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="ws-icon-mono inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Explorer
                <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
              </button>
            </span>
          </Detail>
        </div>
      )}
    </div>
  )
}

function Detail({
  label,
  span,
  children,
}: {
  label: string
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", span && "col-span-2 sm:col-span-4")}>
      <Eyebrow className="text-[10.5px]">{label}</Eyebrow>
      {children}
    </div>
  )
}

/* ── The list ─────────────────────────────────────────────────────────────── */

const PAGE = 12

export function History() {
  const [kind, setKind] = React.useState<TxKind | "all">("all")
  const [status, setStatus] = React.useState<TxStatus | "any">("any")
  const [range, setRange] = React.useState("30d")
  const [query, setQuery] = React.useState("")
  const [shown, setShown] = React.useState(PAGE)
  const dayLabel = useDayLabel()

  const days = RANGE_FILTERS.find((r) => r.key === range)?.days ?? Infinity

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return TRANSACTIONS.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false
      if (status !== "any" && t.status !== status) return false
      if (t.dayOffset >= days) return false
      if (!q) return true
      return (
        t.asset.toLowerCase().includes(q) ||
        (t.toAsset ?? "").toLowerCase().includes(q) ||
        t.network.toLowerCase().includes(q) ||
        t.hash.toLowerCase().includes(q) ||
        (t.counterparty ?? "").toLowerCase().includes(q)
      )
    })
  }, [kind, status, days, query])

  // Narrowing the filter while paged deep would otherwise leave "Load more"
  // visible over a list that is already complete.
  React.useEffect(() => setShown(PAGE), [kind, status, range, query])

  const page = rows.slice(0, shown)

  // Group by day, preserving order — the rows are already newest first.
  const groups: { offset: number; items: Tx[] }[] = []
  for (const t of page) {
    const last = groups[groups.length - 1]
    if (last && last.offset === t.dayOffset) last.items.push(t)
    else groups.push({ offset: t.dayOffset, items: [t] })
  }

  const filtering = kind !== "all" || status !== "any" || query.trim() !== "" || range !== "30d"

  return (
    <CardShell className={CARD_HUE}>
      {/* The kind tabs used to live in CardHeader's `right` slot. Six tabs and
          a subtitle cannot share one line on a 375px phone: the subtitle got
          squeezed to a four-line column ("30 / of / 30 / transactions") and
          the tabs still overflowed the card. They get their own scrollable
          row instead — which also reads better on desktop. */}
      <CardHeader title="History" subtitle={`${rows.length} of ${TRANSACTIONS.length} transactions`} />

      <div className="scrollbar-none overflow-x-auto border-t border-border/40 px-4 py-2.5">
        <Segmented size="sm" options={KIND_FILTERS} value={kind} onChange={setKind} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-border/40 px-4 py-2.5">
        {/* w-full on a phone: as a flex-1 sibling of two selects it collapsed
            to the width of its own magnifier icon. */}
        <label className="relative flex w-full min-w-[12rem] items-center sm:w-auto sm:flex-1 sm:max-w-xs">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground"
          />
          <span className="sr-only">Search transactions</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hash, token, address…"
            className="h-9 w-full min-w-0 rounded-full bg-foreground/[0.05] pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="ws-icon-mono absolute right-3 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <Select value={status} onChange={(v) => setStatus(v as TxStatus | "any")} options={STATUS_FILTERS} />
        <Select value={range} onChange={setRange} options={RANGE_FILTERS} />

        <span className="ml-auto hidden text-[12px] tabular-nums text-muted-foreground/70 sm:block">
          {rows.length === TRANSACTIONS.length ? "No filters" : `${TRANSACTIONS.length - rows.length} filtered out`}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description={
            filtering
              ? "No transaction fits those filters. Widen the date range or clear the search."
              : "Transactions appear here as soon as money moves."
          }
        />
      ) : (
        <div className="flex flex-1 flex-col">
          {groups.map((g) => (
            <div key={g.offset} className="flex flex-col">
              {/* Sticky day heading — scrolling a long ledger without one means
                  losing track of what day you are reading. */}
              <div className="sticky top-0 z-10 flex items-center gap-3 bg-card/85 px-4 py-1.5 backdrop-blur-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {dayLabel(g.offset)}
                </span>
                <span aria-hidden className="h-px flex-1 bg-border/40" />
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {g.items.length} {g.items.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border/25">
                {g.items.map((t) => (
                  <Row key={t.id} tx={t} dayLabel={dayLabel(t.dayOffset)} />
                ))}
              </div>
            </div>
          ))}

          {shown < rows.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="border-t border-border/40 px-4 py-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              Show {Math.min(PAGE, rows.length - shown)} more
              <span className="text-muted-foreground/60"> · {rows.length - shown} remaining</span>
            </button>
          )}
        </div>
      )}
    </CardShell>
  )
}

/** A styled native select — keeps keyboard and mobile behaviour for free, and
 *  avoids putting a popover inside a card that scrolls. */
function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { key: string; label: string }[]
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={options[0]?.label}
        className="h-9 appearance-none rounded-full bg-foreground/[0.05] pl-3.5 pr-8 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key} className="bg-popover text-popover-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className="ws-icon-mono pointer-events-none absolute right-3 h-3.5 w-3.5 text-muted-foreground"
      />
    </span>
  )
}
