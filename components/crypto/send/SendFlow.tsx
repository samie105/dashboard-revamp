"use client"

/**
 * SendFlow — money out of the self-custodial wallet (spec §4, §7).
 *
 * Three screens over one piece of state: fill in the transfer, read exactly
 * what the signature will commit to, then watch it land. The signing itself
 * never leaves this device — this component only orchestrates the modules
 * that hold the keys, and holds no secret of its own.
 *
 * The parts worth knowing before editing:
 *
 *  · The form values OUTLIVE the intent. An expired quote is never reused
 *    (spec §13) — `refreshQuote` throws the intent away and asks for a new one
 *    from the same typed values, so "get a fresh one" costs the user nothing.
 *  · The pre-check is asymmetric. A simulation that comes back `ok: false` is
 *    the service saying this transfer WOULD fail: block. A simulation call
 *    that never landed is us knowing nothing: warn and let them sign.
 *  · Unlock RESUMES. If the DEK lapsed between review and press, the dialog
 *    opens with the pending action stored, and finishing the unlock runs that
 *    action — it never drops the user back at the start of the flow.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import { SectionMessage } from "@/components/crypto/primitives"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import {
  FlowHeader,
  FlowShell,
  FlowSkeleton,
  InlineNotice,
  UnavailablePanel,
  useElapsed,
  useStageProgress,
} from "@/components/ui/flow"
import { BackAction } from "@/components/ui/system"
import { formatCryptoAmount, useCryptoBalances } from "@/hooks/crypto/useCryptoBalances"
import { useTransactionIntent } from "@/hooks/crypto/useTransactionIntent"
import { useUsdIndex } from "@/hooks/crypto/useUsdIndex"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
  type CryptoErrorAction,
  type CryptoWalletAccount,
} from "@/lib/crypto-backend"
import { explorerTxUrl, networkMetaFor } from "@/lib/crypto-backend/network-meta"
import { validateAddress, validateAmount } from "@/lib/crypto-wallet/address-validation"
import { SEND_STAGES, sendStageIndex } from "@/lib/crypto-wallet/send-stages"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { NETWORK_ICON } from "@/lib/networks"
import { SendFormScreen, type ChoiceOption } from "./SendFormScreen"
import { SendReviewScreen } from "./SendReviewScreen"
import { SendStatusScreen } from "./SendStatusScreen"
import { feeRowValue, useSponsorshipOffer } from "./use-sponsorship-offer"
import {
  assetKeyOf,
  baseUnitsOf,
  epochMsOf,
  formatCountdown,
  isSelfSend,
  readTxHash,
  spendableBalances,
  statusStateOf,
  usdApproxFor,
} from "./send-helpers"

const WALLET_HREF = "/wallet/modern"

/**
 * What the intent was built from, frozen at the moment it was created.
 *
 * The review and status screens must NOT read these off the live pickers.
 * Submitting invalidates the balance snapshot, and the asset just spent can
 * drop out of the spendable list entirely — the status screen would then be
 * reporting "Sending 5 " with the symbol missing, about money it had already
 * sent. What was signed doesn't change because the wallet moved on.
 */
type CommittedTransfer = {
  symbol: string
  amount: string
  networkId: string
  networkLabel: string
  tokenContract: string | null
  fromAddress: string
  toAddress: string
}

