/**
 * Pure fee-row formatting for the send review. Fee routing happens on the
 * backend before the wallet signs, so the browser does not query provider
 * availability or expose a sponsorship choice.
 * `feeRowValue` here is only presentation — formatting that decision into the
 * fee row's string — so this file, not the screens, is what changes if the
 * formatting ever needs to.
 */

import type { FeePresentation } from "@/lib/crypto-backend/sponsorship"
import { usd } from "@/lib/num"
import { FEE_SELF_LABEL, FEE_SPONSORED_LABEL } from "./send-helpers"

/**
 * The review screen's "Network fee" value.
 *
 * Pure formatting over `resolveFeePresentation`'s verdict. Provider routing
 * details are intentionally not included in the fee row.
 */
export function feeRowValue(presentation: FeePresentation, gasEstimate: string | undefined): string {
  if (presentation.kind === "sponsored") {
    return presentation.costUsd !== undefined
      ? `${FEE_SPONSORED_LABEL} · ≈ ${usd(presentation.costUsd)}`
      : FEE_SPONSORED_LABEL
  }
  return gasEstimate ? `${FEE_SELF_LABEL} · ${gasEstimate} gas` : FEE_SELF_LABEL
}
