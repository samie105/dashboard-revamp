"use client"

/**
 * The preview's launch page (components/launchpad-unauth/token.tsx) on a real
 * launch: header with the progress to graduation, the bonding curve, about +
 * terms + addresses on the left; the curve ticket (or where trading went,
 * once graduated) on the right.
 *
 * Data is the old page's (components/launchpad/live-token-page.tsx, kept
 * unused): the token read (30s), and the curve's own shape from the config
 * (30s, while live). The ticket's quote, intent, unlock, signing and submit
 * are useCurveTicket — moved verbatim out of the old ticket.
 *
 * Swapped for real data:
 *  · price is the curve's current price, in SOL; market cap has no source
 *    yet and shows "—";
 *  · the chart plots price against SOL raised — the axis the backend serves —
 *    instead of the preview's tokens sold;
 *  · launch terms are what the token states (graduation target, creator
 *    allocation, no vesting, a platform fee only if one is charged).
 * Not carried over, because nothing real backs them: Recent trades (needs a
 * curve-trade index), the supply split (needs tokens sold), the ticket's
 * wallet balance and sell-% chips, and the preview's "Demo" tag.
 */

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import { ArrowLeft01Icon, Copy01Icon, Globe02Icon, NewTwitterIcon, TelegramIcon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { QuoteClock } from "@/components/ui/quote-clock"
import { Rise } from "@/components/ui/system"
import { DashScope } from "@/components/dash"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { Icon, Panel, PanelTitle, PillTabs, SLIDE } from "@/components/dashboard/redesign/ui"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { LaunchpadCurve, LaunchpadToken } from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { acceptAmountInput } from "@/lib/wallet-view"
import { agoFrom, cardView, progressLabel } from "@/lib/launchpad-view"
import { fromBaseUnits, useCurveTicket } from "../live-curve-ticket"
import { formatTinyPrice } from "../curve-chart"
import { explorerUrl } from "../address-row"
import { NetworkBadge } from "../network"
import { LaunchAvatar, PausedNotice, ProgressBar, StatusPill, useLaunchAvailability } from "./ui"

function useNow() {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {})
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/[0.07] bg-foreground/[0.03] px-2 py-1 font-mono text-[11.5px] text-muted-foreground transition-colors hover:border-foreground/[0.14] hover:text-foreground"
    >
      {label ?? `${value.slice(0, 4)}…${value.slice(-4)}`}
      <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5", copied && "text-credit")} />
    </button>
  )
}

/* ── Header ───────────────────────────────────────────────────────────── */

