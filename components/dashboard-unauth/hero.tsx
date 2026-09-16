"use client"

/**
 * The hero panel — one pane carrying the whole "where do I stand" answer:
 * the balance, the curve, the account split and the four counters.
 *
 * It is ONE CardShell rather than four cards in a row on purpose. These
 * figures are all the same fact seen from different distances, and splitting
 * them into separate panes made the top of the page read as a pile of
 * unrelated widgets.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  CoinsSwapIcon,
  ChartLineData01Icon,
  ArrowDataTransferHorizontalIcon,
  CreditCardIcon,
  EyeIcon,
  ViewOffSlashIcon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ActionPill,
  Balance,
  CardShell,
  DeltaChip,
  Eyebrow,
  Segmented,
  allocationColor,
} from "@/components/ui/system"
import { AreaChart, Donut, MiniSpark } from "@/components/preview/charts"
import { HERO_HUE } from "@/components/preview/surface"
import {
  ACCOUNTS,
  HOLDINGS,
  HOLDINGS_TOTAL,
  PERFORMANCE,
  PORTFOLIO_DAY_PCT,
  PORTFOLIO_DAY_PNL,
  PORTFOLIO_TOTAL,
  RANGES,
  RANGE_DAYS,
  STATS,
  formatUSD,
  type RangeKey,
} from "@/components/dashboard-unauth/demo-data"

const DEMO_UID = "30197536"
const DEMO_NAME = "Raphael"

/** Icon adapters — Segmented/ActionPill take a plain `{className}` component,
 *  and HugeiconsIcon needs its `icon` bound. */
function hi(icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]) {
  const C = ({ className }: { className?: string }) => <HugeiconsIcon icon={icon} className={className} />
  C.displayName = "HugeIcon"
  return C
}

const ActionIcons = {
  deposit: hi(ArrowDownLeft01Icon),
  withdraw: hi(ArrowUpRight01Icon),
  swap: hi(CoinsSwapIcon),
  trade: hi(ChartLineData01Icon),
  bridge: hi(ArrowDataTransferHorizontalIcon),
  buy: hi(CreditCardIcon),
}

type View = "performance" | "allocation"

/** Day labels going back from today, resolved on the client only — the server
 *  has no business guessing the viewer's calendar. */
function useDayLabels(days: number, count: number): string[] | undefined {
  const [labels, setLabels] = React.useState<string[]>()
  React.useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    const today = Date.now()
    setLabels(
      Array.from({ length: count }, (_, i) =>
        fmt.format(new Date(today - (count - 1 - i) * ((days * 86_400_000) / (count - 1)))),
      ),
    )
  }, [days, count])
  return labels
}

function useTodayLine(): string {
  const [line, setLine] = React.useState("")
  React.useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    const greeting = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    const date = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now)
    setLine(`${greeting} · ${date}`)
  }, [])
  return line
}

