"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  Call02Icon,
  Message01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useProfile } from "@/components/profile-provider"
import {
  getConversations,
  getTotalUnreadCount,
  type ConversationWithDetails,
} from "@/lib/community/actions/messages"

type ActivitySection = "messages" | "voice" | "video" | null

export function CommunityActivityPill() {
  const { profile } = useProfile()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentConversations, setRecentConversations] = useState<ConversationWithDetails[]>([])
  const [activeSection, setActiveSection] = useState<ActivitySection>(null)
  const [loaded, setLoaded] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load data on mount
  useEffect(() => {
    if (!profile?.authUserId) return

    const load = async () => {
      const [unread, convos] = await Promise.all([
        getTotalUnreadCount(),
        getConversations(),
      ])
      if (unread.success) setUnreadCount(unread.count ?? 0)
      if (convos.success && convos.conversations) {
        setRecentConversations(convos.conversations.slice(0, 5))
      }
      setLoaded(true)
    }
    load()

    // Poll every 30s
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
    if (activeSection) {
      gsap.fromTo(
        dropdownRef.current,
        { opacity: 0, y: -4, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" }
      )
    }
  }, [activeSection])

  const handleEnter = useCallback((section: ActivitySection) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveSection(section)
  }, [])

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveSection(null), 200)
  }, [])

  const handleDropdownEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  if (!loaded) return null

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "now"
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `${hours}h`
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const sections: { key: ActivitySection; icon: typeof Video01Icon; label: string }[] = [
    { key: "messages", icon: Message01Icon, label: "Messages" },
    { key: "voice", icon: Call02Icon, label: "Voice calls" },
    { key: "video", icon: Video01Icon, label: "Video calls" },
  ]

  return (
    <div className="relative hidden md:block" onMouseLeave={handleLeave}>
      <div
        ref={pillRef}
        className="flex items-center h-8 rounded-lg border border-border/30 bg-muted/30 overflow-hidden"
      >
        {sections.map((s, i) => (
          <div key={s.key} className="relative">
            <Link
              href="/community"
              onMouseEnter={() => handleEnter(s.key)}
              className={cn(
                "flex items-center justify-center h-8 w-9 transition-colors relative",
                activeSection === s.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
                i > 0 && "border-l border-border/30",
              )}
            >
              <HugeiconsIcon icon={s.icon} size={15} />
              {s.key === "messages" && unreadCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </Link>
          </div>
        ))}
      </div>

      {/* Hover dropdown */}
      {activeSection && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-72 z-50"
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleLeave}
        >
          <div className="bg-popover/90 backdrop-blur-2xl shadow-xl rounded-xl ring-1 ring-border/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/10">
              <span className="text-xs font-semibold text-foreground/80">
                {sections.find((s) => s.key === activeSection)?.label}
              </span>
              <button
                onClick={() => setActiveSection(null)}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={10} />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-60 overflow-y-auto">
              {recentConversations.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
                  No recent activity
                </div>
              ) : (
                <div className="py-1">
                  {recentConversations.map((c) => (
                    <Link
                      key={c.id}
                      href="/community"
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.participant.avatar || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {c.participant.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {c.participant.isOnline && (
                          <div className="absolute bottom-0 right-0 h-2 w-2 bg-emerald-500 rounded-full border border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn(
                            "text-xs truncate",
                            c.unreadCount > 0 ? "font-semibold" : "font-medium text-foreground/80"
                          )}>
                            {c.participant.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                            {formatTime(new Date(c.lastMessageAt))}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
                          {c.isOwnLastMessage ? "You: " : ""}{c.lastMessage || "No messages"}
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
            </div>

            {/* Footer */}
            <div className="border-t border-border/10 px-3 py-2">
              <Link
                href="/community"
                className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Open Community →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
