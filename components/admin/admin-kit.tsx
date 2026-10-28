"use client"

/**
 * The admin console's shared pieces, in the redesign's language
 * (components/dash on the app's tokens, both themes): the page header (period, last update, refresh), KPI cards with their
 * change and trend, the switchable main chart, breakdown bars, and one panel
 * per non-figure state, so every admin page draws loading, switching
 * period, no access, signed out, not connected, failed, empty and quiet
 * periods the same way.
 *
 * Access is the backend's call (RBAC): these screens only render what it
 * answers. A 403 shows "no access"; nothing here checks a role.
 */

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, CancelCircleIcon, CheckmarkCircle02Icon, InformationCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons"

import { ChangeChip, Chip, EmptyPanel, GoldButton, NeutralButton, ErrorPanel, Panel, PanelHeader, PillTabs, PriceChart, SkeletonBlock, StatePanel, UnavailableState } from "@/components/dash"
import { Spark, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { ADMIN_DATA_IS_MOCK } from "@/lib/admin/source"
import { customPeriod, isAdminPeriod, MAX_CUSTOM_DAYS, parseCustomPeriod, type AdminAttention, type AdminBreakdown, type AdminKpi, type AdminPeriod, type AdminServiceStatus } from "@/lib/admin/types"
import { attentionItems, bucketLabel, bucketUnit, kpiChange, kpiDelta, PERIOD_OPTIONS, periodLong, periodPrevious, shares, spreadTicks, timeAgo, type AdminViewState } from "@/lib/admin/view"
import { cn } from "@/lib/utils"

/* ── Frame ────────────────────────────────────────────────────────────── */

/** The period lives in the URL (`?period=7d`), so it survives navigation and can be shared. */
export function useAdminPeriod(): [AdminPeriod, (period: AdminPeriod) => void] {
  const search = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = search.get("period")
  // Anything that isn't a preset or a valid custom range (bad dates, future,
  // too long) falls back to 7d rather than reaching the backend.
  const period: AdminPeriod = isAdminPeriod(raw) ? raw : "7d"
  const setPeriod = React.useCallback(
    (next: AdminPeriod) => {
      const params = new URLSearchParams(search.toString())
      params.set("period", next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [search, router, pathname],
  )
  return [period, setPeriod]
}

/** Title, the "Demo data" tag while mocked, the period picker, and when the figures were computed (with refresh). */
export function AdminPageHeader({
  title,
  subtitle,
  period,
  onPeriod,
  asOf,
  refreshing,
  onRefresh,
}: {
  title: string
  subtitle: string
  /** Omit both for a page that isn't period-based (the audit log). */
  period?: AdminPeriod
  onPeriod?: (p: AdminPeriod) => void
  asOf?: string
  refreshing: boolean
  onRefresh: () => void
}) {
  // Re-render the "updated" line every 30s so it doesn't go stale on screen.
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[30px]">{title}</h1>
          {ADMIN_DATA_IS_MOCK && <Chip>Demo data</Chip>}
        </div>
        <p className="text-[13.5px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground tabular-nums" aria-live="polite">
          {refreshing ? "Updating…" : asOf ? `Updated ${timeAgo(asOf)}` : ""}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh figures"
          className="flex size-8 items-center justify-center rounded-full border border-foreground/[0.07] bg-foreground/[0.025] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
        >
          <HugeiconsIcon icon={RefreshIcon} className={cn("size-4", refreshing && "animate-spin motion-reduce:animate-none")} strokeWidth={1.8} />
        </button>
        {period && onPeriod && <PeriodPicker period={period} onPeriod={onPeriod} />}
      </div>
    </header>
  )
}

/* ── Period picker ────────────────────────────────────────────────────── */

const todayUtc = () => new Date().toISOString().slice(0, 10)
const daysAgoUtc = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

/**
 * The presets, plus "Custom": two dates (UTC days, both included, up to a
 * year, not in the future), checked by parseCustomPeriod before they're
 * applied. The chosen range shows under the tabs.
 */
function PeriodPicker({ period, onPeriod }: { period: AdminPeriod; onPeriod: (p: AdminPeriod) => void }) {
  const current = parseCustomPeriod(period)
  const [open, setOpen] = React.useState(false)
  const [from, setFrom] = React.useState(current?.from ?? daysAgoUtc(13))
  const [to, setTo] = React.useState(current?.to ?? todayUtc())
  const [problem, setProblem] = React.useState<string | null>(null)
  const fromId = React.useId()
  const toId = React.useId()
  const options = [...PERIOD_OPTIONS.map((o) => ({ key: o.key as string, label: o.label })), { key: "custom", label: "Custom" }]

  const apply = () => {
    const next = customPeriod(from, to)
    if (!parseCustomPeriod(next)) {
      setProblem(from > to ? "The start date must be on or before the end date." : to > todayUtc() ? "The range can't end in the future." : `Pick a range of at most ${MAX_CUSTOM_DAYS} days.`)
      return
    }
    setProblem(null)
    setOpen(false)
    onPeriod(next)
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <PillTabs
        label="Period"
        options={options}
        value={current ? "custom" : period}
        onChange={(key) => (key === "custom" ? setOpen(true) : (setOpen(false), onPeriod(key as AdminPeriod)))}
      />
      {current && !open && (
        <button type="button" onClick={() => setOpen(true)} className="rounded text-[11.5px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60">
          {periodLong(period)} · change
        </button>
      )}
      {open && (
        <div role="group" aria-label="Custom range" className="ds-panel absolute right-0 top-full z-30 mt-2 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={fromId} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
              From
              <input id={fromId} type="date" value={from} max={to || todayUtc()} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
            </label>
            <label htmlFor={toId} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
              To
              <input id={toId} type="date" value={to} min={from} max={todayUtc()} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
            </label>
          </div>
          <p className="text-[11.5px] text-muted-foreground">Whole days in UTC, both included. Up to {MAX_CUSTOM_DAYS} days.</p>
          {problem && <p role="alert" className="text-[12px] font-semibold text-debit">{problem}</p>}
          <div className="flex justify-end gap-2">
            <NeutralButton onClick={() => { setOpen(false); setProblem(null) }}>Cancel</NeutralButton>
            <GoldButton onClick={apply}>Apply</GoldButton>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Figures ──────────────────────────────────────────────────────────── */

/** An absolute change: arrow + signed figure + colour (flat reads neutral). */
function DeltaChip({ value, format, lowerIsBetter = false }: { value: number; format: (v: number) => string; lowerIsBetter?: boolean }) {
  const up = value > 0
  const down = value < 0
  // Colour says good/bad, the arrow says direction: for "lower is better"
  // figures (payout time) a rise is red.
  const good = lowerIsBetter ? down : up
  const bad = lowerIsBetter ? up : down
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums", good ? "bg-credit/[0.12] text-credit" : bad ? "bg-debit/[0.12] text-debit" : "bg-foreground/[0.06] text-muted-foreground")}>
      <span aria-hidden>{up ? "▲" : down ? "▼" : "•"}</span>
      <span className="sr-only">{up ? "Up" : down ? "Down" : "Unchanged"}</span>
      {up ? "+" : down ? "−" : ""}
      {format(Math.abs(value))}
    </span>
  )
}

/**
 * One KPI: figure, change vs the previous period, and its trend across the
 * period. `compare="absolute"` is for running totals (show "+1,388", not a
 * percentage of the whole). `definition` sits behind an ⓘ that opens in
 * place (works on touch and keyboard, unlike a hover tooltip). `kpi`
 * undefined draws the skeleton; `dim` while a new period loads.
 */
export function KpiCard({
  label,
  kpi,
  format,
  period,
  note,
  definition,
  compare = "percent",
  lowerIsBetter = false,
  dim = false,
}: {
  label: string
  kpi?: AdminKpi
  format: (v: number) => string
  period: AdminPeriod
  note?: string
  definition?: string
  compare?: "percent" | "absolute"
  /** For figures where a fall is good (e.g. payout time): flips the change colour. Absolute comparisons only. */
  lowerIsBetter?: boolean
  dim?: boolean
}) {
  const [explain, setExplain] = React.useState(false)
  const definitionId = React.useId()
  const change = kpi ? kpiChange(kpi) : null
  const delta = kpi ? kpiDelta(kpi) : null
  const comparison = compare === "absolute"
    ? delta === null ? null : <><DeltaChip value={delta} format={format} lowerIsBetter={lowerIsBetter} /><span className="hidden truncate sm:inline">in {periodLong(period)}</span></>
    : change === null ? null : <><ChangeChip value={change} /><span className="hidden truncate sm:inline">vs {periodPrevious(period)}</span></>
  return (
    <Panel className={cn("flex min-w-0 flex-col gap-2.5 p-3.5 transition-opacity sm:gap-3 sm:p-4 md:p-5", dim && "opacity-55")} aria-busy={!kpi || dim}>
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
        {definition && (
          <button
            type="button"
            onClick={() => setExplain((v) => !v)}
            aria-expanded={explain}
            aria-controls={definitionId}
            aria-label={`What "${label}" means`}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      {definition && explain && (
        <p id={definitionId} className="-mt-1.5 rounded-lg bg-foreground/[0.04] px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {definition}
        </p>
      )}
      {kpi ? (
        <>
          {/* The figure gets the full width (it must never be cut off); the
              trend sits under it, stretched to the card. */}
          <p className="whitespace-nowrap font-display text-[20px] font-semibold sm:text-[26px] leading-none tracking-[-0.03em] tabular-nums text-foreground">{format(kpi.value)}</p>
          {kpi.spark.length > 1 && kpi.spark.some((v) => v !== kpi.spark[0]) ? (
            <Spark points={kpi.spark} width={200} height={28} tone="brand" fluid />
          ) : (
            <span aria-hidden className="h-7" />
          )}
          <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            {comparison ?? <span>No earlier period to compare</span>}
          </p>
          {note && <p className="-mt-1.5 truncate text-[11.5px] text-muted-foreground/80">{note}</p>}
        </>
      ) : (
        <>
          <SkeletonBlock className="h-[26px] w-28" />
          <SkeletonBlock className="h-7 w-full" />
          <SkeletonBlock className="h-3 w-32" />
        </>
      )}
    </Panel>
  )
}

export function KpiGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: 3 | 4 }) {
  // Two per row on phones (one per row made the overview a long scroll);
  // a third card in a 3-up grid spans the row there.
  return <div className={cn("grid grid-cols-2 gap-3 md:gap-4", columns === 4 ? "xl:grid-cols-4" : "[&>*:last-child:nth-child(odd)]:col-span-2 xl:grid-cols-3 xl:[&>*:last-child:nth-child(odd)]:col-span-1")}>{children}</div>
}

export type ChartMetric<K extends string> = { key: K; label: string; values: number[]; previous?: number[]; format: (v: number) => string; formatAxis: (v: number) => string }

/** The main chart with a metric switch. `points` are bucket starts (ISO). */
export function MetricChart<K extends string>({
  id,
  title,
  period,
  at,
  metrics,
  quiet,
  dim,
  height = 260,
}: {
  id: string
  title: string
  period: AdminPeriod
  /** Bucket starts; undefined = loading. */
  at?: string[]
  metrics: ChartMetric<K>[]
  quiet: boolean
  dim: boolean
  /** Chart height in px (the overview raises it to line up with the column beside it). */
  height?: number
}) {
  const [metricKey, setMetricKey] = React.useState<K>(metrics[0]!.key)
  const [comparing, setComparing] = React.useState(true)
  // The same numbers as a table: for screen readers, and for reading exact values.
  const [asTable, setAsTable] = React.useState(false)
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]!
  const labels = React.useMemo(() => (at ? at.map((a) => bucketLabel(a, period)) : []), [at, period])
  return (
    <Panel className="flex flex-col gap-2 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-foreground/[0.06]">
        <h2 className="pb-3.5 font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        <UnderlineTabs id={id} options={metrics.map((m) => ({ key: m.key, label: m.label }))} value={metric.key} onChange={setMetricKey} className="-mb-px overflow-x-auto" />
      </div>
      {!at ? (
        <div role="status" aria-busy="true" aria-label="Loading chart" className="pt-3">
          <div style={{ height }}><SkeletonBlock className="h-full w-full rounded-2xl" /></div>
        </div>
      ) : quiet || metric.values.every((v) => v === 0) ? (
        <EmptyPanel compact title="No activity in this period" description={`Nothing to chart for ${periodLong(period)}. Try a longer period.`} />
      ) : (
        <div className={cn("pt-3 transition-opacity", dim && "opacity-55")} aria-busy={dim}>
          {asTable ? (
            <div className="overflow-auto rounded-xl border border-foreground/[0.06]" style={{ maxHeight: height }}>
              <table className="w-full text-[12.5px] tabular-nums">
                <caption className="sr-only">{metric.label} per {bucketUnit(period)}, {periodLong(period)}</caption>
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">{bucketUnit(period) === "hour" ? "Hour (UTC)" : bucketUnit(period) === "month" ? "Month" : "Day"}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">{metric.label}</th>
                    {metric.previous && <th scope="col" className="px-3 py-2 text-right font-medium">{periodPrevious(period).replace(/^p/, "P")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {metric.values.map((v, i) => (
                    <tr key={i} className="border-t border-foreground/[0.05]">
                      <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">{labels[i]}</th>
                      <td className="px-3 py-1.5 text-right font-semibold text-foreground">{metric.format(v)}</td>
                      {metric.previous && <td className="px-3 py-1.5 text-right text-muted-foreground">{metric.format(metric.previous[i] ?? 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <PriceChart
            points={metric.values}
            compare={comparing ? metric.previous : undefined}
            compareLabel={periodPrevious(period).replace(/^p/, "P")}
            pointLabels={labels}
            ticks={spreadTicks(labels)}
            format={metric.format}
            formatAxis={metric.formatAxis}
            height={height}
          />
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />This period</span>
              {metric.previous && (
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={comparing} onChange={(e) => setComparing(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
                  <span aria-hidden className="w-4 border-t-[1.5px] border-dashed border-muted-foreground/60" />
                  {periodPrevious(period).replace(/^p/, "P")}
                </label>
              )}
            </div>
            <span className="flex items-center gap-3 text-muted-foreground/70">
              Per {bucketUnit(period)} · times in UTC
              <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="rounded font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60">
                {asTable ? "View as chart" : "View as table"}
              </button>
            </span>
          </div>
        </div>
      )}
    </Panel>
  )
}

/** A ranked share list: label, figure, share bar. */
export function BreakdownPanel({ title, subtitle, items, format, dim, emptyText, action }: { title: string; subtitle?: string; items?: AdminBreakdown[]; format: (v: number) => string; dim: boolean; emptyText: string; /** e.g. a switch between breakdowns */ action?: React.ReactNode }) {
  const pct = items ? shares(items.map((i) => i.value)) : []
  return (
    <Panel className="flex flex-col gap-4 p-4 md:p-5">
      <PanelHeader title={title} subtitle={subtitle} action={action} />
      {!items ? (
        <div role="status" aria-busy="true" aria-label={`Loading ${title}`} className="flex flex-col gap-3.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <SkeletonBlock className="h-3 w-40" />
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 || items.every((i) => i.value === 0) ? (
        <EmptyPanel compact title="Nothing to break down" description={emptyText} />
      ) : (
        <ul className={cn("flex flex-col gap-3.5 transition-opacity", dim && "opacity-55")}>
          {items.map((item, i) => (
            <li key={item.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold text-foreground">{item.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{format(item.value)}</span> · {pct[i]!.toFixed(pct[i]! < 10 ? 1 : 0)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden>
                <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : i === 1 ? "bg-primary/70" : i === 2 ? "bg-primary/50" : "bg-primary/30")} style={{ width: `${pct[i]}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ── Needs attention ──────────────────────────────────────────────────── */

const SERVICE_DOT: Record<AdminServiceStatus, string> = {
  operational: "bg-credit",
  degraded: "bg-warning",
  down: "bg-debit",
}
const SERVICE_WORD: Record<AdminServiceStatus, string> = { operational: "Operational", degraded: "Degraded", down: "Down" }

/**
 * What an admin should act on now (worst first, lib/admin/view.ts
 * attentionItems), and every dependency's health, in a compact column that
 * sits beside the main chart on wide screens. A one-line summary heads it;
 * "All clear" when there's nothing, so an empty panel never reads as
 * "didn't load".
 */
export function AttentionPanel({ attention, dim, className }: { attention?: AdminAttention; dim: boolean; className?: string }) {
  const items = attention ? attentionItems(attention) : []
  const critical = items.filter((i) => i.tone === "danger").length
  const warnings = items.length - critical
  const summary = [critical ? `${critical} critical` : "", warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")
  return (
    <Panel className={cn("flex min-w-0 flex-col gap-3 p-4 transition-opacity md:p-5", dim && "opacity-55", className)} aria-busy={!attention || dim}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground">Needs attention</h2>
          <p className="text-[12px] text-muted-foreground">Queues are live; failures count for the chosen period</p>
        </div>
        {attention && items.length > 0 && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums", critical ? "bg-debit/[0.12] text-debit" : "bg-warning/[0.12] text-warning")}>{summary}</span>
        )}
      </div>
      {!attention ? (
        <div role="status" aria-label="Loading what needs attention" className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => <SkeletonBlock key={i} className="h-10 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-credit/[0.07] px-3 py-2.5" role="status">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-[18px] shrink-0 text-credit" strokeWidth={1.8} />
          <p className="text-[13px] font-semibold text-foreground">All clear. Nothing needs a look right now.</p>
        </div>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5 rounded-xl px-1 py-2 transition-colors hover:bg-foreground/[0.03]">
              <HugeiconsIcon icon={item.tone === "danger" ? CancelCircleIcon : Alert02Icon} className={cn("mt-px size-4 shrink-0", item.tone === "danger" ? "text-debit" : "text-warning")} strokeWidth={2} />
              <div className="flex min-w-0 flex-col">
                <p className="text-[13px] font-semibold leading-snug text-foreground">{item.title}</p>
                <p className="text-[12px] leading-snug text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {attention && attention.services.length > 0 && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-foreground/[0.06] pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/80">Services</p>
          <ul className="flex flex-col gap-1">
            {attention.services.map((svc) => (
              <li key={svc.key} className="flex items-center gap-2 text-[12.5px]">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", SERVICE_DOT[svc.status])} />
                <span className="min-w-0 flex-1 truncate text-foreground" title={svc.detail}>{svc.label}</span>
                <span className={cn("shrink-0 font-semibold", svc.status === "operational" ? "text-muted-foreground" : svc.status === "degraded" ? "text-warning" : "text-debit")}>{SERVICE_WORD[svc.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/* ── States ───────────────────────────────────────────────────────────── */

/** States that replace the figures entirely (rather than sitting beside them). */
export function blocksFigures(state: AdminViewState): boolean {
  return state.kind === "forbidden" || state.kind === "signed-out" || state.kind === "unavailable" || state.kind === "error" || state.kind === "empty"
}

/** The panel for every state that isn't figures. `subject` names what's missing ("users", "wallets"). */
export function AdminStatePanel({ state, period, subject, onRetry }: { state: AdminViewState; period: AdminPeriod; subject: string; onRetry: () => void }) {
  const body = (() => {
    switch (state.kind) {
      case "forbidden":
        return <StatePanel tone="warning" title="You don't have access to this" description="Your account doesn't have an admin role for this page. Ask an administrator if you need it." />
      case "signed-out":
        return <StatePanel tone="warning" title="Sign in again" description="Your session has ended. Sign in again to see admin data." />
      case "unavailable":
        return <UnavailableState title="Admin data isn't connected yet" description="These figures will appear once the admin service is wired up." />
      case "error":
        return <ErrorPanel title="Couldn't load admin data" message="Something went wrong on our side. Try again in a moment." onRetry={onRetry} reference={state.requestId} />
      case "empty":
        return <EmptyPanel title={`No ${subject} yet`} description={`Once people sign up, ${subject} will show here.`} />
      case "no-data":
        return <EmptyPanel compact title="No activity in this period" description={`Nothing happened in ${periodLong(period)}. Try a longer period.`} />
      default:
        return null
    }
  })()
  return body ? <Panel>{body}</Panel> : null
}
