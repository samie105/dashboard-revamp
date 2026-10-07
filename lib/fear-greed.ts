/**
 * The Crypto Fear & Greed Index (alternative.me), read from its free public
 * API: https://api.alternative.me/fng/?limit=8, which lists one reading per
 * day, newest first. Pure: the fetching lives in getFearGreed (lib/actions.ts).
 */

export type FearGreedReading = { value: number; classification: string }

export type FearGreed = FearGreedReading & {
  /** The day before's reading, when the index has one. */
  yesterday?: FearGreedReading
  /** The reading seven days back, when the index has one. */
  lastWeek?: FearGreedReading
}

function reading(row: unknown): FearGreedReading | null {
  const r = row as { value?: unknown; value_classification?: unknown } | undefined
  const value = Number(r?.value)
  if (!r || !Number.isFinite(value) || value < 0 || value > 100) return null
  return { value: Math.round(value), classification: typeof r.value_classification === "string" ? r.value_classification : "" }
}

/** Today's reading, with yesterday's and last week's where the response has
 *  them; null if it has no reading for today. */
export function parseFearGreed(body: unknown): FearGreed | null {
  const rows = (body as { data?: unknown[] } | null)?.data ?? []
  const today = reading(rows[0])
  if (!today) return null
  const yesterday = reading(rows[1])
  const lastWeek = reading(rows[7])
  return { ...today, ...(yesterday ? { yesterday } : {}), ...(lastWeek ? { lastWeek } : {}) }
}
