"use client"

import React, { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Cancel01Icon,
  AiChat02Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons"
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

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
    <div className="flex flex-col h-full bg-card/50 border-r border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-13 border-b border-border/30">
        <span className="text-sm font-medium text-foreground">Chats</span>
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

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-muted-foreground/60 mb-1">
              No conversations yet
            </p>
            <button
              onClick={onCreate}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <div className="px-2">
            {grouped.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pt-3 pb-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                  {group.label}
                </p>
                {group.items.map((convo) => (
                  <div
                    key={convo._id}
                    className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      activeConversation?._id === convo._id
                        ? "bg-accent text-foreground"
                        : "hover:bg-accent/50 text-foreground/80"
                    }`}
                    onClick={() => {
                      if (editingId !== convo._id) {
                        onSelect(convo._id)
                      }
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

                    {/* Actions */}
                    {editingId !== convo._id && (
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(
                              menuOpenId === convo._id ? null : convo._id
                            )
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
  )
}
