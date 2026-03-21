"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Cancel01Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
  Delete01Icon,
  ArrowDown01Icon,
  UserIcon,
  Settings01Icon,
  Logout01Icon,
  DashboardSquare01Icon,
  ChartCandlestickIcon,
  Activity01Icon,
  ArrowRight01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import type { Conversation } from "@/hooks/useChat"

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeConversation: Conversation | null
  loading: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onClose?: () => void
}

const QUICK_LINKS = [
  { label: "Dashboard", href: "/", icon: DashboardSquare01Icon },
  { label: "Portfolio", href: "/portfolio", icon: ChartCandlestickIcon },
  { label: "Spot Trading", href: "/spotv2", icon: Activity01Icon },
  { label: "Profile", href: "/profile", icon: UserIcon },
  { label: "Security", href: "/security", icon: Shield01Icon },
  { label: "Settings", href: "/settings", icon: Settings01Icon },
]

export default function ConversationSidebar({
  conversations,
  activeConversation,
  loading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: ConversationSidebarProps) {
  const { user, signOut } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [convoOpen, setConvoOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)

  const convoContentRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const initials = displayName.charAt(0).toUpperCase()

  // GSAP: animate conversations section open/close
  useEffect(() => {
    const el = convoContentRef.current
    if (!el) return
    if (convoOpen) {
      gsap.set(el, { display: "block", overflow: "hidden" })
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.25, ease: "power2.out" },
      )
    } else {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => { gsap.set(el, { display: "none" }) },
      })
    }
  }, [convoOpen])

  // GSAP: animate profile dropdown
  useEffect(() => {
    const el = profileRef.current
    if (!el) return
    if (profileOpen) {
      gsap.set(el, { display: "block", transformOrigin: "bottom center" })
      gsap.fromTo(
        el,
        { opacity: 0, y: 8, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" },
      )
      // stagger children links
      const links = el.querySelectorAll(".profile-link")
      gsap.fromTo(
        links,
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.18, stagger: 0.04, ease: "power2.out", delay: 0.05 },
      )
    } else {
      gsap.to(el, {
        opacity: 0,
        y: 4,
        scale: 0.97,
        duration: 0.15,
        ease: "power2.in",
        onComplete: () => { gsap.set(el, { display: "none" }) },
      })
    }
  }, [profileOpen])

  const handleStartRename = (convo: Conversation) => {
    setEditingId(convo._id)
    setEditTitle(convo.title)
    setMenuOpenId(null)
  }

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveRename()
    if (e.key === "Escape") {
      setEditingId(null)
      setEditTitle("")
    }
  }

  // Group conversations by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: Conversation[] }[] = []
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000)

    const today: Conversation[] = []
    const yesterday: Conversation[] = []
    const thisWeek: Conversation[] = []
    const older: Conversation[] = []

    for (const c of conversations) {
      const d = new Date(c.updatedAt)
      if (d >= todayStart) today.push(c)
      else if (d >= yesterdayStart) yesterday.push(c)
      else if (d >= weekStart) thisWeek.push(c)
      else older.push(c)
    }

    if (today.length) groups.push({ label: "Today", items: today })
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday })
    if (thisWeek.length) groups.push({ label: "This week", items: thisWeek })
    if (older.length) groups.push({ label: "Older", items: older })

    return groups
  }, [conversations])

  return (
    <div className="flex flex-col h-full bg-card/50 border-r border-border/30 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-13 border-b border-border/30 shrink-0">
        <span className="text-sm font-medium text-foreground">Vivid AI</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCreate}
            className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors"
            title="New Chat"
          >
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors lg:hidden"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations section */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Collapsible section toggle */}
        <button
          onClick={() => setConvoOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30 transition-colors shrink-0"
        >
          <span className="flex-1 text-left">Conversations</span>
          <span className="text-[10px] font-normal text-muted-foreground/40 mr-1">
            {conversations.length > 0 ? conversations.length : ""}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={`h-3 w-3 transition-transform duration-200 ${convoOpen ? "" : "-rotate-90"}`}
          />
        </button>

        {/* Animated conversation list */}
        <div
          ref={convoContentRef}
          className="overflow-y-auto flex-1"
          style={{ display: "block" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-muted-foreground/50 mb-1">No conversations yet</p>
              <button
                onClick={onCreate}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="px-2 pb-2">
              {grouped.map((group) => (
                <div key={group.label} className="mb-1">
                  <p className="px-3 pt-3 pb-1.5 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                    {group.label}
                  </p>
                  {group.items.map((convo) => (
                    <div
                      key={convo._id}
                      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        activeConversation?._id === convo._id
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent/50 text-foreground/70 hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (editingId !== convo._id) onSelect(convo._id)
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {editingId === convo._id ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={handleKeyDown}
                            className="w-full text-sm bg-background border border-border rounded px-2 py-0.5 outline-none focus:border-primary"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <p className="text-sm truncate">{convo.title}</p>
                        )}
                      </div>

                      {editingId !== convo._id && (
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpenId(menuOpenId === convo._id ? null : convo._id)
                            }}
                            className={`p-1 rounded hover:bg-accent transition-opacity ${
                              menuOpenId === convo._id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <HugeiconsIcon icon={MoreVerticalIcon} className="h-3.5 w-3.5" />
                          </button>

                          {menuOpenId === convo._id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenId(null)
                                }}
                              />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-28">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartRename(convo)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
                                >
                                  <HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMenuOpenId(null)
                                    onDelete(convo._id)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                                >
                                  <HugeiconsIcon icon={Delete01Icon} className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile section — pinned at bottom */}
      <div className="shrink-0 border-t border-border/30 relative">
        {/* Profile dropdown panel */}
        <div
          ref={profileRef}
          className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-popover/90 backdrop-blur-xl rounded-xl border border-border/30 shadow-xl shadow-black/10 overflow-hidden z-50"
          style={{ display: "none" }}
        >
          {/* User header */}
          <div className="flex items-center gap-2.5 px-3 py-3 border-b border-border/20">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.imageUrl} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-[1.5px] border-background bg-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="p-1.5">
            <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Quick access
            </p>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="profile-link flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors group/link"
              >
                <HugeiconsIcon icon={link.icon} className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 font-medium">{link.label}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="h-3 w-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all"
                />
              </Link>
            ))}

            <div className="h-px bg-border/20 my-1 mx-1" />

            <button
              onClick={async () => {
                setProfileOpen(false)
                await signOut()
              }}
              className="profile-link w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <HugeiconsIcon icon={Logout01Icon} className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </div>

        {/* Profile trigger button */}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-accent/40 transition-colors"
        >
          <div className="relative">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-px -right-px h-1.5 w-1.5 rounded-full border-[1.5px] border-background bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
          </div>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  )
}
