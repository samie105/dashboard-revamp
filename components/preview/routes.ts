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
  // Not in the rail on purpose — reached from the top bar's Buy Crypto menu
  // and the dashboard's quick actions.
  buy: "/buy-unauth",
  sell: "/sell-unauth",
  settings: "/settings-unauth",
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

/**
 * Previews that have moved to the redesign's own frame — the top bar and rail
 * in components/redesign/shell.tsx, mounted ONCE by app/(redesign)/layout.tsx
 * so it survives navigation between them. LayoutShell renders these
 * full-bleed (no shared navbar or sidebar) and without the phone's bottom tab
 * bar, because the frame's drawer is their navigation. A preview joins this
 * list when its page moves under app/(redesign)/.
 */
export const REDESIGN_PATHS: string[] = [
  PREVIEW_ROUTES.dashboard,
  PREVIEW_ROUTES.markets,
  PREVIEW_ROUTES.wallet,
  PREVIEW_ROUTES.transactions,
  PREVIEW_ROUTES.buy,
  PREVIEW_ROUTES.sell,
  PREVIEW_ROUTES.swap,
  PREVIEW_ROUTES.bridge,
  PREVIEW_ROUTES.trade,
  PREVIEW_ROUTES.launchpad,
  PREVIEW_ROUTES.settings,
]

export function isRedesignPath(pathname: string): boolean {
  return REDESIGN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * A link into the wallet's action panel. The rail, the dashboard's quick
 * actions and the balance rows all use it, so "Withdraw" means one URL
 * wherever it is clicked — which is also what lets the rail highlight the
 * row you arrived by.
 */
export type WalletAction = "deposit" | "withdraw" | "transfer"

export function walletHref(action?: WalletAction, asset?: string): string {
  if (!action) return PREVIEW_ROUTES.wallet
  return `${PREVIEW_ROUTES.wallet}?action=${action}${asset ? `&asset=${encodeURIComponent(asset)}` : ""}`
}
