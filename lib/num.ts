/**
 * Numbers that can't embarrass you.
 *
 * Every figure on the dashboard is downstream of a feed that is allowed to be
 * late, partial, or wrong. `parseFloat(undefined)` is NaN; NaN.toFixed(2) is
 * the string "NaN"; and "NaN%" rendered in credit green next to someone's
 * position is the single fastest way to lose their trust in every other number
 * on the page. Infinity gets in the same way — a percentage against a zero cost
 * basis, a share of an empty portfolio.
 *
 * The rule these helpers encode: when a figure isn't known, say so with a dash.
 * Never print a broken one, and never quietly substitute zero for unknown —
 * "$0.00" is a claim about someone's money, and it's a different claim from
 * "we don't know yet".
 */

/** The placeholder for a figure we don't have. One character, one meaning. */
export const UNKNOWN = "—"

/** A finite number, or null. Accepts the strings the trade adapters hand back. */
export function num(value: unknown): number | null {
  // `+value` normalises -0 to 0: "-0.00 ETH" is a real thing a balance of
  // exactly zero can render as, and it reads as a bug.
  if (typeof value === "number") return Number.isFinite(value) ? value + 0 : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** A finite number, or a fallback. For arithmetic, where null would poison. */
export function numOr(value: unknown, fallback = 0): number {
  return num(value) ?? fallback
}

/** `part / whole` as a percentage, 0 when the whole is zero or unknown. */
export function share(part: unknown, whole: unknown): number {
  const p = num(part)
  const w = num(whole)
  if (p === null || w === null || w === 0) return 0
  const pct = (p / w) * 100
  return Number.isFinite(pct) ? pct : 0
}

/** USD, or a dash. Never "$NaN". */
export function usd(value: unknown, opts?: { min?: number; max?: number }) {
  const n = num(value)
  if (n === null) return UNKNOWN
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.min ?? 2,
    maximumFractionDigits: opts?.max ?? 2,
  })
}

/** Abbreviated USD for tight columns: $1.2K, $3.40M, $2.1B. */
export function usdCompact(value: unknown) {
  const n = num(value)
  if (n === null) return UNKNOWN
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

/** A percentage with a fixed precision, or a dash. */
export function pct(value: unknown, digits = 2) {
  const n = num(value)
  if (n === null) return UNKNOWN
  // toFixed switches to exponential notation past 1e21, which is not a
  // percentage a human reads. Anything that large is a broken feed, not a gain.
  if (Math.abs(n) >= 1e15) return "∞%"
  return `${n.toFixed(digits)}%`
}

/** A signed percentage — the form used for change and PnL. */
export function pctSigned(value: unknown, digits = 2) {
  const n = num(value)
  if (n === null) return UNKNOWN
  if (Math.abs(n) >= 1e15) return n > 0 ? "+∞%" : "−∞%"
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`
}

/**
 * A token quantity. Crypto spans eighteen orders of magnitude, so a fixed
 * precision is wrong at one end or the other: 0.00 for a satoshi balance, or
 * 5400.000000 for a TRX one. Precision follows size.
 */
export function qty(value: unknown, unit?: string) {
  const n = num(value)
  if (n === null) return UNKNOWN
  const abs = Math.abs(n)
  const digits = abs === 0 ? 2 : abs >= 1_000 ? 2 : abs >= 1 ? 4 : abs >= 0.0001 ? 6 : 8
  const body = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })
  return unit ? `${body} ${unit}` : body
}

/**
 * A unit price. Same reasoning as `qty` — $64,138.50 and $0.00001234 both need
 * to read correctly, and a single precision can't serve both.
 */
export function price(value: unknown) {
  const n = num(value)
  if (n === null) return UNKNOWN
  const abs = Math.abs(n)
  // The sign belongs outside the currency symbol: "-$12.34", never "$-12.34".
  const sign = n < 0 ? "-" : ""
  if (abs >= 1_000)
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`
  if (abs === 0) return "$0.00"
  return `${sign}$${abs.toFixed(8)}`
}
