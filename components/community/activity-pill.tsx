"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  Call02Icon,
  Message01Icon,
  Cancel01Icon,
  CallIncoming04Icon,
  CallOutgoing04Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, avatarUrl } from "@/lib/utils"
import { useProfile } from "@/components/profile-provider"
import { useIsMobile } from "@/hooks/use-mobile"
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
import { useGlobalCall } from "./incoming-call-provider"

type ActivePopover = "messages" | "calls" | null

const MAX_ITEMS = 5

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
  if (msg.startsWith("📹") || msg.startsWith("📞")) return `${prefix}${msg}`
  return `${prefix}${msg}`
}

function formatTime(date: Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h`
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function getCallLabel(call: RecentCallItem): { text: string; isNegative: boolean } {
  if (call.status === "missed") return { text: call.isCaller ? "No answer" : "Missed", isNegative: true }
  if (call.status === "declined") return { text: "Declined", isNegative: true }
  if (call.status === "failed") return { text: "Failed", isNegative: true }
  if (call.duration > 0) return { text: formatDuration(call.duration), isNegative: false }
  return { text: "Completed", isNegative: false }
}

export function CommunityActivityPill() {
  const { profile } = useProfile()
  const { startCall } = useGlobalCall()
  const isMobile = useIsMobile()
  const [unreadCount, setUnreadCount] = useState(0)
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [recentCalls, setRecentCalls] = useState<RecentCallItem[]>([])
  const [recentUsers, setRecentUsers] = useState<UserSearchResult[]>([])
  const [activePopover, setActivePopover] = useState<ActivePopover>(null)
  const [loaded, setLoaded] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter conversations to messages only (no call events)
  const messageConversations = useMemo(
    () => conversations.filter(
      (c) => !c.lastMessage.startsWith("CALL_EVENT:") && !c.lastMessage.startsWith("📹") && !c.lastMessage.startsWith("📞")
    ),
    [conversations]
  )
  const displayMessages = messageConversations.slice(0, MAX_ITEMS)
  const displayCalls = recentCalls.slice(0, MAX_ITEMS)
  const displayUsers = recentUsers.slice(0, MAX_ITEMS)
  const hasMoreMessages = messageConversations.length > MAX_ITEMS
  const hasMoreCalls = recentCalls.length > MAX_ITEMS || recentUsers.length > MAX_ITEMS

  // Load data
  useEffect(() => {
    if (!profile?.authUserId) return
    const load = async () => {
      const [unread, convos, calls, users] = await Promise.all([
        getTotalUnreadCount(),
        getConversations(),
        getRecentCalls(10),
        getRecentUsers(),
      ])
      if (unread.success) setUnreadCount(unread.count ?? 0)
      if (convos.success && convos.conversations) setConversations(convos.conversations)
      if (calls.success) setRecentCalls(calls.calls)
      if (users.success && users.users) setRecentUsers(users.users)
      setLoaded(true)
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [profile?.authUserId])

  // GSAP entrance
  useEffect(() => {
    if (!loaded || !pillRef.current) return
    gsap.fromTo(pillRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.6)" })
  }, [loaded])

  // Dropdown animation
  useEffect(() => {
    if (!dropdownRef.current) return
    if (activePopover) {
      gsap.fromTo(
        dropdownRef.current,
        { opacity: 0, y: -6, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power2.out" }
      )
    }
  }, [activePopover])

  // Click outside to close (mobile)
  useEffect(() => {
    if (!activePopover || !isMobile) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      setActivePopover(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [activePopover, isMobile])

  const handleEnter = useCallback((section: ActivePopover) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActivePopover(section)
  }, [])

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActivePopover(null), 200)
  }, [])

  const handleDropdownEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const handleMobileTap = useCallback((section: NonNullable<ActivePopover>) => {
    setActivePopover((prev) => (prev === section ? null : section))
  }, [])

  const initiateCall = useCallback((userId: string, type: "video" | "audio", userName: string, userAvatar?: string | null) => {
    setActivePopover(null)
    startCall({
      participantId: userId,
      participantName: userName,
      participantAvatar: userAvatar || undefined,
      callType: type,
    })
  }, [startCall])

  if (!loaded) return null

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseLeave={isMobile ? undefined : handleLeave}
    >
      {/* Pill — 2 icons: Messages + Calls */}
      <div
        ref={pillRef}
        className="flex items-center h-8 rounded-lg border border-border/30 bg-muted/30 overflow-hidden"
      >
        {/* Messages icon */}
        <div className="relative">
          {isMobile ? (
            <button
              onClick={() => handleMobileTap("messages")}
              className={cn(
                "flex items-center justify-center h-8 w-8 transition-colors relative",
                activePopover === "messages"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 active:text-foreground active:bg-muted/50",
              )}
            >
              <HugeiconsIcon icon={Message01Icon} size={14} />
              {unreadCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 min-w-3 px-0.5 rounded-full bg-primary text-primary-foreground text-[7px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </button>
          ) : (
            <Link
              href="/community"
              onMouseEnter={() => handleEnter("messages")}
              className={cn(
                "flex items-center justify-center h-8 w-9 transition-colors relative",
                activePopover === "messages"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
              )}
            >
              <HugeiconsIcon icon={Message01Icon} size={15} />
              {unreadCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </Link>
          )}
        </div>

        {/* Calls icon */}
        <div className="relative">
          {isMobile ? (
            <button
              onClick={() => handleMobileTap("calls")}
              className={cn(
                "flex items-center justify-center h-8 w-8 transition-colors relative border-l border-border/30",
                activePopover === "calls"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 active:text-foreground active:bg-muted/50",
              )}
            >
              <HugeiconsIcon icon={Call02Icon} size={14} />
            </button>
          ) : (
            <Link
              href="/community"
              onMouseEnter={() => handleEnter("calls")}
              className={cn(
                "flex items-center justify-center h-8 w-9 transition-colors relative border-l border-border/30",
                activePopover === "calls"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
              )}
            >
              <HugeiconsIcon icon={Call02Icon} size={15} />
            </Link>
          )}
        </div>
      </div>

      {/* ── Popover ── */}
      {activePopover && (
        <div
          ref={dropdownRef}
          className={cn("absolute top-full mt-2 z-50 right-0", isMobile ? "w-72" : "w-80")}
          onMouseEnter={isMobile ? undefined : handleDropdownEnter}
          onMouseLeave={isMobile ? undefined : handleLeave}
        >
          <div className="bg-popover/95 backdrop-blur-2xl shadow-2xl rounded-xl ring-1 ring-border/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/15">
              <span className="text-xs font-semibold text-foreground/90">
                {activePopover === "messages" ? "Messages" : "Calls"}
              </span>
              <button
                onClick={() => setActivePopover(null)}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={10} />
              </button>
            </div>

            {/* ── Messages Popover ── */}
            {activePopover === "messages" && (
              <div className="max-h-72 overflow-y-auto">
                {displayMessages.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground/50">
                    No recent messages
                  </div>
                ) : (
                  <div className="py-1">
                    {displayMessages.map((c) => (
                      <Link
                        key={c.id}
                        href={`/community?chat=${c.id}`}
                        onClick={() => setActivePopover(null)}
                        className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={avatarUrl(c.participant.avatar, c.participant.name)} />
                            <AvatarFallback className="text-[10px] bg-muted">
                              {c.participant.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {c.participant.isOnline && (
                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-popover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-xs truncate",
                              c.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                            )}>
                              {c.participant.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                              {formatTime(new Date(c.lastMessageAt))}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
                            {formatLastMessage(c)}
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <div className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold shrink-0">
                            {c.unreadCount}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                {hasMoreMessages && (
                  <div className="border-t border-border/10 px-3.5 py-2">
                    <Link
                      href="/community"
                      onClick={() => setActivePopover(null)}
                      className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View all messages →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── Calls Popover ── */}
            {activePopover === "calls" && (
              <div className="max-h-80 overflow-y-auto">
                {/* Recent calls */}
                {displayCalls.length > 0 && (
                  <>
                    <div className="px-3.5 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                        Recent
                      </span>
                    </div>
                    <div>
                      {displayCalls.map((call) => {
                        const label = getCallLabel(call)
                        return (
                          <div
                            key={call.id}
                            className="flex items-center gap-2.5 px-3.5 py-2 border-b border-border/8 last:border-b-0"
                          >
                            <div className="relative shrink-0">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={avatarUrl(call.participantAvatar, call.participantName)} />
                                <AvatarFallback className="text-[10px] bg-muted">
                                  {call.participantName[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-foreground/80 truncate block">
                                {call.participantName}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <HugeiconsIcon
                                  icon={call.isCaller ? CallOutgoing04Icon : CallIncoming04Icon}
                                  size={10}
                                  className={label.isNegative ? "text-destructive" : "text-muted-foreground/50"}
                                />
                                <span className={cn(
                                  "text-[10px]",
                                  label.isNegative ? "text-destructive" : "text-muted-foreground/50"
                                )}>
                                  {call.type === "video" ? "Video" : "Voice"} · {label.text}
                                </span>
                                <span className="text-[10px] text-muted-foreground/30 ml-auto shrink-0">
                                  {formatTime(new Date(call.createdAt))}
                                </span>
                              </div>
                            </div>
                            {/* Call-back buttons */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => initiateCall(call.participantId, "audio", call.participantName, call.participantAvatar)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
                                title="Voice call"
                              >
                                <HugeiconsIcon icon={Call02Icon} size={14} />
                              </button>
                              <button
                                onClick={() => initiateCall(call.participantId, "video", call.participantName, call.participantAvatar)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-500/10 transition-all active:scale-90"
                                title="Video call"
                              >
                                <HugeiconsIcon icon={Video01Icon} size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* People — users you can call */}
                {displayUsers.length > 0 && (
                  <>
                    <div className={cn("px-3.5 pt-2 pb-1", displayCalls.length > 0 && "border-t border-border/15")}>
                      <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                        People
                      </span>
                    </div>
                    <div>
                      {displayUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-2.5 px-3.5 py-2 border-b border-border/8 last:border-b-0"
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={avatarUrl(user.avatar, user.name)} />
                            <AvatarFallback className="text-[10px] bg-muted">
                              {user.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-foreground/80 truncate flex-1 min-w-0">
                            {user.name}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => initiateCall(user.id, "audio", user.name, user.avatar)}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
                              title="Voice call"
                            >
                              <HugeiconsIcon icon={Call02Icon} size={14} />
                            </button>
                            <button
                              onClick={() => initiateCall(user.id, "video", user.name, user.avatar)}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-500/10 transition-all active:scale-90"
                              title="Video call"
                            >
                              <HugeiconsIcon icon={Video01Icon} size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {displayCalls.length === 0 && displayUsers.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground/50">
                    No recent calls
                  </div>
                )}

                {hasMoreCalls && (
                  <div className="border-t border-border/10 px-3.5 py-2">
                    <Link
                      href="/community"
                      onClick={() => setActivePopover(null)}
                      className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View all →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
