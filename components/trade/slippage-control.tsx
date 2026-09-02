"use client"

/**
 * PriceProtection — how far the price may move before the order is dropped.
 *
 * Every spot order this app has ever placed carried a 1% tolerance, and no
 * screen said so. That is the single biggest thing this ticket owes its user:
 * the price on screen is read from a pool now, the trade settles seconds
 * later, and this setting is the whole distance between the two. A user who
 * can't see it can't tell a bad fill from a normal one, and a user who can't
 * change it has no answer when a thin market keeps failing.
 *
 * COPY: the house rule is plain outcomes, not mechanisms — most people here
 * are new to crypto. So this is "price protection" and it says what happens,
 * never "slippage tolerance" and never "minimum output amount". The trading
 * term appears nowhere in the interface; the behaviour it names is stated in
 * full.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  SLIPPAGE_HIGH,
  SLIPPAGE_MAX,
  SLIPPAGE_MIN,
  SLIPPAGE_PERCENTAGE,
} from "@/lib/crypto-backend/spot-order"

/** The answers people actually give, as fractions. */
const PRESETS = [0.005, 0.01, 0.02] as const

/** "0.5", "1", "2.5" — never "0.50", which reads as more precision than meant. */
function asPercentText(fraction: number) {
  return String(Number((fraction * 100).toFixed(2)))
}

export function SlippageControl({
  value,
  onChange,
  className,
}: {
  /** The tolerance as a FRACTION (0.01 = 1%), always within the band. */
  value: number
  onChange: (next: number) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  /* The custom box keeps its own text so a half-typed "0." isn't rewritten to
     a number mid-keystroke. It only reaches `onChange` once it parses inside
     the band; anything else leaves the committed value alone. */
  const [customText, setCustomText] = React.useState("")
  const isPreset = PRESETS.some((p) => Math.abs(p - value) < 1e-9)
  const high = value > SLIPPAGE_HIGH
  const low = value <= SLIPPAGE_MIN
  const shownCustom = isPreset && customText === "" ? "" : customText || asPercentText(value)

  const commit = (text: string) => {
    setCustomText(text)
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) return
    const fraction = parsed / 100
    if (fraction < SLIPPAGE_MIN || fraction > SLIPPAGE_MAX) return
    onChange(fraction)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-vivid-target="trade-price-protection"
        data-vivid-label="Show or hide how far the price may move before the order is dropped"
        className="flex items-center justify-between gap-2 rounded-xl px-1 py-0.5 text-[12px] transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        <span className="font-semibold text-muted-foreground">Price protection</span>
        <span className="flex items-center gap-1">
          <span className={cn("font-semibold tabular-nums", high ? "text-warning" : "text-foreground")}>
            {asPercentText(value)}%
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn("h-3.5 w-3.5 text-subtle transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-2">
          <div className="flex items-center gap-1.5">
            {PRESETS.map((preset) => {
              const active = Math.abs(preset - value) < 1e-9
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCustomText("")
                    onChange(preset)
                  }}
                  aria-pressed={active}
                  data-vivid-target={`trade-price-protection-${asPercentText(preset)}`}
                  data-vivid-label={`Allow the price to move up to ${asPercentText(preset)} percent`}
                  className={cn(
                    "inline-flex min-h-9 flex-1 items-center justify-center rounded-lg text-[12px] font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                    active
                      ? "bg-accent text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {asPercentText(preset)}%
                </button>
              )
            })}
            <label className="flex min-h-9 shrink-0 items-center gap-0.5 rounded-lg bg-background/60 px-2">
              <span className="sr-only">
                A different limit, as a percentage
              </span>
              <input
                value={shownCustom}
                onChange={(e) => commit(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="Other"
                aria-label="A different limit, as a percentage"
                data-vivid-target="trade-price-protection-custom"
                data-vivid-label="Type a different limit, as a percentage"
                className="w-[46px] bg-transparent text-right text-[12px] font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-subtle"
              />
              {/* The suffix would read "Other %" against the placeholder. */}
              {shownCustom !== "" && (
                <span className="text-[12px] font-semibold text-subtle">%</span>
              )}
            </label>
          </div>

          <p className="px-0.5 text-[11px] leading-snug text-subtle">
            {high ? (
              <span className="text-warning">
                Your order can go through well below the price shown. Only
                widen this if orders keep failing.
              </span>
            ) : low ? (
              "The strictest setting. Orders will often be dropped rather than go through at a slightly worse price."
            ) : (
              `Your order goes through only if the price stays within ${asPercentText(value)}% of what's shown. If it moves further, the order is dropped instead.`
            )}
          </p>

          {!isPreset && (
            <button
              type="button"
              onClick={() => {
                setCustomText("")
                onChange(SLIPPAGE_PERCENTAGE)
              }}
              className="self-start px-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to {asPercentText(SLIPPAGE_PERCENTAGE)}%
            </button>
          )}
        </div>
      )}
    </div>
  )
}
