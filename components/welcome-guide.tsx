"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ChartCandlestickIcon,
  Chart01Icon,
  ChartLineData01Icon,
  CoinsSwapIcon,
  CreditCardIcon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  Menu01Icon,
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
import { useMigrationPopupOwnsScreen } from "@/components/crypto/MigrationNotice"
import { markOnboardingComplete } from "@/lib/profile-actions"
import {
  WELCOME_GUIDE_KEY,
  WELCOME_SEEN_PREFIX,
  welcomeGuideSurfaces,
  welcomeSeenKey,
  type SeenSnapshot,
} from "@/lib/welcome-guide"

/** A line in a card's list. Rows are how this guide organises information —
 *  a newcomer scans a labelled list; they do not read a paragraph. */
type GuideRow = {
  icon: typeof Wallet01Icon
  title: string
  body: string
  /** Rows that are places you can go say so, and go there. */
  href?: string
}

type GuideCard = {
  /** A house illustration, or nothing — the list is the card's substance. */
  art?: IllustrationKey
  title: string
  /** One short line under the title. Sets the list up; never repeats it. */
  body?: string
  rows?: GuideRow[]
}

/**
 * Worldstreet explaining itself, once, to the person who just arrived.
 *
 * Four cards answering the four questions a newcomer actually has, in the
 * order they have them: what is this, what am I looking at on the screen in
 * front of me, what can I do, and where do I find it. Each answer is a
 * LABELLED LIST rather than a paragraph — the complaint this guide exists to
 * fix is "I don't understand what is going on", and prose is what people skip.
 *
 * Copy follows the house plain-language rule: no "self-custody", no "keys",
 * no "gas", no "on-chain", no "network" as a noun the reader is expected to
 * already own. It describes outcomes, and it never implies Worldstreet can
 * open the wallet. The one exception is the trading row's "six chains", the
 * shipped marketing line it arrived with when the promo rail was folded in.
 */
