"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon as Search,
  UserIcon as User,
  Settings01Icon as Settings,
  Logout01Icon as LogOut,
  ArrowRight01Icon as ArrowRight,
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
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/components/auth-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { TopNav } from "@/components/top-nav"
import { NavbarActions } from "@/components/navbar-actions"

export function Navbar({ hideDiscover }: { hideDiscover?: boolean } = {}) {
  const isMobile = useIsMobile()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const { user, signOut } = useAuth()

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
    <button className="group flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-accent/40 focus:outline-none active:scale-[0.97]">
      <div className="relative">
        <Avatar className="h-6 w-6">
          <AvatarImage src={user?.imageUrl} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-[1.5px] border-background bg-emerald-500" />
      </div>
      <HugeiconsIcon icon={ArrowRight} className="hidden md:block h-3 w-3 rotate-90 text-muted-foreground/60" />
    </button>
  )

  return (
    <header className="sticky top-0 z-40 flex h-12 w-full shrink-0 items-center gap-2 border-b border-border/5 bg-background/80 px-3 backdrop-blur-2xl md:gap-4 md:px-6">
      {/* Mobile: logo */}
      <div className="flex md:hidden items-center gap-2">
        <img src="/worldstreet-logo/WorldStreet4x.png" alt="WS" className="h-5 w-5 rounded-full" />
        <span className="text-sm font-bold">WorldStreet</span>
      </div>

      {/* Desktop: inline top nav */}
      {!hideDiscover && <TopNav />}

      {/* Desktop: search */}
      <div className="flex flex-1 items-center gap-4">
        <div className="hidden md:flex relative max-w-sm w-full">
          <HugeiconsIcon icon={Search} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input 
            type="search"
            placeholder="Search assets, trades..." 
            className="w-full rounded-lg border-0 bg-accent/30 pl-8 pr-3 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus:bg-accent/50 focus:ring-1 focus:ring-border/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-0.5 md:gap-1 ml-auto">
        <NavbarActions />
        <ThemeToggle />

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
            <PopoverContent className="w-52 p-1.5 border-0 shadow-xl shadow-black/8 bg-popover/80 backdrop-blur-2xl ring-1 ring-white/10 rounded-xl" align="end" sideOffset={8}>
              {profileContent}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  )
}
