"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  Notification01Icon,
  Cancel01Icon,
  Exchange01Icon,
  Activity01Icon,
  ArrowRight01Icon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { useAuth } from "@/components/auth-provider"
import { useWalletMode } from "@/components/wallet-mode-provider"
import { Segmented } from "@/components/ui/system"
import { SoonBadge } from "@/components/ui/coming-soon"
import { MigrationNotice } from "@/components/crypto/MigrationNotice"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { SendModal as ModernSendModal } from "@/components/crypto/SendModal"
import { getPrices } from "@/lib/actions"
import {
  getSpotBalances,
  getSpotPositions,
  getTokenPrices,
  type LedgerBalance,
  type PositionInfo,
} from "@/lib/trade-adapter"

/* ─── Types ─── */
type ActiveSection = "wallet" | "notifications" | null

const SECTIONS: ActiveSection[] = ["wallet", "notifications"]

/* ─── Helpers ─── */
const INITIAL_ANNOUNCEMENTS = [
  { id: "1", title: "Spot trading is live on six chains", desc: "Swap and trade thousands of tokens across Ethereum, Arbitrum, Solana, Sui, TON and Tron.", time: "2h ago", isNew: true },
  { id: "2", title: "Maintenance Window", desc: "Scheduled maintenance on March 15, 2:00-3:00 UTC.", time: "1d ago", isNew: false },
  { id: "3", title: "Referral Program Update", desc: "Earn up to 40% commission on referred trades.", time: "3d ago", isNew: false },
]

/* ─────────────────────────────────────────────────
   NavbarActions — Unified grouped popover
   wallet · notifications
   ───────────────────────────────────────────────── */
