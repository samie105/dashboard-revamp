"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  ChartCandlestickIcon,
  Chart01Icon,
  ChartLineData01Icon,
  Coins01Icon,
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

/** The same mark the sidebar and the app launcher use. */
const BRAND_MARK = "/worldstreet-logo/WorldStreet1.png"

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
  /** The brand mark. The opening card only: it is a greeting FROM
   *  Worldstreet, so Worldstreet is what belongs at the top of it. */
  mark?: boolean
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
 * Five cards, in the order a newcomer's questions actually arrive: what is
 * this (and what is it NOT), what is that big number made of, what do I do
 * first, how does money get in and out, and where do I find things. Each
 * answer is a LABELLED LIST rather than a paragraph — the complaint this
 * guide exists to fix is "I don't understand what is going on", and prose is
 * what people skip.
 *
 * The opening card carries the boundary that costs us the most confused
 * newcomers. This is the CRYPTO dashboard; cash lives in the Dollar Account,
 * which is a different product with its own dashboard. Someone who reads this
 * screen as "the main dashboard" arrives expecting to deposit cash into it,
 * and every screen after that reads as broken. Said once, plainly, at the
 * top, and stated as a boundary rather than an apology.
 *
 * The account names are the platform's own, not softened ones: the sidebar,
 * the portfolio and the trade screens all say Holdings, Spot and Futures, so
 * the guide says them too and only the sentences around them are plain.
 * Futures is described as shut rather than dropped — the sidebar already
 * badges it "Soon" (`FUTURES_CLOSED` in `lib/venues.ts`), and a reader who
 * meets the word on another screen deserves to know why there is no card for
 * it here.
 *
 * The third card exists because the dashboard is now progressive: a
 * brand-new account has NO account cards at all (`lib/dashboard-cards.ts`),
 * so a guide that described a populated screen would be describing one this
 * reader cannot see. It sets that expectation and then says the one thing
 * that makes the screen fill in.
 *
 * Copy follows the house plain-language rule: no "self-custody", no "keys",
 * no "gas", no "on-chain", no "network" as a noun the reader is expected to
 * already own. It describes outcomes, and it never implies Worldstreet can
 * open the wallet. The old "trade across six chains" marketing line went with
 * this rewrite — it was the one row that asked the reader to already know
 * what a chain was.
 */
