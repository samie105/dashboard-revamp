"use client"

/**
 * Everything about keeping the wallet safe, in one modal reached from the
 * wallet's Security button.
 *
 * ── Why a menu that PUSHES rather than four tabs ──────────────────────────
 * Three of these panels open dialogs of their own — the security panel alone
 * carries three confirm steps, and the export panel can raise the unlock
 * dialog. A tab bar would leave all four mounted, so a stray confirm could
 * belong to a pane nobody is looking at. A menu that swaps the modal's
 * content means exactly one panel is mounted at a time and the confirm you
 * see always belongs to what you are doing.
 *
 * The panels themselves are reused UNCHANGED from when they lived stacked at
 * the bottom of the page. `FlatCardSurface` is what makes that possible: it
 * tells their CardShells they're already on a card, so the modal doesn't end
 * up as glass inside glass.
 */

import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Key01Icon,
  PlusSignIcon,
  Shield01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons"

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { FlatCardSurface } from "@/components/ui/system"
import { useUiMode } from "@/components/ui-mode-provider"
import type { CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { CryptoSecurityPanel } from "./CryptoSecurityPanel"
import { RecoveryPanel } from "./RecoveryPanel"
import { WalletKeyExportPanel } from "./WalletKeyExportPanel"
import { WalletChainProvisioningPanel } from "./WalletChainProvisioningPanel"

type View = "menu" | "locks" | "recovery" | "export" | "networks"

type Entry = {
  key: Exclude<View, "menu">
  icon: typeof Shield01Icon
  title: string
  subtitle: string
}

/* Plain language, per the house rule: no "self-custody", no "encrypt", no
   "package". "Private key" survives in exactly one place — the export row —
   because that IS the thing being handed over and a euphemism there would
   be dishonest about what the user is about to copy. */
const ENTRIES: Entry[] = [
  {
    key: "locks",
    icon: SquareLock02Icon,
    title: "Passphrase and backup",
    subtitle: "Change your passphrase, sign out other devices, save a backup file",
  },
  {
    key: "recovery",
    icon: Shield01Icon,
    title: "Get back in",
    subtitle: "Use your recovery secret if you're locked out of your wallet",
  },
  {
    key: "export",
    icon: Key01Icon,
    title: "Move an account to another app",
    subtitle: "Shows that account's private key — for advanced users only",
  },
]

const NETWORKS_ENTRY: Entry = {
  key: "networks",
  icon: PlusSignIcon,
  title: "Add new networks",
  subtitle: "Your wallet can hold more networks than it does today",
}

/* The modal names the pane, so each panel's own CardHeader is hidden and its
   subtitle is carried here instead — one title per screen, not two. */
const DETAIL: Record<Exclude<View, "menu">, { title: string; description: string }> = {
  locks: {
    title: "Passphrase and backup",
    description: "These actions need your passphrase and your recovery secret.",
  },
  recovery: {
    title: "Get back in",
    description: "Your recovery secret proves it's you. It never leaves this device.",
  },
  export: {
    title: "Move an account to another app",
    description: "Keys are only ever shown on this device — never sent anywhere.",
  },
  networks: {
    title: "Add new networks",
    description: "Your wallet can hold more networks than it does today.",
  },
}

function MenuRow({
  icon,
  title,
  subtitle,
  flagged,
  onClick,
}: {
  icon: typeof Shield01Icon
  title: string
  subtitle: string
  /** Something is waiting in here — the one place gold appears in this list. */
  flagged?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/50"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          flagged ? "bg-primary/[0.16] text-primary" : "bg-surface-sunken text-muted-foreground group-hover:text-foreground"
        }`}
      >
        <HugeiconsIcon icon={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[14px] font-semibold leading-tight">
          {title}
          {flagged ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
        </span>
        <span className="text-[12.5px] leading-snug text-muted-foreground">{subtitle}</span>
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  )
}

export function WalletSecurityModal({
  open,
  onOpenChange,
  walletId,
  packageValue,
  accounts,
  networksToAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletId: string
  packageValue: CryptoWalletPackageDocument
  accounts: CryptoWalletAccount[]
  /** How many networks the provisioning panel would offer. 0 hides the row. */
  networksToAdd: number
}) {
  const [view, setView] = useState<View>("menu")
  const { isSimple } = useUiMode()
  const [advancedShown, setAdvancedShown] = useState(false)

  // Back to the menu on close, but only once the modal is fully gone —
  // resetting while it animates out would swap the pane under the user's
  // eyes on the way down. The disclosure re-folds with it, so the next
  // opening is the calm list again.
  useEffect(() => {
    if (open) return
    const id = setTimeout(() => {
      setView("menu")
      setAdvancedShown(false)
    }, 220)
    return () => clearTimeout(id)
  }, [open])

  const all = networksToAdd > 0 ? [NETWORKS_ENTRY, ...ENTRIES] : ENTRIES
  const onMenu = view === "menu"

  /* Simple mode does not DELETE the advanced rows, it folds them. "Add new
     networks" and "Move an account to another app" are the two entries whose
     titles a newcomer cannot act on, but a wallet where a feature silently
     vanished is worse than a busy one — they'd go to support asking where
     their export went. So Simple shows the two everyday rows and a
     disclosure; pressing it reveals the rest in place. */
  const ADVANCED: Exclude<View, "menu">[] = ["networks", "export"]
  const everyday = all.filter((entry) => !ADVANCED.includes(entry.key))
  const advanced = all.filter((entry) => ADVANCED.includes(entry.key))
  const entries = advancedShown || !isSimple ? all : everyday
  const hiddenCount = entries.length === all.length ? 0 : advanced.length

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {onMenu ? (
              "Wallet security"
            ) : (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  aria-label="Back to wallet security"
                  className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                </button>
                {DETAIL[view].title}
              </span>
            )}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {onMenu
              ? "Only you can open this wallet. These are the ways to keep it that way."
              : DETAIL[view].description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {/* The panes are tall — the modal scrolls rather than growing past
            the viewport on a laptop. */}
        <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[min(70dvh,640px)]">
          {onMenu ? (
            <div className="flex flex-col">
              {entries.map((entry) => (
                <MenuRow
                  key={entry.key}
                  icon={entry.icon}
                  title={entry.title}
                  subtitle={
                    entry.key === "networks"
                      ? `${networksToAdd} ${networksToAdd === 1 ? "network" : "networks"} can be added to your wallet`
                      : entry.subtitle
                  }
                  flagged={entry.key === "networks"}
                  onClick={() => setView(entry.key)}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAdvancedShown(true)}
                  className="mx-3 mt-1 mb-2 inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  Show advanced options
                </button>
              )}
            </div>
          ) : (
            // The panels bring their own CardShell; FlatCardSurface strips the
            // pane so they sit flush inside the modal instead of as a card
            // floating inside a card.
            <FlatCardSurface>
              <div className="ws-card-face-in [&_[data-slot=card-header]]:hidden">
                {view === "locks" ? (
                  <CryptoSecurityPanel walletId={walletId} packageValue={packageValue} />
                ) : view === "recovery" ? (
                  <RecoveryPanel walletId={walletId} packageValue={packageValue} />
                ) : view === "export" ? (
                  <WalletKeyExportPanel walletId={walletId} accounts={accounts} packageValue={packageValue} />
                ) : (
                  <WalletChainProvisioningPanel
                    walletId={walletId}
                    packageValue={packageValue}
                    accounts={accounts}
                  />
                )}
              </div>
            </FlatCardSurface>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
