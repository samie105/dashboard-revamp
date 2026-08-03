"use client"

/**
 * PromoRow — the swipable card rail, ported from the mobile app's
 * `features/wallet/promo-cards.tsx`.
 *
 * Cards are DATA. The rail snaps card-to-card, autoplays, and each card is
 * dismissable with its own X. Dismissals persist per card key, so a card the
 * user closed stays closed across visits and the rail disappears once they're
 * all gone.
 *
 * Copy is written FROM each destination page, not from its title — the card
 * promises exactly what the page delivers.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { illustrations, type IllustrationKey } from "@/components/ui/system"

export type PromoCard = {
  key: string
  hero: string
  tagline: string
  art: IllustrationKey
  /** Route this card opens. */
  href: string
  /** Action label — matches the verb of the destination page. */
  cta: string
  /** Optical scale for the art. Some renders fill more of their canvas than
   *  others and need trimming to look the same size on the card. */
  artScale?: number
}

/**
 * The dashboard's promo rail. Trade leads the set on purpose — it's the
 * highest-intent destination and the rail sits directly under the balance.
 */
export const PROMO_CARDS: PromoCard[] = [
  {
    key: "crypto-trade",
    hero: "Trade spot & futures",
    tagline: "Market and limit orders on live books, with perps and leverage.",
    art: "cryptoTrade",
    href: "/trade",
    cta: "Open trading",
  },
  {
    key: "crypto-buy",
    hero: "Buy your first crypto",
    tagline: "Turn your Dollar Account into USDT on Solana, Ethereum or Tron.",
    art: "cryptoBuy",
    href: "/buy",
    cta: "Buy now",
  },
  {
    key: "crypto-swap",
    hero: "Swap in one move",
    tagline: "Convert cash and tokens at live rates, any pair to any pair.",
    art: "cryptoSwap",
    href: "/swap",
    cta: "Swap",
  },
]

/** How long a card holds before the rail advances itself. */
const AUTOPLAY_MS = 5200
const STORAGE_KEY = "worldstreet.dismissedPromos"

function readDismissed(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function PromoRow({
  cards = PROMO_CARDS,
  className,
}: {
  cards?: PromoCard[]
  className?: string
}) {
  // Start empty and hydrate in an effect — reading localStorage during render
  // would mismatch the server HTML.
  const [dismissed, setDismissed] = React.useState<string[]>([])
  const [page, setPage] = React.useState(0)
  const [held, setHeld] = React.useState(false)
  const railRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setDismissed(readDismissed()), [])

  const visible = cards.filter((c) => !dismissed.includes(c.key))

  const dismiss = React.useCallback((key: string) => {
    setDismissed((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch { /* private mode — the dismissal just won't persist */ }
      return next
    })
  }, [])

  // Autoplay — pauses while the user is touching the rail or hovering it, and
  // never runs for a single card.
  React.useEffect(() => {
    if (held || visible.length < 2) return
    const id = setInterval(() => {
      const el = railRef.current
      if (!el) return
      const stride = el.scrollWidth / visible.length
      const next = (Math.round(el.scrollLeft / stride) + 1) % visible.length
      el.scrollTo({ left: next * stride, behavior: "smooth" })
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [held, visible.length])

  const onScroll = React.useCallback(() => {
    const el = railRef.current
    if (!el || visible.length === 0) return
    const stride = el.scrollWidth / visible.length
    setPage(Math.round(el.scrollLeft / stride))
  }, [visible.length])

  if (visible.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={railRef}
        onScroll={onScroll}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onTouchStart={() => setHeld(true)}
        onTouchEnd={() => setHeld(false)}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none"
      >
        {visible.map((card) => (
          <div
            key={card.key}
            className="relative min-w-0 flex-1 shrink-0 basis-[min(100%,26rem)] snap-start"
          >
            <a
              href={card.href}
              aria-label={`${card.hero}. ${card.tagline}`}
              className="group flex h-24 items-center gap-3 overflow-hidden rounded-2xl bg-card pl-3 pr-3 transition-transform active:scale-[0.985]"
            >
              {/* Sized to sit INSIDE the 96px card with clearance top and
                  bottom — at the mobile's 104px it clipped against both edges. */}
              <img
                src={illustrations[card.art]}
                alt=""
                loading="lazy"
                className="shrink-0 object-contain"
                style={{
                  width: 64 * (card.artScale ?? 1),
                  height: 64 * (card.artScale ?? 1),
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
                <span className="truncate text-[14.5px] font-semibold tracking-[-0.2px]">
                  {card.hero}
                </span>
                <span className="line-clamp-2 text-[11.5px] leading-[15.5px] text-subtle">
                  {card.tagline}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-primary">
                  {card.cta}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </span>
            </a>

            <button
              onClick={(e) => { e.preventDefault(); dismiss(card.key) }}
              aria-label={`Dismiss ${card.hero}`}
              className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-foreground/[0.06] text-subtle transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {visible.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {visible.map((c, i) => (
            <span
              key={c.key}
              className={cn(
                "h-[5px] rounded-full transition-all",
                i === page ? "w-3.5 bg-primary" : "w-[5px] bg-foreground/[0.16]",
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
