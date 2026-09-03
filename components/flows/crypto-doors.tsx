"use client"

/**
 * The crypto side of the two doors, as steps inside the money-flow modal.
 *
 * ── Why not just mount ModernReceiveModal / SendModal here ────────────────
 * Both of those ARE modals — each brings its own backdrop, focus trap and
 * close button. Rendered inside the money-flow popup they would stack a
 * dialog on a dialog for one step of one journey. So this reuses the layer
 * underneath them instead: `ReceivePanel` (the same panel ModernReceiveModal
 * wraps, with the same address mapping) and `SendFlow` (which already knows
 * how to wear someone else's chrome — pass `onClose` and it drops its page
 * shell, exactly as SendModal does).
 *
 * ── Why this file is loaded on demand ─────────────────────────────────────
 * MoneyFlowProvider is mounted on every route. SendFlow pulls the whole
 * wallet stack behind it — balances, quotes, the unlock dialog, a QR encoder
 * — and none of that belongs in the bundle of a page nobody will send from.
 * money-flow-modal.tsx imports this through next/dynamic, and only renders it
 * while a crypto door is actually open: SendFlow holds a live transfer intent
 * and a poll, and a closed-but-mounted copy would leave both running behind
 * the modal and come back showing a stale quote.
 */

import * as React from "react"

import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import { SendFlow } from "@/components/crypto/send/SendFlow"
import { FlowHeader, InlineNotice } from "@/components/ui/flow"
import { ReceivePanel } from "@/components/ui/receive-panel"
import type { WalletChain } from "@/lib/networks"

/** Kept in step with ModernReceiveModal — the wallet stores an account per
 *  family, ReceivePanel renders per chain. */
const FAMILY_TO_CHAIN: Record<string, WalletChain> = {
  evm: "ethereum",
  solana: "solana",
  sui: "sui",
  ton: "ton",
  tron: "tron",
}

export type CryptoDoorView = "receive" | "send"

export function CryptoDoorPanel({
  view,
  onClose,
  onInFlightChange,
}: {
  view: CryptoDoorView
  /** Closes the whole modal. SendFlow's dead-end screens use it instead of a
   *  link, so finishing a transfer doesn't navigate away from the page the
   *  modal was opened over. */
  onClose: () => void
  /** Reports when dismissing would abandon a transfer that has already gone
   *  out. The shell ignores backdrop clicks and Escape while it is true. */
  onInFlightChange: (inFlight: boolean) => void
}) {
  // Branching on the view rather than on a prop inside one component keeps
  // each side's hooks to itself — receiving reads addresses, sending runs a
  // whole quote/sign/poll machine, and neither should pay for the other.
  if (view === "send") {
    return (
      // Same column padding as the custodial flows' modal bodies; SendFlow
      // draws its own header and CTA inside it.
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <SendFlow onClose={onClose} onInFlightChange={onInFlightChange} />
      </div>
    )
  }
  return <ReceiveStep />
}

function ReceiveStep() {
  const { wallet } = useCryptoContext()

  const modernAddresses = React.useMemo(() => {
    const map: Partial<Record<WalletChain, string>> = {}
    for (const account of wallet.data?.accounts ?? []) {
      const chain = FAMILY_TO_CHAIN[account.chainFamily]
      if (chain && account.canonicalAddress) map[chain] = account.canonicalAddress
    }
    return map
  }, [wallet.data])

  const hasModern = Object.keys(modernAddresses).length > 0

  // Some wallets were created before an option shipped, so they hold fewer
  // addresses than the app can show. That is a gap to name, not an error —
  // and it is only meaningful when we're reading the modern wallet at all.
  const readyCount = React.useMemo(
    () => new Set((wallet.data?.accounts ?? []).map((account) => account.chainFamily)).size,
    [wallet.data],
  )
  const someMissing = hasModern && readyCount < Object.keys(FAMILY_TO_CHAIN).length

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
      <FlowHeader
        className="ws-casc ws-casc-1"
        direction="in"
        title="Receive coins"
        subtitle="Send to one of these addresses and it lands in your wallet"
      />
      {/* `undefined` is not the same as an empty map: it tells ReceivePanel to
          fall back to the addresses it already knows about, which is what
          someone still on the older wallet needs to see. Passing an empty map
          instead would show them "wallet setup required" over a wallet they
          have. */}
      <ReceivePanel
        className="ws-casc ws-casc-2"
        asset={null}
        addresses={hasModern ? modernAddresses : undefined}
        // Only claimed for the wallet where it is true. The older wallet is a
        // different arrangement, and this line is a promise, not decoration.
        note={
          hasModern
            ? "This address belongs to your Worldstreet wallet. Only you can access money sent to it."
            : undefined
        }
      />
      {someMissing && (
        <InlineNotice tone="warning">
          Not every option is ready on your wallet yet. Open{" "}
          <a href="/wallet/modern#security" className="font-semibold underline underline-offset-2">
            Security
          </a>{" "}
          in your wallet to turn on the rest.
        </InlineNotice>
      )}
    </div>
  )
}
