"use client"

/**
 * ReceivePanel — the deposit addresses, with a QR per network.
 *
 * This is the half of "deposit" that always works: buying USDT with your
 * Dollar Account depends on the treasury being available, but receiving from
 * an external wallet only needs your own address. So this stays usable even
 * when the buy flow is paused.
 *
 * Mirrors the mobile ReceiveScreen: pick a network, see its address as a QR
 * plus copyable text, with one honest warning about sending the wrong asset.
 */

import * as React from "react"
import QRCode from "qrcode"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, CheckmarkCircle01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/system"
import { ChoiceRow } from "@/components/ui/flow"
import { NETWORKS, NETWORK_ICON, type WalletChain } from "@/lib/networks"
import { useWallet } from "@/components/wallet-provider"

export function ReceivePanel({
  /** Restrict to the networks the asset actually lives on. */
  only,
  /**
   * The asset being received, named in the warning. Pass `null` when the panel
   * isn't scoped to one token (the wallet's generic "receive anything" view) —
   * naming a token there would be a lie, and the warning has to stay true to
   * be worth reading.
   */
  asset = "USDT",
  className,
  /** Override the legacy wallet-provider addresses (modern wallet passes its own). */
  addresses: addressesProp,
  /** Extra confirmation line under the warning (e.g. the self-custody note). */
  note,
}: {
  only?: string[]
  asset?: string | null
  className?: string
  addresses?: Partial<Record<WalletChain, string>> | null
  note?: string
}) {
  // Always called — hooks rules — even when the modern wallet overrides the
  // value below with its own addresses. The legacy wallet-generated flag only
  // matters for the legacy path: a source-agnostic caller already knows
  // whether it has an address map to show (an empty one just yields no
  // available networks, which the length check below already handles).
  const legacy = useWallet()
  const addresses = addressesProp ?? legacy.addresses
  const walletsGenerated = addressesProp === undefined ? legacy.walletsGenerated : true

  const available = React.useMemo(
    () => NETWORKS.filter((n) => (!only || only.includes(n.key)) && addresses?.[n.chain]),
    [only, addresses],
  )

  const [key, setKey] = React.useState<string>(only?.[0] ?? "tron")
  const active = available.find((n) => n.key === key) ?? available[0]
  const address = active ? (addresses?.[active.chain] ?? "") : ""

  const [qr, setQr] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Render the QR client-side — no address ever leaves the browser.
  React.useEffect(() => {
    let cancelled = false
    if (!address) { setQr(null); return }
    QRCode.toDataURL(address, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0C0A09", light: "#FFFFFF" },
    })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch(() => { if (!cancelled) setQr(null) })
    return () => { cancelled = true }
  }, [address])

  React.useEffect(() => {
    if (available.length && !available.some((n) => n.key === key)) setKey(available[0].key)
  }, [available, key])

  if (!walletsGenerated || available.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-8 text-center", className)}>
        <p className="text-[15px] font-semibold">Wallet setup required</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Your receiving addresses appear here once your wallets are created.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* A one-option picker is just noise — the network is already named on
          the address label and again in the warning. */}
      {available.length > 1 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Receive on</Eyebrow>
          <ChoiceRow
            options={available.map((n) => ({ key: n.key, label: n.label, icon: NETWORK_ICON[n.key] }))}
            value={key}
            onChange={setKey}
            columns={3}
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-4 py-6">
        {qr ? (
          <img
            src={qr}
            alt={`${active?.label} deposit address QR code`}
            className="h-44 w-44 rounded-xl bg-white p-2"
          />
        ) : (
          <div className="h-44 w-44 animate-pulse rounded-xl bg-surface-sunken" />
        )}

        <div className="flex w-full flex-col gap-1.5">
          <Eyebrow>Your {active?.label} address</Eyebrow>
          <button
            onClick={() => {
              // Optional-chained through the whole call: no clipboard API
              // (non-HTTPS, older browser) or a permission rejection both
              // short-circuit to a no-op instead of an unhandled rejection.
              void navigator.clipboard?.writeText(address).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }).catch(() => {})
            }}
            className="flex w-full items-center gap-2 rounded-xl bg-surface-sunken px-3 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-muted-foreground">
              {address}
            </span>
            <HugeiconsIcon
              icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
              className={cn("h-4 w-4 shrink-0", copied ? "text-credit" : "text-muted-foreground/60")}
            />
          </button>
          <span className="text-[11.5px] text-subtle">
            {copied ? "Copied to clipboard" : "Tap the address to copy"}
          </span>
        </div>

        {/* One honest warning — the mobile screen's rule. */}
        <div className="flex w-full items-start gap-2 rounded-xl bg-warning-chip px-3 py-2.5">
          <HugeiconsIcon icon={AlertCircleIcon} className="mt-px h-4 w-4 shrink-0 text-warning" />
          <p className="text-[12px] leading-relaxed text-warning">
            {asset ? (
              <>
                Only send <strong>{asset} on {active?.label}</strong> to this address. Anything else
                — a different token, or the right token on another network — may be lost permanently.
              </>
            ) : (
              <>
                Only send assets that exist on <strong>{active?.label}</strong> to this address.
                The right token on another network may be lost permanently.
              </>
            )}
          </p>
        </div>

        {note && <p className="text-[12px] leading-relaxed text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}
