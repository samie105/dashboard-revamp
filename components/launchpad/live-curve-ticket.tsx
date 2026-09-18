"use client"

/**
 * The real curve ticket — Phase 3.
 *
 * Every figure on it is the backend's quote, which is the curve program's own
 * math over live pool state. Nothing here reimplements the curve: if this
 * screen computed an output and the program computed another, the user would
 * see one number and get a different one.
 *
 * Flow is the swap's: quote → create intent → unlock if needed → sign on this
 * device → submit. The intent lives only as long as its quote.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CardShell, Segmented } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { QuoteClock } from "@/components/ui/quote-clock"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { useAuth } from "@/components/auth-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type {
  LaunchpadToken,
  LaunchpadTradeSide,
} from "@/lib/crypto-backend/types"
import { signSolanaIntent } from "@/lib/crypto-wallet"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"
import { cn } from "@/lib/utils"

const SOL_DECIMALS = 9
const QUOTE_TTL = 20
/** Above this, the impact row turns amber. A display threshold, not a limit. */
const IMPACT_WARN_BPS = 300

const SLIPPAGE = [
  { key: "50", label: "0.5%" },
  { key: "100", label: "1%" },
  { key: "300", label: "3%" },
]

export function fromBaseUnits(
  value: string,
  decimals: number,
  maxFraction = 6
) {
  const raw = BigInt(value)
  const scale = BigInt(10) ** BigInt(decimals)
  const whole = raw / scale
  // Past a thousand, more than two decimals is noise, not precision.
  const places = whole >= BigInt(1000) ? Math.min(2, maxFraction) : maxFraction
  const fraction = (raw % scale)
    .toString()
    .padStart(decimals, "0")
    .slice(0, places)
    .replace(/0+$/, "")
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Seconds until `iso`, ticking once a second. Null with no deadline. */
function useSecondsLeft(iso: string | undefined) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!iso) return
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [iso])
  if (!iso || now === null) return null
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000))
}

type Result = { ok: true; txHash?: string } | { ok: false; message: string }

