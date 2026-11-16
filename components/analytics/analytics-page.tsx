"use client"

/**
 * Analytics: the user's own activity, summed from their own records.
 *
 * Sources, and nothing else:
 *  · GET /transactions through useUnifiedTransactions, the transactions
 *    page's hook, at the backend's cap of 100 rows (IntentService.ts
 *    listTransactionHistory clamps the limit to 1–100). The page says how far
 *    back that reaches instead of implying it is the whole history.
 *  · GET /fiat/orders through useFiatOrders, counted on its own (a sell's
 *    crypto leg is already a wallet row).
 *
 * Futures P&L is left out while futures are closed, and so is a value-over-
 * time curve: the dashboard already draws one, from the same balances.
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  BankIcon,
  CheckmarkCircle02Icon,
  Exchange01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { DashScope, EmptyPanel, ErrorPanel, MoreLink, NeutralButton, NeutralLink, SkeletonBlock } from "@/components/dash"
import { Figure, Icon, Panel, PillTabs, type IconSvg } from "@/components/dashboard/redesign/ui"
import { Rise } from "@/components/ui/system"
import { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import { useFiatOrders } from "@/hooks/crypto/useFiatOrders"
import {
  ANALYTICS_RANGES,
  WEEKDAYS,
  bankSummary,
  byAsset,
  byKind,
  byNetwork,
  flowSeries,
  fmtDuration,
  inRange,
  outcomes,
  rhythm,
  totals,
  type AnalyticsRange,
  type BankSide,
  type UsdFigure,
} from "@/lib/analytics-view"
import { FlowChart, FlowTable, RankedBars, RhythmGrid, SegmentBar, blockLabel, usd } from "@/components/analytics/charts"

/** GET /transactions returns at most this many rows. */
const LEDGER_CAP = 100

const RANGE_NOUN: Record<AnalyticsRange, string> = {
  "7d": "the last 7 days",
  "30d": "the last 30 days",
  "90d": "the last 90 days",
  all: "all time",
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function SectionPanel({ title, subtitle, action, className, children }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Panel className={cn("flex min-w-0 flex-col gap-5 p-4 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Panel>
  )
}

function Tile({ label, icon, tone, value, sub }: { label: string; icon: IconSvg; tone: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Panel as="article" className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-[10px] border", tone)}>
          <Icon icon={icon} className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="truncate font-display text-[20px] font-semibold leading-none tracking-[-0.03em] sm:text-[24px]">{value}</span>
        <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>
      </div>
    </Panel>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** A USD figure, or "—" until prices load. Partial sums say what they skipped. */
function usdTile(f: UsdFigure, pricesReady: boolean, noun: string): { value: React.ReactNode; sub: string } {
  if (!pricesReady) return { value: "—", sub: "Waiting for prices" }
  if (f.count > 0 && f.unpriced === f.count) return { value: "—", sub: `${plural(f.count, noun)}, none priced yet` }
  return {
    value: <Figure>{usd(f.usd)}</Figure>,
    sub: f.unpriced > 0 ? `${plural(f.count, noun)} · ${f.unpriced} not priced` : plural(f.count, noun),
  }
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4" role="status" aria-label="Loading figures">
      {Array.from({ length: 4 }, (_, i) => (
        <Panel key={i} as="article" className="flex flex-col gap-4 p-4 sm:p-5" aria-hidden>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="size-8 rounded-[10px]" />
          </div>
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-6 w-28" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </Panel>
      ))}
    </div>
  )
}

function BodySkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5" aria-hidden>
      <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
        <SkeletonBlock className="h-[330px] rounded-[20px] xl:col-span-2" />
        <SkeletonBlock className="h-[330px] rounded-[20px]" />
      </div>
      <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[260px] rounded-[20px]" />
        ))}
      </div>
    </div>
  )
}

function OutcomeLegend({ items }: { items: { key: string; label: string; value: number; dot: string }[] }) {
  const total = items.reduce((n, i) => n + i.value, 0)
  return (
    <ul className="grid grid-cols-3 gap-3">
      {items.map((i) => (
        <li key={i.key} className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", i.dot)} />
            {i.label}
          </span>
          <span className="font-display text-[18px] font-semibold leading-none tabular-nums text-foreground">{i.value}</span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">{total > 0 ? `${Math.round((i.value / total) * 100)}%` : "—"}</span>
        </li>
      ))}
    </ul>
  )
}

