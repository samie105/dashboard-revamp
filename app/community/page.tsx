"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import gsap from "gsap"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserAdd01Icon, Search01Icon, Cancel01Icon, Message01Icon } from "@hugeicons/core-free-icons"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import {
  ConversationList,
  ChatHeader,
  MessageBubble,
  MessageInput,
  DateSeparator,
  groupMessagesByDate,
  CallEvent,
  isCallEventMessage,
  MessageContextMenu,
} from "@/components/community"
import type { Conversation } from "@/components/community"
import type { MessageType } from "@/components/community/message-bubble"
import type { Attachment } from "@/components/community/message-input"
import {
  getConversations,
  getMessages,
  sendMessage,
  searchUsers,
  getOrCreateConversation,
  getRecentUsers,
  markMessagesAsRead,
  emitTypingEvent,
  type ConversationWithDetails,
  type MessageWithDetails,
  type UserSearchResult,
} from "@/lib/community/actions/messages"
import { getImageUploadUrl, getVideoUploadUrl, getAudioUploadUrl } from "@/lib/community/actions/upload"
import { useMessageEvents, useTypingEvents } from "@/lib/community/use-events"
import { useProfile } from "@/components/profile-provider"
import { useGlobalCall } from "@/components/community/incoming-call-provider"
import type { MessageEventPayload, TypingEventPayload } from "@/lib/community/events"

type OptimisticMessage = MessageWithDetails & { status?: "pending" | "sent" | "error"; uploadProgress?: number; isNew?: boolean }