export function LiveCurveTicket({
  token,
  platformFeeBps,
  tokenDecimals,
}: {
  token: LaunchpadToken
  platformFeeBps: number
  tokenDecimals: number
}) {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const walletPackage = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data),
    staleTime: 3 * 60_000,
  })

  const [side, setSide] = React.useState<LaunchpadTradeSide>("buy")
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState("100")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<Result | null>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const idempotencyKey = React.useRef<string | null>(null)

  const decimals = side === "buy" ? SOL_DECIMALS : tokenDecimals
  const baseUnits = React.useMemo(() => {
    const trimmed = amount.trim()
    if (!trimmed || !/^\d*\.?\d*$/.test(trimmed) || Number(trimmed) <= 0)
      return null
    const units = toBaseUnits(trimmed, decimals)
    return units && units !== "0" ? units : null
  }, [amount, decimals])
  const debounced = useDebounced(baseUnits, 400)

  const tradable = token.status === "live"
  const quote = useQuery({
    queryKey: ["launchpad", "quote", token.launchId, side, debounced, slippage],
    queryFn: ({ signal }) =>
      cryptoBackendClient.quoteLaunchpadTrade(
        token.launchId,
        { side, amount: debounced!, slippageBps: Number(slippage) },
        signal
      ),
    enabled: tradable && Boolean(debounced),
    // Re-read just before the quote would expire, never after.
    refetchInterval: (QUOTE_TTL - 3) * 1000,
    // Keep refreshing in a background tab too: a quote that ran out while
    // the user looked away must not come back looking live.
    refetchIntervalInBackground: true,
    retry: false,
  })
  const q = debounced && debounced === baseUnits ? quote.data : undefined
  const seconds = useSecondsLeft(q?.expiresAt)
  // An expired quote is not a quote: it can't be traded on until replaced.
  const expired = seconds === 0

  const outDecimals = side === "buy" ? tokenDecimals : SOL_DECIMALS
  const outUnit = side === "buy" ? token.symbol : "SOL"
  const inUnit = side === "buy" ? "SOL" : token.symbol

  async function execute() {
    if (!q || !baseUnits || busy || expired) return
    if (!user || !wallet.data || !walletPackage.data) {
      setResult({ ok: false, message: "Your wallet isn't ready yet." })
      return
    }
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) {
      setUnlockOpen(true)
      return
    }
    const account = wallet.data.accounts.find(
      (a) => a.chainFamily === "solana" && a.state === "active"
    )
    if (!account?.id) {
      setResult({ ok: false, message: "Your Solana account isn't ready yet." })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const key =
        idempotencyKey.current ?? (idempotencyKey.current = crypto.randomUUID())
      const { intent } = await cryptoBackendClient.createLaunchpadTradeIntent(
        token.launchId,
        {
          side,
          amount: baseUnits,
          slippageBps: Number(slippage),
          idempotencyKey: key,
        }
      )
      const signed = await signSolanaIntent(
        user.userId,
        wallet.data.id,
        walletPackage.data,
        intent,
        account.id
      )
      const submitted = await cryptoBackendClient.submitIntent(
        intent.id,
        signed
      )
      setResult({ ok: true, txHash: submitted.txHash })
      idempotencyKey.current = null
      setAmount("")
    } catch (error) {
      setResult({
        ok: false,
        message: formatWalletActionError(
          error,
          "solana",
          side === "buy" ? "SOL" : token.symbol
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  if (!tradable) {
    return (
      <CardShell className={cn(CARD_HUE, "flex flex-col gap-2 p-5")}>
        <span className="text-[14px] font-semibold">
          {token.status === "graduated" || token.status === "graduating"
            ? "This token has left the curve"
            : "Not open for trading yet"}
        </span>
        <span className="text-[12.5px] leading-relaxed text-muted-foreground">
          {token.status === "graduated" || token.status === "graduating"
            ? "It reached its target and its liquidity moved to the open market. Curve trading is closed."
            : "Trading opens once the launch is confirmed on Solana."}
        </span>
      </CardShell>
    )
  }

  const impactWarn = q ? q.priceImpactBps >= IMPACT_WARN_BPS : false
  const cta = busy
    ? "Signing…"
    : !baseUnits
      ? `Enter an amount of ${inUnit}`
      : !q || expired
        ? quote.isFetching || expired
          ? "Getting a quote…"
          : "No quote yet"
        : side === "buy"
          ? `Buy ${token.symbol}`
          : `Sell ${token.symbol}`

  return (
    <CardShell className={cn(CARD_HUE, "flex flex-col gap-4 p-5")}>
      <Segmented
        options={[
          { key: "buy", label: "Buy" },
          { key: "sell", label: "Sell" },
        ]}
        value={side}
        onChange={(next) => {
          setSide(next as LaunchpadTradeSide)
          setAmount("")
          setResult(null)
          idempotencyKey.current = null
        }}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">
          {side === "buy" ? "You spend" : "You sell"}
        </span>
        <span className="flex h-12 items-center gap-2 rounded-xl bg-foreground/[0.05] px-3.5 focus-within:ring-2 focus-within:ring-primary/40">
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(",", "."))
              setResult(null)
              idempotencyKey.current = null
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-[18px] font-semibold tabular-nums outline-none placeholder:text-muted-foreground/50"
          />
          <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
            {inUnit}
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">Max slippage</span>
        <Segmented
          size="sm"
          options={SLIPPAGE}
          value={slippage}
          onChange={setSlippage}
        />
      </div>

      {quote.error && baseUnits && (
        <p
          role="alert"
          className="rounded-xl bg-debit/10 px-3 py-2 text-[12px] text-debit"
        >
          {formatWalletActionError(quote.error, "solana")}
        </p>
      )}

      {q && (
        <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.05] p-3.5">
          <div className="flex items-center gap-3">
            <QuoteClock
              seconds={seconds}
              total={QUOTE_TTL}
              refreshing={quote.isFetching}
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[12.5px] font-semibold">Live quote</span>
              <span className="text-[11px] text-muted-foreground">
                From the curve, refreshed before it expires
              </span>
            </span>
          </div>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            <Row
              label="You receive"
              value={`${fromBaseUnits(q.expectedOut, outDecimals)} ${outUnit}`}
              strong
            />
            <Row
              label="Minimum received"
              value={`${fromBaseUnits(q.minimumOut, outDecimals)} ${outUnit}`}
            />
            <Row
              label="Price impact"
              value={`${(q.priceImpactBps / 100).toFixed(2)}%`}
              warn={impactWarn}
            />
            <Row
              label="Curve fee (1%)"
              value={`${fromBaseUnits(q.curveFee, side === "buy" ? SOL_DECIMALS : tokenDecimals)} ${inUnit}`}
            />
            {platformFeeBps > 0 && (
              <Row
                label={`WorldStreet fee (${platformFeeBps / 100}%)`}
                value={`${fromBaseUnits(q.platformFeeLamports, SOL_DECIMALS)} SOL`}
              />
            )}
          </dl>
        </div>
      )}

      <button
        type="button"
        disabled={!q || busy || expired}
        onClick={execute}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
          q && !busy && !expired
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-foreground/[0.08] text-muted-foreground"
        )}
      >
        {cta}
      </button>

      {result && (
        <p
          role="status"
          className={cn(
            "rounded-xl px-3 py-2 text-[12px] leading-relaxed",
            result.ok ? "bg-credit/10 text-credit" : "bg-debit/10 text-debit"
          )}
        >
          {result.ok
            ? `Sent to Solana.${result.txHash ? ` Transaction ${result.txHash.slice(0, 8)}…` : ""} Your balance updates once it confirms.`
            : result.message}
        </p>
      )}

      <WalletUnlockDialog
        action="swap"
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => void execute()}
      />
    </CardShell>
  )
}

function Row({
  label,
  value,
  strong,
  warn,
}: {
  label: string
  value: string
  strong?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "text-[13.5px] font-semibold" : "font-medium",
          warn && "text-warning"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
