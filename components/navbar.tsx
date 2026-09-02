"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon as Search,
  UserIcon as User,
  Settings01Icon as Settings,
  Logout01Icon as LogOut,
  ArrowRight01Icon as ArrowRight,
  ArrowDownLeft01Icon as ArrowDownLeft,
  BankIcon as Bank,
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
  SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { NavbarActions } from "@/components/navbar-actions"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { useCashBalance } from "@/hooks/useCashBalance"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"

export function Navbar() {
  const isMobile = useIsMobile()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const { user, signOut } = useAuth()
  const { openFlow } = useMoneyFlow()
  const { cash, loaded: cashLoaded } = useCashBalance()
  const { hidden } = useBalancePrivacy()

  // ⌘K / Ctrl-K jumps to search from anywhere. The hint chip renders the
  // Windows form first and corrects to ⌘ after mount — hydration-safe.
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [kbdHint, setKbdHint] = React.useState("Ctrl K")
  React.useEffect(() => {
    if (/Mac/i.test(navigator.platform)) setKbdHint("⌘K")
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const email = user?.email || ""
  const initials = displayName.charAt(0).toUpperCase()

  /* ── Shared profile content ── */
  const profileContent = (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.imageUrl} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-[1.5px] border-background bg-emerald-500" />
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-semibold leading-none">{displayName}</p>
          <p className="text-[11px] leading-none text-muted-foreground mt-0.5">{email}</p>
        </div>
      </div>
      <div className="h-px bg-border/15 mx-1" />
      <a href="/profile" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors">
        <HugeiconsIcon icon={User} className="h-3.5 w-3.5" />
        Profile
      </a>
      <a href="/settings" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors">
        <HugeiconsIcon icon={Settings} className="h-3.5 w-3.5" />
        Settings
      </a>
      <div className="h-px bg-border/15 mx-1" />
      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <HugeiconsIcon icon={LogOut} className="h-3.5 w-3.5" />
        Log out
      </button>
    </div>
  )

  const profileTrigger = (
    <button className="group flex h-10 items-center gap-1 rounded-full pl-1 pr-1 transition-colors hover:bg-accent/60 focus:outline-none active:scale-[0.97] md:h-8 md:pr-1.5">
      <div className="relative">
        <Avatar className="h-8 w-8 md:h-6 md:w-6">
          <AvatarImage src={user?.imageUrl} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold md:text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-[1.5px] border-background bg-emerald-500" />
      </div>
      <HugeiconsIcon icon={ArrowRight} className="hidden md:block h-3 w-3 rotate-90 text-muted-foreground/60" />
    </button>
  )

  return (
    // The band is gone: the header itself is transparent — the silk field is
    // the ground — and its controls float on it as three glass instruments
    // (launcher · search · utility cluster), the same grammar as the floating
    // rail: rounded-full, translucent card fill, hairline ring, blur.
    <header className="relative z-40 flex h-14 w-full shrink-0 items-center gap-2 px-3 md:h-16 md:gap-3 md:px-6 lg:px-8">
      {/* Mobile: logo */}
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <img src="/worldstreet-logo/WorldStreet4x.png" alt="WS" className="h-6 w-6 shrink-0 rounded-full" />
        <span className="truncate font-display text-[15px] font-semibold tracking-[-0.01em]">WorldStreet</span>
      </div>

      {/* Search — the bar's one wide instrument, centered between clusters.
          ⌘K/Ctrl-K focuses it from anywhere; the chip says so. */}
      <div className="flex flex-1 justify-center">
        <div className="relative hidden w-full max-w-md md:block">
          <HugeiconsIcon icon={Search} className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search assets, trades…"
            onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur() }}
            className="ws-nav-glass h-10 w-full rounded-full bg-card/35 pl-11 pr-4 text-[13px] ring-1 ring-border/50 backdrop-blur-xl outline-none transition-all placeholder:text-muted-foreground/50 focus:bg-card/80 focus:ring-primary/40 lg:pr-16"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center rounded-md bg-surface-sunken/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground/70 ring-1 ring-border/40 lg:flex">
            {kbdHint}
          </kbd>
        </div>
      </div>

      {/* Cash — the Dollar Account, which is the money a Deposit actually
          spends. It sits immediately left of that CTA so the figure and the
          action read as one thought. Masked by the same eye button as the
          dashboard hero; withheld until loaded so it never flashes a $0.00
          it would have to correct. */}
      {cashLoaded && (
        <div
          className="ws-nav-glass hidden h-10 shrink-0 items-center gap-2 rounded-full bg-card/35 px-3.5 ring-1 ring-border/50 backdrop-blur-xl lg:flex"
          title="Dollar Account"
        >
          {/* The icon replaces the "Cash" label, so the account it names has to
              survive for screen readers — a title attribute alone doesn't. */}
          <HugeiconsIcon icon={Bank} aria-hidden className="h-4 w-4 text-muted-foreground/70" />
          <span className="sr-only">Dollar Account balance:</span>
          <span className="text-[13px] font-semibold tabular-nums">
            {hidden
              ? "$••••"
              : cash.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </span>
        </div>
      )}

      {/* Deposit — the one primary action, reachable from every page. The
          only gold in the bar, exactly as the system intends. */}
      <button
        type="button"
        onClick={() => openFlow("buy")}
        className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary pl-3.5 pr-4 text-[13px] font-bold text-primary-foreground shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-all hover:bg-primary/90 active:scale-[0.97] motion-reduce:active:scale-100 md:flex"
      >
        <HugeiconsIcon icon={ArrowDownLeft} className="h-4 w-4" />
        Deposit
      </button>

      {/* Utility cluster — one glass pill: actions · account.
          (The theme control is gone: the app is dark-only. See
          components/theme-provider.tsx to restore it.) */}
      <div className="ws-nav-glass ml-auto flex h-11 shrink-0 items-center gap-0.5 rounded-full bg-card/35 px-1 ring-1 ring-border/50 backdrop-blur-xl md:h-10 md:px-1.5">
        <NavbarActions />
        <div className="mx-0.5 h-4 w-px bg-border/60" />

        {/* Profile — bottom sheet on mobile, popover on desktop */}
        {isMobile ? (
          <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
            <SheetTrigger render={profileTrigger} />
            <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="text-sm">Account</SheetTitle>
              </SheetHeader>
              <div className="px-2 pb-6">{profileContent}</div>
            </SheetContent>
          </Sheet>
        ) : (
          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger render={profileTrigger} />
            <PopoverContent className="w-52 p-1.5 border-0 shadow-xl shadow-black/8 bg-popover/60 backdrop-blur-2xl ring-1 ring-white/10 rounded-xl" align="end" sideOffset={8}>
              {profileContent}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  )
}