function TokenHeader({ t, price }: { t: LaunchpadToken; price: number | null }) {
  const v = cardView(t)
  const now = useNow()
  const links = [
    t.links?.website && { href: t.links.website, icon: Globe02Icon, label: "Website" },
    t.links?.x && { href: `https://x.com/${t.links.x.replace(/^@/, "")}`, icon: NewTwitterIcon, label: "X" },
    t.links?.telegram && { href: `https://t.me/${t.links.telegram.replace(/^@/, "")}`, icon: TelegramIcon, label: "Telegram" },
  ].filter(Boolean) as { href: string; icon: typeof Globe02Icon; label: string }[]

  return (
    <div className="flex flex-col gap-3">
      <Link href="/launchpad" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
        All launches
      </Link>
      <Panel className="relative">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_140%_at_0%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex min-w-0 items-center gap-4">
            <LaunchAvatar symbol={t.symbol} iconUrl={t.iconUrl} mint={t.mint} size="xl" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">{t.name}</h1>
                <span className="font-display text-[18px] font-semibold text-muted-foreground">${t.symbol}</span>
                <StatusPill status={v.status} raw={t.status} />
                <NetworkBadge networkId={t.networkId} className="px-2 py-0.5 text-[10px]" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>Launched {agoFrom(t.createdAt, now) || "—"}</span>
                <span>·</span>
                <span>by</span>
                <CopyChip value={t.creatorAddress} />
                {t.mint && (
                  <>
                    <span>· mint</span>
                    <CopyChip value={t.mint} />
                  </>
                )}
                {links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" title={l.label} className="flex size-7 items-center justify-center rounded-lg border border-foreground/[0.07] text-muted-foreground transition-colors hover:text-foreground">
                    <Icon icon={l.icon} className="size-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.06] lg:ml-auto lg:min-w-[380px]">
            {[
              { k: "Market cap", v: "—", title: "Needs a per-token USD price, which isn't served yet" },
              { k: "Price", v: price === null ? "—" : `${formatTinyPrice(price)} SOL`, title: "The curve's current price" },
              { k: "Creator holds", v: `${(t.allocation.creatorBps / 100).toFixed(1)}%`, warn: t.allocation.creatorBps >= 1000, title: "Share of supply the creator bought at launch" },
            ].map((s) => (
              <div key={s.k} title={s.title} className="flex flex-col gap-0.5 bg-card px-4 py-3 dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
                <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
                <dd className={cn("truncate font-display text-[17px] font-semibold tabular-nums", s.warn ? "text-warning" : "text-foreground")}>{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex flex-col gap-2 border-t border-foreground/[0.06] px-5 py-4 md:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-[12.5px]">
            <span className="text-muted-foreground">
              {t.status === "live" && t.curve ? (
                <>
                  <span className="font-semibold tabular-nums text-foreground">{fromBaseUnits(t.curve.solRaised, 9, 3)} SOL</span> raised of {fromBaseUnits(t.curve.graduationLamports, 9, 0)} SOL ·{" "}
                  <span className="font-semibold tabular-nums text-foreground">{v.remainingSol === null ? "—" : `${v.remainingSol.toFixed(2)} SOL`}</span> to graduation
                </>
              ) : t.status === "graduating" ? (
                "The curve is full — liquidity is being moved to the open market"
              ) : t.status === "graduated" ? (
                "Graduated — trading on the open market"
              ) : (
                "Curve state appears once the launch is confirmed."
              )}
            </span>
            <span className="flex items-center gap-3">
              {t.curve && <span className="text-[11.5px] text-muted-foreground">Updated {new Date(t.curve.refreshedAt).toLocaleTimeString()}</span>}
              <span className="font-display text-[16px] font-semibold tabular-nums text-primary">{progressLabel(v.progressBps, v.status)}</span>
            </span>
          </div>
          <ProgressBar bps={v.progressBps} status={v.status} size="lg" />
        </div>
      </Panel>
    </div>
  )
}

/* ── Curve chart ──────────────────────────────────────────────────────── */

const H = 240
const PAD_L = 4
const PAD_R = 76
const PAD_B = 26

function CurveChart({ curve, loading, error, graduationLamports }: { curve: LaunchpadCurve | undefined; loading: boolean; error: string | null; graduationLamports: string }) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(0)
  const [hover, setHover] = React.useState<number | null>(null)
  React.useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const pts = React.useMemo(() => (curve?.points ?? []).map((p) => ({ sol: Number(p.solRaised) / 1e9, price: p.price })), [curve])
  const target = Number(curve?.graduationLamports ?? graduationLamports) / 1e9 || 0
  const maxP = pts.length ? Math.max(...pts.map((p) => p.price)) * 1.08 : 1
  const x = (sol: number) => PAD_L + (target > 0 ? sol / target : 0) * (w - PAD_L - PAD_R)
  const y = (price: number) => 8 + (1 - price / maxP) * (H - PAD_B - 8)
  const now = curve?.current ? { sol: Number(curve.current.solRaised) / 1e9, price: curve.current.price } : null
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.sol).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")
  const filled = now ? pts.filter((p) => p.sol <= now.sol) : []
  const fillPath = now && filled.length > 0 ? `${filled.map((p, i) => `${i ? "L" : "M"}${x(p.sol).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")} L${x(now.sol)},${y(now.price)} L${x(now.sol)},${H - PAD_B} L${x(0)},${H - PAD_B} Z` : ""
  const hp = hover !== null ? pts[hover] : null

  return (
    <Panel className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle className="text-[16px]">Bonding curve</PanelTitle>
        <span className="text-[12px] text-muted-foreground">Price rises as SOL comes in — set by the curve, not an order book</span>
      </div>
      <div
        ref={wrap}
        className="relative w-full touch-pan-y select-none"
        style={{ height: H }}
        onPointerMove={(e) => {
          const box = wrap.current?.getBoundingClientRect()
          if (!box || w === 0 || pts.length < 2) return
          const t = (e.clientX - box.left - PAD_L) / (w - PAD_L - PAD_R)
          setHover(t >= 0 && t <= 1 ? Math.round(t * (pts.length - 1)) : null)
        }}
        onPointerLeave={() => setHover(null)}
      >
        {loading ? (
          <span className="skel absolute inset-0 rounded-xl" />
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-debit">{error}</div>
        ) : pts.length < 2 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-[13.5px] font-semibold text-foreground">No curve to draw yet</span>
            <span className="text-[12.5px] text-muted-foreground">The curve appears once the launch is live.</span>
          </div>
        ) : (
          w > 0 && (
            <svg width={w} height={H} className="absolute inset-0" aria-hidden>
              <defs>
                <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={PAD_L} x2={w - PAD_R} y1={y(maxP * f * 0.92)} y2={y(maxP * f * 0.92)} className="stroke-foreground/[0.06]" />
                  <text x={w - 4} y={y(maxP * f * 0.92)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/75 text-[10.5px] tabular-nums">
                    {formatTinyPrice(maxP * f * 0.92)}
                  </text>
                </g>
              ))}
              {fillPath && <path d={fillPath} fill="url(#curve-fill)" />}
              <path d={line} fill="none" className="stroke-foreground/20" strokeWidth={2} strokeDasharray="4 4" />
              {filled.length > 1 && (
                <motion.path
                  d={filled.map((p, i) => `${i ? "L" : "M"}${x(p.sol).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
                />
              )}
              <line x1={x(target)} x2={x(target)} y1={0} y2={H - PAD_B} stroke="var(--credit)" strokeDasharray="3 4" opacity={0.6} />
              <text x={x(target) - 6} y={14} textAnchor="end" className="fill-credit text-[10.5px] font-semibold">
                Graduates at {target.toLocaleString("en-US")} SOL
              </text>
              {now && (
                <g>
                  <circle cx={x(now.sol)} cy={y(now.price)} r={12} className="fill-primary/20">
                    <animate attributeName="r" values="7;14;7" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x(now.sol)} cy={y(now.price)} r={5} className="fill-primary stroke-card" strokeWidth={2} />
                </g>
              )}
              {hp && (
                <g>
                  <line x1={x(hp.sol)} x2={x(hp.sol)} y1={0} y2={H - PAD_B} className="stroke-foreground/25" strokeDasharray="3 3" />
                  <circle cx={x(hp.sol)} cy={y(hp.price)} r={4} className="fill-foreground" />
                </g>
              )}
              {[0, 0.25, 0.5, 0.75, 1].map((f, k) => (
                <text key={f} x={x(target * f)} y={H - 8} textAnchor={k === 0 ? "start" : k === 4 ? "end" : "middle"} className="fill-muted-foreground/70 text-[10.5px] tabular-nums">
                  {(target * f).toLocaleString("en-US", { maximumFractionDigits: 1 })} SOL
                </text>
              ))}
            </svg>
          )
        )}
        {hp && (
          <div className="pointer-events-none absolute top-6 z-10 -translate-x-1/2 rounded-xl border border-foreground/10 bg-popover/95 px-3 py-2 text-center shadow-lg" style={{ left: Math.min(w - 90, Math.max(90, x(hp.sol))) }}>
            <span className="block text-[13px] font-semibold tabular-nums">{formatTinyPrice(hp.price)} SOL</span>
            <span className="block text-[11px] text-muted-foreground">at {hp.sol.toLocaleString("en-US", { maximumFractionDigits: 2 })} SOL raised</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" /> Bought so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-foreground/30" /> Still on the curve
        </span>
        {now && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> You are here · {formatTinyPrice(now.price)} SOL
          </span>
        )}
      </div>
    </Panel>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

const QUOTE_TTL = 20
const IMPACT_WARN_BPS = 300
const SLIPPAGE = [
  { key: "50", label: "0.5%" },
  { key: "100", label: "1%" },
  { key: "300", label: "3%" },
]

function CurveTicket({ token, platformFeeBps, tokenDecimals }: { token: LaunchpadToken; platformFeeBps: number; tokenDecimals: number }) {
  const t = useCurveTicket({ token, tokenDecimals })
  const { q } = t
  const impactWarn = q ? q.priceImpactBps >= IMPACT_WARN_BPS : false
  const cta = t.busy
    ? "Signing…"
    : !t.baseUnits
      ? `Enter an amount of ${t.inUnit}`
      : !q || t.expired
        ? t.quote.isFetching || t.expired
          ? "Getting a quote…"
          : "No quote yet"
        : t.side === "buy"
          ? `Buy ${token.symbol}`
          : `Sell ${token.symbol}`
  const ready = Boolean(q) && !t.busy && !t.expired

  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[15px]">Trade ${token.symbol}</PanelTitle>
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          {t.seconds !== null && <span className="tabular-nums">Quote {t.seconds}s</span>}
          <QuoteClock seconds={t.seconds} total={QUOTE_TTL} refreshing={t.quote.isFetching} />
        </div>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.025] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={t.side === s}
            onClick={() => {
              t.setSide(s)
              t.setAmount("")
              t.setResult(null)
              t.resetIntentKey()
            }}
            className={cn("relative h-10 rounded-xl text-[14px] font-semibold capitalize transition-colors", t.side === s ? "text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {t.side === s && <motion.span layoutId="curve-side" transition={SLIDE} className={cn("absolute inset-0 rounded-xl", s === "buy" ? "bg-credit" : "bg-debit")} />}
            <span className="relative">{s}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4 transition-colors focus-within:border-primary/40">
        <div className="flex justify-between text-[12px] text-muted-foreground">
          <span>{t.side === "buy" ? "You pay" : "You sell"}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            autoComplete="off"
            aria-label={t.side === "buy" ? "SOL to spend" : `${token.symbol} to sell`}
            value={t.amount}
            onChange={(e) => {
              const next = acceptAmountInput(e.target.value.replace(",", "."), t.side === "buy" ? 9 : tokenDecimals)
              if (next === null) return
              t.setAmount(next)
              t.setResult(null)
              t.resetIntentKey()
            }}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums outline-none placeholder:text-muted-foreground/30"
          />
          <span className="text-[14px] font-semibold text-muted-foreground">{t.inUnit}</span>
        </div>
        {t.side === "buy" && (
          <div className="flex flex-wrap gap-1.5">
            {["0.1", "0.5", "1", "5"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  t.setAmount(s)
                  t.setResult(null)
                  t.resetIntentKey()
                }}
                className={cn("h-7 rounded-lg border px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors", t.amount === s ? "border-primary/50 bg-primary/[0.1] text-primary" : "border-foreground/[0.07] text-muted-foreground hover:text-foreground")}
              >
                {s} SOL
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">Max slippage</span>
        <PillTabs id="curve-slip" size="sm" options={SLIPPAGE} value={t.slippage} onChange={t.setSlippage} />
      </div>

      {t.quote.error && t.baseUnits && (
        <p role="alert" className="rounded-xl border border-debit/25 bg-debit/[0.06] px-3 py-2 text-[12px] text-debit">
          {formatWalletActionError(t.quote.error, "solana")}
        </p>
      )}

      {q && (
        <dl className="flex flex-col gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.015] px-3.5 py-3 text-[12.5px]">
          {[
            { k: "You receive", v: `${fromBaseUnits(q.expectedOut, t.outDecimals)} ${t.outUnit}`, strong: true },
            { k: "Price impact", v: `${(q.priceImpactBps / 100).toFixed(2)}%`, tone: impactWarn ? "text-warning" : "text-foreground" },
            { k: "Curve fee (1%)", v: `${fromBaseUnits(q.curveFee, t.side === "buy" ? 9 : tokenDecimals)} ${t.inUnit}` },
            ...(platformFeeBps > 0 ? [{ k: `WorldStreet fee (${platformFeeBps / 100}%)`, v: `${fromBaseUnits(q.platformFeeLamports, 9)} SOL` }] : []),
            { k: "Minimum received", v: `${fromBaseUnits(q.minimumOut, t.outDecimals)} ${t.outUnit}` },
          ].map((r) => (
            <div key={r.k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className={cn("font-semibold tabular-nums", "tone" in r && r.tone ? r.tone : "text-foreground", "strong" in r && r.strong && "font-display text-[14px]")}>{r.v}</dd>
            </div>
          ))}
        </dl>
      )}

      <button
        type="button"
        disabled={!ready}
        onClick={() => void t.execute()}
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-[filter]",
          !ready ? "border border-foreground/[0.07] bg-foreground/[0.04] text-muted-foreground" : cn("text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110", t.side === "buy" ? "bg-credit" : "bg-debit"),
        )}
      >
        {t.busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {cta}
      </button>

      {t.result && (
        <p role="status" className={cn("rounded-xl border px-3 py-2 text-[12px] leading-relaxed", t.result.ok ? "border-credit/25 bg-credit/[0.06] text-credit" : "border-debit/25 bg-debit/[0.06] text-debit")}>
          {t.result.ok ? `Sent to Solana.${t.result.txHash ? ` Transaction ${t.result.txHash.slice(0, 8)}…` : ""} Your balance updates once it confirms.` : t.result.message}
        </p>
      )}

      <WalletUnlockDialog action="swap" open={t.unlockOpen} onOpenChange={t.setUnlockOpen} onUnlocked={() => void t.execute()} />
    </Panel>
  )
}

/* ── Graduation ───────────────────────────────────────────────────────── */

function GraduationCard({ t }: { t: LaunchpadToken }) {
  const done = t.status === "graduated"
  const target = t.curve ? `${fromBaseUnits(t.curve.graduationLamports, 9, 0)} SOL` : "its target"
  const steps = [`Curve filled at ${target}`, "Liquidity moved to the open market", "Trading on the open market"]
  const active = done ? 3 : 1
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <PanelTitle className="text-[16px]">{done ? `${t.symbol} has graduated` : `${t.symbol} is graduating`}</PanelTitle>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {done
            ? "The curve filled and its liquidity moved into a pool, where it's locked permanently: nobody, including the creator, can withdraw it. Curve trading is closed."
            : "The curve is full, so it stopped selling. Its liquidity is moving to the open market."}
          {done && (t.networkId === "solana-mainnet-beta" ? " It trades like any other token, and appears in Markets once a price is available." : " Devnet tokens aren't listed in Markets.")}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const state = i < active ? "done" : i === active ? "current" : "todo"
          return (
            <li key={s} className="flex items-center gap-3">
              <span className={cn("flex size-6 items-center justify-center rounded-full border", state === "done" && "border-credit/40 bg-credit/[0.12] text-credit", state === "current" && "border-warning/50 bg-warning/[0.1]", state === "todo" && "border-foreground/[0.1]")}>
                {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-warning" /> : null}
              </span>
              <span className={cn("text-[13px] font-medium", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
            </li>
          )
        })}
      </ol>
      {t.graduation && <AddressLine label="Market pool" value={t.graduation.ammPoolAddress} networkId={t.networkId} />}
      {done && t.networkId === "solana-mainnet-beta" && (
        <Link href="/trading/markets" className="ds-gold flex h-11 items-center justify-center rounded-xl text-[14px] font-semibold">
          Find {t.symbol} in Markets
        </Link>
      )}
    </Panel>
  )
}

/** A "not open yet" ticket for a launch that isn't live and hasn't graduated. */
function NotOpenCard() {
  return (
    <Panel className="flex flex-col gap-2 p-5">
      <PanelTitle className="text-[15px]">Not open for trading yet</PanelTitle>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">Trading opens once the launch is confirmed on Solana.</p>
    </Panel>
  )
}

/* ── About, terms, addresses ──────────────────────────────────────────── */

function AddressLine({ label, value, networkId, hint }: { label: string; value: string; networkId: string; hint?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground/80">{hint}</span>}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 select-all break-all font-mono text-[12.5px] leading-relaxed text-foreground/90">{value}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }, () => {})
          }}
          aria-label={`Copy ${label}`}
          className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors", copied ? "bg-credit/[0.12] text-credit" : "bg-foreground/[0.06] text-muted-foreground hover:text-foreground")}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a href={explorerUrl(value, networkId)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-foreground/[0.06] px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          Solscan
        </a>
      </div>
    </div>
  )
}

function AboutCard({ t, platformFeeBps }: { t: LaunchpadToken; platformFeeBps: number }) {
  const terms = [
    { k: "Graduates at", v: t.curve ? `${fromBaseUnits(t.curve.graduationLamports, 9, 0)} SOL raised` : "—" },
    { k: "Creator allocation", v: `${(t.allocation.creatorBps / 100).toFixed(2)}% of supply` },
    { k: "Vesting", v: "None: the creator's tokens are free to sell" },
    ...(platformFeeBps > 0 ? [{ k: "WorldStreet fee", v: `${platformFeeBps / 100}%` }] : []),
  ]
  return (
    <Panel className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <PanelTitle className="text-[15px]">About {t.name}</PanelTitle>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{t.description?.trim() || "The creator didn't add a description."}</p>
      </div>
      <div className="flex flex-col gap-2">
        <PanelTitle className="text-[15px]">Launch terms</PanelTitle>
        <dl className="flex flex-col divide-y divide-foreground/[0.05]">
          {terms.map((r) => (
            <div key={r.k} className="flex justify-between gap-3 py-2 text-[12.5px]">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}

function AddressesCard({ t }: { t: LaunchpadToken }) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle className="text-[15px]">Addresses</PanelTitle>
        <span className="text-[12px] text-muted-foreground">On-chain — check before you send</span>
      </div>
      {t.mint && <AddressLine label="Token address" value={t.mint} networkId={t.networkId} hint="The token itself" />}
      {t.poolAddress && <AddressLine label="Curve pool" value={t.poolAddress} networkId={t.networkId} hint="Holds the SOL raised so far" />}
      <AddressLine label="Creator" value={t.creatorAddress} networkId={t.networkId} hint="Launched this token" />
    </Panel>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function LaunchTokenPage({ launchId }: { launchId: string }) {
  const availability = useLaunchAvailability()
  const token = useQuery({
    queryKey: ["launchpad", "token", launchId],
    queryFn: ({ signal }) => cryptoBackendClient.getLaunchpadToken(launchId, signal),
    enabled: isCryptoBackendEnabled,
    refetchInterval: 30_000,
  })
  const curve = useQuery({
    queryKey: ["launchpad", "curve", launchId],
    queryFn: ({ signal }) => cryptoBackendClient.getLaunchpadCurve(launchId, signal),
    enabled: isCryptoBackendEnabled && token.data?.data.status === "live",
    refetchInterval: 30_000,
  })

  const shell = "ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6"

  if (token.isLoading) {
    return (
      <DashScope className={shell}>
        <span className="skel h-5 w-28 rounded" />
        <span className="skel h-[190px] rounded-[20px]" />
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <span className="skel h-[320px] rounded-[20px]" />
          <span className="skel h-[420px] rounded-[20px]" />
        </div>
      </DashScope>
    )
  }

  if (token.error || !token.data) {
    return (
      <DashScope className={shell}>
        <Link href="/launchpad" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
          All launches
        </Link>
        <Panel className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-foreground">We couldn&apos;t find this launch</p>
          <p className="text-[13px] text-muted-foreground">It may not have been confirmed on Solana yet, or the link is wrong.</p>
        </Panel>
      </DashScope>
    )
  }

  const { data: launch, platformFeeBps, tokenDecimals } = token.data
  const live = launch.status === "live"

  return (
    <DashScope className={shell}>
      <Rise>
        <TokenHeader t={launch} price={curve.data?.current?.price ?? null} />
      </Rise>
      <Rise delay={60}>
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <div className="order-2 flex min-w-0 flex-col gap-4 md:gap-5 xl:order-1">
            {live && (
              <CurveChart
                curve={curve.data}
                loading={curve.isLoading}
                error={curve.error ? formatWalletActionError(curve.error, "solana") : null}
                graduationLamports={launch.curve?.graduationLamports ?? "0"}
              />
            )}
            <AboutCard t={launch} platformFeeBps={platformFeeBps} />
            <AddressesCard t={launch} />
          </div>
          <div className="order-1 flex min-w-0 flex-col gap-4 md:gap-5 xl:sticky xl:top-4 xl:order-2">
            <PausedNotice availability={availability.data} compact />
            {live ? (
              <CurveTicket token={launch} platformFeeBps={platformFeeBps} tokenDecimals={tokenDecimals} />
            ) : launch.status === "graduated" || launch.status === "graduating" ? (
              <GraduationCard t={launch} />
            ) : (
              <NotOpenCard />
            )}
          </div>
        </div>
      </Rise>
    </DashScope>
  )
}
