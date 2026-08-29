"use client"

/**
 * Self-custody setup, as a guided flow (spec §3): Intro → Passphrase →
 * Creating → Done.
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
 *     true mid-ceremony; if that also hid the Creating/Done screens and the
 *     recovery modal, the secret would vanish at exactly the wrong moment.
 *     `busyWithSetup` below is what keeps the flow on screen once it starts.
 *
 * Secrets: the passphrase and the recovery secret are never logged, never put
 * in a query key, and never sent anywhere — the passphrase is cleared from
 * state as soon as the wallet exists.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerIcon, DatabaseLockedIcon, Key01Icon, Shield01Icon } from "@hugeicons/core-free-icons"

import { useModernWalletSetup } from "@/hooks/crypto/useModernWalletSetup"
import { AddressPill, SectionMessage } from "@/components/crypto/primitives"
import { Input } from "@/components/ui/input"
import {
  FlowCta,
  InlineNotice,
  StageList,
  UnavailablePanel,
  useStageProgress,
  type Stage,
} from "@/components/ui/flow"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { CardHeader, CardShell, EmptyState, ListRow, WeightBar } from "@/components/ui/system"
import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { passphraseStrength } from "@/lib/crypto-wallet/passphrase-strength"
import type { WalletSetupStage } from "@/lib/crypto-wallet/wallet-setup"

type Step = "intro" | "passphrase" | "creating" | "done" | "closed"

/** In the order `createSelfCustodialWallet` actually runs them — the backend
 *  wallet and its accounts exist before there is anything to generate keys
 *  for. A checklist that claimed otherwise would tick "keys" while the client
 *  was still talking to the service, and `useStageProgress`'s high-water mark
 *  would then swallow the real key-generation report. */
const SETUP_STAGES: Stage[] = [
  { key: "account", label: "Provisioning wallet accounts" },
  { key: "keys", label: "Generating keys on this device" },
  { key: "encrypt", label: "Encrypting your wallet package" },
  { key: "commit", label: "Storing the encrypted package" },
]

const INTRO_POINTS = [
  { icon: ComputerIcon, text: "Your keys are generated on this device" },
  { icon: DatabaseLockedIcon, text: "Worldstreet stores only encrypted data" },
  { icon: Key01Icon, text: "Your passphrase and recovery secret are the only ways in" },
]

const FAMILY_LABEL: Record<string, string> = {
  evm: "EVM",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

/** Plain full-width pill. Gold's breathing glow belongs to the money CTA
 *  (FlowCta's armed state); these secondary confirmations don't move money. */
const PILL =
  "flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
const QUIET_PILL =
  "rounded-full bg-surface-sunken px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-accent"

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
   Blocking by contract: this is the only time the secret is ever displayed,
   so the ONLY way out is the confirmation checkbox plus the button under it.
   Escape, the backdrop, and the close affordance are all removed below. ─── */

function RecoverySecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <ResponsiveModal
      open
      // Controlled with a constant `open` and an onOpenChange that refuses
      // every request: Escape and any programmatic close are answered with
      // "no". `disablePointerDismissal` stops the outside-press path at the
      // source rather than letting it ask.
      onOpenChange={() => {}}
      disablePointerDismissal
    >
      <ResponsiveModalContent showCloseButton={false} className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Save your wallet recovery secret</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            This is the only time the new recovery secret is shown. You need it to recover the wallet, change the
            passphrase, rotate keys, or revoke devices.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <code className="block max-h-40 select-all overflow-auto break-all rounded-xl bg-surface-sunken/70 p-3 font-mono text-xs leading-5 ring-1 ring-border/25">
          {secret}
        </code>
        <p className="text-[12px] leading-relaxed text-warning">
          Keep it offline. Worldstreet cannot show it again, reissue it, or recover your wallet without it.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={QUIET_PILL}
            onClick={() => {
              void navigator.clipboard?.writeText(secret).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }).catch(() => {})
            }}
          >
            {copied ? "Copied" : "Copy recovery secret"}
          </button>
          <button
            type="button"
            className={QUIET_PILL}
            onClick={() => {
              const blob = new Blob([secret], { type: "text/plain" })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement("a")
              anchor.href = url
              anchor.download = "worldstreet-wallet-recovery-secret.txt"
              anchor.click()
              URL.revokeObjectURL(url)
            }}
          >
            Download secret
          </button>
        </div>

        <label className="flex items-start gap-2 text-[13px] leading-relaxed">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="mt-0.5"
          />
          <span>I have saved this recovery secret somewhere secure and offline.</span>
        </label>
        <button type="button" disabled={!saved} onClick={onClose} className={PILL}>
          I saved it — continue
        </button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/** Opt-in modern wallet setup. The legacy WalletProvider remains untouched. */
