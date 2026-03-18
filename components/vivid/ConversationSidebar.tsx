"use client"

import React, { useState } from "react"
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">
          Conversations
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreate}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            title="New Chat"
          >
            <HugeiconsIcon icon={Add01Icon} className="h-4.5 w-4.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors lg:hidden"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20 border-t-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <HugeiconsIcon
              icon={AiChat02Icon}
              className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3"
            />
            <p className="text-sm text-muted-foreground">
              No conversations yet
            </p>
            <button
              onClick={onCreate}
              className="mt-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((convo) => (
              <div
                key={convo._id}
                className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                  activeConversation?._id === convo._id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent text-foreground"
                }`}
                onClick={() => {
                  if (editingId !== convo._id) {
                    onSelect(convo._id)
                  }
                }}
              >
                <HugeiconsIcon
                  icon={AiChat02Icon}
                  className="h-4.5 w-4.5 shrink-0 opacity-60"
                />

                <div className="flex-1 min-w-0">
                  {editingId === convo._id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={handleKeyDown}
                      className="w-full text-sm bg-background border border-primary/30 rounded px-1.5 py-0.5 outline-none focus:border-primary"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">
                        {convo.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(convo.updatedAt)}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions menu */}
                {editingId !== convo._id && (
                  <div className="relative">
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
                      <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
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
                        <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-30">
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
        )}
      </div>
    </div>
  )
}
