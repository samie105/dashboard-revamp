"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Settings02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { illustrations, type IllustrationKey } from "@/components/ui/system"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { useUiMode } from "@/components/ui-mode-provider"
import { useMigrationPopupOwnsScreen } from "@/components/crypto/MigrationNotice"
import { markOnboardingComplete } from "@/lib/profile-actions"
import {
  WELCOME_GUIDE_KEY,
  WELCOME_SEEN_PREFIX,
  welcomeGuideSurfaces,
  welcomeSeenKey,
  type SeenSnapshot,
} from "@/lib/welcome-guide"

type GuideCard = {
  /** Either an icon in a gold well, or a house illustration — never both.
   *  The cards that came in from the promo rail keep the art they shipped
   *  with; the ones teaching a control keep the icon that names it. */
  icon?: typeof Wallet01Icon
  art?: IllustrationKey
  title: string
  /** A function where the text has to know what it is looking at. */
  body: string | ((simple: boolean) => string)
  /** An optional way to act on the card, offered under Next. */
  action?: { label: string; href: string }
}

/**
 * Worldstreet introducing itself, once, to the person who just arrived.
 *
 * Copy follows the house plain-language rule: no "self-custody", no "keys",
 * no "gas", no "network" as a noun the reader is expected to already own. It
 * describes outcomes, and it never implies Worldstreet can open the wallet.
 * The cards lifted wholesale from the promo rail keep the marketing copy they
 * shipped with, "six chains" included — moving a card is not licence to
 * rewrite it.
 *
 * Seven cards, in the order a newcomer actually meets the problem: what is
 * this, how do I get my first coin, the two things people come here to do
 * with it, moving money in and out, and finally why this screen might look
 * simpler than a friend's.
 */
const CARDS: GuideCard[] = [
  {
    art: "welcome",
    title: "Welcome to Worldstreet",
    body:
      "Your money and your crypto sit here together, valued in dollars. The wallet is yours alone — only you can open it, not even Worldstreet can.",
  },
  /* The three cards below WERE the dashboard's promo rail: an autoplaying
     carousel below the markets grid, each card carrying its own dismiss X.
     That put the whole of a newcomer's "what do I actually do here" behind a
     thing that moves on its own and can be closed by accident, on a stretch
     of page they have to scroll to reach. They belong in the guide that
     already has the person's attention, in the order someone starting from
     zero needs them. Deleting the rail is the other half of this — a card
     cannot be in two places and still be "the" invitation. */
  {
    art: "cryptoBuy",
    title: "Buy your first crypto",
    body:
      "Don't hold any yet? Your Dollar Account can buy some. Turn dollars into USDT on Solana, Ethereum or Tron, and it lands in your wallet.",
    action: { label: "Buy crypto", href: "/buy" },
  },
  {
    art: "cryptoTrade",
    title: "Trade across six chains",
    body: "Thousands of tokens on live markets, priced and routed for you.",
    action: { label: "Open trading", href: "/trade" },
  },
  {
    art: "cryptoSwap",
    title: "Swap in one move",
    body: "Convert cash and tokens at live rates, any pair to any pair.",
    action: { label: "Swap", href: "/swap" },
  },
  {
    icon: ArrowDownLeft01Icon,
    title: "Adding money",
    body:
      "Press Deposit. Pick what you're adding, and you'll get an address to send it to. It shows up in your wallet once it arrives.",
  },
  {
    icon: ArrowUpRight01Icon,
    title: "Sending money",
    body:
      "Press Send, choose what you're sending and where it's going. You'll see exactly what leaves before anything moves.",
  },
  {
    icon: Settings02Icon,
    title: "Simple or Pro",
    // The one card whose text has to know what it is looking at: telling a
    // Pro user they are in Simple would be the first thing this guide got
    // wrong, on the card whose whole job is teaching the control.
    body: (simple: boolean) =>
      simple
        ? "You're in Simple, which shows the essentials. Pro adds the full breakdown for every place your money sits. Switch at the top of your wallet whenever you like."
        : "You're in Pro, which shows the full breakdown for every place your money sits. Simple trims it back to the essentials. Switch at the top of your wallet whenever you like.",
  },
]

const SEEN_VALUE = "seen"

