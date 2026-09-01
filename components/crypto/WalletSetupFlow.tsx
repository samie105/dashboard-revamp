"use client"

/**
 * Self-custody setup, as a guided flow (spec §3): Intro → Passphrase →
 * Creating → Done → Recovery.
 *
 * ── One modal, five steps ──────────────────────────────────────────────────
 * The whole ceremony is a single dialog over the wallet page, which stays
 * behind it under the backdrop's blur (and, before there is a wallet, holds
 * `WalletSkeleton` so there is something to be behind it). Two things follow
 * from it being ONE dialog rather than a card plus a second dialog:
 *
 *  · The recovery secret is the last STEP, not a modal stacked on the last
 *    screen. It used to derive its own dialog straight off the mutation, so
 *    it opened on the same tick the "Your wallet is ready" screen did and the
 *    user got both at once. Now the ready screen asks for it.
 *  · Dismissal is decided in one place (`dismissible`). It is live while this
 *    is only an invitation and dead from the moment a wallet is being made,
 *    which is what stops the one-time secret being escaped away.
 *
 * ── The mount contract (read before restructuring anything) ────────────────
 * `ModernWalletPage` renders this at a FIXED child position and mounts it
 * UNCONDITIONALLY, passing `walletExists`. Two consequences bind this file:
 *
 *  1. Everything the user can only be shown once — the recovery secret, the
 *     staged progress of the attempt in flight — lives in THIS instance's
 *     state and mutation. It must survive the creation transition, so the
 *     component may never require an unmount/remount to change screens.
 *  2. `walletExists` suppresses the idle INVITATION, not the flow. Creation
 *     invalidates the wallet query the moment it succeeds, so the prop flips
 *     true mid-ceremony; if that also closed the Creating/Done/Recovery steps
 *     the secret would vanish at exactly the wrong moment. `committed` below
 *     is what keeps the flow on screen once it starts.
 *
 * Secrets: the passphrase and the recovery secret are never logged, never put
 * in a query key, and never sent anywhere — the passphrase is cleared from
 * state as soon as the wallet exists.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  ComputerIcon,
  Copy01Icon,
  DatabaseLockedIcon,
  DiceIcon,
  Download01Icon,
  Key01Icon,
  Shield01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons"

import { useModernWalletSetup } from "@/hooks/crypto/useModernWalletSetup"
import { AddressPill, SectionMessage } from "@/components/crypto/primitives"
import { Input } from "@/components/ui/input"
import {
  FlowCta,
  InlineNotice,
  UnavailablePanel,
  useStageProgress,
  type Stage,
} from "@/components/ui/flow"
import { SetupCeremony } from "@/components/crypto/SetupCeremony"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { CardShell, EmptyState, ListRow, Rise, WeightBar } from "@/components/ui/system"
import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { passphraseStrength } from "@/lib/crypto-wallet/passphrase-strength"
import type { WalletSetupStage } from "@/lib/crypto-wallet/wallet-setup"

type Step = "intro" | "passphrase" | "creating" | "done" | "recovery" | "closed"

/** In the order `createSelfCustodialWallet` actually runs them — the backend
 *  wallet and its accounts exist before there is anything to generate keys
 *  for. A checklist that claimed otherwise would tick "keys" while the client
 *  was still talking to the service, and `useStageProgress`'s high-water mark
 *  would then swallow the real key-generation report. */
const SETUP_STAGES: Stage[] = [
  { key: "account", label: "Setting up your accounts" },
  { key: "keys", label: "Creating your wallet on this device" },
  { key: "encrypt", label: "Locking it with your passphrase" },
  { key: "commit", label: "Saving your locked wallet" },
]

const INTRO_POINTS = [
  { icon: ComputerIcon, text: "Your wallet is created on this device" },
  { icon: DatabaseLockedIcon, text: "Worldstreet can't open it — not even our team" },
  { icon: Key01Icon, text: "Your passphrase and recovery secret are the only ways in" },
]

