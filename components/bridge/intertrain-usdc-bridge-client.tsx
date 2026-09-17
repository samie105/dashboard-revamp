"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { CryptoBackendError } from "@/lib/crypto-backend"
import { signEvmIntent } from "@/lib/crypto-wallet"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { RouteStrip, AmountField, DetailPanel, InlineNotice, FlowCta } from "@/components/ui/flow"
import { CardShell, PageHeader, SectionRule } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { BridgeHistory } from "@/components/bridge/bridge-history"

export function IntertrainUsdcBridgeClient() {
  const { user } = useAuth(); const wallet = useCryptoWalletState(); const qc = useQueryClient()
  const [amount, setAmount] = React.useState(""); const [busy, setBusy] = React.useState(false); const [notice, setNotice] = React.useState<{ tone: "progress" | "error"; text: string } | null>(null); const [unlock, setUnlock] = React.useState(false); const resume = React.useRef<(() => void) | null>(null)
  const status = useQuery({ queryKey: ["crypto", "intertrain-bridge", "status"], queryFn: ({ signal }) => cryptoBackendClient.getIntertrainUsdcBridgeStatus(signal), refetchInterval: 30_000 })
  const pkg = useQuery({ queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"), queryFn: () => cryptoBackendClient.getWalletPackage(), enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id), staleTime: 60_000 })
  const account = wallet.data?.accounts.find((a) => a.chainFamily === "evm" && a.state === "active")
  const [selectedDestination, setSelectedDestination] = React.useState("")
  const destinations = wallet.data?.accounts.filter((a) => a.chainFamily === "intertrain" && a.state === "active" && a.canonicalAddress) ?? []
  const destination = destinations.find((a) => a.id === selectedDestination) ?? (destinations.length === 1 ? destinations[0] : undefined)
  const value = Number(amount); const valid = Number.isFinite(value) && value > 0
  const blocker = !isCryptoBackendEnabled ? "Modern wallet backend is not enabled" : !wallet.data ? "Create your modern wallet first" : !account ? "Your modern wallet has no active EVM account" : destinations.length === 0 ? "Add an active Intertrain account first" : !destination ? "Select an Intertrain destination" : status.isLoading ? "Checking bridge status…" : !status.data?.available ? status.data?.reason ?? "Bridge unavailable" : !valid ? "Enter an amount" : null
  async function submit() {
    if (!destination) { setNotice({ tone: "error", text: "Select your Intertrain destination account first." }); return }
    if (blocker || busy || !user?.userId || !wallet.data?.id || !pkg.data || !account) return
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) { resume.current = () => void submit(); setUnlock(true); return }
    setBusy(true); setNotice(null)
    try {
      let idempotencyKey = crypto.randomUUID()
      let completed = false
      for (let recoveryAttempt = 0; recoveryAttempt < 4 && !completed; recoveryAttempt += 1) {
        try {
          const { intents } = await cryptoBackendClient.createIntertrainUsdcBridgeIntents({ accountId: account.id, destinationAccountId: destination.id, amount, idempotencyKey })
          if (intents.length === 0) throw new Error("The bridge returned no transaction intent")
          let approvalSubmitted = false
          for (const intent of intents) {
            const signed = await signEvmIntent(user.userId, wallet.data.id, pkg.data, intent, account.id)
            await cryptoBackendClient.submitIntent(intent.id, signed)
            approvalSubmitted ||= String(intent.normalizedSummary?.action) === "bridge-approve"
          }
          if (approvalSubmitted) {
            setNotice({ tone: "progress", text: "USDC approval submitted. Waiting for Arbitrum confirmation before depositing…" })
            await new Promise((resolve) => setTimeout(resolve, 8_000))
            idempotencyKey = crypto.randomUUID()
          } else completed = true
        } catch (error) {
          const recoverable = error instanceof CryptoBackendError && ["NONCE_STALE", "FEE_TOO_LOW", "BRIDGE_APPROVAL_PENDING"].includes(error.code)
          if (!recoverable || recoveryAttempt === 3) throw error
          // The signed intent cannot be edited. Prepare a new intent with a
          // fresh idempotency key so the backend re-reads nonce, allowance,
          // and fees before asking the user to sign again.
          idempotencyKey = crypto.randomUUID()
          if (error instanceof CryptoBackendError && error.code === "BRIDGE_APPROVAL_PENDING") {
            setNotice({ tone: "progress", text: "USDC approval is still confirming on Arbitrum. Waiting before depositing…" })
            await new Promise((resolve) => setTimeout(resolve, 8_000))
          } else setNotice({ tone: "progress", text: "Arbitrum state changed while preparing the bridge. Refreshing the transaction…" })
        }
      }
      if (!completed) throw new Error("The USDC approval was submitted but has not confirmed yet. Try again after it is mined.")
      setAmount(""); setNotice({ tone: "progress", text: "USDC deposit submitted. WSK will appear after Arbitrum finality and Intertrain consensus minting." }); await qc.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
    } catch (e) { setNotice({ tone: "error", text: formatWalletActionError(e, "arbitrum", "USDC") }) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Bridge"
        subtitle="Move USDC from Arbitrum into Intertrain as WSK"
        back="/"
      />

      <div className="flex flex-col gap-3">
        <SectionRule label="Bridge" note="1 USDC = 1 WSK" />

        {/* LANDSCAPE from `lg` up: what you are sending on the left, what it
            becomes and what it commits you to on the right, directly above the
            button. This was a single portrait column written as one line of
            JSX — see the git history if you want to know why it is now shaped
            like every other money form in the app. */}
        <CardShell className={CARD_HUE}>
          <div className="flex flex-col gap-5 p-4 sm:p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-6">
            <div className="flex min-w-0 flex-col gap-4">
              <RouteStrip
                direction="in"
                from={{ label: "Arbitrum One", sub: "USDC" }}
                to={{ label: "Intertrain", sub: "WSK" }}
              />

              <AmountField
                value={amount}
                onChange={setAmount}
                unit="USDC"
                hint="USDC is deposited through the verified bridge contract."
                maxDecimals={6}
              />

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Receive WSK in</span>
                <select
                  value={destination?.id ?? ""}
                  onChange={(event) => setSelectedDestination(event.target.value)}
                  disabled={destinations.length === 1}
                  className="w-full rounded-xl bg-foreground/[0.05] px-3 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-70"
                >
                  <option value="">Select an Intertrain account</option>
                  {destinations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.canonicalAddress?.slice(0, 10)}…{item.canonicalAddress?.slice(-8)}
                    </option>
                  ))}
                </select>
                {destination?.canonicalAddress && (
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {destination.canonicalAddress}
                  </span>
                )}
              </label>
            </div>

            {/* The commitment pane. */}
            <div className="flex min-w-0 flex-col gap-3">
              <DetailPanel
                rows={[
                  { label: "Rate", value: "1 USDC = 1 WSK" },
                  { label: "You receive", value: valid ? `${value} WSK` : "—" },
                  {
                    label: "Destination",
                    value: destination ? "Your Intertrain account" : "Not selected",
                  },
                ]}
              />

              {/* Why it is slow, before it is slow. The backend publishes no
                  ETA, so this names the two waits rather than inventing a
                  duration for them. */}
              <div className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  What happens next
                </span>
                <ol className="flex flex-col gap-2">
                  {[
                    "You sign on this device",
                    "Arbitrum reaches finality",
                    "Intertrain mints your WSK",
                  ].map((step, index) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/[0.09] text-[10px] font-bold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="text-[12.5px] leading-snug text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <span className="text-[12px] leading-relaxed text-muted-foreground">
                  It is safe to leave this page — the bridge carries on, and it is listed below
                  until the WSK lands.
                </span>
              </div>

              {notice && (
                <InlineNotice tone={notice.tone === "progress" ? "warning" : "error"}>
                  {notice.text}
                </InlineNotice>
              )}

              <FlowCta
                label={blocker ?? `Bridge ${amount || "0"} USDC`}
                onClick={submit}
                disabled={Boolean(blocker)}
                busy={busy}
                control={{ target: "bridge-submit", describe: "Bridge USDC to Intertrain", guarded: true }}
              />
            </div>
          </div>
        </CardShell>
      </div>

      <div className="flex flex-col gap-3">
        <SectionRule label="History" note="Newest first" />
        <BridgeHistory />
      </div>

      <WalletUnlockDialog
        open={unlock}
        onOpenChange={setUnlock}
        onUnlocked={() => {
          setUnlock(false)
          resume.current?.()
          resume.current = null
        }}
        action="hyperliquid-deposit"
      />
    </div>
  )
}
