/**
 * Fiat ramp rollout flags.
 *
 * NEXT_PUBLIC_FIAT_BUY_FLOW picks which Buy the BuySellClient renders and
 * NEXT_PUBLIC_FIAT_SELL_FLOW independently picks which Sell it renders:
 *   "onswitch" (default) — the released OnSwitch/Bridge guide flow.
 *   "legacy"             — the old Dollar Account → USDT flow, retained as
 *                          an explicit rollback path.
 *
 * Availability is decided by the backend through /fiat/config, so the
 * frontend default does not bypass the backend kill switch. The guide flow
 * remains fail-closed when the live backend is not configured.
 *
 * Build-time (NEXT_PUBLIC_*), so changing it needs a redeploy. Anything other
 * than exactly "legacy" uses the released guide flow. Set "legacy" only to
 * roll back the corresponding UI lane.
 */

export type BuyFlow = "onswitch" | "legacy"
export type SellFlow = "onswitch" | "legacy"

export function resolveBuyFlow(value: string | undefined): BuyFlow {
  return value === "legacy" ? "legacy" : "onswitch"
}

export const FIAT_BUY_FLOW: BuyFlow = resolveBuyFlow(process.env.NEXT_PUBLIC_FIAT_BUY_FLOW)

export function resolveSellFlow(value: string | undefined): SellFlow {
  return value === "legacy" ? "legacy" : "onswitch"
}

export const FIAT_SELL_FLOW: SellFlow = resolveSellFlow(process.env.NEXT_PUBLIC_FIAT_SELL_FLOW)

/** Which released or explicitly rolled-back Buy/Sell implementation renders. */
export function buySellImplementation(
  mode: "buy" | "sell",
  buyFlow: BuyFlow = FIAT_BUY_FLOW,
  sellFlow: SellFlow = FIAT_SELL_FLOW,
): "onswitch-buy" | "onswitch-sell" | "legacy" {
  if (mode === "buy" && buyFlow === "onswitch") return "onswitch-buy"
  if (mode === "sell" && sellFlow === "onswitch") return "onswitch-sell"
  return "legacy"
}
