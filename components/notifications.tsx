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
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

const defaultAnnouncements = [
  {
    id: "1",
    title: "New: SOL/USDT Futures Live",
    description: "Trade Solana perpetual futures with up to 20x leverage.",
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
          <button
            onClick={() => onDismiss(item.id)}
            className="shrink-0 self-start p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
            aria-label="Dismiss"
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

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={trigger} />
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Megaphone01Icon} className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Announcements</h3>
              {newCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {newCount}
                </span>
              )}
            </div>
          </SheetHeader>
          <AnnouncementsList items={items} onDismiss={dismiss} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 border-0 shadow-xl shadow-black/8 bg-popover/80 backdrop-blur-2xl ring-1 ring-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Announcements</h3>
          </div>
          {newCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
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
