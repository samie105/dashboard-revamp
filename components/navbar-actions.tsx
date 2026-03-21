"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  Message01Icon,
  Notification01Icon,
  Call02Icon,
  Video01Icon,
  Cancel01Icon,
  CallIncoming04Icon,
  CallOutgoing04Icon,
  Exchange01Icon,
  Activity01Icon,
  ArrowRight01Icon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, avatarUrl } from "@/lib/utils"
import { useProfile } from "@/components/profile-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { useAuth } from "@/components/auth-provider"
import {
  getConversations,
  getTotalUnreadCount,
  getRecentUsers,
  type ConversationWithDetails,
  type UserSearchResult,
} from "@/lib/community/actions/messages"
import {
  getRecentCalls,
  type RecentCallItem,
} from "@/lib/community/actions/calls"
import { useGlobalCall } from "@/components/community/incoming-call-provider"

/* ─── Types ─── */
type ActiveSection = "wallet" | "community" | "notifications" | null
type CommunityTab = "messages" | "calls"

const SECTIONS: ActiveSection[] = ["wallet", "community", "notifications"]

/* ─── Helpers ─── */
function formatLastMessage(c: ConversationWithDetails): string {
  const prefix = c.isOwnLastMessage ? "You: " : ""
  const msg = c.lastMessage
  if (!msg) return "No messages"
  if (msg.startsWith("CALL_EVENT:")) {
    const parts = msg.split(":")
    const type = parts[1] === "video" ? "Video" : "Voice"
    const status = parts[2] || "completed"
    if (status === "missed") return `${prefix}Missed ${type.toLowerCase()} call`
    if (status === "declined") return `${prefix}Declined`
    return `${prefix}${type} call`
  }
  return `${prefix}${msg}`
}

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h`
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function callLabel(call: RecentCallItem) {
  if (call.status === "missed") return { text: call.isCaller ? "No answer" : "Missed", negative: true }
  if (call.status === "declined") return { text: "Declined", negative: true }
  if (call.status === "failed") return { text: "Failed", negative: true }
  if (call.duration > 0) return { text: fmtDuration(call.duration), negative: false }
  return { text: "Completed", negative: false }
}

const INITIAL_ANNOUNCEMENTS = [
  { id: "1", title: "New: SOL/USDT Futures Live", desc: "Trade Solana perpetual futures with up to 20x leverage.", time: "2h ago", isNew: true },
  { id: "2", title: "Maintenance Window", desc: "Scheduled maintenance on March 15, 2:00-3:00 UTC.", time: "1d ago", isNew: false },
  { id: "3", title: "Referral Program Update", desc: "Earn up to 40% commission on referred trades.", time: "3d ago", isNew: false },
]

/* ─────────────────────────────────────────────────
   NavbarActions — Unified grouped popover
   wallet · community (messages | calls) · notifications
   ───────────────────────────────────────────────── */
export function NavbarActions() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { startCall } = useGlobalCall()
  const isMobile = useIsMobile()

  /* ── Wallet data ── */
  const { balances: chainBal } = useWalletBalances(60_000)
  const { accountValue: hlAccountValue, balances: hlBalances } = useHyperliquidBalance(user?.userId, !!user)
  const estValue = useMemo(() => {
    let total = 0
    for (const b of chainBal) if (["USDT", "USDC"].includes(b.symbol)) total += b.balance
    total += hlBalances.reduce((s, b) => s + (b.currentValue || 0), 0)
    total += hlAccountValue
    return total
  }, [chainBal, hlBalances, hlAccountValue])

  /* ── Community data ── */
  const [unread, setUnread] = useState(0)
  const [convos, setConvos] = useState<ConversationWithDetails[]>([])
  const [calls, setCalls] = useState<RecentCallItem[]>([])
  const [users, setUsers] = useState<UserSearchResult[]>([])

  /* ── Notification data ── */
  const [notifs, setNotifs] = useState(INITIAL_ANNOUNCEMENTS)
  const newNotifCount = notifs.filter(n => n.isNew).length

  /* ── UI state ── */
  const [section, setSection] = useState<ActiveSection>(null)
  const [comTab, setComTab] = useState<CommunityTab>("messages")
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tabContentRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef<ActiveSection>(null)
  const wasOpenRef = useRef(false)

  /* ── Load community data ── */
  useEffect(() => {
    if (!profile?.authUserId) return
    const load = async () => {
      const [u, c, cl, us] = await Promise.all([
        getTotalUnreadCount(),
        getConversations(),
        getRecentCalls(10),
        getRecentUsers(),
      ])
      if (u.success) setUnread(u.count ?? 0)
      if (c.success && c.conversations) setConvos(c.conversations)
      if (cl.success) setCalls(cl.calls)
      if (us.success && us.users) setUsers(us.users)
    }
    load()
    const i = setInterval(load, 30_000)
    return () => clearInterval(i)
  }, [profile?.authUserId])

  /* ── Pill entrance ── */
  useEffect(() => {
    if (!pillRef.current) return
    gsap.fromTo(pillRef.current, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.6)" })
  }, [])

  /* ── Dropdown entrance ── */
  useEffect(() => {
    if (!section) { wasOpenRef.current = false; return }
    if (!wasOpenRef.current && dropRef.current) {
      gsap.fromTo(dropRef.current, { opacity: 0, y: -6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" })
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

  /* ── Tab content fade ── */
  useEffect(() => {
    if (!tabContentRef.current || section !== "community") return
    gsap.fromTo(tabContentRef.current, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" })
  }, [comTab, section])

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

  const doCall = useCallback((uid: string, type: "video" | "audio", name: string, avatar?: string | null) => {
    setSection(null)
    startCall({ participantId: uid, participantName: name, participantAvatar: avatar || undefined, callType: type })
  }, [startCall])

  const dismissNotif = useCallback((id: string) => setNotifs(p => p.filter(n => n.id !== id)), [])

  return (
    <div ref={containerRef} className="relative" onMouseLeave={isMobile ? undefined : leave}>
      {/* ── Icon Group ── */}
      <div ref={pillRef} className="flex items-center h-8 rounded-xl border border-border/30 bg-muted/30 overflow-visible">
        {/* Wallet */}
        {isMobile ? (
          <button onClick={() => tap("wallet")} className={cn("flex items-center justify-center h-8 w-8 transition-colors", section === "wallet" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 active:text-foreground active:bg-muted/50")}>
            <HugeiconsIcon icon={Wallet01Icon} size={14} />
          </button>
        ) : (
          <button onMouseEnter={() => enter("wallet")} className={cn("flex items-center justify-center h-8 w-9 transition-colors", section === "wallet" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>
            <HugeiconsIcon icon={Wallet01Icon} size={15} />
          </button>
        )}

        {/* Community */}
        <div className="relative border-l border-border/30">
          {isMobile ? (
            <button onClick={() => tap("community")} className={cn("flex items-center justify-center h-8 w-8 transition-colors relative", section === "community" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 active:text-foreground active:bg-muted/50")}>
              <HugeiconsIcon icon={Message01Icon} size={14} />
              {unread > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 min-w-3 px-0.5 rounded-full bg-primary text-primary-foreground text-[7px] flex items-center justify-center font-bold">{unread > 9 ? "9+" : unread}</div>
              )}
            </button>
          ) : (
            <Link href="/community" onMouseEnter={() => enter("community")} className={cn("flex items-center justify-center h-8 w-9 transition-colors relative", section === "community" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>
              <HugeiconsIcon icon={Message01Icon} size={15} />
              {unread > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">{unread > 9 ? "9+" : unread}</div>
              )}
            </Link>
          )}
        </div>

        {/* Notifications */}
        <div className="relative border-l border-border/30">
          {isMobile ? (
            <button onClick={() => tap("notifications")} className={cn("flex items-center justify-center h-8 w-8 transition-colors relative", section === "notifications" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 active:text-foreground active:bg-muted/50")}>
              <HugeiconsIcon icon={Notification01Icon} size={14} />
              {newNotifCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 min-w-3 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[7px] flex items-center justify-center font-bold">{newNotifCount}</div>
              )}
            </button>
          ) : (
            <button onMouseEnter={() => enter("notifications")} className={cn("flex items-center justify-center h-8 w-9 transition-colors relative", section === "notifications" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>
              <HugeiconsIcon icon={Notification01Icon} size={15} />
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
          className={cn("absolute top-full mt-2 z-50 right-0", isMobile ? "w-72" : "w-80")}
          onMouseEnter={isMobile ? undefined : dropEnter}
          onMouseLeave={isMobile ? undefined : leave}
        >
          <div className="bg-popover/95 backdrop-blur-2xl shadow-2xl rounded-xl ring-1 ring-border/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/15">
              <span className="text-xs font-semibold text-foreground/90">
                {section === "wallet" ? "Wallet" : section === "community" ? "Community" : "Notifications"}
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
                <div className="p-3.5">
                  <div className="mb-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Est. Value</p>
                    <p className="text-xl font-bold tabular-nums tracking-tight mt-0.5">
                      ${estValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">USD</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <a href="/deposit" className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors">
                      <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5 text-white [&_path]:stroke-current [&_path]:fill-none [&_path]:opacity-100" />
                      Deposit
                    </a>
                    <a href="/withdraw" className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                      Withdraw
                    </a>
                  </div>
                  <div className="h-px bg-border/20 mb-2" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1 block">Wallets</span>
                  <div className="flex flex-col gap-0.5">
                    {[
                      { label: "Spot Wallet", href: "/portfolio", icon: Wallet01Icon },
                      { label: "Futures Wallet", href: "/futures", icon: Activity01Icon },
                      { label: "Funding", href: "/assets", icon: Wallet01Icon },
                    ].map(w => (
                      <a key={w.label} href={w.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors group/link">
                        <HugeiconsIcon icon={w.icon} className="h-3.5 w-3.5 text-primary" />
                        <span className="flex-1 font-medium">{w.label}</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════ Community ══════ */}
              {section === "community" && (
                <div>
                  {/* Tabs */}
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted/40 rounded-lg mx-3 mt-2.5 mb-1.5">
                    {(["messages", "calls"] as CommunityTab[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setComTab(t)}
                        className={cn(
                          "flex-1 text-[11px] font-medium py-1 rounded-md transition-all duration-150",
                          comTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
                        )}
                      >
                        {t === "messages" ? "Messages" : "Calls"}
                      </button>
                    ))}
                  </div>

                  <div ref={tabContentRef} className="max-h-72 overflow-y-auto">
                    {/* ── Messages Tab ── */}
                    {comTab === "messages" && (
                      <>
                        {convos.length === 0 ? (
                          <div className="px-4 py-8 text-center text-xs text-muted-foreground/50">No conversations yet</div>
                        ) : (
                          <div className="py-0.5">
                            {convos.map(c => (
                              <Link
                                key={c.id}
                                href={`/community?chat=${c.id}`}
                                onClick={() => setSection(null)}
                                className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/40 transition-colors"
                              >
                                <div className="relative shrink-0">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={avatarUrl(c.participant.avatar, c.participant.name)} />
                                    <AvatarFallback className="text-[10px] bg-muted">{c.participant.name[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  {c.participant.isOnline && (
                                    <div className="absolute bottom-0 right-0 h-2 w-2 bg-emerald-500 rounded-full border-[1.5px] border-popover" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={cn("text-xs truncate", c.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                                      {c.participant.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">{timeAgo(new Date(c.lastMessageAt))}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{formatLastMessage(c)}</p>
                                </div>
                                {c.unreadCount > 0 && (
                                  <div className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold shrink-0">{c.unreadCount}</div>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                        <div className="border-t border-border/10 px-3.5 py-2">
                          <Link href="/community" onClick={() => setSection(null)} className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                            View all messages →
                          </Link>
                        </div>
                      </>
                    )}

                    {/* ── Calls Tab ── */}
                    {comTab === "calls" && (
                      <>
                        {calls.length > 0 && (
                          <>
                            <div className="px-3.5 pt-2 pb-1">
                              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Recent</span>
                            </div>
                            {calls.slice(0, 5).map(call => {
                              const lbl = callLabel(call)
                              return (
                                <div key={call.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-border/8 last:border-b-0">
                                  <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={avatarUrl(call.participantAvatar, call.participantName)} />
                                    <AvatarFallback className="text-[10px] bg-muted">{call.participantName[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-foreground/80 truncate block">{call.participantName}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <HugeiconsIcon icon={call.isCaller ? CallOutgoing04Icon : CallIncoming04Icon} size={10} className={lbl.negative ? "text-destructive" : "text-muted-foreground/50"} />
                                      <span className={cn("text-[10px]", lbl.negative ? "text-destructive" : "text-muted-foreground/50")}>
                                        {call.type === "video" ? "Video" : "Voice"} · {lbl.text}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/30 ml-auto shrink-0">{timeAgo(new Date(call.createdAt))}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button onClick={() => doCall(call.participantId, "audio", call.participantName, call.participantAvatar)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90" title="Voice call">
                                      <HugeiconsIcon icon={Call02Icon} size={13} />
                                    </button>
                                    <button onClick={() => doCall(call.participantId, "video", call.participantName, call.participantAvatar)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-500/10 transition-all active:scale-90" title="Video call">
                                      <HugeiconsIcon icon={Video01Icon} size={13} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </>
                        )}

                        {users.length > 0 && (
                          <>
                            <div className={cn("px-3.5 pt-2 pb-1", calls.length > 0 && "border-t border-border/15")}>
                              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">People</span>
                            </div>
                            {users.slice(0, 5).map(u => (
                              <div key={u.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-border/8 last:border-b-0">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarImage src={avatarUrl(u.avatar, u.name)} />
                                  <AvatarFallback className="text-[9px] bg-muted">{u.name[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-foreground/80 truncate flex-1 min-w-0">{u.name}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button onClick={() => doCall(u.id, "audio", u.name, u.avatar)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90">
                                    <HugeiconsIcon icon={Call02Icon} size={12} />
                                  </button>
                                  <button onClick={() => doCall(u.id, "video", u.name, u.avatar)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-500/10 transition-all active:scale-90">
                                    <HugeiconsIcon icon={Video01Icon} size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {calls.length === 0 && users.length === 0 && (
                          <div className="px-4 py-8 text-center text-xs text-muted-foreground/50">No recent calls</div>
                        )}

                        <div className="border-t border-border/10 px-3.5 py-2">
                          <Link href="/community" onClick={() => setSection(null)} className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                            View all →
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ══════ Notifications ══════ */}
              {section === "notifications" && (
                <div className="max-h-72 overflow-y-auto">
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
    </div>
  )
}
