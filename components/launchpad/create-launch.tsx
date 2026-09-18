"use client"

/**
 * Launchpad Phase 2 — create a launch, for real.
 *
 * Landscape, like the preview it replaces: the form on the left; on the
 * right, continuously, what the launch costs. Every figure on the right comes
 * from GET /launchpad/terms, which reads the on-chain config the launch will
 * use — the threshold, the supply, the fee, and what the creator's allocation
 * costs, quoted by the curve program. Nothing here is a placeholder.
 *
 * Launch = draft → deploy (the server builds the transaction and co-signs the
 * new token's address) → sign on this device → submit. The launch then has
 * its own status screen at ?launch=<id>, read from the server, so closing the
 * tab loses nothing.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { CardShell, PageHeader, SectionRule } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { StatusScreen } from "@/components/ui/flow"
import {
  cryptoBackendClient,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { LaunchpadToken } from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { cn } from "@/lib/utils"
import { fromBaseUnits } from "./live-curve-ticket"
import { useSolanaSigner } from "./use-solana-signer"

const SOL = 9
/** Solana's base fee per signature — a chain constant. */
const SIGNATURE_FEE_LAMPORTS = BigInt(5_000)
const ALLOCATION_STEP_BPS = 50

/* The server enforces these (src/launchpad/rules.ts); the form mirrors them so
   a creator finds out while typing, not after pressing Launch. */
const RESERVED = new Set([
  "SOL",
  "WSOL",
  "USDC",
  "USDT",
  "BTC",
  "WBTC",
  "ETH",
  "WETH",
  "BNB",
  "TRX",
  "TON",
  "SUI",
  "ARB",
  "JUP",
  "BONK",
  "RAY",
  "PYTH",
  "JTO",
  "WIF",
  "DAI",
  "PYUSD",
  "USDE",
  "WS",
  "WORLDSTREET",
])

type Form = {
  name: string
  symbol: string
  description: string
  website: string
  x: string
  telegram: string
  creatorBps: number
}

const EMPTY: Form = {
  name: "",
  symbol: "",
  description: "",
  website: "",
  x: "",
  telegram: "",
  creatorBps: 0,
}

function problemsOf(f: Form): Partial<Record<keyof Form, string>> {
  const p: Partial<Record<keyof Form, string>> = {}
  const name = f.name.trim()
  const symbol = f.symbol.trim().replace(/^\$/, "").toUpperCase()
  if (name && (name.length < 2 || name.length > 32)) p.name = "2–32 characters"
  if (symbol) {
    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) p.symbol = "2–10 letters or digits"
    else if (RESERVED.has(symbol)) p.symbol = `${symbol} is reserved`
  }
  if (f.description.length > 500) p.description = "500 characters at most"
  for (const key of ["website", "x", "telegram"] as const) {
    const v = f[key].trim()
    if (!v) continue
    try {
      if (new URL(v).protocol !== "https:") throw new Error()
    } catch {
      p[key] = "Must be an https:// link"
    }
  }
  return p
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

export function CreateLaunch() {
  const params = useSearchParams()
  const launchId = params.get("launch")
  return launchId ? <LaunchStatus launchId={launchId} /> : <LaunchForm />
}

/* ── The form ──────────────────────────────────────────────────────────── */