/** Same shape as the migration store, for the same reasons: one snapshot
 *  shared by every mounted instance and every open tab, and a `storage`
 *  listener so clearing site data in one tab doesn't leave another
 *  convinced the guide was already shown. */
const welcomeSeenStore = (() => {
  const cache = new Map<string, boolean>()
  const listeners = new Set<() => void>()
  let attached = false

  function notify() {
    for (const listener of listeners) listener()
  }

  function ensureListener() {
    if (attached || typeof window === "undefined") return
    attached = true
    window.addEventListener("storage", (event) => {
      if (event.key === null) {
        cache.clear()
        notify()
        return
      }
      if (!event.key.startsWith(WELCOME_SEEN_PREFIX)) return
      cache.set(event.key, event.newValue === SEEN_VALUE)
      notify()
    })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      ensureListener()
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot(key: string): SeenSnapshot {
      if (!cache.has(key)) {
        if (typeof window === "undefined") return "unknown"
        try {
          cache.set(key, window.localStorage.getItem(key) === SEEN_VALUE)
        } catch {
          // Private mode. Treated as "not seen" so the guide still greets
          // this person — showing it twice is a far smaller cost than a
          // newcomer never being shown it at all.
          cache.set(key, false)
        }
      }
      return cache.get(key) ?? false
    },
    getServerSnapshot(): SeenSnapshot {
      return "unknown"
    },
    markSeen(key: string) {
      cache.set(key, true)
      try {
        window.localStorage.setItem(key, SEEN_VALUE)
      } catch {
        /* best effort */
      }
      notify()
    },
  }
})()

/**
 * Whether this PAGE LOAD has already granted the guide its showing, and
 * whether that showing is over. Module-level rather than component state on
 * purpose.
 *
 * `markSeen` fires the moment the guide is shown (so a reload mid-read
 * doesn't earn a second one), which means the component's own side effect
 * immediately makes its own precondition false. Any remount after that —
 * React's Strict Mode double-invoke in development, a Fast Refresh, a parent
 * re-key — reads "seen" and silently swallows the showing the first mount had
 * just authorised. That is how this guide came to write its localStorage key
 * and then never appear.
 *
 * Surviving the remount is exactly the scope wanted: a real reload resets
 * this to "pending", by which time the persisted key legitimately says the
 * person has already been greeted.
 */
let showing: "pending" | "open" | "closed" = "pending"

