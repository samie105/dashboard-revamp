/**
 * The settings section keys — in a module WITHOUT "use client" on purpose.
 *
 * The page is a server component and validates `?section=` against this
 * list. Imported from settings.tsx (a client module) the array arrives as a
 * client reference, not an array, and `.includes` throws — the same trap
 * components/preview/routes.ts documents for PREVIEW_ROUTES.
 */
export const SECTION_KEYS = ["profile", "security", "verification", "notifications", "preferences", "sessions", "payouts", "account"] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export function sectionOf(raw: string | undefined): SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(raw ?? "") ? (raw as SectionKey) : "profile"
}