export function NavbarActions() {
  const { user } = useAuth()
  const { mode: walletMode, setMode: setWalletMode, canChoose: canChooseWallet } = useWalletMode()
  const { openFlow } = useMoneyFlow()
  /* The wallet section's own money doors. These used to open the cash flow —
     "buy" and "sell" against the DOLLAR account — from a panel sitting under
     a wallet-mode switch, showing a balance denominated in the wallet's own
     tokens. Depositing into a self-custodial wallet means being shown its
     address, not being sold currency. */
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const modernWalletMode = walletMode === "modern"
  const isMobile = useIsMobile()

  /* ── Wallet data ── */
  const { balances: chainBal } = useWalletBalances(60_000)
  const { accountValue: hlAccountValue } = useHyperliquidBalance(user?.userId, !!user)

  // Live token prices (for on-chain valuation)
  const [prices, setPrices] = useState<Record<string, number>>({})
  // SpotV2 ledger data (same source as dashboard/assets)
  const [spotLedger, setSpotLedger] = useState<LedgerBalance[]>([])
  const [spotPositions, setSpotPositions] = useState<(PositionInfo & { currentPrice: number })[]>([])

  useEffect(() => {
    let cancelled = false
    getPrices()
      .then((data) => { if (!cancelled && data?.prices) setPrices(data.prices) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      try {
        const [balances, positions] = await Promise.all([
          getSpotBalances(),
          getSpotPositions(),
        ])
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        if (cancelled) return
        setSpotLedger(balances)
        setSpotPositions(positions.map((p) => ({ ...p, currentPrice: priceMap.get(p.token) ?? 0 })))
      } catch { /* empty state */ }
    }
    load()
    const i = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(i) }
  }, [user])

  // Total estimated value — on-chain (priced) + spot ledger + futures account value.
  // Mirrors the dashboard "Total" wallet view so the figures match.
  const estValue = useMemo(() => {
    // On-chain: value every token at its USD price (stablecoins fall back to $1)
    let onChain = 0
    for (const b of chainBal) {
      const p = prices[b.symbol] ?? 0
      onChain += b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
    }
    // Spot: SpotV2 ledger (available + locked) + open positions value
    const spot =
      spotLedger.reduce((s, b) => s + b.available + b.locked, 0) +
      spotPositions.reduce((s, p) => s + p.quantity * p.currentPrice, 0)
    // Futures: Hyperliquid perps account value
    return onChain + spot + hlAccountValue
  }, [chainBal, prices, spotLedger, spotPositions, hlAccountValue])

  /* ── Notification data ── */
  const [notifs, setNotifs] = useState(INITIAL_ANNOUNCEMENTS)
  const newNotifCount = notifs.filter(n => n.isNew).length

  /* ── UI state ── */
  const [section, setSection] = useState<ActiveSection>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef<ActiveSection>(null)
  const wasOpenRef = useRef(false)

  /* ── Pill entrance ── */
  useEffect(() => {
    if (!pillRef.current) return
    gsap.fromTo(
      pillRef.current,
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.6)", clearProps: "transform,opacity" },
    )
  }, [])

  /* ── Dropdown entrance ── */
  useEffect(() => {
    if (!section) { wasOpenRef.current = false; return }
    if (!wasOpenRef.current && dropRef.current) {
      // clearProps is load-bearing, not tidiness: the leftover transform
      // would keep the panel's backdrop-blur switched off for as long as the
      // dropdown stayed open.
      gsap.fromTo(
        dropRef.current,
        { opacity: 0, y: -8, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power3.out", clearProps: "transform" },
      )
      wasOpenRef.current = true
    }
  }, [section])

  /* ── Content slide on section switch ── */
  useEffect(() => {
    if (!contentRef.current || !section) return
    const prev = prevRef.current
    prevRef.current = section
    if (!prev || prev === section) return
    const dir = SECTIONS.indexOf(section)! > SECTIONS.indexOf(prev)! ? 1 : -1
    gsap.fromTo(contentRef.current, { opacity: 0, x: dir * 16 }, { opacity: 1, x: 0, duration: 0.18, ease: "power2.out" })
  }, [section])

  /* ── Desktop hover ── */
  const enter = useCallback((s: ActiveSection) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSection(s)
  }, [])
  const leave = useCallback(() => {
    timerRef.current = setTimeout(() => { setSection(null); prevRef.current = null }, 200)
  }, [])
  const dropEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  /* ── Mobile tap ── */
  const tap = useCallback((s: NonNullable<ActiveSection>) => {
    setSection(prev => prev === s ? null : s)
  }, [])

  /* ── Click outside (mobile) ── */
  useEffect(() => {
    if (!section || !isMobile) return
    const h = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      setSection(null)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [section, isMobile])

  const dismissNotif = useCallback((id: string) => setNotifs(p => p.filter(n => n.id !== id)), [])

  return (
    <div ref={containerRef} className="relative" onMouseLeave={isMobile ? undefined : leave}>
      {/* ── Icon Group — bare icons, no bordered box (mobile header grammar) ── */}
      <div ref={pillRef} className="flex items-center gap-0.5 overflow-visible">
        {/* Wallet */}
        {isMobile ? (
          <button onClick={() => tap("wallet")} className={cn("flex h-10 w-10 items-center justify-center rounded-full transition-colors", section === "wallet" ? "bg-primary/10 text-primary" : "text-muted-foreground/70 active:bg-muted/50 active:text-foreground")}>
            <HugeiconsIcon icon={Wallet01Icon} size={17} />
          </button>
        ) : (
          <button onMouseEnter={() => enter("wallet")} className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-colors", section === "wallet" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            <HugeiconsIcon icon={Wallet01Icon} size={16} />
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          {isMobile ? (
            <button onClick={() => tap("notifications")} className={cn("relative flex h-10 w-10 items-center justify-center rounded-full transition-colors", section === "notifications" ? "bg-primary/10 text-primary" : "text-muted-foreground/70 active:bg-muted/50 active:text-foreground")}>
              <HugeiconsIcon icon={Notification01Icon} size={17} />
              {newNotifCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 min-w-3 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[7px] flex items-center justify-center font-bold">{newNotifCount}</div>
              )}
            </button>
          ) : (
            <button onMouseEnter={() => enter("notifications")} className={cn("relative flex h-8 w-8 items-center justify-center rounded-full transition-colors", section === "notifications" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <HugeiconsIcon icon={Notification01Icon} size={16} />
              {newNotifCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center font-bold">{newNotifCount}</div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Shared Dropdown ── */}
      {section && (
        <div
          ref={dropRef}
          className={cn(
            "z-50",
            isMobile
              ? "fixed inset-x-3 top-[calc(3.5rem+0.5rem)]"
              : "absolute right-0 top-full mt-2.5 w-85",
          )}
          onMouseEnter={isMobile ? undefined : dropEnter}
          onMouseLeave={isMobile ? undefined : leave}
        >
          {/* SOLID, not glass. Two reasons, and they agree: the design
              system's glass ruling (design-system/06-motion-accessibility)
              says dropdowns sit on solid surfaces with hairlines and bans
              backdrop-filter outright — and backdrop-filter could not be
              relied on here anyway, because any transformed ancestor (this
              panel's own entrance tween, a Floating UI position) silently
              turns it into a no-op and leaves a translucent wash over live
              balances. */}
          <div className="overflow-hidden rounded-2xl bg-popover shadow-[0_8px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-border/40">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
              <span className="text-[13px] font-semibold text-foreground/90 tracking-tight">
                {section === "wallet" ? "Wallet" : "Notifications"}
              </span>
              {isMobile && (
                <button onClick={() => setSection(null)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors">
                  <HugeiconsIcon icon={Cancel01Icon} size={10} />
                </button>
              )}
            </div>

            <div ref={contentRef}>
              {/* ══════ Wallet ══════ */}
              {section === "wallet" && (
                <div className="p-4">
                  <div className="mb-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Est. Value</p>
                    <p className="text-xl font-bold tabular-nums tracking-tight mt-0.5">
                      ${estValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">USD</span>
                    </p>
                  </div>
                  {canChooseWallet && (
                    <div className="mb-3">
                      <Segmented
                        size="sm"
                        grow
                        value={walletMode}
                        onChange={setWalletMode}
                        options={[
                          { key: "modern", label: "New wallet" },
                          { key: "legacy", label: "Old wallet" },
                        ]}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {/* Opens the money-flow modal in place — the popover
                        closes first so it isn't left hanging underneath. */}
                    <button
                      type="button"
                      onClick={() => {
                        setSection(null)
                        if (modernWalletMode) setReceiveOpen(true)
                        else openFlow("buy")
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                      <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5 text-white [&_path]:stroke-current [&_path]:fill-none [&_path]:opacity-100" />
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSection(null)
                        if (modernWalletMode) setSendOpen(true)
                        else openFlow("sell")
                      }}
                      className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      Withdraw
                    </button>
                  </div>
                  <div className="h-px bg-border/20 mb-2" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1 block">Wallets</span>
                  <div className="flex flex-col gap-0.5">
                    {([
                      { label: "Spot Wallet", href: "/portfolio", icon: Wallet01Icon, soon: false },
                      // Futures is not open yet — the row stays so the balance
                      // still has a name, but it does not lead anywhere.
                      { label: "Futures Wallet", href: "", icon: Activity01Icon, soon: true },
                      { label: "Funding", href: "/assets", icon: Wallet01Icon, soon: false },
                    ] as const).map(w =>
                      w.soon ? (
                        <span
                          key={w.label}
                          title="Futures is not open yet"
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/50"
                        >
                          <HugeiconsIcon icon={w.icon} className="h-3.5 w-3.5 text-muted-foreground/40" />
                          <span className="flex-1 font-medium">{w.label}</span>
                          <SoonBadge />
                        </span>
                      ) : (
                        <a key={w.label} href={w.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors group/link">
                          <HugeiconsIcon icon={w.icon} className="h-3.5 w-3.5 text-primary" />
                          <span className="flex-1 font-medium">{w.label}</span>
                          <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                        </a>
                      ),
                    )}
                    <Link href="/wallet/modern" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors group/link">
                      <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary" />
                      <span className="flex-1 font-medium">Worldstreet Wallet</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                    </Link>
                  </div>
                </div>
              )}

              {/* ══════ Notifications ══════ */}
              {section === "notifications" && (
                <div className="max-h-[min(60dvh,22rem)] overflow-y-auto overscroll-contain">
                  {/* Spec §2 — pinned above fetched notifications for
                      confirmed legacy-wallet owners; renders nothing
                      otherwise (modern-only users, unclassifiable lookups,
                      dismissed/confirmed). */}
                  <MigrationNotice variant="notification" />
                  {notifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <HugeiconsIcon icon={Megaphone01Icon} className="h-8 w-8 text-muted-foreground/40" />
                      <span className="text-xs font-medium text-muted-foreground">All caught up</span>
                      <span className="text-[11px] text-muted-foreground/50">No new notifications</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/15">
                      {notifs.map(n => (
                        <div key={n.id} className="group flex gap-2.5 px-3.5 py-2.5 hover:bg-muted/30 transition-colors">
                          <HugeiconsIcon icon={Notification01Icon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium">{n.title}</span>
                              {n.isNew && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase text-primary">New</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-0.5">{n.desc}</p>
                            <span className="text-[10px] text-muted-foreground/40">{n.time}</span>
                          </div>
                          <button onClick={() => dismissNotif(n.id)} className="shrink-0 self-start p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
                            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-muted-foreground/50" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The modern wallet's own money doors, mounted at the navbar so the
          popover can close before they open. Deposit shows the wallet's
          addresses; withdraw sends from it. Neither touches the cash account. */}
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
      <ModernSendModal open={sendOpen} onOpenChange={setSendOpen} />
    </div>
  )
}