const FAMILY_LABEL: Record<string, string> = {
  evm: "Ethereum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

/** Word pool for the suggested passphrase. Short, concrete, easy-to-type
 *  words — the phrase is meant to be memorable, and its strength comes from
 *  five independent draws (244^5 ≈ 2^39.7) plus a two-digit tail, hardened
 *  further by the 600k-iteration key derivation. */
const PASSPHRASE_WORDS = (
  "acorn amber anchor apple arrow autumn badge baker bamboo basil beach beacon berry birch blaze bloom " +
  "bluff board bonus boots bounce brave bread breeze brick bridge bright brook brush bucket butter cabin " +
  "cactus camel candle canoe canyon carbon cargo carrot castle cedar chalk charm cherry chess chief chime " +
  "cider circle citrus clover cobalt cocoa comet copper coral cotton cove crane cream crisp crown cypress " +
  "daisy dawn delta denim desert dew diamond dome drift dune eagle early earth ember engine falcon fable " +
  "feather fern field fig flame flint flora forest fossil fox frost galaxy garden gecko ginger glacier glade " +
  "globe gold goose grape grove hazel harbor hawk heron hill honey horizon iceberg indigo iris island ivory " +
  "jade jasper jungle juniper kayak kettle koala lagoon lake lantern laurel lemon lily linen lunar maple " +
  "marble meadow melon mesa mint mirror monsoon moss mountain mango napkin nectar nickel night nimbus north " +
  "oak oasis ocean olive onyx opal orbit orchid otter owl oyster palm panda paper peach pearl pebble pecan " +
  "penguin pepper petal pine pistachio planet plum pocket polar pond poppy prairie prism pumpkin quartz " +
  "quill rain raven reef ridge river robin rocket rose rustic saffron sage salmon sand sapphire scarlet " +
  "shell silver sketch sleet slope smoke snow solar sparrow spice spring spruce stone storm summit sunny " +
  "swan tang teak tempo terra thyme tiger timber topaz torch trail tulip tundra turtle twilight umber " +
  "valley vanilla velvet vine violet wagon walnut water willow winter wolf wren yarrow zebra zephyr zinc"
).split(/\s+/)

/** Five uniformly drawn words plus a two-digit tail, via rejection-sampled
 *  crypto randomness — Math.random has no place near a wallet credential. */
function generatePassphrase(): string {
  const draw = (bound: number) => {
    const limit = Math.floor(256 / bound) * bound
    const byte = new Uint8Array(1)
    for (;;) {
      crypto.getRandomValues(byte)
      if (byte[0] < limit) return byte[0] % bound
    }
  }
  const words = Array.from({ length: 5 }, () => PASSPHRASE_WORDS[draw(PASSPHRASE_WORDS.length)])
  return `${words.join("-")}-${draw(10)}${draw(10)}`
}

/** Plain full-width pill. Gold's breathing glow belongs to the money CTA
 *  (FlowCta's armed state); these secondary confirmations don't move money. */
const PILL =
  "flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
/** The app's sunken field (RecoveryPanel's FIELD), applied over the base
 *  Input: taller, softer, ring instead of border — the bordered shadcn
 *  default reads like a wireframe against this card. */
const FIELD_INPUT =
  "h-11 rounded-xl border-0 bg-surface-sunken/70 px-3.5 text-[13px] ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-surface-sunken/70"

const ShieldGlyph = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={Shield01Icon} className={className} />
)

/* HTTPS is a hard requirement of `createSelfCustodialWallet` (WebCrypto), and
   the flag only exists in the browser. Read through useSyncExternalStore
   rather than an effect: the server snapshot assumes a secure origin, so a
   normal page never flashes the panel, and the value can't change while the
   document is open — hence a subscribe that never fires. */
const neverChanges = () => () => {}
const readSecureContext = () => window.isSecureContext !== false
const assumeSecureOnServer = () => true

/** The freshly committed package's canonical address per chain family. Read
 *  defensively: `accounts` is `unknown[]` on the document type, and this
 *  screen would rather show fewer rows than throw on the success screen. */
function packageAddresses(pkg: CryptoWalletPackageDocument | undefined) {
  if (!pkg || !Array.isArray(pkg.accounts)) return []
  return pkg.accounts.flatMap((entry, index) => {
    if (typeof entry !== "object" || entry === null) return []
    const { family, canonicalAddress, accountId } = entry as {
      family?: unknown
      canonicalAddress?: unknown
      accountId?: unknown
    }
    if (typeof family !== "string" || typeof canonicalAddress !== "string" || !canonicalAddress) return []
    return [{
      key: typeof accountId === "string" ? accountId : `${family}:${index}`,
      family,
      address: canonicalAddress,
    }]
  })
}