export function Hero() {
  const [range, setRange] = React.useState<RangeKey>("30d")
  const [view, setView] = React.useState<View>("performance")
  const [hidden, setHidden] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const series = PERFORMANCE[range]
  const labels = useDayLabels(RANGE_DAYS[range], series.points.length)
  const todayLine = useTodayLine()

  const copyUid = () => {
    navigator.clipboard?.writeText(DEMO_UID).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const topHoldings = HOLDINGS.slice(0, 5)
  const otherValue = HOLDINGS.slice(5).reduce((s, h) => s + h.value, 0)
  const slices = [
    ...topHoldings.map((h) => ({ label: h.symbol, value: h.value })),
    ...(otherValue > 0 ? [{ label: "Other", value: otherValue }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <CardShell className={HERO_HUE}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* ── Left: who, how much, split across accounts ─────────────── */}
          <div className="flex flex-col gap-5 p-5 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <Eyebrow>Welcome back</Eyebrow>
                </span>
                <h1 className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]">
                  {DEMO_NAME}
                </h1>
                {/* Reserved height so the client-resolved date doesn't nudge
                    the balance down when it lands. */}
                <p className="min-h-[18px] text-[13px] text-muted-foreground">{todayLine || "\u00A0"}</p>
              </div>
              <button
                type="button"
                onClick={copyUid}
                title="Copy UID"
                className="ws-icon-mono inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:text-foreground"
              >
                UID {DEMO_UID}
                <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="flex items-center gap-2">
                <Eyebrow>Total portfolio</Eyebrow>
                <button
                  type="button"
                  onClick={() => setHidden((v) => !v)}
                  aria-label={hidden ? "Show balances" : "Hide balances"}
                  title={hidden ? "Show balances" : "Hide balances"}
                  className={cn(
                    "ws-icon-mono inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                    hidden ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : EyeIcon} className="h-[15px] w-[15px]" />
                </button>
              </span>
              <Balance value={formatUSD(PORTFOLIO_TOTAL)} hidden={hidden} className="text-[clamp(2.25rem,4.4vw,3.5rem)]" />
              <span className="flex flex-wrap items-center gap-2">
                <DeltaChip value={PORTFOLIO_DAY_PCT} />
                <span
                  className={cn(
                    "text-[13px] font-medium tabular-nums",
                    PORTFOLIO_DAY_PNL >= 0 ? "text-credit" : "text-debit",
                  )}
                >
                  {hidden ? "••••" : `${PORTFOLIO_DAY_PNL >= 0 ? "+" : "−"}${formatUSD(Math.abs(PORTFOLIO_DAY_PNL))}`}
                </span>
                <span className="text-[13px] text-muted-foreground">today</span>
              </span>
            </div>

            {/* Account split — three rails, each with its own 30d shape. */}
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border/40">
              {ACCOUNTS.map((a) => (
                <div key={a.key} className="flex flex-col gap-1.5 bg-card/40 px-3 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    {a.label}
                  </span>
                  <span className="truncate text-[15px] font-semibold tabular-nums">
                    {hidden ? "••••" : formatUSD(a.value, { maxFrac: 0 })}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        a.changePct >= 0 ? "text-credit" : "text-debit",
                      )}
                    >
                      {a.changePct >= 0 ? "+" : ""}
                      {a.changePct.toFixed(2)}%
                    </span>
                    <MiniSpark points={a.points} tone="brand" width={40} height={16} />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{a.caption}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: the curve (or the composition) ──────────────────── */}
          <div className="flex flex-col gap-4 border-t border-border/40 p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                size="sm"
                options={[
                  { key: "performance", label: "Performance" },
                  { key: "allocation", label: "Allocation" },
                ]}
                value={view}
                onChange={setView}
              />
              {view === "performance" && (
                <Segmented
                  size="sm"
                  options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
                  value={range}
                  onChange={setRange}
                />
              )}
            </div>

            {view === "performance" ? (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Eyebrow>{RANGES.find((r) => r.key === range)?.label} change</Eyebrow>
                  {/* Neutral on purpose: the chip beside it carries the sign,
                      and a coloured figure here was the third green object in
                      the same eyeful. */}
                  <span className="font-display text-[22px] font-medium tabular-nums">
                    {hidden
                      ? "••••"
                      : `${series.changeUsd >= 0 ? "+" : "−"}${formatUSD(Math.abs(series.changeUsd))}`}
                  </span>
                  <DeltaChip value={series.changePct} />
                </div>
                <AreaChart
                  points={series.points}
                  labels={labels}
                  format={(v) => (hidden ? "••••" : formatUSD(v, { maxFrac: 0 }))}
                  height={196}
                  className="mt-1"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{labels?.[0] ?? "\u00A0"}</span>
                  <span>{labels ? labels[Math.floor(labels.length / 2)] : "\u00A0"}</span>
                  <span>Now</span>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-wrap items-center justify-center gap-6 py-2 sm:justify-start sm:gap-8">
                <Donut slices={slices} size={158} thickness={16}>
                  <span className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">Assets</span>
                  <span className="font-display text-[22px] font-light tabular-nums">{HOLDINGS.length}</span>
                </Donut>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {slices.map((s, i) => (
                    <span key={s.label} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: allocationColor(i) }}
                      />
                      <span className="w-12 shrink-0 text-[13px] font-medium">{s.label}</span>
                      <span className="flex-1 text-right text-[13px] tabular-nums text-muted-foreground">
                        {hidden ? "••••" : formatUSD(s.value, { maxFrac: 0 })}
                      </span>
                      <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                        {((s.value / HOLDINGS_TOTAL) * 100).toFixed(1)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Counters — the ledger-style strip that closes the pane ────── */}
        {/* Four across only once there is room for four: at tablet and small
            desktop widths a 4-up strip clipped every label to "ACTIVE WALLE…",
            which is worse than two rows of two. */}
        <div className="grid grid-cols-2 gap-px border-t border-border/40 bg-border/40 2xl:grid-cols-4">
          {STATS.map((s) => (
            // Label beside the figure once the cell is wide enough; stacked on
            // a phone, where side-by-side left "30d volume / +18% vs last
            // month" wrapping across three ragged lines.
            <div
              key={s.key}
              className="flex flex-col gap-1 bg-card/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.07em] text-muted-foreground">
                  {s.label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground/70">{s.hint}</span>
              </div>
              <span
                className={cn(
                  "shrink-0 font-display text-[20px] font-medium tabular-nums",
                  s.tone === "credit" && "text-credit",
                  s.tone === "debit" && "text-debit",
                  s.tone === "warning" && "text-warning",
                )}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </CardShell>

      {/* ── Action rail ──────────────────────────────────────────────────── */}
      <div className="scrollbar-none -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        <ActionPill icon={ActionIcons.deposit} label="Deposit" />
        <ActionPill icon={ActionIcons.withdraw} label="Withdraw" />
        <ActionPill icon={ActionIcons.swap} label="Swap" />
        <ActionPill icon={ActionIcons.trade} label="Trade" />
        <ActionPill icon={ActionIcons.bridge} label="Bridge" />
        <ActionPill icon={ActionIcons.buy} label="Buy with card" />
      </div>
    </div>
  )
}
