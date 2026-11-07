/**
 * Amounts as a person reads them: grouped thousands, and no run of trailing
 * zeros after the decimal point. Display only. Values sent to the backend stay
 * the exact strings the user typed or the backend returned.
 */

/** "100000.5" -> "100,000.5". Keeps a trailing dot so typing "12." still works. */
export function groupDigits(raw: string): string {
  if (!raw) return ""
  const negative = raw.startsWith("-")
  const body = negative ? raw.slice(1) : raw
  const [whole = "", fraction] = body.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`
}

/** What the input stores: the typed text without separators. */
export function stripGrouping(typed: string): string {
  return typed.replace(/,/g, "")
}

/** "62.450000" -> "62.45", "100" -> "100", "1602.564102" -> "1,602.564102" (up to `maxDecimals`). */
export function readableAmount(value: string | number, maxDecimals = 6): string {
  const text = String(value).trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text
  const [whole = "0", fraction = ""] = text.split(".")
  const kept = fraction.slice(0, maxDecimals).replace(/0+$/, "")
  return groupDigits(kept ? `${whole}.${kept}` : whole)
}
