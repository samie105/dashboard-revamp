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
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { CoinAvatar } from "./coin-avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notifications"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAuth } from "@/components/auth-provider"
import { TopNav } from "@/components/top-nav"

export function SpotTopBar({
  coin,
  onOpenSearch,
  onOpenDeposit,
  onOpenWithdraw,
  refreshTrigger,
}: {
  coin: CoinData
  onOpenSearch: () => void
  onOpenDeposit?: () => void
  onOpenWithdraw?: () => void
  refreshTrigger?: number
}) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [mobileInfoOpen, setMobileInfoOpen] = React.useState(false)
  const { usdcBalance, accountValue, balances, loading: balanceLoading, refetch } = useHyperliquidBalance(user?.userId, !!user)

  // Fire refetch whenever parent signals a deposit/withdraw completed
  const isFirstRender = React.useRef(true)
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (refreshTrigger !== undefined) refetch()
  }, [refreshTrigger])

  const spotBalance = usdcBalance.available
  const totalValue = balances.reduce((sum, b) => sum + (b.currentValue || 0), 0)
  const inOrders = usdcBalance.hold
  const otherAssetsCount = balances.length > 1 ? balances.length - 1 : 0
  const showBalance = !balanceLoading

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const initials = displayName.charAt(0).toUpperCase()
  const isPositive = coin.change24h >= 0

  const fmtPrice = coin.price < 1
    ? coin.price.toFixed(4)
    : coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <>
      <header className="flex items-center gap-2 lg:gap-4 border-b border-border/10 bg-background/80 px-3 py-2 backdrop-blur-xl">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="rounded-lg p-1.5 transition-colors hover:bg-accent shrink-0"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </button>

        {/* Logo — hidden on mobile */}
        <button
          onClick={() => router.push("/")}
          className="hidden lg:flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary shrink-0"
        >
          <img
            src="/worldstreet-logo/WorldStreet4x.png"
            alt="WS"
            className="h-6 w-6 rounded-full"
          />
          <span className="hidden xl:inline">WorldStreet</span>
        </button>

        <div className="hidden lg:block h-5 w-px bg-border/30 shrink-0" />

        {/* Trading switcher — hidden on mobile */}
        <div className="hidden lg:block">
          <TopNav />
        </div>

        <div className="hidden lg:block h-5 w-px bg-border/30 shrink-0" />

        {/* Pair selector + price + change — always visible */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 lg:gap-2 shrink-0"
        >
          <CoinAvatar image={coin.image} symbol={coin.symbol} size={20} />
          <span className="text-sm font-bold">{coin.symbol}/{coin.quoteAsset || "USDC"}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className="h-3 w-3 text-muted-foreground"
          />
        </button>

        <span
          className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}
        >
          ${fmtPrice}
        </span>

        <span
          className={`text-xs font-medium tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}
        >
          {isPositive ? "+" : ""}
          {coin.change24h.toFixed(2)}%
        </span>

        {/* Vol / Cap — hidden on mobile */}
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
          {/* Balance — hidden on mobile */}
          {showBalance && (
            <div className="hidden lg:flex items-center gap-3 rounded-xl bg-transparent px-2.5 py-1.5 mr-0.5">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-muted-foreground leading-none">Spot Balance</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    ${spotBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground leading-none">Total Value</span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {inOrders > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-muted-foreground leading-none">In Orders</span>
                  <span className="text-xs font-bold tabular-nums text-amber-500">
                    ${inOrders.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {otherAssetsCount > 0 && (
                <span className="text-[10px] text-muted-foreground">+{otherAssetsCount} assets</span>
              )}
            </div>
          )}
          {/* Deposit — hidden on mobile */}
          {onOpenDeposit && (
            <button
              onClick={onOpenDeposit}
              className="hidden lg:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/10"
            >
              <HugeiconsIcon icon={Download04Icon} className="h-3 w-3" />
              <span className="hidden sm:inline">Deposit</span>
            </button>
          )}
          {/* Withdraw — hidden on mobile */}
          {onOpenWithdraw && (
            <button
              onClick={onOpenWithdraw}
              className="hidden lg:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-orange-500 transition-colors hover:bg-orange-500/10"
            >
              <HugeiconsIcon icon={Upload04Icon} className="h-3 w-3" />
              <span className="hidden sm:inline">Withdraw</span>
            </button>
          )}
          {/* Notifications / theme / profile — hidden on mobile */}
          <div className="hidden lg:block"><NotificationBell /></div>
          <div className="hidden lg:block"><ThemeToggle /></div>
          <div className="hidden lg:block">
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

          {/* Mobile "more" button — visible only < lg */}
          <button
            onClick={() => setMobileInfoOpen(true)}
            className="lg:hidden rounded-lg p-1.5 transition-colors hover:bg-accent"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* ── Mobile info drawer ── */}
      <Sheet open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          <SheetHeader className="px-4 pb-2 pt-0">
            <SheetTitle className="text-sm">{coin.symbol}/{coin.quoteAsset || "USDC"} Details</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            {/* Price row */}
            <div className="flex items-baseline gap-3">
              <span className={`text-2xl font-bold tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                ${fmtPrice}
              </span>
              <span className={`text-sm font-medium tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                {isPositive ? "+" : ""}{coin.change24h.toFixed(2)}%
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-accent/30 p-3">
                <span className="text-[10px] text-muted-foreground">24h Volume</span>
                <p className="text-sm font-bold tabular-nums">${(coin.volume24h / 1e6).toFixed(2)}M</p>
              </div>
              <div className="rounded-xl bg-accent/30 p-3">
                <span className="text-[10px] text-muted-foreground">Market Cap</span>
                <p className="text-sm font-bold tabular-nums">${(coin.marketCap / 1e9).toFixed(2)}B</p>
              </div>
            </div>

            {/* Balance section */}
            {showBalance && (
              <div className="rounded-xl bg-accent/30 p-3 space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Balances</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Spot Balance</span>
                    <p className="font-bold tabular-nums">
                      ${spotBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Value</span>
                    <p className="font-bold tabular-nums">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  {inOrders > 0 && (
                    <div>
                      <span className="text-muted-foreground">In Orders</span>
                      <p className="font-bold tabular-nums text-amber-500">
                        ${inOrders.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {otherAssetsCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">Holdings</span>
                      <p className="font-bold">{otherAssetsCount} asset{otherAssetsCount > 1 ? "s" : ""}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {onOpenDeposit && (
                <button
                  onClick={() => { onOpenDeposit(); setMobileInfoOpen(false) }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-emerald-500 bg-emerald-500/10 transition-colors hover:bg-emerald-500/20"
                >
                  <HugeiconsIcon icon={Download04Icon} className="h-4 w-4" />
                  Deposit
                </button>
              )}
              {onOpenWithdraw && (
                <button
                  onClick={() => { onOpenWithdraw(); setMobileInfoOpen(false) }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-orange-500 bg-orange-500/10 transition-colors hover:bg-orange-500/20"
                >
                  <HugeiconsIcon icon={Upload04Icon} className="h-4 w-4" />
                  Withdraw
                </button>
              )}
            </div>

            {/* Footer row: theme + notifications + profile */}
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <NotificationBell />
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.imageUrl} alt={displayName} />
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{displayName}</span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
