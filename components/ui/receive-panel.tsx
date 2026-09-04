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
    <div className={cn("flex flex-col gap-3", className)}>
      {/* NETWORK PICKER, as chips rather than tiles.
          Six stacked tiles at three columns is two rows of ~68px plus an
          eyebrow — around 170px spent on a control the user touches once, on
          top of a QR, an address and a warning. Inside a fixed-height modal
          that was the difference between fitting and scrolling. Chips put the
          mark and the name on one line, so the same six choices cost about a
          third of the height and stay one tap.

          A one-option picker is still noise: the network is named on the
          address label and again in the warning. */}
      {available.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((n) => {
            const on = n.key === active?.key
            return (
              <button
                key={n.key}
                onClick={() => setKey(n.key)}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium transition-all active:scale-[0.97] motion-reduce:active:scale-100",
                  on
                    ? "bg-accent text-foreground ring-1 ring-foreground/[0.10]"
                    : "bg-surface-sunken/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {NETWORK_ICON[n.key] ? (
                  <img src={NETWORK_ICON[n.key]} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-surface-raised" />
                )}
                {n.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        {qr ? (
          <img
            src={qr}
            alt={`${active?.label} deposit address QR code`}
            className="h-40 w-40 rounded-xl bg-white p-2"
          />
        ) : (
          <div className="h-40 w-40 animate-pulse rounded-xl bg-surface-sunken" />
        )}

        <div className="flex w-full flex-col gap-1.5">
          {/* The copy affordance moved up beside the label. As its own line
              underneath it was a permanent row of text saying what the icon
              already says, and it doubled as the "Copied" slot — so the panel
              carried the height whether or not anything had been copied. */}
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>Your {active?.label} address</Eyebrow>
            <span className={cn("text-[11.5px]", copied ? "text-credit" : "text-subtle")}>
              {copied ? "Copied" : "Tap to copy"}
            </span>
          </div>
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
            className="flex w-full items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <span className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-muted-foreground">
              {address}
            </span>
            <HugeiconsIcon
              icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
              className={cn("h-4 w-4 shrink-0", copied ? "text-credit" : "text-muted-foreground/60")}
            />
          </button>
        </div>

        {/* One honest warning — the mobile screen's rule. Tightened to the
            sentence that actually changes behaviour; the clause about the
            right token on the wrong network was a second sentence saying the
            same thing, and it was the line that pushed this panel over. */}
        <div className="flex w-full items-start gap-2 rounded-xl bg-warning-chip px-3 py-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="mt-px h-4 w-4 shrink-0 text-warning" />
          <p className="text-[12px] leading-relaxed text-warning">
            Only send{" "}
            <strong>
              {asset ? `${asset} on ${active?.label}` : `assets that exist on ${active?.label}`}
            </strong>
            . Anything else may be lost permanently.
          </p>
        </div>

        {note && <p className="text-[12px] leading-relaxed text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}