/* ── The one-time recovery secret ──────────────────────────────────────────
   The LAST step of the ceremony, not a second dialog stacked on the finished
   one. It used to derive its own modal straight off the mutation result,
   which meant it opened the instant creation resolved — on top of the "Your
   wallet is ready" screen that resolved at the same moment, so the user met
   both at once and read neither.

   Blocking is still the contract: this is the only time the secret is ever
   displayed. The step it belongs to refuses every dismissal path, and the
   only way past it is the confirmation checkbox plus the button under it. ─ */

function RecoverySecretPanel({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <>
      {/* The secret and its two actions are one object — a sunken panel
          with the controls attached, not three loose blocks. */}
      <div className="flex flex-col rounded-xl bg-surface-sunken/70 p-1.5 ring-1 ring-border/25">
        <code className="block max-h-40 select-all overflow-auto break-all rounded-lg px-3 py-3.5 text-center font-mono text-[13px] leading-6">
          {secret}
        </code>
        <div className="flex gap-1 border-t border-border/15 pt-1.5">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(secret).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }).catch(() => {})
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${copied ? "text-credit" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <HugeiconsIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([secret], { type: "text/plain" })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement("a")
              anchor.href = url
              anchor.download = "worldstreet-wallet-recovery-secret.txt"
              anchor.click()
              URL.revokeObjectURL(url)
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Download01Icon} className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>

      <InlineNotice tone="warning">
        Keep it offline. Worldstreet cannot show it again, reissue it, or recover your wallet without it.
      </InlineNotice>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-surface-sunken/40 p-3 text-[13px] leading-snug ring-1 ring-border/20 transition-colors hover:bg-surface-sunken/70">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span>I have saved this recovery secret somewhere secure and offline.</span>
      </label>
      <button type="button" disabled={!saved} onClick={onDone} className={PILL}>
        I saved it — continue
      </button>
    </>
  )
}

