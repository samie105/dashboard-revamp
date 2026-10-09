/**
 * Username, country and time zone on the dashboard profile — the rules and
 * the choices, shared by the server action (which enforces them) and the
 * Settings page (which says them while you type). No "use client" / "use
 * server": both sides import it.
 *
 * The country and time-zone lists are the settings preview's
 * (components/settings-unauth/settings.tsx).
 */

export const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States"] as const

export const TIMEZONES = [
  "Africa/Lagos (GMT+1)",
  "Africa/Accra (GMT+0)",
  "Africa/Nairobi (GMT+3)",
  "Europe/London (GMT+0)",
  "America/New_York (GMT-5)",
] as const

const USERNAME = /^[a-z0-9_]{3,20}$/

/** Lowercased and trimmed, with a leading "@" dropped. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase()
}

/** Why a username can't be used, or null. Empty is allowed (no username). */
export function usernameProblem(raw: string): string | null {
  const u = normalizeUsername(raw)
  if (!u) return null
  return USERNAME.test(u) ? null : "3–20 lowercase letters, digits or _."
}

export function isCountry(v: string): boolean {
  return v === "" || (COUNTRIES as readonly string[]).includes(v)
}

export function isTimezone(v: string): boolean {
  return v === "" || (TIMEZONES as readonly string[]).includes(v)
}
