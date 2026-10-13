/**
 * The dashboard preview's formatters (components/dashboard-unauth/demo-data.ts),
 * copied verbatim so the real dashboard prints figures exactly as the preview does.
 */

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatUSD(value: number, opts?: { compact?: boolean; maxFrac?: number }): string {
  const max = opts?.maxFrac ?? (opts?.compact ? 1 : 2)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    // Intl throws when the minimum exceeds the maximum — clamp instead.
    minimumFractionDigits: Math.min(opts?.compact ? 0 : 2, max),
    maximumFractionDigits: max,
  }).format(value)
}

/** Prices span 96,420.50 → 0.000042, so the precision has to follow the size. */
export function formatPrice(value: number): string {
  const frac = value >= 1 ? 2 : value >= 0.01 ? 4 : 6
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })}`
}

/** Loose coin quantities — the wallet preview imports this one. */
export function formatAmount(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 6
  return value.toLocaleString("en-US", { maximumFractionDigits: frac })
}

/** Coin quantities for the holdings table. Fractions of a coin get the full
 *  8 places an exchange ledger shows; whole-coin amounts drop to 4 and four-
 *  figure ones to 2, or "5,120.00000000" runs into the next column. */
export function formatQty(value: number): string {
  if (value === 0) return "0.00"
  const frac = value >= 1000 ? 2 : value >= 1 ? 4 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

export function formatPct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}%`
}
