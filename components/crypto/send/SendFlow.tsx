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
import Link from "next/link"
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
  describeCryptoError,
  existingOperationIdFrom,
  isCryptoBackendEnabled,
  type CryptoErrorAction,
  type CryptoIntentSimulation,
  type CryptoWalletAccount,
} from "@/lib/crypto-backend"
import { explorerTxUrl, networkMetaFor } from "@/lib/crypto-backend/network-meta"
import { resolveFeePresentation } from "@/lib/crypto-backend/sponsorship"
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
 *
 * Captured BEFORE `transfer.createIntent` is awaited, from the same read as
 * the values handed to that call — never after. `createIntent` is a
 * multi-second round trip (intent + sponsorship quote + prepare), and the
 * pickers are still live on screen for however long the form isn't disabled
 * during it; reading this snapshot back out afterwards would risk it
 * disagreeing with what was actually signed.
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

/**
 * The send ceremony, rendered in either of two homes.
 *
 * On its own route it wears `FlowShell` — the narrow centred column every
 * flow page uses. Passed `onClose` it is inside the wallet's send modal
 * instead, where the popup already supplies the width, the padding and a way
 * out; the shell would then be a second frame drawn inside the first, and
 * every "back to wallet" would navigate away from the wallet the user is
 * already looking at.
 *
 * Only the chrome differs. Steps, signing and error handling are the same
 * code in both, which is the point of doing it this way rather than forking
 * a modal copy that drifts.
 */
