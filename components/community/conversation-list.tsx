"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Image02Icon, Video01Icon, Mic01Icon, Attachment01Icon, Call02Icon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type Conversation = {
  id: string
  name: string
  avatar?: string
  lastMessage: string
  lastMessageType?: "text" | "image" | "video" | "audio" | "file"
  isOwnLastMessage?: boolean
  timestamp: Date
  unread: number
  isOnline?: boolean
  isInCall?: boolean
}

type ConversationListProps = {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchPlaceholder?: string
  activeCallConversationId?: string | null
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  searchPlaceholder = "Search conversations...",
  activeCallConversationId,
}: ConversationListProps) {
  const [search, setSearch] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // GSAP search bar glow
  useEffect(() => {
    if (!searchBarRef.current) return
    gsap.to(searchBarRef.current, {
      boxShadow: isFocused
        ? "0 0 0 2px hsl(var(--primary) / 0.15), 0 2px 8px hsl(var(--primary) / 0.06)"
        : "0 0 0 0px transparent, 0 0 0 0px transparent",
      duration: 0.25,
      ease: "power2.out",
    })
  }, [isFocused])

  // GSAP stagger entrance
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll("[data-conv-item]")
    if (items.length === 0) return
    gsap.fromTo(
      items,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.03, duration: 0.3, ease: "power2.out" }
    )
  }, [conversations.length])

  const handleHover = useCallback((el: HTMLButtonElement, enter: boolean) => {
    gsap.to(el, { x: enter ? 3 : 0, duration: 0.2, ease: "power2.out" })
  }, [])

  const filtered = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return "now"
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    if (days === 1) return "Yesterday"
    if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" })
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getMessagePreview = (c: Conversation) => {
    const type = c.lastMessageType || "text"
    const prefix = c.isOwnLastMessage ? "You: " : ""

    const typeConfig: Record<string, { icon: typeof Image02Icon; label: string }> = {
      audio: { icon: Mic01Icon, label: "Voice note" },
      image: { icon: Image02Icon, label: "Photo" },
      video: { icon: Video01Icon, label: "Video" },
      file: { icon: Attachment01Icon, label: "File" },
    }

    if (type !== "text" && typeConfig[type]) {
      const config = typeConfig[type]
      return (
        <span className="flex items-center gap-1">
          {prefix && <span>{prefix}</span>}
          <HugeiconsIcon icon={config.icon} size={11} className="shrink-0 opacity-50" />
          <span>{c.lastMessage ? `${config.label} · ${c.lastMessage}` : config.label}</span>
        </span>
      )
    }

    if (c.lastMessage.startsWith("CALL_EVENT:")) {
      const parts = c.lastMessage.split(":")
      const callType = parts[1] === "video" ? "video" : "audio"
      const status = parts[2] || "completed"
      const durationStr = parts[3] || "0"
      const icon = callType === "video" ? Video01Icon : Call02Icon
      const label = callType === "video" ? "Video call" : "Voice call"
      let statusText = ""
      if (status === "completed" && durationStr !== "0") statusText = ` · ${durationStr}`
      else if (status === "missed") statusText = " · Missed"
      else if (status === "declined") statusText = " · Declined"
      else if (status === "failed") statusText = " · Failed"
      return (
        <span className="flex items-center gap-1">
          {prefix && <span>{prefix}</span>}
          <HugeiconsIcon icon={icon} size={11} className="shrink-0 opacity-50" />
          <span>{label}{statusText}</span>
        </span>
      )
    }

    if (c.lastMessage.startsWith("📹") || c.lastMessage.startsWith("📞")) {
      const isVideo = c.lastMessage.startsWith("📹")
      const icon = isVideo ? Video01Icon : Call02Icon
      const text = c.lastMessage.replace(/^📹\s*/, "").replace(/^📞\s*/, "")
      return (
        <span className="flex items-center gap-1">
          {prefix && <span>{prefix}</span>}
          <HugeiconsIcon icon={icon} size={11} className="shrink-0 opacity-50" />
          <span>{text}</span>
        </span>
      )
    }

    return `${prefix}${c.lastMessage || "No messages yet"}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2.5">
        <div
          ref={searchBarRef}
          className="relative flex items-center rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <HugeiconsIcon
            icon={Search01Icon}
            size={15}
            className={cn(
              "absolute left-3 transition-colors",
              isFocused ? "text-primary" : "text-muted-foreground/50"
            )}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full bg-transparent text-sm pl-9 pr-3 py-2 outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground/60">
              {search ? "No results found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div ref={listRef} className="px-1.5 pb-2">
            {filtered.map((c) => {
              const isSelected = selectedId === c.id
              const isInCall = activeCallConversationId === c.id

              return (
                <button
                  key={c.id}
                  data-conv-item
                  onClick={() => onSelect(c.id)}
                  onMouseEnter={(e) => handleHover(e.currentTarget, true)}
                  onMouseLeave={(e) => handleHover(e.currentTarget, false)}
                  className={cn(
                    "w-full px-2.5 py-2.5 text-left rounded-xl transition-colors flex items-center gap-3 relative",
                    isSelected ? "bg-primary/8" : "hover:bg-muted/40",
                  )}
                >
                  {/* Active bar */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-primary" />
                  )}

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className={cn(
                      "h-11 w-11 ring-2 transition-all",
                      isSelected ? "ring-primary/20" : "ring-transparent",
                    )}>
                      <AvatarImage src={c.avatar} />
                      <AvatarFallback className="text-sm font-medium bg-muted">
                        {c.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isInCall ? (
                      <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4.5 w-4.5 bg-emerald-500 rounded-full border-2 border-background animate-pulse">
                        <HugeiconsIcon icon={Call02Icon} size={8} className="text-white" />
                      </div>
                    ) : c.isOnline ? (
                      <div className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 rounded-full border-2 border-background" />
                    ) : null}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-[13px] truncate",
                        c.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90",
                      )}>
                        {c.name}
                      </span>
                      <span className={cn(
                        "text-[10px] tabular-nums shrink-0",
                        c.unread > 0 ? "text-primary font-medium" : "text-muted-foreground/50",
                      )}>
                        {formatTime(c.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className={cn(
                        "text-[12px] truncate flex-1",
                        c.unread > 0 ? "text-foreground/70" : "text-muted-foreground/50"
                      )}>
                        {getMessagePreview(c)}
                      </p>
                      {c.unread > 0 && (
                        <div className="h-4.5 min-w-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shrink-0">
                          {c.unread > 99 ? "99+" : c.unread}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