const CARDS: GuideCard[] = [
  {
    art: "welcome",
    title: "Welcome to Worldstreet",
    body:
      "Your money and your crypto in one place. Here is what is on your screen, and where everything lives.",
  },
  {
    /* The card this guide was rebuilt for. The dashboard shows one big total
       over a breakdown, and a newcomer has no idea what the parts are or why
       there is more than one. Naming the three, and saying they add up to the
       figure at the top, is the single most useful thing this guide says. */
    art: "cryptoBuy",
    title: "Your money sits in three places",
    body: "Add them together and you get the total at the top of your screen.",
    rows: [
      {
        icon: DollarCircleIcon,
        title: "Cash",
        body: "Dollars you can spend here or send to your bank.",
      },
      {
        icon: Wallet01Icon,
        title: "Crypto wallet",
        body: "Coins only you can move — not even Worldstreet can.",
      },
      {
        icon: Chart01Icon,
        title: "Trading",
        body: "What you have moved onto the market to buy and sell with.",
      },
    ],
  },
  {
    art: "cryptoTrade",
    title: "What you can do",
    body: "Four things, and you can start with any of them.",
    rows: [
      {
        icon: CreditCardIcon,
        title: "Buy your first crypto",
        body: "Turn dollars into USDT on Solana, Ethereum or Tron.",
        href: "/buy",
      },
      {
        icon: ChartLineData01Icon,
        title: "Trade across six chains",
        body: "Thousands of tokens on live markets, priced and routed for you.",
        href: "/trade",
      },
      {
        icon: CoinsSwapIcon,
        title: "Swap in one move",
        body: "Convert cash and tokens at live rates, any pair to any pair.",
        href: "/swap",
      },
      {
        icon: ArrowDownLeft01Icon,
        title: "Add and send coins",
        body: "Get an address to receive, or send what you hold anywhere.",
        href: "/wallet/modern",
      },
    ],
  },
  {
    title: "Where to find things",
    /* Deliberately not "the bar at the bottom of your screen": on a laptop it
       is a sidebar. The icons are the same in both, so they do the teaching. */
    body: "Five places, with the same icons everywhere.",
    rows: [
      { icon: DashboardSquare01Icon, title: "Home", body: "Your balance and what moved today.", href: "/" },
      { icon: ChartCandlestickIcon, title: "Trade", body: "Markets, charts and your orders.", href: "/trade" },
      { icon: Chart01Icon, title: "Portfolio", body: "Everything you own, in one list.", href: "/portfolio" },
      { icon: Wallet01Icon, title: "Wallet", body: "Your coins, addresses and security.", href: "/wallet/modern" },
      { icon: Menu01Icon, title: "Apps", body: "The Worldstreet mark opens the rest: Shop, Academy, Social." },
    ],
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
 * "Open the guide" as an app-wide request.
 *
 * A guide that only ever appears unbidden, once, is one most people meet
 * while they are busy with something else and then never see again — which is
 * how this one came to be invisible. Anything that can spot a confused user
 * should be able to offer it: the dashboard's "How this works", the wallet
 * header's help button. A counter, so repeated presses each re-open it.
 */
const openRequests = (() => {
  let count = 0
  const listeners = new Set<() => void>()
  return {
    request() {
      count += 1
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: () => count,
    getServerSnapshot: () => 0,
  }
})()

export function openWelcomeGuide() {
  openRequests.request()
}

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
  /** The wallet setup ceremony owns the page — or has not decided yet,
   *  which counts the same: a guide that opens into the gap gets a ceremony
   *  landed on top of it. Only the wallet page has one; everywhere else this
   *  stays false. */
  ceremonyVisible?: boolean
  /** Incremented by a caller that also renders the guide. Anything else can
   *  call `openWelcomeGuide()` instead. */
  openSignal?: number
  onOpenChange?: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { profile } = useProfile()
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

  /* Eligibility is the guide's own business rather than a prop. It is mounted
     on more than one page (the dashboard people land on, and the wallet,
     which also owns a help button), and a rule each caller restates is a rule
     that drifts. Signed in is the whole of it — the cards describe the
     product, not one backend. */
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

  // Asked for on purpose — by the prop, or by anything anywhere calling
  // `openWelcomeGuide()`. Deliberately does not touch the seen store: asking
  // to see it again is not the same as never having seen it.
  const requested = React.useSyncExternalStore(
    openRequests.subscribe,
    openRequests.get,
    openRequests.getServerSnapshot,
  )
  const demand = (openSignal ?? 0) + requested
  // Seeded from the first render, so mounting into a session where the guide
  // has already been asked for once does not count as a fresh request.
  const lastDemand = React.useRef(demand)
  React.useEffect(() => {
    if (demand === lastDemand.current) return
    lastDemand.current = demand
    setCard(0)
    setOpen(true)
  }, [demand])

  const change = React.useCallback(
    (next: boolean) => {
      // Closing retires the automatic showing for the rest of this page load.
      // An explicit request re-opens it by setting `open` directly, which is
      // why it does not have to unwind this.
      if (!next) showing = "closed"
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  if (!open) return null

  const current = CARDS[card]
  const isLast = card === CARDS.length - 1

  return (
    <ResponsiveModal open={open} onOpenChange={change}>
      <ResponsiveModalContent className="sm:max-w-[26rem]">
        <div className="flex flex-col gap-4">
          {/* The dialog's real title IS the heading on screen — a separate
              sr-only copy beside a visible <h2> made a screen reader announce
              every card's name twice. */}
          <ResponsiveModalHeader className="flex flex-col items-center gap-2.5 space-y-0 text-center">
            {current.art && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={illustrations[current.art]}
                alt=""
                className="h-[88px] w-[88px] object-contain"
              />
            )}
            {/* Keyed so each card's text settles in rather than swapping
                under the reader mid-sentence. */}
            <div key={current.title} className="ws-card-face-in flex flex-col gap-1.5">
              <ResponsiveModalTitle className="font-display text-[18px] font-semibold tracking-[-0.2px]">
                {current.title}
              </ResponsiveModalTitle>
              {current.body && (
                <ResponsiveModalDescription className="text-[12.5px] leading-relaxed">
                  {current.body}
                </ResponsiveModalDescription>
              )}
            </div>
          </ResponsiveModalHeader>

          {/* The list. LEFT-aligned inside a centred card, because a label and
              its explanation are scanned down a column — centring them is what
              turns a list back into prose. */}
          {current.rows && (
            <div
              key={`${current.title}-rows`}
              className="ws-card-face-in flex flex-col gap-0.5 rounded-xl bg-surface-sunken p-1.5"
            >
              {current.rows.map((row) => {
                const inner = (
                  <>
                    <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/[0.12] text-primary">
                      <HugeiconsIcon icon={row.icon} className="h-4 w-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <span className="text-[12.5px] font-semibold leading-none">{row.title}</span>
                      <span className="text-[11.5px] leading-[15px] text-muted-foreground">
                        {row.body}
                      </span>
                    </span>
                    {row.href && (
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
                      />
                    )}
                  </>
                )
                return row.href ? (
                  <Link
                    key={row.title}
                    href={row.href}
                    onClick={() => change(false)}
                    className="flex min-h-11 items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent active:bg-accent"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span key={row.title} className="flex items-start gap-2.5 px-2 py-2">
                    {inner}
                  </span>
                )
              })}
            </div>
          )}

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

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => (isLast ? change(false) : setCard((value) => value + 1))}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[13.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {isLast ? "Start using Worldstreet" : "Next"}
              {!isLast && <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />}
            </button>

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
            Reopen this any time from How this works, on Home.
          </p>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