export default function CommunityPage() {
  const { profile } = useProfile()
  const userId = profile?.authUserId ?? ""
  const searchParams = useSearchParams()
  const router = useRouter()

  const pageRef = useRef<HTMLDivElement>(null)

  // GSAP page entrance
  useEffect(() => {
    if (!pageRef.current) return
    gsap.fromTo(
      pageRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
    )
  }, [])

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<ConversationWithDetails["participant"] | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Global call
  const { startCall: globalStartCall } = useGlobalCall()

  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  // User search state
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentUsers, setRecentUsers] = useState<UserSearchResult[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Typing indicator state
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load conversations
  const loadConversations = useCallback(async () => {
    const result = await getConversations()
    if (result.success && result.conversations) {
      setConversations(result.conversations)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Restore conversation from URL on mount / when conversations load
  useEffect(() => {
    const chatId = searchParams.get("chat")
    if (chatId && conversations.length > 0 && !selectedId) {
      const conv = conversations.find((c) => c.id === chatId)
      if (conv) {
        setSelectedId(chatId)
        setSelectedParticipant(conv.participant)
        setShowMobileChat(true)
      }
    }
  }, [searchParams, conversations, selectedId])

  // Load messages when conversation changes
  useEffect(() => {
    async function loadMessages() {
      if (!selectedId) {
        setMessages([])
        return
      }
      setIsLoadingMessages(true)
      const result = await getMessages(selectedId)
      if (result.success && result.messages) {
        setMessages(result.messages)
      }
      setIsLoadingMessages(false)
      markMessagesAsRead(selectedId).then(() => loadConversations())
    }
    loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Track messages we've sent locally to prevent SSE duplicates
  const sentMessageIdsRef = useRef<Set<string>>(new Set())

  // Real-time messages via Ably
  const handleMessageEvent = useCallback((event: MessageEventPayload) => {
    if (event.type === "message:new") {
      const currentConvId = selectedIdRef.current
      const isFromMe = event.senderId === userId

      // Skip own messages — they're already in state from optimistic + server response
      if (isFromMe) {
        loadConversations()
        return
      }

      if (currentConvId && event.conversationId === currentConvId) {
        const newMsg: OptimisticMessage = {
          id: event.messageId,
          senderId: event.senderId,
          senderName: event.senderName,
          senderAvatar: event.senderAvatar,
          content: event.content,
          type: event.messageType,
          fileUrl: event.fileUrl,
          fileUrls: event.fileUrls,
          fileName: event.fileName,
          fileSize: event.fileSize,
          duration: event.duration,
          waveform: event.waveform,
          isOwn: false,
          isRead: false,
          isDelivered: true,
          timestamp: new Date(event.timestamp),
          isNew: true,
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.messageId)) return prev
          return [...prev, newMsg]
        })
        markMessagesAsRead(currentConvId)
      }
      loadConversations()
    } else if (event.type === "message:read") {
      if (event.conversationId === selectedIdRef.current) {
        setMessages((prev) => prev.map((m) =>
          m.isOwn && !m.isRead ? { ...m, isRead: true } : m
        ))
      }
      loadConversations()
    } else if (event.type === "message:deleted") {
      setMessages((prev) => prev.filter((m) => m.id !== event.messageId))
      loadConversations()
    }
  }, [userId, loadConversations])

  useMessageEvents(userId || null, handleMessageEvent)

  // Typing events via Ably
  const handleTypingEvent = useCallback((event: TypingEventPayload) => {
    if (event.conversationId !== selectedIdRef.current) return
    if (event.type === "typing:start") {
      setIsPartnerTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 4000)
    } else {
      setIsPartnerTyping(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [])

  useTypingEvents(userId || null, handleTypingEvent)

  // Clear typing state when switching conversations
  useEffect(() => {
    setIsPartnerTyping(false)
  }, [selectedId])

  // Scroll to bottom
  const prevMessagesLenRef = useRef(0)
  useEffect(() => {
    if (!messagesEndRef.current) return
    const isNewMessage = messages.length > prevMessagesLenRef.current
    prevMessagesLenRef.current = messages.length
    if (isNewMessage) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
      })
    }
  }, [messages])

  // Map to component formats
  const mappedConversations: Conversation[] = conversations.map((c) => ({
    id: c.id,
    name: c.participant.name,
    avatar: c.participant.avatar || undefined,
    lastMessage: c.lastMessage,
    lastMessageType: c.lastMessageType,
    isOwnLastMessage: c.isOwnLastMessage,
    timestamp: new Date(c.lastMessageAt),
    unread: c.unreadCount,
    isOnline: c.participant.isOnline,
  }))

  const mappedMessages: MessageType[] = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar || undefined,
    content: m.content,
    timestamp: new Date(m.timestamp),
    isOwn: m.isOwn,
    isRead: m.isRead,
    isDelivered: m.isDelivered,
    type: m.type === "text" ? undefined : m.type,
    fileUrl: m.fileUrl,
    fileUrls: m.fileUrls,
    fileName: m.fileName,
    fileSize: m.fileSize,
    duration: m.duration,
    waveform: m.waveform,
    status: m.status,
    uploadProgress: m.uploadProgress,
    isNew: m.isNew,
  }))

  const messageGroups = groupMessagesByDate(mappedMessages)

  // Prefetch first few conversation messages in background
  const prefetchedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (conversations.length === 0) return
    const toPrefetch = conversations.slice(0, 3)
    toPrefetch.forEach((c) => {
      if (prefetchedRef.current.has(c.id) || c.id === selectedId) return
      prefetchedRef.current.add(c.id)
      getMessages(c.id) // fire-and-forget prefetch
    })
  }, [conversations, selectedId])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    const conv = conversations.find((c) => c.id === id)
    setSelectedParticipant(conv?.participant || null)
    setShowMobileChat(true)
    // Update URL without navigation
    router.replace(`/community?chat=${id}`, { scroll: false })
  }, [conversations, router])

  const startCall = useCallback((type: "video" | "audio") => {
    if (!selectedParticipant) return
    globalStartCall({
      participantId: selectedParticipant.id,
      participantName: selectedParticipant.name,
      participantAvatar: selectedParticipant.avatar || undefined,
      callType: type,
    })
  }, [selectedParticipant, globalStartCall])

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!selectedId) return
    emitTypingEvent(selectedId, isTyping)
  }, [selectedId])

  const handleSendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    if (!selectedParticipant) return

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    let fileData: { url: string; urls?: string[]; name?: string; size?: string; duration?: string; waveform?: number[] } | undefined
    let messageType: "text" | "image" | "video" | "audio" | "file" = "text"
    let previewUrl: string | undefined
    let previewUrls: string[] | undefined

    if (attachments && attachments.length > 0) {
      const attachment = attachments[0]
      if (attachment.type === "image") messageType = "image"
      else if (attachment.type === "video") messageType = "video"
      else if (attachment.type === "audio") messageType = "audio"
      else messageType = "file"

      if (messageType === "image" && attachments.length > 1) {
        previewUrls = attachments.filter(a => a.type === "image").map(a => a.preview || "")
        previewUrl = previewUrls[0]
      } else {
        previewUrl = attachment.preview
      }
    }

    const optimisticMessage: OptimisticMessage = {
      id: tempId,
      senderId: userId,
      senderName: "You",
      senderAvatar: null,
      content: content || "",
      type: messageType,
      fileUrl: previewUrl,
      fileUrls: previewUrls,
      fileName: attachments?.[0]?.file.name,
      fileSize: attachments?.[0]?.file ? `${(attachments[0].file.size / 1024 / 1024).toFixed(2)} MB` : undefined,
      duration: attachments?.[0]?.duration,
      waveform: attachments?.[0]?.waveform,
      isOwn: true,
      isRead: false,
      isDelivered: false,
      timestamp: new Date(),
      status: "pending",
    }

    setMessages((prev) => [...prev, optimisticMessage])

    try {
      if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.type === "image")

        if (messageType === "image" && imageAttachments.length > 1) {
          const uploadedUrls: string[] = []
          const totalFiles = imageAttachments.length

          for (let i = 0; i < totalFiles; i++) {
            const attachment = imageAttachments[i]
            const contentType = attachment.file.type || "application/octet-stream"
            const uploadUrlResult = await getImageUploadUrl(attachment.file.name, contentType)

            if (!uploadUrlResult.success || !uploadUrlResult.uploadUrl || !uploadUrlResult.publicUrl) {
              throw new Error("Failed to get upload URL")
            }

            const uploadOk = await new Promise<boolean>((resolve) => {
              const xhr = new XMLHttpRequest()
              xhr.open("PUT", uploadUrlResult.uploadUrl!)
              xhr.setRequestHeader("Content-Type", contentType)
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const filePct = (event.loaded / event.total)
                  const overallPct = Math.round(((i + filePct) / totalFiles) * 100)
                  setMessages((prev) =>
                    prev.map((m) => m.id === tempId ? { ...m, uploadProgress: overallPct } : m)
                  )
                }
              }
              xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
              xhr.onerror = () => resolve(false)
              xhr.send(attachment.file)
            })

            if (!uploadOk) throw new Error("Upload failed")
            uploadedUrls.push(uploadUrlResult.publicUrl)
          }

          fileData = {
            url: uploadedUrls[0],
            urls: uploadedUrls,
            name: imageAttachments[0].file.name,
            size: `${imageAttachments.reduce((sum, a) => sum + a.file.size, 0) / 1024 / 1024 | 0} MB`,
          }
        } else {
          const attachment = attachments[0]
          const contentType = attachment.file.type || "application/octet-stream"
          let uploadUrlResult

          if (messageType === "image") {
            uploadUrlResult = await getImageUploadUrl(attachment.file.name, contentType)
          } else if (messageType === "video") {
            uploadUrlResult = await getVideoUploadUrl(attachment.file.name, contentType)
          } else if (messageType === "audio") {
            uploadUrlResult = await getAudioUploadUrl(attachment.file.name, contentType)
          } else {
            uploadUrlResult = await getImageUploadUrl(attachment.file.name, contentType)
          }

          if (!uploadUrlResult.success || !uploadUrlResult.uploadUrl || !uploadUrlResult.publicUrl) {
            throw new Error("Failed to get upload URL")
          }

          const uploadOk = await new Promise<boolean>((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open("PUT", uploadUrlResult.uploadUrl!)
            xhr.setRequestHeader("Content-Type", contentType)
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 100)
                setMessages((prev) =>
                  prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m)
                )
              }
            }
            xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
            xhr.onerror = () => resolve(false)
            xhr.send(attachment.file)
          })

          if (!uploadOk) throw new Error("Upload failed")

          fileData = {
            url: uploadUrlResult.publicUrl,
            name: attachment.file.name,
            size: `${(attachment.file.size / 1024 / 1024).toFixed(2)} MB`,
            duration: attachment.duration,
            waveform: attachment.waveform,
          }
        }
      }

      const result = await sendMessage(
        selectedParticipant.id,
        content || (fileData ? "" : ""),
        messageType,
        fileData
      )

      if (result.success && result.message) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== tempId) return m
            const serverMsg = result.message!
            return {
              ...serverMsg,
              status: "sent" as const,
            }
          })
        )
        loadConversations()
      } else {
        throw new Error(result.error || "Failed to send message")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, status: "error" as const } : m)
      )
    }
  }, [selectedParticipant, userId, loadConversations])

  // Load recent users when search modal opens
  useEffect(() => {
    if (showUserSearch && recentUsers.length === 0) {
      setIsLoadingRecent(true)
      getRecentUsers().then((result) => {
        if (result.success && result.users) {
          setRecentUsers(result.users)
        }
        setIsLoadingRecent(false)
      })
    }
  }, [showUserSearch, recentUsers.length])

  // User search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const result = await searchUsers(query)
    if (result.success && result.users) {
      setSearchResults(result.users)
    }
    setIsSearching(false)
  }, [])

  const handleStartConversation = useCallback(async (user: UserSearchResult) => {
    const result = await getOrCreateConversation(user.id)
    if (result.success && result.conversationId) {
      setShowUserSearch(false)
      setSearchQuery("")
      setSearchResults([])

      await loadConversations()
      setSelectedId(result.conversationId)
      setSelectedParticipant({ id: user.id, name: user.name, avatar: user.avatar, isOnline: false })
      setShowMobileChat(true)
      router.replace(`/community?chat=${result.conversationId}`, { scroll: false })
    }
  }, [loadConversations, router])

  return (
    <>
      {/* Hide bottom nav when mobile chat is open */}
      {showMobileChat && (
        <style>{`@media (max-width: 767px) { nav.fixed.bottom-0 { display: none !important; } }`}</style>
      )}

      <div ref={pageRef} className={cn(
        "flex-1 flex overflow-hidden touch-manipulation",
        showMobileChat ? "h-[calc(100dvh-3rem)]" : "h-[calc(100dvh-3rem)] pb-14 md:pb-0"
      )}>
        {/* Conversation List */}
        <div className={showMobileChat ? "hidden md:flex" : "flex w-full md:w-auto"}>
          <div className="w-full md:w-80 lg:w-96 border-r border-border/40 flex flex-col bg-background h-full">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <h2 className="font-semibold">Community</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUserSearch(true)}
                className="h-8 w-8"
              >
                <HugeiconsIcon icon={UserAdd01Icon} size={18} />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex-1 space-y-3 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-2.5 w-36 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ConversationList
                conversations={mappedConversations}
                selectedId={selectedId}
                onSelect={handleSelect}
                activeCallConversationId={null}
              />
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-background overflow-hidden min-w-0 ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {selectedParticipant ? (
            <>
              <ChatHeader
                name={selectedParticipant.name}
                avatar={selectedParticipant.avatar || undefined}
                isOnline={selectedParticipant.isOnline}
                showBackButton
                onBack={() => setShowMobileChat(false)}
                onVideoCall={() => startCall("video")}
                onAudioCall={() => startCall("audio")}
              />

              {isLoadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading messages...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-3 py-4 space-y-1 max-w-3xl mx-auto w-full">
                      {messageGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                          <div className="relative w-20 h-20 mb-5">
                            <div className="absolute inset-0 rounded-full bg-primary/5" />
                            <div className="absolute inset-2 rounded-full bg-primary/8" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <HugeiconsIcon icon={UserAdd01Icon} size={28} className="text-primary/40" />
                            </div>
                          </div>
                          <h3 className="text-base font-semibold text-foreground/80 mb-1">Start the conversation</h3>
                          <p className="text-[13px] text-muted-foreground/60 text-center max-w-xs">
                            Say hello and connect with {selectedParticipant?.name?.split(" ")[0] || "them"}
                          </p>
                        </div>
                      ) : (
                        messageGroups.map((group) => (
                          <div key={group.date.toISOString()}>
                            <DateSeparator date={group.date} />
                            <div className="space-y-0.5">
                              <AnimatePresence initial={false}>
                                {group.messages.map((msg, i) => {
                                  const prev = group.messages[i - 1]
                                  const next = group.messages[i + 1]

                                  const isSameSenderAsPrev = prev && prev.senderId === msg.senderId
                                  const prevSameMinute = isSameSenderAsPrev && prev &&
                                    Math.floor(new Date(prev.timestamp).getTime() / 60000) === Math.floor(new Date(msg.timestamp).getTime() / 60000)

                                  const nextSameMinute = next && next.senderId === msg.senderId && next &&
                                    Math.floor(new Date(next.timestamp).getTime() / 60000) === Math.floor(new Date(msg.timestamp).getTime() / 60000)

                                  const isGroupStart = !prevSameMinute
                                  const isGroupEnd = !nextSameMinute

                                  if (isCallEventMessage(msg.content)) {
                                    return (
                                      <motion.div
                                        key={msg.id}
                                        initial={msg.isNew ? { opacity: 0, y: 10 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                                      >
                                        <CallEvent
                                          content={msg.content}
                                          isOwn={msg.isOwn}
                                          timestamp={msg.timestamp}
                                          onCallback={(type) => startCall(type)}
                                        />
                                      </motion.div>
                                    )
                                  }

                                  return (
                                    <motion.div
                                      key={msg.id}
                                      initial={msg.isNew ? { opacity: 0, y: 10 } : false}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                                    >
                                      <MessageContextMenu
                                        messageId={msg.id}
                                        content={msg.content}
                                        isOwn={msg.isOwn}
                                        onDeleted={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
                                      >
                                        <MessageBubble
                                          message={msg}
                                          showAvatar={isGroupStart}
                                          showTimestamp={isGroupEnd}
                                        />
                                      </MessageContextMenu>
                                    </motion.div>
                                  )
                                })}
                              </AnimatePresence>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {isPartnerTyping && selectedParticipant && (
                    <div className="px-4 py-1.5 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <span className="inline-flex items-center gap-1">
                        {selectedParticipant.name.split(" ")[0]} is typing
                        <span className="inline-flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </span>
                    </div>
                  )}

                  <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-5">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-primary/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <HugeiconsIcon icon={UserAdd01Icon} size={32} className="text-primary/40" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground/80">Welcome to Community</h3>
                  <p className="text-sm text-muted-foreground mt-1">Select a conversation or start a new one</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-6"
                  onClick={() => setShowUserSearch(true)}
                >
                  <HugeiconsIcon icon={UserAdd01Icon} size={16} className="mr-2" />
                  New Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Search Modal — Redesigned */}
      <ResponsiveModal open={showUserSearch} onOpenChange={setShowUserSearch}>
        <ResponsiveModalContent className="sm:max-w-2xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="text-lg">New Conversation</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => {
                    setSearchQuery("")
                    setSearchResults([])
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} />
                </Button>
              )}
            </div>

            <ScrollArea className="h-96">
              {searchQuery.length >= 2 ? (
                isSearching ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-20 rounded bg-muted" />
                          <div className="h-2 w-14 rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <HugeiconsIcon icon={Search01Icon} size={22} className="text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">No users found</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartConversation(user)}
                        className="flex items-center gap-3 p-3 text-left hover:bg-muted/50 rounded-xl transition-colors ring-1 ring-border/10 hover:ring-border/30"
                      >
                        <Avatar className="h-10 w-10 ring-1 ring-border/20">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback className="text-sm bg-primary/5 text-primary">
                            {user.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground/50">Start chatting</p>
                        </div>
                        <HugeiconsIcon icon={Message01Icon} size={14} className="text-muted-foreground/40" />
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-5">
                  {/* Existing conversations */}
                  {conversations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Your Conversations
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {conversations.slice(0, 6).map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => {
                              setShowUserSearch(false)
                              handleSelect(conv.id)
                            }}
                            className="flex items-center gap-3 p-3 text-left hover:bg-muted/50 rounded-xl transition-colors ring-1 ring-border/10 hover:ring-border/30"
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={conv.participant.avatar || undefined} />
                                <AvatarFallback className="text-sm bg-muted">
                                  {conv.participant.name[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {conv.participant.isOnline && (
                                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-background" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{conv.participant.name}</p>
                              {conv.unreadCount > 0 && (
                                <p className="text-xs text-primary font-medium">{conv.unreadCount} unread</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* People to connect with */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      People to Connect With
                    </p>
                    {isLoadingRecent ? (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
                            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : recentUsers.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground/50 text-sm">
                        Search above to find people
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {recentUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleStartConversation(user)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                          >
                            <Avatar className="h-14 w-14 ring-1 ring-border/20 group-hover:ring-primary/30 transition-all">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback className="text-sm bg-primary/5 text-primary">
                                {user.name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <p className="text-xs font-medium truncate w-full text-center">
                              {user.name.split(" ")[0]}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>


    </>
  )
}