export function SendFlow({
  onClose,
  onInFlightChange,
}: {
  onClose?: () => void
  /** Reports whether a transfer is mid-flight, so a containing modal can
   *  refuse accidental dismissal. Named to match `BuySellClient`, which
   *  reports the same thing to the cash money-flow modal. */
  onInFlightChange?: (inFlight: boolean) => void
} = {}) {
  const router = useRouter()
  const inModal = Boolean(onClose)
  /** "Leave the flow" — close the modal, or go back to the wallet page. */
  const leaveFlow = React.useCallback(() => {
    if (onClose) onClose()
    else router.push(WALLET_HREF)
  }, [onClose, router])
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
  const [simulationResult, setSimulationResult] = React.useState<CryptoIntentSimulation | null>(null)
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

  // Spec §11: the review screen's one source of truth for who pays the
  // network fee — never inferred from "does a sponsorship object exist"
  // alone. A quote/prepare outage is caught inside `useTransactionIntent.
  // create` and arrives here as `sponsorshipError` instead of failing the
  // mutation; this is what turns that pair into the self-paid fallback.
  const feePresentation = resolveFeePresentation({
    requested: sponsorFees,
    operation: transfer.sponsorship ?? null,
    quoteError: transfer.sponsorshipError ?? null,
  })
  // The FINAL choice for `submitIntent` — not merely "is a sponsorship object
  // present" (an expired or stale one must never be signed down that path).
  const useSponsorshipFinal = feePresentation.kind === "sponsored"

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
  const intentExpiresAtMs = epochMsOf(intent?.expiresAt)
  // Spec §11: a sponsored offer can lapse before the intent itself does — the
  // countdown must reflect whichever clock runs out first, but only while the
  // fee is actually being presented as sponsored (once it isn't, the offer's
  // clock is no longer this transfer's business).
  const sponsorshipExpiresAtMs = useSponsorshipFinal ? epochMsOf(transfer.sponsorship?.expiresAt) : null
  const expiresAtMs =
    intentExpiresAtMs !== null && sponsorshipExpiresAtMs !== null
      ? Math.min(intentExpiresAtMs, sponsorshipExpiresAtMs)
      : intentExpiresAtMs ?? sponsorshipExpiresAtMs
  const remainingMs = quoteAt !== null && expiresAtMs !== null ? expiresAtMs - (quoteAt + sinceQuote) : null
  const expired = remainingMs !== null && remainingMs <= 0
  const countdown = remainingMs === null ? null : formatCountdown(remainingMs)

  const simulateIntent = transfer.simulateIntent
  React.useEffect(() => {
    if (step !== "review" || !intentId || simulatedFor.current === intentId) return
    simulatedFor.current = intentId
    setSimulateCallError(null)
    setSimulationResult(null)
    void simulateIntent()
      // What the call RESOLVES with is kept here rather than being read back
      // out of the query cache. `useTransactionIntent`'s onSuccess merges the
      // result with `setQueryData(key, current => current ? {...} : current)`,
      // which silently DISCARDS it when the intent GET hasn't populated that
      // key yet — and this effect fires the instant the step flips to review,
      // racing exactly that GET. Dropping a fail-closed verdict would leave an
      // armed "Approve and sign locally" on a transfer the service already
      // said would fail.
      .then((result) => setSimulationResult(result))
      .catch((error: unknown) => {
        setSimulateCallError(error)
        // The call never landed, so nothing was learned — let a later return
        // to this screen ask again instead of pinning the fail-open warning.
        simulatedFor.current = null
      })
  }, [step, intentId, simulateIntent])

  // Fail-closed union: a "no" from EITHER source is a "no". The resolved value
  // is the one that cannot be lost to the cache race; the intent's own fields
  // carry a verdict that arrived by poll or from an earlier simulate.
  const resolvedValidation = simulationResult?.validation
  const resolvedSimulation = simulationResult?.simulation
  const validationErrors = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...(resolvedValidation?.ok === false ? resolvedValidation.errors ?? [] : []),
          ...(intent?.validationResult?.ok === false ? intent.validationResult.errors ?? [] : []),
        ]),
      ),
    [resolvedValidation, intent?.validationResult],
  )
  const simulationFailed = resolvedSimulation?.ok === false || intent?.simulationResult?.ok === false
  const simulationRaw =
    (resolvedSimulation?.ok === false ? resolvedSimulation.error : null) ??
    (intent?.simulationResult?.ok === false ? intent.simulationResult.error : null) ??
    null
  const gasEstimate = resolvedSimulation?.gasEstimate ?? intent?.simulationResult?.gasEstimate

  /* ── Status ────────────────────────────────────────────────────────────── */

  const rawStageIndex = sendStageIndex(intent?.status ?? "created")
  const stageProgress = useStageProgress(rawStageIndex, intentId ?? "none")
  const statusState = signError ? "failure" : statusStateOf(intent?.status)
  const activeIndex = statusState === "success" ? SEND_STAGES.length : stageProgress.index

  /* `runSubmit` moves to the status step BEFORE signing, so this one flag
     covers the whole dangerous window: signing, submitting, and waiting for
     the chain. A settled send — success or failure — is free to dismiss. */
  const inFlight = step === "status" && statusState === "processing"
  React.useEffect(() => {
    onInFlightChange?.(inFlight)
  }, [inFlight, onInFlightChange])
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
    // Captured HERE, before the await — not read back off the pickers once
    // `createIntent` resolves. The form stays mounted (and merely disabled,
    // belt-and-braces) for the whole round trip, so what gets reviewed and
    // signed must be exactly what was on screen the instant this fired.
    const input = transferInput()
    const committedSnapshot = snapshot()
    try {
      await transfer.createIntent(input)
      setCommitted(committedSnapshot)
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
    setSimulationResult(null)
    setSignError(null)
    setSubmitRecord(null)
    simulatedFor.current = null
    transfer.reset()
    // Leave the status screen HERE, before the await — from this line nothing
    // is in flight, and the status screen must never keep showing a running
    // transfer core and "you can safely leave" over a transfer that no longer
    // exists. Review is where a fresh quote gets read; while it is being
    // fetched the review branch shows its (bounded) skeleton.
    setStep("review")
    // Same capture-before-await discipline as `startReview`: whatever this
    // refresh reviews and signs must be the values read the instant it fired.
    const input = transferInput()
    const committedSnapshot = snapshot()
    try {
      await transfer.createIntent(input)
      setCommitted(committedSnapshot)
    } catch (error) {
      setCreateError(error)
      // No quote means nothing to review. The form is the only screen that is
      // true here, and it renders this error.
      setStep("form")
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
      setSubmitRecord(await transfer.submitIntent({ useSponsorship: useSponsorshipFinal }))
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
    setSimulationResult(null)
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

  function errorAction(
    action: CryptoErrorAction,
    retry: () => void,
    resume: () => void,
    existingId: string | null,
  ) {
    switch (action) {
      case "unlock":
        openUnlock(resume)
        break
      case "new-intent":
        void refreshQuote()
        break
      case "view-existing": {
        // Only ever offered when an id was actually resolved (see renderError),
        // so this can't be a button that quietly does nothing.
        if (!existingId) break
        setCreateError(null)
        setSignError(null)
        // On the submit path the duplicate IS our intent. On the create path
        // `create.onSuccess` never ran, so the id came out of the error and the
        // poll has to be pointed at it.
        if (existingId !== intentId) transfer.adoptIntent(existingId)
        setStep("status")
        break
      }
      case "setup-wallet":
        leaveFlow()
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

  /**
   * One error presenter for all three screens.
   *
   * Its job beyond rendering: decide whether the taxonomy's suggested action is
   * one this screen can actually honour. `view-existing` is the case that
   * matters — a `DUPLICATE_REQUEST` on the CREATE path arrives before
   * `create.onSuccess` has set an id, and the backend's documented contract
   * carries none, so offering "View status" there would be a button that
   * silently does nothing. When no id can be resolved the button is withheld
   * and the copy says plainly what the user can do instead.
   */
  const renderError = (error: unknown, retry: () => void, resume: () => void): React.ReactNode => {
    if (!error) return null
    const described = describeCryptoError(error)
    // The service's named id wins over the local one: after an edit-and-
    // re-review our `intentId` can be a different (superseded) operation, and
    // the duplicate is about whichever one the service says it is.
    const existingId = described.action === "view-existing" ? existingOperationIdFrom(error) ?? intentId ?? null : null
    const actionable = described.action !== "none" && (described.action !== "view-existing" || existingId !== null)
    return (
      <div className="flex flex-col gap-1.5">
        <SectionMessage
          error={error}
          onAction={actionable ? (action) => errorAction(action, retry, resume, existingId) : undefined}
        />
        {described.action === "view-existing" && !existingId ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The service didn&apos;t say which operation, so there&apos;s nothing to open here. Nothing was sent twice —
            check your <Link href="/transactions" className="font-semibold underline underline-offset-2">transaction
            history</Link> in a moment.
          </p>
        ) : null}
      </div>
    )
  }

  /* ── Chrome ────────────────────────────────────────────────────────────── */

  // Back means "the form" only when there is a review to back OUT of; on the
  // fall-through (review step, no quote) the form is already what's rendered.
  const steppedBack = step === "review" && intent && committed
  const backTarget: string | (() => void) = steppedBack ? () => setStep("form") : onClose ?? WALLET_HREF
  // In the modal the popup's own close button is the way out, so the back
  // arrow appears only when it means "back a step" — two controls that both
  // leave is one control too many.
  const showBack = steppedBack || !inModal
  const Shell = inModal ? "div" : FlowShell
  const shell = (body: React.ReactNode) => (
    <Shell>
      <div className={`flex items-start gap-2 ${inModal ? "mb-4" : "mb-5"}`}>
        {showBack ? <BackAction to={backTarget} /> : null}
        <FlowHeader direction="out" title="Send crypto" subtitle="Approved on this device — only you can send" />
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
    </Shell>
  )

  if (!isCryptoBackendEnabled) {
    return shell(
      <UnavailablePanel
        title="The Worldstreet wallet isn't enabled"
        tone="muted"
        reason="The new wallet is still rolling out and isn't switched on for your account yet."
      />,
    )
  }

  if (wallet.needsSetup) {
    return shell(
      <UnavailablePanel
        title="You don't have a Worldstreet wallet yet"
        tone="muted"
        reason="Create your Worldstreet wallet first — it only takes a minute."
        action={{ label: "Set up your wallet", onClick: leaveFlow }}
      />,
    )
  }

  if (wallet.isLoading || networks.isLoading || balances.isLoading) return shell(<FlowSkeleton />)

  if (wallet.error) {
    return shell(<SectionMessage error={wallet.error} onAction={() => void wallet.refetch()} />)
  }

  if (networkOptions.length === 0) {
    // An empty list here can mean the read failed, not that it succeeded with
    // nothing in it — those are different problems with different fixes, and
    // only the second one is actually "add a chain under Security".
    if (networks.isError && !networks.data) {
      return shell(<SectionMessage error={networks.error} onAction={() => void networks.refetch()} />)
    }
    return shell(
      <UnavailablePanel
        title="No network to send on"
        tone="muted"
        reason="None of your networks can accept a transfer right now. Add one under Security, or try again shortly."
        action={{ label: "Back to wallet", onClick: leaveFlow }}
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
        onLeave={onClose}
        // `createError` too: a quote failure can no longer strand a user here
        // (refreshQuote leaves this screen before it starts), but if one ever
        // reaches this branch it must be readable rather than invisible.
        errorSlot={renderError(signError ?? createError, () => void runSubmit(), () => void runSubmit())}
      />,
    )
  }

  /* ── Review ────────────────────────────────────────────────────────────── */

  if (step === "review" && intent && committed) {
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
        feeValue={feeRowValue(feePresentation, gasEstimate)}
        feeFallbackReason={feePresentation.kind === "self-paid-fallback" ? feePresentation.reason : null}
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
        errorSlot={renderError(
          createError ?? packageQuery.error,
          () => void refreshQuote(),
          () => void runSubmit(),
        )}
      />,
    )
  }

  // Review with no quote: only reachable WHILE one is being fetched, because a
  // failed `refreshQuote` sends the step back to the form. The skeleton is
  // therefore bounded by the request — it can never be indefinite.
  if (step === "review" && transfer.isLoading) return shell(<FlowSkeleton />)

  /* ── Form ──────────────────────────────────────────────────────────────── */
  /* Also the fall-through for a "review" step with nothing to review and
     nothing in flight: the form is the only honest screen then, and it renders
     `createError`. */

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
      errorSlot={renderError(createError, () => void startReview(), () => void startReview())}
      // Belt and braces alongside the pre-flight snapshot capture above: while
      // the intent create is in flight, nothing here should be editable —
      // there must be no window where a picker change can outrun what was
      // already captured for the review screen.
      disabled={transfer.isLoading}
    />,
  )
}
