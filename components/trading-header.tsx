"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Wallet01Icon,
  UserIcon,
  Settings01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import { getUserBalances } from "@/lib/actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notifications"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAuth } from "@/components/auth-provider"
import { TopNav } from "@/components/top-nav"

/**
 * Shared header for full-bleed trading pages (Forex, Binary, etc.)
 * Mirrors the SpotTopBar pattern: back · logo · TopNav · {children} · actions
 */
export function TradingHeader({ children }: { children?: React.ReactNode }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [totalBalance, setTotalBalance] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!user?.userId) return
    let cancelled = false
    getUserBalances(user.userId).then((res) => {
      if (!cancelled && res.success) setTotalBalance(res.totalUsd)
    })
    return () => {
      cancelled = true
    }
  }, [user?.userId])

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <header className="flex items-center gap-4 border-b border-border/10 bg-background/80 px-3 py-2 backdrop-blur-xl shrink-0">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="rounded-lg p-1.5 transition-colors hover:bg-accent shrink-0"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
      </button>

      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary shrink-0"
      >
        <img
          src="/worldstreet-logo/WorldStreet4x.png"
          alt="WS"
          className="h-6 w-6 rounded-full"
        />
        <span className="hidden xl:inline">WorldStreet</span>
      </button>

      <div className="h-5 w-px bg-border/30 shrink-0" />

      {/* Trading switcher dropdown */}
      <TopNav />

      <div className="h-5 w-px bg-border/30 shrink-0 hidden md:block" />

      {/* Page-specific center content (pair info, asset info, etc.) */}
      {children}

      {/* Right-side actions */}
      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        {totalBalance !== null && (
          <div className="flex items-center gap-1.5 rounded-lg bg-accent/50 px-2.5 py-1 mr-1 md:mr-2">
            <HugeiconsIcon
              icon={Wallet01Icon}
              className="h-3.5 w-3.5 text-primary shrink-0 md:hidden"
            />
            <div className="flex flex-col items-end">
              <span className="hidden md:block text-[9px] text-muted-foreground leading-none">
                Balance
              </span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                $
                {totalBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        )}
        <NotificationBell />
        <ThemeToggle />
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger
            render={
              <button className="rounded-full p-1 transition-opacity hover:opacity-80 focus:outline-none" />
            }
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback className="text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end" sideOffset={8}>
            <div className="flex flex-col gap-1 p-1">
              <p className="text-xs font-medium">{displayName}</p>
              <p className="mb-1 text-[10px] text-muted-foreground">
                {user?.email}
              </p>
              <a
                href="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <HugeiconsIcon icon={UserIcon} className="h-3.5 w-3.5" />{" "}
                Profile
              </a>
              <a
                href="/settings"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <HugeiconsIcon icon={Settings01Icon} className="h-3.5 w-3.5" />{" "}
                Settings
              </a>
              <div className="my-1 h-px bg-border/30" />
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-accent"
              >
                <HugeiconsIcon icon={Logout01Icon} className="h-3.5 w-3.5" />{" "}
                Log out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
