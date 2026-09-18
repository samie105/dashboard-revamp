/**
 * The design-preview routes.
 *
 * Deliberately NOT in sidebar.tsx. That file is `"use client"`, and importing
 * a plain value out of a client module into a server component does not give
 * you the value — it gives you a client reference, which arrives as
 * `undefined` at render. The trade page's header consumed these for its
 * <Link href>, so the whole route died with "expects a string … got
 * undefined". Shared constants live in a module with no directive.
 */
export const PREVIEW_ROUTES = {
  dashboard: "/dashboard-unauth",
  wallet: "/wallet-unauth",
  transactions: "/transactions-unauth",
  markets: "/markets-unauth",
  trade: "/trade-unauth",
  swap: "/swap-unauth",
  bridge: "/bridge-unauth",
  launchpad: "/launchpad-unauth",
} as const

export const PREVIEW_PATHS: string[] = Object.values(PREVIEW_ROUTES)

/**
 * Is this pathname a design preview, including its sub-routes?
 *
 * The launchpad is the first preview with sub-routes — `/launchpad-unauth/
 * create`, `/launchpad-unauth/[launchId]` — and an exact `includes()` test
 * missed every one of them, so those pages rendered with the LIVE sidebar
 * whose links lead into authenticated screens. The trailing-slash check keeps
 * `/dashboard-unauth` from also matching a hypothetical `/dashboard-unauthx`.
 */
export function isPreviewPath(pathname: string): boolean {
  return PREVIEW_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