export function SendFlow() {
  const router = useRouter()
  const { user } = useAuth()
  const { wallet, networks } = useCryptoContext()
  const balances = useCryptoBalances()
  const usdIndex = useUsdIndex()
  const userId = user?.userId ?? "anonymous"
  const walletId = wallet.data?.id

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(walletId),
    staleTime: 60_000,
  })
  const transfer = useTransactionIntent(walletId, packageQuery.data)

  /* ── Form state. Deliberately survives every intent: a fresh quote is a new
        backend object, not a new answer from the user. ──────────────────── */
  const [step, setStep] = React.useState<"form" | "review" | "status">("form")
  const [networkId, setNetworkId] = React.useState("")
  const [assetKey, setAssetKey] = React.useState("")
  const [to, setTo] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [sponsorFees, setSponsorFees] = React.useState(false)
  const [addressTouched, setAddressTouched] = React.useState(false)

  const [committed, setCommitted] = React.useState<CommittedTransfer | null>(null)
  const [createError, setCreateError] = React.useState<unknown>(null)
  const [simulateCallError, setSimulateCallError] = React.useState<unknown>(null)
  const [signError, setSignError] = React.useState<unknown>(null)
  const [submitRecord, setSubmitRecord] = React.useState<unknown>(null)

  // `refresh()` REJECTS on a failed read and doesn't write the failure into
  // the query, so a swallowed call would leave a stale snapshot on screen with
  // no explanation (the bug ModernWalletPage documents).
  const [refreshError, setRefreshError] = React.useState<unknown>(null)
  const refreshBalances = React.useCallback(() => {
    setRefreshError(null)
    balances.refresh().catch((error: unknown) => setRefreshError(error))
    // `balances` itself is a fresh object each render; its `refresh` is the
    // stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances.refresh])

  const [unlockOpen, setUnlockOpen] = React.useState(false)
  /** What to run once the wallet is unlocked — the whole point of the dialog
   *  is that the interrupted action continues, not that it restarts. */
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)
  const simulatedFor = React.useRef<string | null>(null)

  /* ── Accounts × networks ───────────────────────────────────────────────── */

  const accounts = React.useMemo(() => wallet.data?.accounts ?? [], [wallet.data])
  const accountByFamily = React.useMemo(() => {
    const map = new Map<string, CryptoWalletAccount>()
    for (const account of accounts) if (!map.has(account.chainFamily)) map.set(account.chainFamily, account)
    return map
  }, [accounts])

  const networkList = React.useMemo(() => networks.data ?? [], [networks.data])
  const networkOptions: ChoiceOption[] = React.useMemo(
    () =>
      networkList
        // A network with no key on this wallet has no address to send from,
        // and one whose transfer capability is off can't be sent on at all.
        .filter((network) => accountByFamily.has(network.family) && network.capabilities?.transfer !== false)
        .map((network) => {
          const meta = networkMetaFor(network.id, networkList)
          return { key: network.id, label: meta?.label ?? network.name, icon: meta ? NETWORK_ICON[meta.key] : undefined }
        }),
    [networkList, accountByFamily],
  )

  const selectedNetwork = networkList.find((network) => network.id === networkId)
  const account = selectedNetwork ? accountByFamily.get(selectedNetwork.family) : undefined
  const family = account?.chainFamily ?? ""
  const accountId = account?.id ?? ""
  const fromAddress =
    account?.addresses?.find((entry) => entry.networkId === networkId)?.address ?? account?.canonicalAddress ?? ""

  /* ── Assets on that account+network ────────────────────────────────────── */

  const assetRows = React.useMemo(
    () => (accountId && networkId ? spendableBalances(balances.balances, accountId, networkId) : []),
    [balances.balances, accountId, networkId],
  )
  const assetOptions: ChoiceOption[] = assetRows.map((row) => ({
    key: assetKeyOf(row.asset),
    label: row.symbol,
    sub: formatCryptoAmount(row.amountBaseUnits, row.decimals),
    icon: row.logo,
  }))
  const selectedBalance = assetRows.find((row) => assetKeyOf(row.asset) === assetKey)
  // A refreshed snapshot can retire the row the user picked (spent elsewhere,
  // provider dropped it). Falling back to "nothing selected" keeps every
  // downstream read honest instead of rendering a stale symbol and amount.
  const activeAssetKey = selectedBalance ? assetKey : ""
  const symbol = selectedBalance?.symbol ?? ""
  const decimals = selectedBalance?.decimals ?? 0
  const availableBaseUnits = selectedBalance?.amountBaseUnits

  const maxSpend = React.useMemo(() => {
    if (!selectedBalance) return null
    // formatCryptoAmount TRUNCATES, so this can never propose more than the
    // account holds — the chips are an upper bound, not a rounding.
    const value = Number(formatCryptoAmount(selectedBalance.amountBaseUnits, selectedBalance.decimals, Math.min(selectedBalance.decimals, 8)))
    return Number.isFinite(value) && value > 0 ? value : null
  }, [selectedBalance])

  /* ── Validation ────────────────────────────────────────────────────────── */

  const addressEntered = to.trim().length > 0
  const addressCheck = validateAddress(family, to)
  const addressProblem = addressTouched && addressEntered && !addressCheck.ok ? addressCheck.problem : null
  const selfSend = isSelfSend(family, fromAddress, to)

  const amountEntered = amount.trim().length > 0
  const amountCheck = selectedBalance ? validateAmount({ amount, decimals, availableBaseUnits }) : null
  const amountProblem = amountEntered && amountCheck && !amountCheck.ok ? amountCheck.problem : null
  const amountApprox = usdApproxFor(amount, symbol, usdIndex)
  // A full-balance native send leaves nothing to pay gas with. Advisory only —
  // the backend's INSUFFICIENT_FUNDS stays the authority on what fits.
  const spendsWholeNativeBalance =
    selectedBalance?.asset.kind === "native" &&
    amountCheck?.ok === true &&
    availableBaseUnits !== undefined &&
    BigInt(amountCheck.baseUnits) === baseUnitsOf(availableBaseUnits)
  const amountHint = spendsWholeNativeBalance ? `Keep a little ${symbol} for the network fee.` : null

  /* ── Fee sponsorship ───────────────────────────────────────────────────── */

  const assetKind = selectedBalance?.asset.kind ?? "native"
  const { offered: feeOffered } = useSponsorshipOffer({ networkId, family: account?.chainFamily, assetKind })
  React.useEffect(() => {
    // Never carry a sponsored choice into a network/asset that isn't offered
    // one — the request would ask for a quote the service already refused.
    if (!feeOffered && sponsorFees) setSponsorFees(false)
  }, [feeOffered, sponsorFees])

  /* ── The intent, and its clock ─────────────────────────────────────────── */

  const intent = transfer.intent
  const intentId = transfer.intentId
  const [quoteAt, setQuoteAt] = React.useState<number | null>(null)
  React.useEffect(() => {
    setQuoteAt(intentId ? Date.now() : null)
  }, [intentId])
  // useElapsed re-renders once a second while a quote is live; deriving "now"
  // from it keeps the countdown a pure function of state rather than a
  // Date.now() read during render.
  const sinceQuote = useElapsed(quoteAt)
  const expiresAtMs = epochMsOf(intent?.expiresAt)
  const remainingMs = quoteAt !== null && expiresAtMs !== null ? expiresAtMs - (quoteAt + sinceQuote) : null
  const expired = remainingMs !== null && remainingMs <= 0
  const countdown = remainingMs === null ? null : formatCountdown(remainingMs)

  const simulateIntent = transfer.simulateIntent
  React.useEffect(() => {
    if (step !== "review" || !intentId || simulatedFor.current === intentId) return
    simulatedFor.current = intentId
    setSimulateCallError(null)
    void simulateIntent().catch((error: unknown) => setSimulateCallError(error))
  }, [step, intentId, simulateIntent])

  const validationErrors =
    intent?.validationResult && intent.validationResult.ok === false ? intent.validationResult.errors ?? [] : []
  const simulationFailed = intent?.simulationResult?.ok === false
  const simulationRaw = intent?.simulationResult?.error ?? null

  /* ── Status ────────────────────────────────────────────────────────────── */

  const rawStageIndex = sendStageIndex(intent?.status ?? "created")
  const stageProgress = useStageProgress(rawStageIndex, intentId ?? "none")
  const statusState = signError ? "failure" : statusStateOf(intent?.status)
  const activeIndex = statusState === "success" ? SEND_STAGES.length : stageProgress.index
  const txHash = readTxHash(transfer.sponsorship, submitRecord, intent)
  // The network this transfer was BUILT on, not whatever the picker shows now.
  const sentNetworkId = committed?.networkId ?? networkId
  const explorerHref = txHash ? explorerTxUrl(sentNetworkId, txHash, networkList) : null
  const explorerName = networkMetaFor(sentNetworkId, networkList)?.explorerName
  const explorer = explorerHref && explorerName ? { label: `View on ${explorerName}`, href: explorerHref } : null

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const blocker =
    !networkId ? "Choose a network"
    : !activeAssetKey ? "Choose an asset"
    : !addressEntered ? "Enter a destination address"
    : !addressCheck.ok ? "Fix the address"
    : !amountEntered ? "Enter an amount"
    : amountCheck && !amountCheck.ok ? amountCheck.problem
    : null

  function transferInput() {
    return {
      accountId,
      networkId,
      asset: selectedBalance!.asset,
      // A pasted address routinely arrives with a trailing space or newline.
      to: to.trim(),
      amount: amount.trim(),
      sponsorFees,
    }
  }

  function snapshot(): CommittedTransfer {
    return {
      symbol,
      amount: amount.trim(),
      networkId,
      networkLabel: networkMetaFor(networkId, networkList)?.label ?? selectedNetwork?.name ?? networkId,
      tokenContract: selectedBalance!.asset.kind === "token" ? selectedBalance!.asset.identifier : null,
      fromAddress,
      toAddress: to.trim(),
    }
  }

  async function startReview() {
    setAddressTouched(true)
    if (blocker || !selectedBalance) return
    setCreateError(null)
    try {
      await transfer.createIntent(transferInput())
      setCommitted(snapshot())
      setStep("review")
    } catch (error) {
      setCreateError(error)
    }
  }

  /** Spec §13: an expired intent is never reused — it is replaced. */
  async function refreshQuote() {
    if (!selectedBalance) {
      startOver()
      return
    }
    setCreateError(null)
    setSimulateCallError(null)
    setSignError(null)
    setSubmitRecord(null)
    simulatedFor.current = null
    transfer.reset()
    try {
      await transfer.createIntent(transferInput())
      setCommitted(snapshot())
      // A fresh quote is always something to READ before signing — including
      // when the expiry was discovered at submit time, on the status screen.
      // Landing back on review is what makes "get a fresh one" a route
      // forward rather than a dead end on a screen with nothing in flight.
      setStep("review")
    } catch (error) {
      setCreateError(error)
    }
  }

  async function runSubmit() {
    setSignError(null)
    setSubmitRecord(null)
    // The status screen opens the moment the user commits, not when the
    // service answers: local signing plus a submit takes seconds, and a greyed
    // button is the least reassuring possible reply to "I just sent money".
    setStep("status")
    try {
      setSubmitRecord(await transfer.submitIntent())
    } catch (error) {
      setSignError(error)
    }
  }

  function openUnlock(resume: (() => void) | null) {
    resumeAfterUnlock.current = resume
    setUnlockOpen(true)
  }

  function pressSign() {
    if (!walletId) return
    // The DEK's TTL can lapse between reading the review and pressing sign.
    if (!getUnlockedWalletState(userId, walletId)) {
      openUnlock(() => void runSubmit())
      return
    }
    void runSubmit()
  }

  /** New intent, same typed values — the retry path that keeps the user's work. */
  function startOver() {
    transfer.reset()
    simulatedFor.current = null
    setCreateError(null)
    setSimulateCallError(null)
    setSignError(null)
    setSubmitRecord(null)
    setCommitted(null)
    setStep("form")
  }

  /** Finished with this transfer entirely. */
  function resetToForm() {
    startOver()
    setTo("")
    setAmount("")
    setAddressTouched(false)
  }

  function tryAgain() {
    const intentDead = intent?.status === "failed" || intent?.status === "expired"
    setSignError(null)
    setSubmitRecord(null)
    if (intent && !intentDead && !expired) setStep("review")
    else startOver()
  }

  function errorAction(action: CryptoErrorAction, retry: () => void, resume: () => void) {
    switch (action) {
      case "unlock":
        openUnlock(resume)
        break
      case "new-intent":
        void refreshQuote()
        break
      case "view-existing":
        // The duplicate IS this intent — its status screen is the answer.
        setCreateError(null)
        setSignError(null)
        if (intentId) setStep("status")
        break
      case "setup-wallet":
        router.push(WALLET_HREF)
        break
      case "refresh-session":
        router.refresh()
        break
      case "pay-gas":
        setSponsorFees(false)
        startOver()
        break
      case "retry":
        retry()
        break
      default:
        break
    }
  }

  /* ── Chrome ────────────────────────────────────────────────────────────── */

  const backTarget: string | (() => void) = step === "review" ? () => setStep("form") : WALLET_HREF
  const shell = (body: React.ReactNode) => (
    <FlowShell>
      <div className="mb-5 flex items-start gap-2">
        <BackAction to={backTarget} />
        <FlowHeader direction="out" title="Send crypto" subtitle="Signed locally on this device" />
      </div>
      {body}
      {/* Mounted on every branch: the DEK can lapse at any point, and the
          dialog is what resumes whatever was interrupted. */}
      <WalletUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
    </FlowShell>
  )

  if (!isCryptoBackendEnabled) {
    return shell(
      <UnavailablePanel
        title="The Worldstreet wallet isn't enabled"
        tone="muted"
        reason="Self-custody is still rolling out and isn't switched on for this account yet."
      />,
    )
  }

  if (wallet.needsSetup) {
    return shell(
      <UnavailablePanel
        title="You don't have a Worldstreet wallet yet"
        tone="muted"
        reason="Create your self-custodial wallet first — it takes a moment and the keys stay on this device."
        action={{ label: "Set up your wallet", onClick: () => router.push(WALLET_HREF) }}
      />,
    )
  }

  if (wallet.isLoading || networks.isLoading || balances.isLoading) return shell(<FlowSkeleton />)

  if (wallet.error) {
    return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  }

  if (networkOptions.length === 0) {
    return shell(
      <UnavailablePanel
        title="No network to send on"
        tone="muted"
        reason="This wallet has no chain that currently accepts transfers. Add a chain under Security, or try again shortly."
        action={{ label: "Back to wallet", onClick: () => router.push(WALLET_HREF) }}
      />,
    )
  }

  /* ── Status ────────────────────────────────────────────────────────────── */

  if (step === "status") {
    return shell(
      <SendStatusScreen
        state={statusState}
        amount={committed?.amount ?? amount.trim()}
        symbol={committed?.symbol ?? symbol}
        activeIndex={activeIndex}
        stageStartedAt={statusState === "processing" ? stageProgress.since : null}
        reference={intentId ?? null}
        txHash={txHash}
        explorer={explorer}
        onDone={resetToForm}
        onTryAgain={tryAgain}
        errorSlot={
          signError ? (
            <SectionMessage
              error={signError}
              onAction={(action) => errorAction(action, () => void runSubmit(), () => void runSubmit())}
            />
          ) : null
        }
      />,
    )
  }

  /* ── Review ────────────────────────────────────────────────────────────── */

  if (step === "review") {
    // `refreshQuote` clears the old intent before the new one lands; the
    // review has nothing true to show in that gap.
    if (!intent || !committed) return shell(<FlowSkeleton />)

    const packageReady = Boolean(packageQuery.data)
    const signBlocked = validationErrors.length > 0 || simulationFailed
    const ctaLabel = expired
      ? "Quote expired — get a fresh one"
      : transfer.isSimulating
        ? "Checking this transfer…"
        : !packageReady
          ? "Preparing your wallet…"
          : validationErrors.length > 0
            ? "This transfer can't be sent"
            : simulationFailed
              ? "This transfer would fail"
              : "Approve and sign locally"

    return shell(
      <SendReviewScreen
        fromAddress={committed.fromAddress}
        toAddress={committed.toAddress}
        networkLabel={committed.networkLabel}
        symbol={committed.symbol}
        tokenContract={committed.tokenContract}
        amount={committed.amount}
        feeValue={feeRowValue({
          sponsorship: transfer.sponsorship,
          sponsorFees,
          gasEstimate: intent.simulationResult?.gasEstimate,
        })}
        countdown={countdown}
        expired={expired}
        validationErrors={validationErrors}
        simulationFailed={simulationFailed}
        simulationRaw={simulationRaw}
        simulateCallFailed={simulateCallError !== null}
        ctaLabel={ctaLabel}
        ctaDisabled={!expired && (signBlocked || !packageReady)}
        ctaBusy={transfer.isSimulating || transfer.isSubmitting || transfer.isLoading}
        onSign={expired ? () => void refreshQuote() : pressSign}
        onEdit={() => setStep("form")}
        errorSlot={
          createError || packageQuery.error ? (
            <SectionMessage
              error={createError ?? packageQuery.error}
              onAction={(action) => errorAction(action, () => void refreshQuote(), () => void runSubmit())}
            />
          ) : null
        }
      />,
      )
  }

  /* ── Form ──────────────────────────────────────────────────────────────── */

  const networkUnavailable = balances.unavailableNetworks.some((entry) => entry.networkId === networkId)

  return shell(
    <SendFormScreen
      networkOptions={networkOptions}
      networkId={networkId}
      onNetworkChange={(next) => {
        setNetworkId(next)
        // Address format and amount precision are both properties of the
        // chain — carrying either across a network change would carry a value
        // that was never valid here.
        setAssetKey("")
        setAmount("")
        setAddressTouched(false)
      }}
      networkNotice={
        <>
          {balances.error || refreshError ? (
            <SectionMessage error={balances.error ?? refreshError} onAction={refreshBalances} />
          ) : null}
          {networkUnavailable ? (
            <InlineNotice tone="warning">
              {selectedNetwork?.name ?? "This network"} balances are temporarily unavailable — what you can send here
              may be incomplete.
            </InlineNotice>
          ) : null}
        </>
      }
      assetOptions={assetOptions}
      assetKey={activeAssetKey}
      onAssetChange={(next) => {
        setAssetKey(next)
        // An amount is denominated in the asset it was typed under.
        setAmount("")
      }}
      to={to}
      onToChange={setTo}
      onToBlur={() => {
        setTo((current) => current.trim())
        setAddressTouched(true)
      }}
      addressProblem={addressProblem}
      selfSend={selfSend}
      amount={amount}
      onAmountChange={setAmount}
      symbol={symbol}
      decimals={decimals}
      amountProblem={amountProblem}
      amountApprox={amountApprox}
      amountHint={amountHint}
      maxSpend={maxSpend}
      feeOffered={feeOffered}
      sponsorFees={sponsorFees}
      onSponsorFeesChange={setSponsorFees}
      ctaLabel={transfer.isLoading ? "Preparing review…" : blocker ?? "Review transfer"}
      ctaDisabled={Boolean(blocker)}
      ctaBusy={transfer.isLoading}
      onSubmit={() => void startReview()}
      errorSlot={
        createError ? (
          <SectionMessage
            error={createError}
            onAction={(action) => errorAction(action, () => void startReview(), () => void startReview())}
          />
        ) : null
      }
    />,
  )
}