/** Opt-in modern wallet setup. The legacy WalletProvider remains untouched. */
export function WalletSetupFlow({
  walletExists = false,
  resume = false,
  onVisibilityChange,
}: {
  walletExists?: boolean
  /** The wallet exists but its encrypted package doesn't — an interrupted
   *  setup. Opens straight at the passphrase step with a warning, and keeps
   *  the card visible even though `walletExists` is true. */
  resume?: boolean
  /** Reports whether the ceremony currently owns the page. Creation flips
   *  `walletExists` true mid-flow, so without this the finished wallet would
   *  render BEHIND the "Your wallet is ready → Open your wallet" screen and
   *  that button would point at something already on screen. The page hides
   *  its body while this is true; dismissing the flow reveals it. */
  onVisibilityChange?: (visible: boolean) => void
}) {
  const setup = useModernWalletSetup()
  // `null` until the user steers: the landing step is then derived, so a
  // resume that only becomes known once the package query settles moves an
  // untouched flow to the passphrase step without an effect racing the render.
  const [chosenStep, setChosenStep] = useState<Step | null>(null)
  const [secretAcknowledged, setSecretAcknowledged] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("")
  const [passphraseRevealed, setPassphraseRevealed] = useState(false)
  const [passphraseCopied, setPassphraseCopied] = useState(false)
  /** Counts generated phrases, purely so the field's flash can be re-keyed. */
  const [generated, setGenerated] = useState(0)
  const [stage, setStage] = useState<WalletSetupStage | null>(null)
  const [attempt, setAttempt] = useState(0)
  const secureContext = useSyncExternalStore(neverChanges, readSecureContext, assumeSecureOnServer)

  const step: Step = chosenStep ?? (resume ? "passphrase" : "intro")
  const setStep = setChosenStep
  // The secret exists ONLY in this mutation result and dies with this
  // instance, so it is read straight off the mutation rather than mirrored
  // into state — one less way for the user's only copy to be lost to a render
  // ordering bug. It is owed until they confirm they've saved it, and that
  // debt is what makes the flow refuse to close.
  const pendingSecret = Boolean(setup.data?.recoverySecret) && !secretAcknowledged

  // Closing the tab costs something from the moment the backend wallet exists:
  // mid-creation it strands a wallet with no package (the interruption the
  // resume path exists to repair), and after creation it takes the recovery
  // secret with it, which nothing can reissue. Both windows are guarded.
  useEffect(() => {
    if (step !== "creating" && !pendingSecret) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [step, pendingSecret])

  const strength = passphraseStrength(passphrase)
  const mismatch = passphraseConfirmation.length > 0 && passphrase !== passphraseConfirmation
  const blocker =
    strength.score === 0 ? "At least 12 characters"
      : passphrase !== passphraseConfirmation ? "Passphrases don't match"
      : null

  const rawStageIndex = stage ? SETUP_STAGES.findIndex((item) => item.key === stage) : 0
  const progress = useStageProgress(Math.max(0, rawStageIndex), attempt)
  const addresses = useMemo(() => packageAddresses(setup.data?.package), [setup.data])

  // Suppression is the PROP's job, never the mount's — and only over the idle
  // invitation. Once the ceremony starts (or the secret is owed) this flow
  // owns the screen until the user finishes it.
  const committed = step === "creating" || step === "done" || step === "recovery" || pendingSecret
  const invited = !walletExists || resume
  const open = setup.isReady && step !== "closed" && (committed || invited)
  // Escape, the backdrop and the close button are all live while this is only
  // an invitation — nothing has happened yet and trapping someone on a page
  // they wandered onto would be rude. They all go dead the moment a wallet is
  // being made: from there the only ways on are the flow's own buttons, which
  // is what stops the recovery secret being dismissed into oblivion.
  const dismissible = !committed

  // Announced from an effect, not during render: the parent decides what to
  // put behind this off it, and a setState mid-render would be a
  // cross-component write.
  useEffect(() => {
    onVisibilityChange?.(open)
  }, [open, onVisibilityChange])

  async function createWallet() {
    if (blocker || setup.isPending) return
    setAttempt((current) => current + 1)
    setStage(null)
    setStep("creating")
    try {
      await setup.createWallet({ passphrase, onStage: setStage })
      // Nothing here needs the passphrase again, and the wallet is unlocked
      // for its TTL — drop it rather than leave it in a live component.
      setPassphrase("")
      setPassphraseConfirmation("")
      setStep("done")
    } catch {
      // The mutation's error carries the message (SectionMessage renders it);
      // returning to the form leaves the typed passphrase ready for a retry,
      // which is safe because setup get-or-creates.
      setStep("passphrase")
    }
  }

  if (!setup.isReady) return null

  // Closed with no wallet to show: the page would otherwise be empty, so the
  // way back in stays on it. Deliberately a plain invitation and not the intro
  // over again — the sales pitch belongs in the flow, not on the page behind
  // it.
  if (!open) {
    if (walletExists && !resume) return null
    return (
      <Rise>
        <div className="mx-auto w-full max-w-md">
          <CardShell>
            <div className="flex flex-col gap-4 px-4 pb-5">
              <EmptyState
                icon={ShieldGlyph}
                title="Create your Worldstreet wallet"
                description="A wallet only you can open — set up in about a minute."
                className="gap-2.5 px-0 pb-1 pt-8"
              />
              <FlowCta
                label={resume ? "Finish setting up" : "Create wallet"}
                onClick={() => setStep(resume ? "passphrase" : "intro")}
                control={{ target: "wallet-setup-reopen", describe: "Create your Worldstreet wallet", guarded: false }}
              />
            </div>
          </CardShell>
        </div>
      </Rise>
    )
  }

  return (
    <ResponsiveModal
      open
      // Every dismissal request is answered by the same rule. Once committed,
      // `dismissible` is false and the answer is always no — Escape and any
      // programmatic close included — while `disablePointerDismissal` stops
      // the outside-press path at the source rather than letting it ask.
      onOpenChange={(next) => {
        if (!next && dismissible) setStep("closed")
      }}
      disablePointerDismissal={!dismissible}
    >
      <ResponsiveModalContent
        showCloseButton={dismissible}
        className={step === "recovery" ? "sm:max-w-lg" : "sm:max-w-md"}
      >
        {!secureContext ? (
          <UnavailablePanel
            title="A secure connection is required"
            reason="Open this page over HTTPS to create a wallet."
          />
        ) : step === "intro" ? (
          <div className="flex flex-col gap-5">
            <Rise>
              <ResponsiveModalHeader className="items-center text-center">
                <span
                  aria-hidden
                  className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <HugeiconsIcon icon={Shield01Icon} className="h-6 w-6" />
                </span>
                <ResponsiveModalTitle>Create your Worldstreet wallet</ResponsiveModalTitle>
                <ResponsiveModalDescription>
                  A wallet only you can open — set up in about a minute.
                </ResponsiveModalDescription>
              </ResponsiveModalHeader>
            </Rise>
            <Rise delay={60}>
              <ul className="flex flex-col gap-1 rounded-xl bg-surface-sunken/50 p-2 ring-1 ring-border/20">
                {INTRO_POINTS.map(({ icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-lg p-2 text-[13px] leading-snug text-muted-foreground">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-foreground/70">
                      <HugeiconsIcon icon={icon} className="h-4 w-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </Rise>
            <Rise delay={120}>
              <FlowCta
                label="Get started"
                onClick={() => setStep("passphrase")}
                control={{ target: "wallet-setup-start", describe: "Start wallet setup", guarded: false }}
              />
            </Rise>
          </div>
        ) : step === "passphrase" ? (
          <Rise>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Choose a wallet passphrase</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                It unlocks your wallet on this device. Worldstreet never sees it and can&apos;t reset it.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="flex flex-col gap-5 pt-4">
              {resume ? (
                <InlineNotice tone="warning">
                  Your wallet was created but setup didn&apos;t finish. Pick a passphrase to finish securing it.
                </InlineNotice>
              ) : null}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="wallet-passphrase" className="text-[13px] font-semibold">
                    Wallet passphrase
                  </label>
                  {/* Raised to a real chip rather than a ghost link: for most
                      people this is the better path, and a suggestion nobody
                      notices is a suggestion nobody takes. */}
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generatePassphrase()
                      setPassphrase(generated)
                      setPassphraseConfirmation(generated)
                      // Show what was just chosen for them — a hidden surprise
                      // credential is one nobody writes down.
                      setPassphraseRevealed(true)
                      setGenerated((count) => count + 1)
                      if (setup.error) setup.reset()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-foreground/80 transition-colors hover:bg-accent/70 hover:text-foreground"
                  >
                    <HugeiconsIcon icon={DiceIcon} className="h-3.5 w-3.5" />
                    Generate for me
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="wallet-passphrase"
                    className={`${FIELD_INPUT} pr-20`}
                    type={passphraseRevealed ? "text" : "password"}
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value)
                      // A failed attempt's message stops applying the moment they
                      // start typing a different passphrase.
                      if (setup.error) setup.reset()
                    }}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    aria-describedby="wallet-passphrase-strength"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
                    {passphrase.length > 0 ? (
                      <button
                        type="button"
                        aria-label={passphraseCopied ? "Copied" : "Copy passphrase"}
                        onClick={() => {
                          navigator.clipboard?.writeText(passphrase).then(() => {
                            setPassphraseCopied(true)
                            setTimeout(() => setPassphraseCopied(false), 1600)
                          }).catch(() => {})
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${passphraseCopied ? "text-credit" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        <HugeiconsIcon icon={passphraseCopied ? CheckmarkCircle02Icon : Copy01Icon} className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={passphraseRevealed ? "Hide passphrase" : "Show passphrase"}
                      aria-pressed={passphraseRevealed}
                      onClick={() => setPassphraseRevealed((current) => !current)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <HugeiconsIcon icon={passphraseRevealed ? ViewOffIcon : ViewIcon} className="h-4 w-4" />
                    </button>
                  </div>
                  {/* A one-shot ring on the field the moment a phrase is
                      generated — it lands in a control the user wasn't looking
                      at, so something has to point at it. Keyed (not toggled)
                      so a second roll replays instead of sitting still. */}
                  {generated > 0 ? (
                    <span
                      key={generated}
                      aria-hidden
                      className="ws-field-flash pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/60"
                    />
                  ) : null}
                </div>
                {/* The meter sits with the field it measures. Allocation
                    ladder read backwards: Strong takes rank 0 (brand gold),
                    each weaker rung a duller step down it. */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <WeightBar pct={(strength.score / 3) * 100} rank={3 - strength.score} />
                  <p id="wallet-passphrase-strength" className="flex justify-between gap-2 text-[12px] text-muted-foreground">
                    <span>A long phrase beats a short complicated one.</span>
                    <span className="shrink-0 font-semibold">{strength.label}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="wallet-passphrase-confirmation" className="text-[13px] font-semibold">
                  Confirm passphrase
                </label>
                <Input
                  id="wallet-passphrase-confirmation"
                  className={FIELD_INPUT}
                  type={passphraseRevealed ? "text" : "password"}
                  value={passphraseConfirmation}
                  onChange={(event) => setPassphraseConfirmation(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your passphrase"
                  aria-invalid={mismatch || undefined}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createWallet()
                  }}
                />
                {mismatch ? (
                  <p className="text-[12px] text-debit">Passphrases don&apos;t match</p>
                ) : passphraseConfirmation.length > 0 && passphrase === passphraseConfirmation ? (
                  // Answering the second field while they're still in it — the
                  // alternative is typing a long phrase twice and finding out
                  // whether it took only after pressing the button.
                  <p className="ws-casc flex items-center gap-1.5 text-[12px] text-credit">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3.5 w-3.5" />
                    Passphrases match
                  </p>
                ) : null}
              </div>

              <SectionMessage error={setup.error} />

              <FlowCta
                label={blocker ?? "Create wallet"}
                disabled={Boolean(blocker)}
                busy={setup.isPending}
                onClick={() => void createWallet()}
                control={{ target: "wallet-setup-submit", describe: "Create your Worldstreet wallet", guarded: false }}
              />
            </div>
          </Rise>
        ) : step === "creating" ? (
          <Rise>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Creating your wallet</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Keep this tab open — closing it now leaves the setup half-finished.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="flex flex-col gap-4 pt-4">
              <SetupCeremony stages={SETUP_STAGES} activeIndex={progress.index} />
            </div>
          </Rise>
        ) : step === "recovery" && setup.data?.recoverySecret ? (
          <Rise>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Save your wallet recovery secret</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                This is the only time it will ever be shown. It&apos;s how you get back into your wallet if
                you forget your passphrase or lose this device.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="flex flex-col gap-4 pt-4">
              <RecoverySecretPanel
                secret={setup.data.recoverySecret}
                onDone={() => {
                  setSecretAcknowledged(true)
                  setStep("closed")
                }}
              />
            </div>
          </Rise>
        ) : (
          <Rise>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Your wallet is ready</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {setup.data?.existing
                  ? "This wallet was already set up — nothing about it has changed."
                  : "These are your addresses. Share one to receive money on that network."}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="flex flex-col gap-4 pt-2">
              {addresses.length > 0 ? (
                <Rise delay={60} className="-mx-4 flex flex-col">
                  {addresses.map((account) => (
                    <ListRow
                      key={account.key}
                      title={FAMILY_LABEL[account.family] ?? account.family.toUpperCase()}
                      right={<AddressPill address={account.address} />}
                    />
                  ))}
                </Rise>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Your addresses are listed under Accounts on this page.
                </p>
              )}
              <Rise delay={120}>
                {/* One screen at a time. The secret used to open on top of this
                    one because both resolved on the same tick; now it is the
                    next step, and this button is what asks for it. */}
                {pendingSecret ? (
                  <FlowCta
                    label="Save your recovery secret"
                    onClick={() => setStep("recovery")}
                    control={{ target: "wallet-setup-secret", describe: "Show your recovery secret", guarded: false }}
                  />
                ) : (
                  <FlowCta
                    label="Open your wallet"
                    onClick={() => setStep("closed")}
                    control={{ target: "wallet-setup-done", describe: "Finish wallet setup", guarded: false }}
                  />
                )}
              </Rise>
            </div>
          </Rise>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