function LaunchForm() {
  const router = useRouter()
  const signer = useSolanaSigner()
  const [form, setForm] = React.useState<Form>(EMPTY)
  const [busy, setBusy] = React.useState<null | "draft" | "deploy" | "sign">(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const idempotencyKey = React.useRef<string | null>(null)

  const availability = useQuery({
    queryKey: ["launchpad", "availability"],
    queryFn: ({ signal }) =>
      cryptoBackendClient.getLaunchpadAvailability(signal),
    enabled: isCryptoBackendEnabled,
    refetchInterval: 60_000,
  })
  const solana = availability.data?.solana
  const paused = solana?.state === "paused"

  const bps = useDebounced(form.creatorBps, 250)
  const terms = useQuery({
    queryKey: ["launchpad", "terms", bps],
    queryFn: ({ signal }) => cryptoBackendClient.getLaunchpadTerms(bps, signal),
    enabled: isCryptoBackendEnabled,
    placeholderData: (previous) => previous,
  })
  const t = terms.data
  const settled = t?.creatorBps === form.creatorBps

  const mine = useQuery({
    queryKey: ["launchpad", "mine"],
    queryFn: ({ signal }) => cryptoBackendClient.listMyLaunches(signal),
    enabled: isCryptoBackendEnabled,
  })
  const inFlight = mine.data?.find((l) => l.status === "deploying")

  const problems = problemsOf(form)
  const complete =
    form.name.trim().length >= 2 && form.symbol.trim().length >= 2
  const canLaunch =
    complete &&
    Object.keys(problems).length === 0 &&
    !paused &&
    Boolean(t) &&
    settled &&
    !busy

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
    idempotencyKey.current = null // a changed form is a different launch
  }

  const allocationLamports = t && settled ? BigInt(t.creatorLamports) : null
  const rentLamports = t ? BigInt(t.networkRentLamports) : null
  const total =
    allocationLamports !== null && rentLamports !== null
      ? allocationLamports + rentLamports + SIGNATURE_FEE_LAMPORTS
      : null

  function launch() {
    signer.run(async () => {
      if (!canLaunch) return
      setError(null)
      try {
        const key =
          idempotencyKey.current ??
          (idempotencyKey.current = crypto.randomUUID())
        setBusy("draft")
        const draft = await cryptoBackendClient.createLaunchDraft({
          name: form.name.trim(),
          symbol: form.symbol.trim().replace(/^\$/, "").toUpperCase(),
          description: form.description.trim() || undefined,
          creatorBps: form.creatorBps,
          links: {
            website: form.website.trim() || undefined,
            x: form.x.trim() || undefined,
            telegram: form.telegram.trim() || undefined,
          },
          idempotencyKey: key,
        })
        setBusy("deploy")
        // No idempotency key: the server makes deploy idempotent by the
        // launch's own state (an in-flight deploy returns its intent), and a
        // retry after expiry must be free to build a new one.
        const { intent } = await cryptoBackendClient.deployLaunch(
          draft.launchId
        )
        setBusy("sign")
        if (intent.status === "awaiting_signature")
          await signer.signAndSubmit(intent)
        router.replace(
          `/launchpad/create?launch=${encodeURIComponent(draft.launchId)}`
        )
      } catch (e) {
        setError(formatWalletActionError(e, "solana", "SOL"))
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Launch a token"
        subtitle="It starts on a bonding curve and graduates to the open market once the curve fills."
        back="/launchpad"
      />

      {inFlight && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
          <span className="min-w-0 flex-1 text-[13px]">
            <span className="font-semibold">
              ${inFlight.symbol} is still launching.
            </span>
          </span>
          <Link
            href={`/launchpad/create?launch=${encodeURIComponent(inFlight.launchId)}`}
            className="rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            Open it
          </Link>
        </div>
      )}

      {paused && (
        <div
          role="status"
          className="rounded-2xl border border-warning/30 bg-warning-chip px-4 py-3"
        >
          <p className="text-[13px] font-semibold text-warning">
            Solana launches are paused
          </p>
          <p className="text-[12.5px] leading-relaxed text-foreground/85">
            {solana?.reason ?? "No reason was given."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <CardShell
          className={cn(CARD_HUE, "flex min-w-0 flex-col gap-5 p-5 sm:p-6")}
        >
          <Field
            label="Name"
            hint="What people see in the feed"
            error={problems.name}
          >
            <input
              value={form.name}
              maxLength={32}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ember"
              className={INPUT}
            />
          </Field>
          <Field
            label="Symbol"
            hint="2–10 letters or digits"
            error={problems.symbol}
          >
            <input
              value={form.symbol}
              maxLength={11}
              onChange={(e) => set("symbol", e.target.value.toUpperCase())}
              placeholder="EMBR"
              className={cn(INPUT, "uppercase")}
            />
          </Field>
          <Field
            label="Description"
            hint="Optional"
            error={problems.description}
          >
            <textarea
              value={form.description}
              maxLength={500}
              rows={3}
              onChange={(e) => set("description", e.target.value)}
              className={cn(INPUT, "h-auto py-2.5")}
            />
          </Field>

          <SectionRule label="Links" note="Optional" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Website" error={problems.website}>
              <input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
                className={INPUT}
              />
            </Field>
            <Field label="X" error={problems.x}>
              <input
                value={form.x}
                onChange={(e) => set("x", e.target.value)}
                placeholder="https://x.com/…"
                className={INPUT}
              />
            </Field>
            <Field label="Telegram" error={problems.telegram}>
              <input
                value={form.telegram}
                onChange={(e) => set("telegram", e.target.value)}
                placeholder="https://t.me/…"
                className={INPUT}
              />
            </Field>
          </div>

          <SectionRule label="Your allocation" />
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">
                Tokens you buy at launch
              </span>
              <span className="text-[15px] font-semibold tabular-nums">
                {(form.creatorBps / 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={t?.maxCreatorBps ?? 2000}
              step={ALLOCATION_STEP_BPS}
              value={form.creatorBps}
              onChange={(e) => set("creatorBps", Number(e.target.value))}
              aria-label="Creator allocation"
              className="w-full accent-primary"
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Bought off the curve at the launch price, in the same transaction
              that creates the token. There is no vesting: everyone can see your
              share, and you can sell it.
            </p>
          </div>
        </CardShell>

        <div className="flex min-w-0 flex-col gap-4">
          <CardShell className={cn(CARD_HUE, "flex flex-col gap-4 p-5")}>
            <span className="text-[13px] font-semibold">What it costs</span>
            {terms.error && !t ? (
              <p role="alert" className="text-[12.5px] text-debit">
                {formatWalletActionError(terms.error, "solana")}
              </p>
            ) : (
              <dl className="flex flex-col gap-1.5 text-[12.5px]">
                <Row
                  label={`Your allocation (${(form.creatorBps / 100).toFixed(1)}%)`}
                  value={
                    allocationLamports === null
                      ? "…"
                      : `${fromBaseUnits(allocationLamports.toString(), SOL, 4)} SOL`
                  }
                />
                <Row
                  label="Network rent"
                  value={
                    rentLamports === null
                      ? "…"
                      : `${fromBaseUnits(rentLamports.toString(), SOL, 4)} SOL`
                  }
                />
                <Row label="Network fee" value="0.000005 SOL" />
                <div className="my-1 h-px bg-border/50" />
                <Row
                  label="Total"
                  value={
                    total === null
                      ? "…"
                      : `${fromBaseUnits(total.toString(), SOL, 4)} SOL`
                  }
                  strong
                />
              </dl>
            )}
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              No creation fee. Your allocation is quoted by the curve program at
              the launch price, so this is what the launch transaction buys.
              Solana checks the whole bill before you sign.
            </p>
          </CardShell>

          <CardShell className={cn(CARD_HUE, "flex flex-col gap-3 p-5")}>
            <span className="text-[13px] font-semibold">The curve</span>
            <dl className="flex flex-col gap-1.5 text-[12.5px]">
              <Row
                label="Total supply"
                value={
                  t
                    ? `${fromBaseUnits(t.totalSupply, t.tokenDecimals, 0)}`
                    : "…"
                }
              />
              <Row
                label="Sold on the curve"
                value={
                  t?.curveSupply
                    ? fromBaseUnits(t.curveSupply, t.tokenDecimals, 0)
                    : "…"
                }
              />
              <Row
                label="Graduates at"
                value={
                  t
                    ? `${fromBaseUnits(t.graduationLamports, SOL, 0)} SOL raised`
                    : "…"
                }
              />
              <Row
                label="Fee on every trade"
                value={t ? `${t.tradingFeeBps / 100}%` : "…"}
              />
              <Row
                label="Liquidity after graduation"
                value="Locked permanently"
              />
            </dl>
          </CardShell>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-debit/10 px-3 py-2 text-[12.5px] leading-relaxed text-debit"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canLaunch}
            onClick={launch}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
              canLaunch
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-foreground/[0.08] text-muted-foreground"
            )}
          >
            {busy === "draft"
              ? "Saving…"
              : busy === "deploy"
                ? "Building the launch…"
                : busy === "sign"
                  ? "Signing…"
                  : paused
                    ? "Solana launches are paused"
                    : Object.keys(problems).length > 0
                      ? "Fix the fields marked in red"
                      : total !== null && complete
                        ? `Launch for ${fromBaseUnits(total.toString(), SOL, 4)} SOL`
                        : "Fill in a name and symbol"}
          </button>
        </div>
      </div>
      {signer.dialog}
    </div>
  )
}

/* ── The launch's own status screen ─────────────────────────────────────── */

const STAGES = [
  { key: "signed", label: "Signed on this device" },
  { key: "sent", label: "Sent to Solana" },
  { key: "confirmed", label: "Confirmed: token and curve created" },
  { key: "open", label: "Open for trading" },
]

function LaunchStatus({ launchId }: { launchId: string }) {
  const signer = useSolanaSigner()
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const launch = useQuery({
    queryKey: ["launchpad", "mine", launchId],
    queryFn: ({ signal }) => cryptoBackendClient.getMyLaunch(launchId, signal),
    enabled: isCryptoBackendEnabled,
    // Poll while it is in flight; the reconciler moves it within ~30s.
    refetchInterval: (q) => {
      const s = (q.state.data as LaunchpadToken | undefined)?.status
      return s === "deploying" || s === "draft" ? 4_000 : false
    },
  })

  /** Deploy is idempotent: while a deploy is in flight this returns the same
   *  intent; after a failure it builds a new one (with a new token address). */
  function continueOrRetry() {
    signer.run(async () => {
      setBusy(true)
      setError(null)
      try {
        const { intent } = await cryptoBackendClient.deployLaunch(launchId)
        if (intent.status === "awaiting_signature")
          await signer.signAndSubmit(intent)
        await launch.refetch()
      } catch (e) {
        setError(formatWalletActionError(e, "solana", "SOL"))
      } finally {
        setBusy(false)
      }
    })
  }

  const l = launch.data
  if (!l) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Your launch" back="/launchpad/create" />
        <CardShell
          className={cn(CARD_HUE, "p-6 text-[13px] text-muted-foreground")}
        >
          {launch.error ? "We couldn't find this launch." : "Loading…"}
        </CardShell>
      </div>
    )
  }

  const onChain =
    l.status === "live" || l.status === "graduating" || l.status === "graduated"
  const failed = l.status === "failed"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`$${l.symbol}`} subtitle={l.name} back="/launchpad" />
      <CardShell className={cn(CARD_HUE, "p-2 sm:p-4 lg:p-6")}>
        <StatusScreen
          state={onChain ? "success" : failed ? "failure" : "processing"}
          headline={
            onChain
              ? `$${l.symbol} is live`
              : failed
                ? "The launch didn't go through"
                : l.status === "draft"
                  ? "Not launched yet"
                  : `Creating $${l.symbol}`
          }
          caption={
            onChain
              ? `The curve is open and $${l.symbol} can be bought and sold.${l.allocation.creatorBps > 0 ? ` Your ${(l.allocation.creatorBps / 100).toFixed(1)}% is in your wallet.` : ""}`
              : failed
                ? `${l.failureReason ?? "Nothing was created."} A launch is all or nothing: nothing was taken except, at most, the network fee.`
                : l.status === "draft"
                  ? "It was saved but never signed. Continue to sign it."
                  : "It's with Solana. You can close this page: the launch carries on, and this screen picks it up when you come back."
          }
          stages={STAGES}
          activeIndex={
            onChain ? STAGES.length : failed ? 2 : l.status === "draft" ? 0 : 2
          }
          autoUpdating={l.status === "deploying"}
          primary={
            onChain
              ? {
                  label: `Open $${l.symbol}`,
                  href: `/launchpad/${encodeURIComponent(l.launchId)}`,
                }
              : failed || l.status === "draft"
                ? {
                    label: busy
                      ? "Working…"
                      : failed
                        ? "Try again"
                        : "Continue",
                    onClick: busy ? undefined : continueOrRetry,
                  }
                : undefined
          }
          secondary={
            onChain || failed
              ? { label: "Launch another", href: "/launchpad/create" }
              : undefined
          }
        />
        {l.status === "deploying" && (
          <p className="px-4 pb-2 text-center text-[12px] text-muted-foreground">
            Closed the signing step before finishing?{" "}
            <button
              type="button"
              onClick={continueOrRetry}
              disabled={busy}
              className="font-semibold text-primary hover:opacity-80"
            >
              Continue signing
            </button>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mx-4 mb-2 rounded-xl bg-debit/10 px-3 py-2 text-[12.5px] text-debit"
          >
            {error}
          </p>
        )}
      </CardShell>
      {signer.dialog}
    </div>
  )
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

const INPUT =
  "h-11 w-full min-w-0 rounded-xl bg-foreground/[0.05] px-3.5 text-[14px] outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/40"

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium">{label}</span>
        {hint && !error && (
          <span className="text-[11.5px] text-muted-foreground">{hint}</span>
        )}
        {error && (
          <span className="text-[11.5px] font-medium text-debit">{error}</span>
        )}
      </span>
      {children}
    </label>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "text-[14px] font-semibold" : "font-medium"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
