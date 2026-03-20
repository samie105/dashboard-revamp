"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Image02Icon, Video01Icon, Mic01Icon, Attachment01Icon, Call02Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, LayoutGroup } from "motion/react"

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
  searchPlaceholder = "Search...",
  activeCallConversationId,
}: ConversationListProps) {
  const [search, setSearch] = useState("")

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
          <HugeiconsIcon icon={config.icon} size={12} className="shrink-0 opacity-60" />
          <span>{c.lastMessage ? `${config.label} · ${c.lastMessage}` : config.label}</span>
        </span>
      )
    }

    // Handle CALL_EVENT structured format
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
          <HugeiconsIcon icon={icon} size={12} className="shrink-0 opacity-60" />
          <span>{label}{statusText}</span>
        </span>
      )
    }

    // Handle legacy emoji call format
    if (c.lastMessage.startsWith("📹") || c.lastMessage.startsWith("📞")) {
      const isVideo = c.lastMessage.startsWith("📹")
      const icon = isVideo ? Video01Icon : Call02Icon
      const text = c.lastMessage.replace(/^📹\s*/, "").replace(/^📞\s*/, "")
      return (
        <span className="flex items-center gap-1">
          {prefix && <span>{prefix}</span>}
          <HugeiconsIcon icon={icon} size={12} className="shrink-0 opacity-60" />
          <span>{text}</span>
        </span>
      )
    }

    return `${prefix}${c.lastMessage || "No messages yet"}`
  }

  return (
    <div className="w-full md:w-80 lg:w-96 border-r flex flex-col bg-background h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted border-0"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {search ? "No results" : "No conversations"}
          </div>
        ) : (
          <LayoutGroup>
            <div>
              <AnimatePresence initial={false}>
                {filtered.map((c) => (
                  <motion.button
                    key={c.id}
                    layout
                    layoutId={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      layout: { type: "spring", stiffness: 500, damping: 35 },
                      opacity: { duration: 0.15 },
                      scale: { duration: 0.15 },
                    }}
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-center gap-3",
                      selectedId === c.id && "bg-muted"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={c.avatar} />
                        <AvatarFallback>{c.name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {activeCallConversationId === c.id ? (
                        <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4 w-4 bg-emerald-500 rounded-full border-2 border-background">
                          <HugeiconsIcon icon={Call02Icon} size={8} className="text-white" />
                        </div>
                      ) : c.isOnline ? (
                        <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-medium text-sm truncate", c.unread > 0 && "font-semibold")}>
                          {c.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-muted-foreground">
                            {formatTime(c.timestamp)}
                          </span>
                          {c.unread > 0 && (
                            <div className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                              {c.unread > 99 ? "99+" : c.unread}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm truncate mt-0.5",
                        c.unread > 0 ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {getMessagePreview(c)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </ScrollArea>
    </div>
  )
}