const CARDS: GuideCard[] = [
  {
    /* The boundary card. Two rows rather than a paragraph because the two
       halves are a PAIR — coins here, cash there — and a pair is something a
       reader takes in at a glance and a sentence is something they skim. */
    mark: true,
    title: "Welcome to Worldstreet",
    body: "The crypto side of Worldstreet. Here is what lives here, and what does not.",
    rows: [
      {
        icon: Coins01Icon,
        title: "Coins live here",
        body: "Buy them, hold them, trade them, send them.",
      },
      {
        /* No link. The Dollar Account is a separate product on its own
           domain, and sending someone off this dashboard in the first ten
           seconds of the guide is not the point — knowing it exists is. */
        icon: DollarCircleIcon,
        title: "Cash lives in your Dollar Account",
        body: "Dollars to spend or send to your bank, on its own dashboard.",
      },
    ],
  },
  {
    /* The card this guide was rebuilt for. Home shows one big total over a
       breakdown, and a newcomer has no idea what the parts are or why there
       is more than one. The fourth row is the important one: it answers
       "where is my cash, then?" in the same list, at the same moment the
       question occurs, instead of leaving the reader to conclude the total
       has lost their money. */
    art: "cryptoBuy",
    title: "What your total is made of",
    body: "Three accounts add up to it. Your cash is not one of them.",
    rows: [
      {
        icon: Wallet01Icon,
        title: "Holdings",
        body: "Coins in your wallet. Only you can move them.",
      },
      {
        icon: Chart01Icon,
        title: "Spot",
        body: "What you have moved onto the market to trade with.",
      },
      {
        icon: ChartLineData01Icon,
        title: "Futures",
        body: "Not open yet, so it has no card on your screen.",
      },
      {
        icon: DollarCircleIcon,
        title: "Dollar Account",
        body: "Your cash. Shown under the total, never inside it.",
      },
    ],
  },
  {
    /* Two rows, and only two, because this is the card that has to produce an
       action. The empty-state illustration is doing real work here: the
       reader is looking at an empty dashboard while they read it. */
    art: "noCrypto",
    title: "Start by getting a coin",
    body: "A new dashboard is empty on purpose. Cards appear as you use each account.",
    rows: [
      {
        icon: CreditCardIcon,
        title: "Buy your first coin",
        body: "Pay from your Dollar Account.",
        href: "/buy",
      },
      {
        icon: ArrowDownLeft01Icon,
        title: "Or bring in coins you own",
        body: "Get your address and send them to it.",
        href: "/wallet/modern",
      },
    ],
  },
  {
    /* Deposit and Withdraw open a chooser now, so the guide has to describe a
       decision rather than a button. The first row is the owner-approved
       sentence, kept as written apart from the capital letters the Dollar
       Account carries everywhere else in the product. */
    art: "cryptoSwap",
    title: "Moving money around",
    body: "Deposit asks where the money is coming from. Withdraw asks where it goes.",
    rows: [
      {
        icon: DollarCircleIcon,
        title: "From your Dollar Account",
        body: "Fund directly from your Dollar Account into your trading account.",
      },
      {
        icon: Wallet01Icon,
        title: "From coins you already own",
        body: "Send them to your Worldstreet address.",
        href: "/wallet/modern",
      },
      {
        icon: ArrowUpRight01Icon,
        title: "Taking money out",
        body: "Back to your Dollar Account, or out to an address you choose.",
      },
      {
        icon: CoinsSwapIcon,
        title: "Swapping what you hold",
        body: "Change one coin for another at live rates.",
        href: "/swap",
      },
    ],
  },
  {
    title: "Where everything lives",
    /* Deliberately not "the bar at the bottom of your screen": on a laptop it
       is a sidebar. The icons are the same in both, so they do the teaching —
       which is also why this list mirrors the phone's bar exactly (Home,
       Trade, Portfolio, Wallet, and the mark) rather than listing every
       screen. Swap is not in that bar, so it earns its link on the card
       before this one instead of being taught as a tab that isn't there. */
    body: "The same icons on your phone and on your laptop.",
    rows: [
      { icon: DashboardSquare01Icon, title: "Home", body: "Your total, your accounts, today's moves.", href: "/" },
      { icon: ChartCandlestickIcon, title: "Trade", body: "Prices, charts and your Spot orders.", href: "/trade" },
      { icon: Chart01Icon, title: "Portfolio", body: "Everything you own, in one list.", href: "/portfolio" },
      { icon: Wallet01Icon, title: "Wallet", body: "Your coins, your address, and sending out.", href: "/wallet/modern" },
      { icon: Menu01Icon, title: "Apps", body: "The Worldstreet mark opens Shop, Academy and Social." },
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
        {/* Tighter on a phone, roomier from `sm` up. This guide is read on a
            phone first, the tallest card carries five rows, and the modal
            scrolls internally — so every few pixels reclaimed between the
            blocks is a card that fits whole instead of one whose primary
            button starts below the fold. */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* The dialog's real title IS the heading on screen — a separate
              sr-only copy beside a visible <h2> made a screen reader announce
              every card's name twice. */}
          <ResponsiveModalHeader className="flex flex-col items-center gap-2.5 space-y-0 text-center">
            {/* One slot, so the title sits at the same height on every card
                that has something above it. The mark is smaller than the
                illustrations on purpose — a logo carries at a size a drawing
                does not. */}
            {(current.mark || current.art) && (
              <span className="flex h-[68px] items-center justify-center sm:h-[88px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.mark ? BRAND_MARK : illustrations[current.art!]}
                  alt=""
                  className={
                    current.mark
                      ? "h-14 w-14 object-contain sm:h-16 sm:w-16"
                      : "h-[68px] w-[68px] object-contain sm:h-[88px] sm:w-[88px]"
                  }
                />
              </span>
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
                      {/* `leading-tight`, not `leading-none`. A label like
                          "Cash lives in your Dollar Account" wraps to two
                          lines in a phone-width column, and at 12.5px with no
                          line height at all those two lines sit on top of one
                          another. */}
                      <span className="text-[12.5px] font-semibold leading-tight">{row.title}</span>
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
                    className="flex min-h-11 items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent sm:py-2"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span key={row.title} className="flex min-h-11 items-start gap-2.5 px-2 py-1.5 sm:py-2">
                    {inner}
                  </span>
                )
              })}
            </div>
          )}

          {/* Where you are. Dots, not a progress bar: five cards is still a
              length the reader can hold, and a bar would imply work to get
              through. */}
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
