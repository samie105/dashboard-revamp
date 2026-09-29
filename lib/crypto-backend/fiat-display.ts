/**
 * Rendering helpers for provider display objects: OnSwitch payment
 * instructions (guide lines 755-757) and Bridge deposit instructions (guide
 * lines 856-858, "Display depositInstructions exactly as returned, with
 * masking/copy controls appropriate for sensitive bank details").
 *
 * Only what the backend returned is shown, in the order it returned it.
 * Strings and numbers become rows; an array of strings/numbers is shown as a
 * comma-separated list (e.g. `paymentRails: ["ach", "wire"]`). Nested objects
 * and anything else are skipped rather than guessed at.
 */

export interface DisplayRow {
  key: string
  label: string
  value: string
  /** Bank account details: shown masked until the user reveals them. */
  sensitive: boolean
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
}

/** A backend enum value for display: "MOBILE_MONEY" → "Mobile money". */
export function humanizeValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  if (!normalized) return "Unavailable"
  return normalized.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

export function displayRows(
  raw: unknown,
  options: {
    labels: Record<string, string>
    sensitiveKeys: ReadonlySet<string>
    skipKeys?: ReadonlySet<string>
  },
): DisplayRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  const rows: DisplayRow[] = []
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (options.skipKeys?.has(key)) continue
    let text: string | null = null
    if (typeof value === "string" || typeof value === "number") text = String(value)
    else if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
      text = value.map(String).join(", ")
    }
    if (text === null) continue
    rows.push({
      key,
      label: options.labels[key] ?? humanizeKey(key),
      value: text,
      sensitive: options.sensitiveKeys.has(key),
    })
  }
  return rows
}

/** "••••1234" style mask for a sensitive value, keeping the last four characters. */
export function maskValue(value: string): string {
  const visible = value.slice(-4)
  return `${"•".repeat(Math.max(value.length - 4, 4))}${visible}`
}
