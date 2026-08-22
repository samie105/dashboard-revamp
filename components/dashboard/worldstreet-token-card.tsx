"use client"

/**
 * The house token card — WMNA's live market state straight from the
 * Raydium pool, the user's MNA/WMNA holdings underneath, and the one
 * explainer that stops the two near-identical names being confused.
 * Read-only: no wallet connection, no signing; data arrives through the
 * server-side /api/solana/worldstreet route.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { CardHeader, CardShell, Eyebrow } from "@/components/ui/system"
import { useWorldstreetToken } from "@/hooks/useWorldstreetToken"
import { WMNA_MINT } from "@/lib/worldstreet-token"

const WMNA_ICON = `https://img-v1.raydium.io/icon/${WMNA_MINT}.png`

/** Sub-cent prices need significant figures, not fixed decimals. */
function fmtPrice(p: number): string {
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return p.toPrecision(3)
}

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function TokenDot({ label, img }: { label: string; img?: string }) {
  const [broken, setBroken] = React.useState(false)
  return img && !broken ? (
    <img src={img} alt="" className="h-7 w-7 rounded-full object-contain" onError={() => setBroken(true)} />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
      {label}
    </span>
  )
}

export function WorldstreetTokenCard() {
  const { data, loading, error } = useWorldstreetToken()
  const [showExplainer, setShowExplainer] = React.useState(false)

  const market = data?.market ?? null
  const balances = data?.balances ?? null

  return (
    // The id is the banner CTA's scroll target ("Get MNA" up top).
    <CardShell id="worldstreet-token-card">
      <CardHeader
        title="Worldstreet token"
        subtitle="WMNA on Solana"
        right={
          market && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {/* The dot breathes: this number is the pool right now. */}
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-credit/60 motion-reduce:hidden" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-credit" />
              </span>
              Live · Raydium
            </span>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        {loading ? (
          <div className="flex animate-pulse flex-col gap-3 pt-1">
            <div className="h-9 w-36 rounded-lg bg-foreground/[0.05]" />
            <div className="h-2 w-full rounded bg-foreground/[0.05]" />
            <div className="h-10 rounded-xl bg-foreground/[0.05]" />
          </div>
        ) : !market ? (
          <p className="pt-1 text-[13px] leading-relaxed text-muted-foreground">
            {error
              ? "We couldn't reach the market right now — this refreshes automatically."
              : "Market data is briefly unavailable."}
          </p>
        ) : (
          <>
            {/* Price hero */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-[28px] font-light leading-none tracking-[-0.01em] tabular-nums">
                  ${fmtPrice(market.price)}
                </span>
                <span className="text-[11.5px] text-subtle">per WMNA · USDC</span>
              </div>
              <TokenDot label="W" img={WMNA_ICON} />
            </div>

            {/* 7-day range — an honest visualization without a time series:
                where today's price sits between the week's low and high. */}
            {market.weekRange && market.weekRange[1] > market.weekRange[0] && (
              <div className="flex flex-col gap-1.5">
                <div className="relative h-1 rounded-full bg-surface-sunken ring-1 ring-border/25">
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((market.price - market.weekRange[0]) / (market.weekRange[1] - market.weekRange[0])) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10.5px] tabular-nums text-subtle">
                  <span>${fmtPrice(market.weekRange[0])}</span>
                  <span>7d range</span>
                  <span>${fmtPrice(market.weekRange[1])}</span>
                </div>
              </div>
            )}

            {/* Pool facts */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-sunken/70 px-3 py-2.5 ring-1 ring-border/25">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">Liquidity</p>
                <p className="text-[13.5px] font-semibold tabular-nums">${fmtUsd(market.tvlUsd)}</p>
              </div>
              <div className="rounded-xl bg-surface-sunken/70 px-3 py-2.5 ring-1 ring-border/25">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">7d volume</p>
                <p className="text-[13.5px] font-semibold tabular-nums">${fmtUsd(market.weekVolumeUsd)}</p>
              </div>
            </div>

            {/* Holdings — only when the wallet could actually be read. */}
            {balances && (
              <div className="flex flex-col gap-2">
                <Eyebrow>Your holdings</Eyebrow>
                <div className="flex flex-col divide-y divide-border/20 rounded-xl bg-surface-sunken/70 ring-1 ring-border/25">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <TokenDot label="W" img={WMNA_ICON} />
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-semibold">WMNA</span>
                      <span className="text-[11px] text-subtle">Tradable · Raydium</span>
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[13px] font-semibold tabular-nums">{fmtQty(balances.wmna)}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        ≈ ${fmtUsd(balances.wmna * market.price)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <TokenDot label="M" />
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-semibold">MNA</span>
                      <span className="text-[11px] text-subtle">Via Worldstreet · USDT</span>
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[13px] font-semibold tabular-nums">{fmtQty(balances.mna)}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        ≈ ${fmtUsd(balances.mna * market.price)}
                        <span className="text-subtle"> · at WMNA price</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* The explainer — two tokens, near-identical names, completely
            different machinery. One tap keeps anyone from mixing them up. */}
        <div className="mt-auto">
          <button
            type="button"
            onClick={() => setShowExplainer((v) => !v)}
            aria-expanded={showExplainer}
            className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            MNA vs WMNA — what's the difference?
            <svg
              className={cn("h-3 w-3 shrink-0 text-subtle transition-transform duration-200", showExplainer && "rotate-180")}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {showExplainer && (
            <div className="ws-microswap mt-2 flex flex-col gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">MNA</span> is the primary token. You buy and
                redeem it directly with Worldstreet, priced in USDT — it never trades on an open market.
              </p>
              <p>
                <span className="font-semibold text-foreground">WMNA</span> is the tradable version. Its price
                is set by an open Raydium pool against USDC and moves with every trade.
              </p>
              <p className="text-subtle">
                Same family, different machinery — an amount sent to the wrong one can't arrive. The app always
                routes each correctly.
              </p>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  )
}