export function WalletSetupFlow({
  walletExists = false,
  resume = false,
}: {
  walletExists?: boolean
  /** The wallet exists but its encrypted package doesn't — an interrupted
   *  setup. Opens straight at the passphrase step with a warning, and keeps
   *  the card visible even though `walletExists` is true. */
  resume?: boolean
}) {
  const setup = useModernWalletSetup()
  // `null` until the user steers: the landing step is then derived, so a
  // resume that only becomes known once the package query settles moves an
  // untouched flow to the passphrase step without an effect racing the render.
  const [chosenStep, setChosenStep] = useState<Step | null>(null)
  const [secretAcknowledged, setSecretAcknowledged] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("")
  const [stage, setStage] = useState<WalletSetupStage | null>(null)
  const [attempt, setAttempt] = useState(0)
  const secureContext = useSyncExternalStore(neverChanges, readSecureContext, assumeSecureOnServer)

  const step: Step = chosenStep ?? (resume ? "passphrase" : "intro")
  const setStep = setChosenStep
  // The secret exists ONLY in this mutation result and is shown exactly once,
  // so the modal is derived from it rather than mirrored into an effect — one
  // less way for the user's only copy to be lost to a render ordering bug. It
  // stands until they confirm they've saved it.
  const recoveryModalOpen = Boolean(setup.data?.recoverySecret) && !secretAcknowledged

  // Closing the tab between the backend wallet and the committed package is
  // exactly the interruption the resume path exists to repair — cheaper to
  // warn than to repair, so the whole creating window is guarded, not just
  // the final write.
  useEffect(() => {
    if (step !== "creating") return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [step])

  const strength = passphraseStrength(passphrase)
  const mismatch = passphraseConfirmation.length > 0 && passphrase !== passphraseConfirmation
  const blocker =
    strength.score === 0 ? "At least 12 characters"
      : passphrase !== passphraseConfirmation ? "Passphrases don't match"
      : null

  const rawStageIndex = stage ? SETUP_STAGES.findIndex((item) => item.key === stage) : 0
  const progress = useStageProgress(Math.max(0, rawStageIndex), attempt)
  const addresses = useMemo(() => packageAddresses(setup.data?.package), [setup.data])

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

  // Suppression is the PROP's job, never the mount's — and only over the idle
  // invitation. Once the ceremony starts (or the secret is on screen) this
  // component owns the card until the user leaves it themselves.
  const busyWithSetup = step === "creating" || step === "done" || recoveryModalOpen
  const invited = !walletExists || resume
  if (step === "closed" || (!busyWithSetup && !invited)) return null

  return (
    <>
      {/* The ceremony is a focused flow, not dashboard furniture: a narrow
          centered column (like the send flow), never a full-width card. */}
      <div className="mx-auto w-full max-w-md">
      <CardShell>
        {!secureContext ? (
          <UnavailablePanel
            title="A secure connection is required"
            reason="Open this page over HTTPS to create a wallet."
          />
        ) : step === "intro" ? (
          <div className="flex flex-col gap-5 px-5 pb-5">
            <EmptyState
              icon={ShieldGlyph}
              title="Create your Worldstreet wallet"
              description="A wallet only you can open — set up in about a minute."
              className="gap-2.5 px-0 pb-1 pt-8"
            />
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
            <FlowCta
              label="Get started"
              onClick={() => setStep("passphrase")}
              control={{ target: "wallet-setup-start", describe: "Start wallet setup", guarded: false }}
            />
          </div>
        ) : step === "passphrase" ? (
          <>
            <CardHeader
              title="Choose a wallet passphrase"
              subtitle="It unlocks your keys on this device. Worldstreet never sees it and can't reset it."
            />
            <div className="flex flex-col gap-4 px-4 pb-4">
              {resume ? (
                <InlineNotice tone="warning">
                  Your wallet was created but setup didn&apos;t finish. Pick a passphrase to finish securing it.
                </InlineNotice>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="wallet-passphrase" className="text-[13px] font-semibold">
                  Wallet passphrase
                </label>
                <Input
                  id="wallet-passphrase"
                  type="password"
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="wallet-passphrase-confirmation" className="text-[13px] font-semibold">
                  Confirm passphrase
                </label>
                <Input
                  id="wallet-passphrase-confirmation"
                  type="password"
                  value={passphraseConfirmation}
                  onChange={(event) => setPassphraseConfirmation(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your passphrase"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createWallet()
                  }}
                />
                {mismatch ? <p className="text-[12px] text-debit">Passphrases don&apos;t match</p> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                {/* The allocation ladder read backwards: Strong takes rank 0
                    (brand gold), each weaker rung a duller step down it. */}
                <WeightBar pct={(strength.score / 3) * 100} rank={3 - strength.score} />
                <p id="wallet-passphrase-strength" className="flex justify-between gap-2 text-[12px] text-muted-foreground">
                  <span>A long phrase beats a short complicated one.</span>
                  <span className="shrink-0 font-semibold">{strength.label}</span>
                </p>
              </div>

              <SectionMessage error={setup.error} />

              <FlowCta
                label={blocker ?? "Create wallet"}
                disabled={Boolean(blocker)}
                busy={setup.isPending}
                onClick={() => void createWallet()}
                control={{ target: "wallet-setup-submit", describe: "Create your self-custodial wallet", guarded: false }}
              />
            </div>
          </>
        ) : step === "creating" ? (
          <>
            <CardHeader
              title="Creating your wallet"
              subtitle="Keep this tab open — closing it now leaves the setup half-finished."
            />
            <div className="flex flex-col gap-4 px-4 pb-4">
              <StageList
                stages={SETUP_STAGES}
                activeIndex={progress.index}
                stageStartedAt={progress.since}
                cascade
              />
            </div>
          </>
        ) : (
          <>
            <CardHeader
              title="Your wallet is ready"
              subtitle={
                setup.data?.existing
                  ? "This wallet was already set up — your existing keys are unchanged."
                  : "One address per chain family. They're yours on every network in that family."
              }
            />
            <div className="flex flex-col gap-4 pb-4">
              {addresses.length > 0 ? (
                <div className="flex flex-col">
                  {addresses.map((account) => (
                    <ListRow
                      key={account.key}
                      title={FAMILY_LABEL[account.family] ?? account.family.toUpperCase()}
                      right={<AddressPill address={account.address} />}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-4 text-[13px] text-muted-foreground">
                  Your addresses are listed under Accounts on this page.
                </p>
              )}
              <div className="px-4">
                <FlowCta
                  label="Open your wallet"
                  onClick={() => setStep("closed")}
                  control={{ target: "wallet-setup-done", describe: "Finish wallet setup", guarded: false }}
                />
              </div>
            </div>
          </>
        )}
      </CardShell>
      </div>

      {recoveryModalOpen && setup.data?.recoverySecret ? (
        <RecoverySecretModal
          secret={setup.data.recoverySecret}
          onClose={() => setSecretAcknowledged(true)}
        />
      ) : null}
    </>
  )
}
