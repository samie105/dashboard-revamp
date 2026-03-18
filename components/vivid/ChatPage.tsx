"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Menu01Icon,
  Add01Icon,
  ArrowLeft01Icon,
  Settings01Icon,
  Cancel01Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"
import { useChat } from "@/hooks/useChat"
import ConversationSidebar from "./ConversationSidebar"
import ChatMessageList from "./ChatMessageList"
import ChatInput from "./ChatInput"
import CustomInstructionsModal from "./CustomInstructionsModal"

export default function ChatPage() {
  const router = useRouter()
  const {
    conversations,
    activeConversation,
    conversationsLoading,
    fetchConversations,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    updateCustomInstructions,
    messages,
    messagesLoading,
    sendMessage,
    isGenerating,
    stopGenerating,
    error,
    clearError,
  } = useChat()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeConversation) {
        const newConvo = await createConversation()
        if (newConvo) {
          await sendMessage(content, [], newConvo)
        }
        return
      }
      sendMessage(content)
    },
    [activeConversation, createConversation, sendMessage],
  )

  const handleNewChat = useCallback(async () => {
    await createConversation()
    setSidebarOpen(false)
  }, [createConversation])

  const handleSelectConversation = useCallback(
    async (id: string) => {
      await selectConversation(id)
      setSidebarOpen(false)
    },
    [selectConversation],
  )

  const handleSaveInstructions = useCallback(
    (instructions: string) => {
      if (activeConversation) {
        updateCustomInstructions(activeConversation._id, instructions)
      }
    },
    [activeConversation, updateCustomInstructions],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ConversationSidebar
          conversations={conversations}
          activeConversation={activeConversation}
          loading={conversationsLoading}
          onSelect={handleSelectConversation}
          onCreate={handleNewChat}
          onRename={renameConversation}
          onDelete={deleteConversation}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — minimal, clean */}
        <div className="flex items-center justify-between px-4 md:px-6 h-13 border-b border-border/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors lg:hidden"
            >
              <HugeiconsIcon icon={Menu01Icon} className="h-4.5 w-4.5" />
            </button>

            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors"
              title="Back to Dashboard"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4.5 w-4.5" />
            </button>

            <span className="text-sm font-medium text-foreground truncate max-w-60">
              {activeConversation?.title || "Vivid AI"}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setInstructionsOpen(true)}
              disabled={!activeConversation}
              className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Custom Instructions"
            >
              <HugeiconsIcon icon={Settings01Icon} className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors"
              title="New Chat"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
            <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{error}</p>
            <button
              onClick={clearError}
              className="text-destructive/60 hover:text-destructive transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        <ChatMessageList
          messages={messages}
          loading={messagesLoading}
          isGenerating={isGenerating}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          disabled={messagesLoading}
          isGenerating={isGenerating}
          onStop={stopGenerating}
        />
      </div>

      {/* Custom Instructions Modal */}
      <CustomInstructionsModal
        isOpen={instructionsOpen}
        instructions={activeConversation?.customInstructions || ""}
        onSave={handleSaveInstructions}
        onClose={() => setInstructionsOpen(false)}
      />
    </div>
  )
}
