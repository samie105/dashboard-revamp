"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Notification01Icon,
  Megaphone01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import { useIsMobile } from "@/hooks/use-mobile"

const defaultAnnouncements = [
  {
    id: "1",
    title: "Spot trading is live on six chains",
    description: "Swap and trade thousands of tokens across Ethereum, Arbitrum, Solana, Sui, TON and Tron.",
    time: "2h ago",
    isNew: true,
  },
  {
    id: "2",
    title: "Maintenance Window",
    description: "Scheduled maintenance on March 15, 2:00-3:00 UTC.",
    time: "1d ago",
    isNew: false,
  },
  {
    id: "3",
    title: "Referral Program Update",
    description: "Earn up to 40% commission on referred trades.",
    time: "3d ago",
    isNew: false,
  },
]

function AnnouncementsList({
  items,
  onDismiss,
}: {
  items: typeof defaultAnnouncements
  onDismiss: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <HugeiconsIcon icon={Megaphone01Icon} className="h-8 w-8 text-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">All caught up</span>
        <span className="text-xs text-muted-foreground/60">No new announcements</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border/30">
      {items.map((item) => (
        <div key={item.id} className="group flex gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
          <HugeiconsIcon icon={Notification01Icon} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{item.title}</span>
              {item.isNew && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  New
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground line-clamp-2">{item.description}</span>
            <span className="text-[10px] text-muted-foreground/60">{item.time}</span>
          </div>
          {/* Hover-to-reveal is a pointer idea: a phone has no hover, so on
              the modal (below `md`) the dismiss button is simply there, and
              big enough to hit. From `md` up — the popover — it goes back to
              appearing with the row it belongs to. */}
          <button
            onClick={() => onDismiss(item.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-lg transition-opacity hover:bg-accent md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
            aria-label={`Dismiss ${item.title}`}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function NotificationBell() {
  const isMobile = useIsMobile()
  const [items, setItems] = React.useState(defaultAnnouncements)
  const [open, setOpen] = React.useState(false)

  const newCount = items.filter((a) => a.isNew).length

  function dismiss(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id))
  }

  const trigger = (
    <button className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-95 focus:outline-none">
      <HugeiconsIcon icon={Notification01Icon} className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
      {newCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
          <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
            {newCount}
          </span>
        </span>
      )}
    </button>
  )

  /* The panel used to rise from the bottom edge as a sheet on a phone. It
     stopped: it is opened from a bell in the TOP bar, and a surface that
     answers a control up there has no business arriving from the floor. It is
     now the same centred card as every other dialog in the app — see
     `components/ui/modal-surface.ts` for the one shape. The app launcher on
     the mobile task bar is the sanctioned exception and keeps its sheet,
     because that bar IS the bottom edge and rising from it is the gesture the
     tap asked for.

     No height cap of our own here. The modal already scrolls inside itself at
     `calc(100dvh-2rem)`; a `max-h-[70vh]` on top of that would just be a
     second, shorter answer to a question that is already settled. */
  if (isMobile) {
    return (
      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalTrigger render={trigger} />
        <ResponsiveModalContent className="gap-3 sm:max-w-sm">
          {/* `pr-9` keeps the title and its count clear of the sticky close
              button the modal renders for itself. */}
          <ResponsiveModalHeader className="flex-row items-center gap-2 pr-9">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-4 w-4 shrink-0 text-primary" />
            <ResponsiveModalTitle className="text-sm font-semibold">Announcements</ResponsiveModalTitle>
            {newCount > 0 && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground">
                {newCount}
              </span>
            )}
          </ResponsiveModalHeader>
          {/* Full-bleed, so the row dividers run the width of the card the way
              they run the width of the popover. The card's own bottom padding
              keeps the last row off the rounded corners. */}
          <div className="-mx-4">
            <AnnouncementsList items={items} onDismiss={dismiss} />
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    )
  }

  /* Desktop is left alone as a popover. Anchored under the bell it points at
     the control that opened it, which is the right affordance for a glance-at
     list and is not what the "every modal looks different" complaint was
     about — that was the phone. */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 border-0 shadow-xl shadow-black/8 bg-popover ring-1 ring-border/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Announcements</h3>
          </div>
          {newCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground">
              {newCount}
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          <AnnouncementsList items={items} onDismiss={dismiss} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
