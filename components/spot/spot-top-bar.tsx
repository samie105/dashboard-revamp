"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  Wallet01Icon,
  UserIcon,
  Settings01Icon,
  Logout01Icon,
  Download04Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
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

export function SpotTopBar({
  coin,
  onOpenSearch,
  onOpenDeposit,
  onOpenWithdraw,
}: {
  coin: CoinData
  onOpenSearch: () => void
  onOpenDeposit?: () => void
  onOpenWithdraw?: () => void
}) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const { usdcBalance, accountValue, loading: balanceLoading } = useHyperliquidBalance(user?.id, !!user)

  const spotBalance = usdcBalance.available
  const totalValue = spotBalance + accountValue
  const showBalance = !balanceLoading

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const initials = displayName.charAt(0).toUpperCase()
  const isPositive = coin.change24h >= 0

  return (
    <header className="flex items-center gap-4 border-b border-border/10 bg-background/80 px-3 py-2 backdrop-blur-xl">
      {/* Back button */}
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

      {/* Trading switcher */}
      <TopNav />

      <div className="h-5 w-px bg-border/30 shrink-0 hidden md:block" />

      {/* Pair selector + stats */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 shrink-0"
      >
        {coin.image && (
          <img src={coin.image} alt="" className="h-5 w-5 rounded-full" />
        )}
        <span className="text-sm font-bold">{coin.symbol}/USDT</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="h-3 w-3 text-muted-foreground"
        />
      </button>

      <span
        className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}
      >
        $
        {coin.price < 1
          ? coin.price.toFixed(4)
          : coin.price.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
      </span>

      <span
        className={`text-xs font-medium tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}
      >
        {isPositive ? "+" : ""}
        {coin.change24h.toFixed(2)}%
      </span>

      <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground ml-2">
        <div className="flex flex-col">
          <span>24h Vol</span>
          <span className="font-medium text-foreground tabular-nums">
            ${(coin.volume24h / 1e6).toFixed(2)}M
          </span>
        </div>
        <div className="hidden lg:flex flex-col">
          <span>Mkt Cap</span>
          <span className="font-medium text-foreground tabular-nums">
            ${(coin.marketCap / 1e9).toFixed(2)}B
          </span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
        {showBalance && (
          <div className="flex items-center gap-3 rounded-xl bg-transparent px-2.5 py-1.5 mr-0.5">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex flex-col items-end">
                <span className="hidden md:block text-[9px] text-muted-foreground leading-none">Spot Balance</span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  ${spotBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[9px] text-muted-foreground leading-none">Total Value</span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
        {onOpenDeposit && (
          <button
            onClick={onOpenDeposit}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/10"
          >
            <HugeiconsIcon icon={Download04Icon} className="h-3 w-3" />
            <span className="hidden sm:inline">Deposit</span>
          </button>
        )}
        {onOpenWithdraw && (
          <button
            onClick={onOpenWithdraw}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-orange-500 transition-colors hover:bg-orange-500/10"
          >
            <HugeiconsIcon icon={Upload04Icon} className="h-3 w-3" />
            <span className="hidden sm:inline">Withdraw</span>
          </button>
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
