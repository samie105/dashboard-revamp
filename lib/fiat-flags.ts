/**
 * Fiat ramp rollout flags.
 *
 * NEXT_PUBLIC_FIAT_BUY_FLOW picks which Buy the BuySellClient renders:
 *   "legacy" (default)   — the old Dollar Account → USDT buy. Default until
 *                          the team makes the rollout decision (see
 *                          docs/FIAT_RAMP_CONTEXT.md).
 *   "onswitch"           — the guide flow. Availability is decided by the
 *                          backend through /fiat/config (guide §5), including
 *                          the global kill switch, so no frontend environment
 *                          logic is needed.
 *
 * Build-time (NEXT_PUBLIC_*), so changing it needs a redeploy. Anything other
 * than exactly "onswitch" means the legacy flow.
 */

export type BuyFlow = "onswitch" | "legacy"

export function resolveBuyFlow(value: string | undefined): BuyFlow {
  return value === "onswitch" ? "onswitch" : "legacy"
}

export const FIAT_BUY_FLOW: BuyFlow = resolveBuyFlow(process.env.NEXT_PUBLIC_FIAT_BUY_FLOW)

/** Which Buy/Sell implementation a BuySellClient mode renders. Sell stays on
 *  the legacy flow until the offramp ships (behind its own flag). */
export function buySellImplementation(
  mode: "buy" | "sell",
  buyFlow: BuyFlow = FIAT_BUY_FLOW,
): "onswitch-buy" | "legacy" {
  return mode === "buy" && buyFlow === "onswitch" ? "onswitch-buy" : "legacy"
}