export function WelcomeGuide({
  ceremonyVisible = false,
  openSignal,
  onOpenChange,
}: {
  /** The wallet setup ceremony currently owns the page. Only the wallet page
   *  has one; everywhere else this stays false. */
  ceremonyVisible?: boolean
  /** Incremented by the page's help button to re-open the guide on demand.
   *  A counter rather than a boolean so repeated presses each re-open it
   *  without the caller having to reset anything. */
  openSignal?: number
  onOpenChange?: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { isSimple } = useUiMode()
  /* The other first-run modal. It is mounted by LayoutShell, so it can land
     on top of this guide on ANY page — asking the caller to pass it down
     would mean every future mount point remembering to. */
  const migrationOwnsScreen = useMigrationPopupOwnsScreen()
  const key = welcomeSeenKey(user?.userId)

  const getSnapshot = React.useCallback(() => welcomeSeenStore.getSnapshot(key), [key])
  const seenLocally = React.useSyncExternalStore(
    welcomeSeenStore.subscribe,
    getSnapshot,
    welcomeSeenStore.getServerSnapshot,
  )

  // The durable half. `profile` is null while the request is in flight, and
  // that is genuinely "unknown" — showing the guide then would greet a
  // long-standing user who simply hasn't had their profile land yet.
  const seenOnProfile: SeenSnapshot = profile
    ? profile.onboardingCompleted?.includes(WELCOME_GUIDE_KEY) ?? false
    : "unknown"

  /* Eligibility is the guide’s own business now rather than a prop. It is
     mounted on more than one page (the dashboard people land on, and the
     wallet, which also owns the help button that re-opens it), and a rule
     each caller restates is a rule that drifts. Signed in is the whole of
     it — the cards describe the product, not one backend. */
  const show = welcomeGuideSurfaces({
    eligible: Boolean(user?.userId),
    blockedByModal: ceremonyVisible || migrationOwnsScreen,
    seenLocally,
    seenOnProfile,
  }).guide

  const [open, setOpen] = React.useState(false)
  const [card, setCard] = React.useState(0)

  const markSeen = React.useCallback(() => {
    welcomeSeenStore.markSeen(key)
    // Fire-and-forget: the local key already guarantees this device won't
    // ask again, so a failed write costs at most one repeat on a new device.
    void markOnboardingComplete(WELCOME_GUIDE_KEY).catch(() => {})
  }, [key])

  // Marked seen on show, not on close — a reload mid-read has had its
  // showing. The MigrationNoticePopup precedent, for the same reason. The
  // `showing` latch above is what keeps that write from talking a remount
  // out of the very showing it authorised.
  React.useEffect(() => {
    if (showing === "closed") return
    if (show) {
      showing = "open"
      markSeen()
    }
    if (showing === "open") {
      setOpen(true)
      setCard(0)
    }
  }, [show, markSeen])

  // The header's help button. Deliberately does not touch the seen store:
  // asking to see it again is not the same as never having seen it.
  const firstSignal = React.useRef(openSignal)
  React.useEffect(() => {
    if (openSignal === undefined || openSignal === firstSignal.current) return
    setCard(0)
    setOpen(true)
  }, [openSignal])

  const change = React.useCallback(
    (next: boolean) => {
      // Closing retires the automatic showing for the rest of this page load.
      // The help button re-opens it by setting `open` directly, which is why
      // it does not have to unwind this.
      if (!next) showing = "closed"
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  if (!open) return null

  const current = CARDS[card]
  const isLast = card === CARDS.length - 1
  const Icon = current.icon
  const body = typeof current.body === "function" ? current.body(isSimple) : current.body

  return (
    <ResponsiveModal open={open} onOpenChange={change}>
      <ResponsiveModalContent className="sm:max-w-sm">
        <div className="flex flex-col gap-5">
          {/* The dialog's real title IS the heading on screen — a separate
              sr-only copy beside a visible <h2> made a screen reader announce
              every card's name twice. */}
          <ResponsiveModalHeader className="flex flex-col items-center gap-3 space-y-0 text-center">
            {/* One fixed-height slot for both treatments. The art is 76px and
                the icon well 48px, so without it the title and body jumped up
                and down as you paged between a moved promo card and a card
                teaching a control. */}
            <span className="flex h-[76px] items-center justify-center">
              {current.art ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={illustrations[current.art]}
                  alt=""
                  className="h-[76px] w-[76px] object-contain"
                />
              ) : Icon ? (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
                  <HugeiconsIcon icon={Icon} className="h-6 w-6" />
                </span>
              ) : null}
            </span>
            {/* Keyed so each card's text settles in rather than swapping
                under the reader mid-sentence. */}
            <div key={current.title} className="ws-card-face-in flex flex-col gap-2">
              <ResponsiveModalTitle className="font-display text-[17px] font-semibold">
                {current.title}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-[13px] leading-relaxed">
                {body}
              </ResponsiveModalDescription>
            </div>
          </ResponsiveModalHeader>

          {/* Where you are. Dots, not a progress bar: four cards is a length
              the reader can hold, and a bar would imply work to get through. */}
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            {CARDS.map((item, index) => (
              <span
                key={item.title}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === card ? "w-4 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => (isLast ? change(false) : setCard((value) => value + 1))}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {isLast ? "Start using my wallet" : "Next"}
              {!isLast && <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />}
            </button>

            {/* A card that can be acted on says so, under Next rather than in
                place of it — leaving here is a choice, not the only way
                forward. Safe to leave: the guide marks itself seen when it
                opens, so walking out mid-way does not earn a second showing. */}
            {current.action && (
              <a
                href={current.action.href}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-surface-sunken px-5 text-[13px] font-semibold transition-colors hover:bg-accent"
              >
                {current.action.label}
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
              </a>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCard((value) => Math.max(0, value - 1))}
                disabled={card === 0}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-0"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
                Back
              </button>
              {!isLast && (
                <button
                  type="button"
                  onClick={() => change(false)}
                  className="inline-flex min-h-11 items-center px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60">
            You can open this again from the help button on your wallet.
          </p>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