function BankRow({ label, side }: { label: string; side: BankSide }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{side.total}</span> · {side.completed} completed
          {side.pending > 0 && <> · {side.pending} in progress</>}
          {side.failed > 0 && <> · {side.failed} didn&apos;t complete</>}
        </span>
      </div>
      <SegmentBar
        label={`${label} by outcome`}
        segments={[
          { key: "c", label: "Completed", value: side.completed, className: "bg-credit" },
          { key: "p", label: "In progress", value: side.pending, className: "bg-warning" },
          { key: "f", label: "Didn't complete", value: side.failed, className: "bg-debit" },
        ]}
      />
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function AnalyticsPage() {
  const model = useUnifiedTransactions({ pollInterval: 60_000, limit: LEDGER_CAP })
  const orders = useFiatOrders(50)
  const [range, setRange] = React.useState<AnalyticsRange>("30d")
  const [view, setView] = React.useState<"chart" | "table">("chart")

  // Everything here is relative to today, which the server cannot know.
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])

  const all = model.transactions
  // stats is null while the USD index loads; until then nothing is priced.
  const pricesReady = model.stats !== null

  const d = React.useMemo(() => {
    if (!now) return null
    const rows = inRange(all, range, now)
    return {
      rows,
      totals: totals(rows),
      flow: flowSeries(rows, range, now),
      kinds: byKind(rows),
      networks: byNetwork(rows),
      assets: byAsset(rows),
      outcomes: outcomes(rows),
      rhythm: rhythm(rows),
    }
  }, [all, range, now])

  const bank = React.useMemo(() => (now && orders.data ? bankSummary(inRange(orders.data, range, now)) : null), [orders.data, range, now])

  const oldest = all.length ? all.reduce((m, r) => (r.createdAt < m ? r.createdAt : m), all[0].createdAt) : null
  const capped = all.length >= LEDGER_CAP
  const coverage =
    all.length === 0
      ? "Your money in, money out, trades and habits, from your own transactions"
      : capped && oldest
        ? `From your latest ${LEDGER_CAP} wallet transactions, back to ${new Date(oldest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Older ones aren't counted yet.`
        : `From all ${plural(all.length, "wallet transaction")} on your account`

  const hasOrders = (orders.data?.length ?? 0) > 0
  const loading = model.isLoading || orders.isLoading || !now
  // Bank orders are activity too: only call it empty or failed when neither
  // source has anything to show.
  const fatal = !loading && model.error && all.length === 0 && !hasOrders

  const bankPanel = (
    <SectionPanel title="Bank orders" subtitle={`Buy and sell orders in ${RANGE_NOUN[range]}`} action={<MoreLink href="/transactions">History</MoreLink>}>
      {orders.isLoading ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading bank orders">
          <SkeletonBlock className="h-10" />
          <SkeletonBlock className="h-10" />
        </div>
      ) : orders.error && !orders.data ? (
        <ErrorPanel compact title="Couldn't load bank orders" onRetry={() => void orders.refetch()} />
      ) : !bank || bank.buys.total + bank.sells.total === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground">
            <Icon icon={BankIcon} className="size-5" />
          </span>
          <p className="text-[13px] text-muted-foreground">No bank orders in {RANGE_NOUN[range]}.</p>
          <div className="flex gap-2">
            <NeutralLink href="/buy">Buy crypto</NeutralLink>
            <NeutralLink href="/sell">Sell crypto</NeutralLink>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <BankRow label="Buys" side={bank.buys} />
          <BankRow label="Sells" side={bank.sells} />
        </div>
      )}
    </SectionPanel>
  )

  const busiest = React.useMemo(() => {
    if (!d) return null
    let best = { d: 0, b: 0, v: 0 }
    d.rhythm.forEach((row, di) => row.forEach((v, bi) => v > best.v && (best = { d: di, b: bi, v })))
    return best.v > 0 ? best : null
  }, [d])

  const settled = d ? d.outcomes.completed + d.outcomes.failed : 0
  const successRate = d && settled > 0 ? Math.round((d.outcomes.completed / settled) * 100) : null

  return (
    <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-8 px-4 pb-12 pt-4 md:gap-10 md:px-6 md:pb-16 md:pt-6">
      {/* Masthead */}
      <Rise>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="flex min-w-0 flex-col gap-1.5 px-1">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Analytics</h1>
            <p className="max-w-[640px] text-[14px] text-muted-foreground">{loading ? "Your money in, money out, trades and habits, from your own transactions" : coverage}</p>
          </div>
          <PillTabs id="analytics-range" options={ANALYTICS_RANGES} value={range} onChange={setRange} className="self-start md:self-auto" />
        </div>
      </Rise>

      {loading ? (
        <div className="flex flex-col gap-4 md:gap-5" role="status" aria-busy="true" aria-label="Loading analytics">
          <TilesSkeleton />
          <BodySkeleton />
        </div>
      ) : fatal ? (
        <Panel>
          <ErrorPanel title="Couldn't load your activity" message="Your transactions didn't load, so there's nothing to add up yet." onRetry={model.refresh} />
        </Panel>
      ) : all.length === 0 && !hasOrders ? (
        <Panel>
          <EmptyPanel
            title="No activity yet"
            description="Once you deposit, send, swap or trade, your figures and charts will build up here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <NeutralLink href="/wallet/modern">Open wallet</NeutralLink>
                <NeutralLink href="/buy">Buy crypto</NeutralLink>
              </div>
            }
          />
        </Panel>
      ) : (
        d && (
          <div className="flex flex-col gap-4 md:gap-5">
            {model.error && (
              <div role="alert" className="rounded-2xl border border-debit/20 bg-debit/[0.08] px-4 py-3 text-[13px] text-debit">
                The latest refresh failed, so these figures may be behind. {model.error}
              </div>
            )}

            {/* Figures: wallet movements only, so they wait for one. */}
            {all.length > 0 && <Rise delay={60}>
              <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                <Tile label="Money in" icon={ArrowDownLeft01Icon} tone="border-credit/25 bg-credit/[0.08] text-credit" {...usdTile(d.totals.moneyIn, pricesReady, "deposit")} />
                <Tile label="Money out" icon={ArrowUpRight01Icon} tone="border-debit/25 bg-debit/[0.08] text-debit" {...usdTile(d.totals.moneyOut, pricesReady, "withdrawal")} />
                <Tile label="Traded" icon={Exchange01Icon} tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80" {...usdTile(d.totals.traded, pricesReady, "trade")} />
                <Tile
                  label="Completed"
                  icon={CheckmarkCircle02Icon}
                  tone="border-primary/25 bg-primary/[0.08] text-primary"
                  value={successRate == null ? "—" : `${successRate}%`}
                  sub={settled > 0 ? `${d.outcomes.completed} of ${plural(settled, "finished transaction")}` : "Nothing has finished yet"}
                />
              </div>
            </Rise>}

            {d.rows.length === 0 ? (
              <Rise delay={120}>
                <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
                  <Panel className="flex items-center justify-center xl:col-span-2">
                    {all.length === 0 ? (
                      <EmptyPanel
                        title="No wallet activity yet"
                        description="Deposits, sends, swaps and trades from your wallet will chart here. Your bank orders are counted alongside."
                        action={<NeutralLink href="/wallet/modern">Open wallet</NeutralLink>}
                      />
                    ) : (
                      <EmptyPanel
                        title={`No wallet activity in ${RANGE_NOUN[range]}`}
                        description="Pick a longer range to see your earlier activity."
                        action={range !== "all" ? <NeutralButton onClick={() => setRange("all")}>Show all time</NeutralButton> : undefined}
                      />
                    )}
                  </Panel>
                  {bankPanel}
                </div>
              </Rise>
            ) : (
              <>
                {/* Flow + outcomes */}
                <Rise delay={120}>
                  <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
                    <SectionPanel
                      className="xl:col-span-2"
                      title="Money in and out"
                      subtitle={
                        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-[2px] bg-credit" />
                            In, above the line
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-[2px] bg-debit" />
                            Out, below it
                          </span>
                          <span>Priced deposits and withdrawals; trades excluded</span>
                        </span>
                      }
                      action={<PillTabs id="analytics-flow-view" size="sm" options={[{ key: "chart", label: "Chart" }, { key: "table", label: "Table" }]} value={view} onChange={setView} />}
                    >
                      {!pricesReady ? (
                        <div className="flex h-[232px] items-center justify-center text-[13px] text-muted-foreground" role="status">
                          Waiting for prices
                        </div>
                      ) : d.flow.every((b) => b.in === 0 && b.out === 0) ? (
                        <EmptyPanel compact title="No priced deposits or withdrawals" description={`Your activity in ${RANGE_NOUN[range]} was trades, or movements we can't price yet.`} />
                      ) : view === "chart" ? (
                        <FlowChart buckets={d.flow} />
                      ) : (
                        <FlowTable buckets={d.flow} />
                      )}
                    </SectionPanel>

                    <SectionPanel title="Outcomes" subtitle={`How your ${plural(d.rows.length, "transaction")} ended`}>
                      <div className="flex flex-col gap-4">
                        <SegmentBar
                          label="Transactions by outcome"
                          segments={[
                            { key: "c", label: "Completed", value: d.outcomes.completed, className: "bg-credit" },
                            { key: "p", label: "Pending", value: d.outcomes.pending, className: "bg-warning" },
                            { key: "f", label: "Failed", value: d.outcomes.failed, className: "bg-debit" },
                          ]}
                        />
                        <OutcomeLegend
                          items={[
                            { key: "c", label: "Completed", value: d.outcomes.completed, dot: "bg-credit" },
                            { key: "p", label: "Pending", value: d.outcomes.pending, dot: "bg-warning" },
                            { key: "f", label: "Failed", value: d.outcomes.failed, dot: "bg-debit" },
                          ]}
                        />
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-foreground/[0.06] pt-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[12px] text-muted-foreground">Typical time to confirm</span>
                          <span className="font-display text-[22px] font-semibold leading-none text-foreground">
                            {d.outcomes.medianSettleSeconds == null ? "—" : fmtDuration(d.outcomes.medianSettleSeconds)}
                          </span>
                        </div>
                        <span className="text-right text-[11.5px] text-muted-foreground">
                          {d.outcomes.settledSample > 0 ? `Median of ${d.outcomes.settledSample}` : "No confirmation times yet"}
                        </span>
                      </div>
                    </SectionPanel>
                  </div>
                </Rise>

                {/* Breakdowns */}
                <Rise delay={180}>
                  <div className="grid gap-4 md:gap-5 lg:grid-cols-3">
                    <SectionPanel title="What you did" subtitle="By type · count, then value">
                      {d.kinds.length ? <RankedBars slices={d.kinds} pricesReady={pricesReady} /> : <p className="text-[13px] text-muted-foreground">Nothing that moved money.</p>}
                    </SectionPanel>
                    <SectionPanel title="Networks" subtitle="Where it happened">
                      {d.networks.length ? <RankedBars slices={d.networks} pricesReady={pricesReady} /> : <p className="text-[13px] text-muted-foreground">No network on these transactions.</p>}
                    </SectionPanel>
                    <SectionPanel title="Assets" subtitle="What moved">
                      {d.assets.length ? <RankedBars slices={d.assets} pricesReady={pricesReady} /> : <p className="text-[13px] text-muted-foreground">No named assets on these transactions.</p>}
                    </SectionPanel>
                  </div>
                </Rise>

                {/* Rhythm + bank */}
                <Rise delay={240}>
                  <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
                    <SectionPanel
                      className="xl:col-span-2"
                      title="When you transact"
                      subtitle={busiest ? `Busiest: ${WEEKDAYS[busiest.d]}, ${blockLabel(busiest.b)} · your local time` : "Your local time"}
                    >
                      <RhythmGrid grid={d.rhythm} />
                    </SectionPanel>
                    {bankPanel}
                  </div>
                </Rise>
              </>
            )}
          </div>
        )
      )}
      <p className="px-1 text-[12px] text-muted-foreground">
        Figures come from the same records as{" "}
        <Link href="/transactions" className="font-medium text-foreground underline-offset-2 hover:underline">
          Transactions
        </Link>
        . Values use today&apos;s prices for assets the record doesn&apos;t price itself.
      </p>
    </DashScope>
  )
}
