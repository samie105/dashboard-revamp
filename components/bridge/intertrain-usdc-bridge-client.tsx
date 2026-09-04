"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { signEvmIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { FlowShell, FlowHeader, RouteStrip, AmountField, DetailPanel, InlineNotice, FlowCta } from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"

export function IntertrainUsdcBridgeClient() {
  const { user } = useAuth(); const wallet = useCryptoWalletState(); const qc = useQueryClient()
  const [amount, setAmount] = React.useState(""); const [busy, setBusy] = React.useState(false); const [notice, setNotice] = React.useState<string | null>(null); const [unlock, setUnlock] = React.useState(false); const resume = React.useRef<(() => void) | null>(null)
  const status = useQuery({ queryKey: ["crypto", "intertrain-bridge", "status"], queryFn: ({ signal }) => cryptoBackendClient.getIntertrainUsdcBridgeStatus(signal), refetchInterval: 30_000 })
  const pkg = useQuery({ queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"), queryFn: () => cryptoBackendClient.getWalletPackage(), enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id), staleTime: 60_000 })
  const account = wallet.data?.accounts.find((a) => a.chainFamily === "evm" && a.state === "active")
  const value = Number(amount); const valid = Number.isFinite(value) && value > 0
  const blocker = !isCryptoBackendEnabled ? "Modern wallet backend is not enabled" : !wallet.data ? "Create your modern wallet first" : !account ? "Your modern wallet has no active EVM account" : status.isLoading ? "Checking bridge status…" : !status.data?.available ? status.data?.reason ?? "Bridge unavailable" : !valid ? "Enter an amount" : null
  async function submit() {
    if (blocker || busy || !user?.userId || !wallet.data?.id || !pkg.data || !account) return
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) { resume.current = () => void submit(); setUnlock(true); return }
    setBusy(true); setNotice(null)
    try {
      const { intents } = await cryptoBackendClient.createIntertrainUsdcBridgeIntents({ accountId: account.id, amount, idempotencyKey: crypto.randomUUID() })
      for (const intent of intents) { const signed = await signEvmIntent(user.userId, wallet.data.id, pkg.data, intent, account.id); await cryptoBackendClient.submitIntent(intent.id, signed) }
      setAmount(""); setNotice("USDC deposit submitted. WSK will appear after Arbitrum finality and Intertrain consensus minting."); await qc.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
    } catch (e) { setNotice(e instanceof Error ? e.message : "The bridge deposit could not be submitted.") } finally { setBusy(false) }
  }
  return <FlowShell><PageHeader title="Bridge" subtitle="Move USDC from Arbitrum into Intertrain as WSK" back="/" className="mb-5" /><div className="mb-5"><FlowHeader direction="in" title="Arbitrum USDC → Intertrain WSK" subtitle="1 USDC = 1 WSK · modern wallet only" /></div><RouteStrip direction="in" from={{ label: "Arbitrum One", sub: "USDC" }} to={{ label: "Intertrain", sub: "WSK" }} /><div className="mt-4 space-y-4"><AmountField value={amount} onChange={setAmount} unit="USDC" hint="USDC is deposited through the verified bridge contract." maxDecimals={6} /><DetailPanel rows={[{ label: "Rate", value: "1 USDC = 1 WSK" }, { label: "Destination", value: "Your Intertrain wallet" }, { label: "Settlement", value: "After source finality" }]} />{notice && <InlineNotice tone={notice.includes("submitted") ? "warning" : "error"}>{notice}</InlineNotice>}<FlowCta label={blocker ?? `Bridge ${amount || "0"} USDC`} onClick={submit} disabled={Boolean(blocker)} busy={busy} control={{ target: "bridge-submit", describe: "Bridge USDC to Intertrain", guarded: true }} /></div><WalletUnlockDialog open={unlock} onOpenChange={setUnlock} onUnlocked={() => { setUnlock(false); resume.current?.(); resume.current = null }} action="hyperliquid-deposit" /></FlowShell>
}
