"use server"

import { connectDB } from "@/lib/mongodb"
import { getAuthUser } from "@/lib/auth"
import CommunityMessage from "@/models/CommunityMessage"
import CommunityConversation from "@/models/CommunityConversation"
import DashboardProfile from "@/models/DashboardProfile"
import { emitEvent, type MessageEventPayload, type TypingEventPayload } from "@/lib/community/events"

export type ConversationWithDetails = {
  id: string
  participant: {
    id: string
    name: string
    avatar: string | null
    isOnline: boolean
  }
  lastMessage: string
  lastMessageType: "text" | "image" | "video" | "audio" | "file"
  isOwnLastMessage: boolean
  lastMessageAt: Date
  unreadCount: number
}

export type MessageWithDetails = {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  type: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  isOwn: boolean
  isRead: boolean
  isDelivered: boolean
  timestamp: Date
}

export type UserSearchResult = {
  id: string
  name: string
  avatar: string | null
}

async function init() {
  const [, user] = await Promise.all([connectDB(), getAuthUser()])
  return user
}

export async function getConversations(): Promise<{
  success: boolean
  conversations?: ConversationWithDetails[]
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const conversations = await CommunityConversation.find({
      participants: user.userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate("lastMessage")
      .lean()

    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipantId = conv.participants.find((p: string) => p !== user.userId)

        const otherProfile = otherParticipantId
          ? await DashboardProfile.findOne({ authUserId: otherParticipantId })
              .select("displayName avatarUrl lastSeen")
              .lean()
          : null

        const unreadCount = await CommunityMessage.countDocuments({
          conversationId: conv._id,
          receiverId: user.userId,
          isRead: false,
          content: { $not: /^CALL_EVENT:/ },
        })

        const lastMsg = conv.lastMessage as unknown as {
          content?: string
          type?: string
          senderId?: string
        } | null

        return {
          id: conv._id.toString(),
          participant: {
            id: otherParticipantId || "",
            name: otherProfile?.displayName || "Unknown User",
            avatar: otherProfile?.avatarUrl || null,
            isOnline: otherProfile?.lastSeen
              ? Date.now() - new Date(otherProfile.lastSeen).getTime() < 3 * 60 * 1000
              : false,
          },
          lastMessage: lastMsg?.content || "",
          lastMessageType: (lastMsg?.type as ConversationWithDetails["lastMessageType"]) || "text",
          isOwnLastMessage: lastMsg?.senderId === user.userId,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
        }
      }),
    )

    return { success: true, conversations: conversationsWithDetails }
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return { success: false, error: "Failed to fetch conversations" }
  }
}

export async function getMessages(conversationId: string): Promise<{
  success: boolean
  messages?: MessageWithDetails[]
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const conversation = await CommunityConversation.findOne({
      _id: conversationId,
      participants: user.userId,
    })

    if (!conversation) return { success: false, error: "Conversation not found" }

    const messages = await CommunityMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean()

    // Mark received messages as read
    await CommunityMessage.updateMany(
      { conversationId, receiverId: user.userId, isRead: false },
      { isRead: true },
    )

    // Resolve sender profiles
    const senderIds = [...new Set(messages.map((m) => m.senderId))]
    const profiles = await DashboardProfile.find({ authUserId: { $in: senderIds } })
      .select("authUserId displayName avatarUrl")
      .lean()
    const profileMap = new Map(profiles.map((p) => [p.authUserId, p]))

    const messagesWithDetails: MessageWithDetails[] = messages.map((msg) => {
      const profile = profileMap.get(msg.senderId)
      return {
        id: msg._id.toString(),
        senderId: msg.senderId,
        senderName: profile?.displayName || "Unknown",
        senderAvatar: profile?.avatarUrl || null,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileUrls: msg.fileUrls,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        duration: msg.duration,
        waveform: msg.waveform,
        isOwn: msg.senderId === user.userId,
        isRead: msg.isRead,
        isDelivered: msg.isDelivered,
        timestamp: msg.createdAt,
      }
    })

    return { success: true, messages: messagesWithDetails }
  } catch (error) {
    console.error("Error fetching messages:", error)
    return { success: false, error: "Failed to fetch messages" }
  }
}

export async function sendMessage(
  receiverId: string,
  content: string,
  type: "text" | "image" | "video" | "audio" | "file" = "text",
  fileData?: {
    url: string
    urls?: string[]
    name?: string
    size?: string
    duration?: string
    waveform?: number[]
  },
): Promise<{ success: boolean; message?: MessageWithDetails; error?: string }> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    let conversation = await CommunityConversation.findOne({
      participants: { $all: [user.userId, receiverId] },
    })

    if (!conversation) {
      conversation = await CommunityConversation.create({
        participants: [user.userId, receiverId],
        lastMessageAt: new Date(),
      })
    }

    const message = await CommunityMessage.create({
      conversationId: conversation._id,
      senderId: user.userId,
      receiverId,
      content,
      type,
      fileUrl: fileData?.url,
      fileUrls: fileData?.urls,
      fileName: fileData?.name,
      fileSize: fileData?.size,
      duration: fileData?.duration,
      waveform: fileData?.waveform,
      isDelivered: true,
    })

    conversation.lastMessage = message._id
    conversation.lastMessageAt = new Date()
    await conversation.save()

    const senderProfile = await DashboardProfile.findOne({ authUserId: user.userId })
      .select("displayName avatarUrl")
      .lean()

    const senderName = senderProfile?.displayName || `${user.firstName} ${user.lastName}`.trim()
    const senderAvatar = senderProfile?.avatarUrl || null

    const msgEvent: MessageEventPayload = {
      type: "message:new",
      messageId: message._id.toString(),
      conversationId: conversation._id.toString(),
      senderId: user.userId,
      senderName,
      senderAvatar,
      content,
      messageType: type,
      fileUrl: fileData?.url,
      fileUrls: fileData?.urls,
      fileName: fileData?.name,
      fileSize: fileData?.size,
      duration: fileData?.duration,
      waveform: fileData?.waveform,
      timestamp: message.createdAt.toISOString(),
    }

    await Promise.all([emitEvent(receiverId, msgEvent), emitEvent(user.userId, { ...msgEvent })])

    return {
      success: true,
      message: {
        id: message._id.toString(),
        senderId: user.userId,
        senderName,
        senderAvatar,
        content,
        type,
        fileUrl: fileData?.url,
        fileUrls: fileData?.urls,
        fileName: fileData?.name,
        fileSize: fileData?.size,
        duration: fileData?.duration,
        waveform: fileData?.waveform,
        isOwn: true,
        isRead: false,
        isDelivered: true,
        timestamp: message.createdAt,
      },
    }
  } catch (error) {
    console.error("Error sending message:", error)
    return { success: false, error: "Failed to send message" }
  }
}

export async function searchUsers(query: string): Promise<{
  success: boolean
  users?: UserSearchResult[]
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    if (!query || query.length < 2) return { success: true, users: [] }

    const profiles = await DashboardProfile.find({
      authUserId: { $ne: user.userId },
      $or: [
        { displayName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .limit(10)
      .select("authUserId displayName avatarUrl")
      .lean()

    return {
      success: true,
      users: profiles.map((p) => ({
        id: p.authUserId,
        name: p.displayName || "Unknown",
        avatar: p.avatarUrl || null,
      })),
    }
  } catch (error) {
    console.error("Error searching users:", error)
    return { success: false, error: "Failed to search users" }
  }
}

export async function getOrCreateConversation(userId: string): Promise<{
  success: boolean
  conversationId?: string
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    let conversation = await CommunityConversation.findOne({
      participants: { $all: [user.userId, userId] },
    })

    if (!conversation) {
      conversation = await CommunityConversation.create({
        participants: [user.userId, userId],
        lastMessageAt: new Date(),
      })
    }

    return { success: true, conversationId: conversation._id.toString() }
  } catch (error) {
    console.error("Error getting/creating conversation:", error)
    return { success: false, error: "Failed to get conversation" }
  }
}

export async function markMessagesAsRead(conversationId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const unreadMessages = await CommunityMessage.find({
      conversationId,
      receiverId: user.userId,
      isRead: false,
    })
      .select("senderId")
      .lean()

    if (unreadMessages.length === 0) return { success: true }

    await CommunityMessage.updateMany(
      { conversationId, receiverId: user.userId, isRead: false },
      { isRead: true },
    )

    const senderProfile = await DashboardProfile.findOne({ authUserId: user.userId })
      .select("displayName avatarUrl")
      .lean()

    const senderIds = [...new Set(unreadMessages.map((m) => m.senderId))]
    for (const senderId of senderIds) {
      if (senderId !== user.userId) {
        await emitEvent(senderId, {
          type: "message:read",
          messageId: "",
          conversationId,
          senderId: user.userId,
          senderName: senderProfile?.displayName || "",
          senderAvatar: senderProfile?.avatarUrl || null,
          content: "",
          messageType: "text",
          timestamp: new Date().toISOString(),
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error marking messages as read:", error)
    return { success: false, error: "Failed to mark messages as read" }
  }
}

export async function getTotalUnreadCount(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const count = await CommunityMessage.countDocuments({
      receiverId: user.userId,
      isRead: false,
      content: { $not: /^CALL_EVENT:/ },
    })

    return { success: true, count }
  } catch (error) {
    console.error("Error fetching unread count:", error)
    return { success: false, error: "Failed to fetch unread count" }
  }
}

export async function getRecentUsers(): Promise<{
  success: boolean
  users?: UserSearchResult[]
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const profiles = await DashboardProfile.find({
      authUserId: { $ne: user.userId },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("authUserId displayName avatarUrl")
      .lean()

    return {
      success: true,
      users: profiles.map((p) => ({
        id: p.authUserId,
        name: p.displayName || "Unknown",
        avatar: p.avatarUrl || null,
      })),
    }
  } catch (error) {
    console.error("Error fetching recent users:", error)
    return { success: false, error: "Failed to fetch recent users" }
  }
}

export async function deleteMessage(messageId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await init()
    if (!user) return { success: false, error: "Unauthorized" }

    const message = await CommunityMessage.findById(messageId)
    if (!message) return { success: false, error: "Message not found" }

    if (message.senderId !== user.userId) {
      return { success: false, error: "Can only delete your own messages" }
    }

    const conversationId = message.conversationId
    const receiverId = message.receiverId
    await CommunityMessage.findByIdAndDelete(messageId)

    if (receiverId) {
      await emitEvent(receiverId, {
        type: "message:deleted",
        messageId,
        conversationId: conversationId.toString(),
        senderId: user.userId,
        senderName: "",
        senderAvatar: null,
        content: "",
        messageType: "text",
        timestamp: new Date().toISOString(),
      })
    }

    const lastMsg = await CommunityMessage.findOne({ conversationId })
      .sort({ createdAt: -1 })
      .lean()

    if (lastMsg) {
      await CommunityConversation.findByIdAndUpdate(conversationId, {
        lastMessage: lastMsg._id,
        lastMessageAt: lastMsg.createdAt,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting message:", error)
    return { success: false, error: "Failed to delete message" }
  }
}

// ── Presence heartbeat ──

export async function updatePresence(): Promise<void> {
  try {
    const user = await init()
    if (!user) return

    await DashboardProfile.updateOne(
      { authUserId: user.userId },
      { lastSeen: new Date() },
    )
  } catch {
    // Silently ignore
  }
}

// ── Typing indicators ──

export async function emitTypingEvent(
  conversationId: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const user = await init()
    if (!user) return

    const conversation = await CommunityConversation.findById(conversationId).lean()
    if (!conversation) return

    const otherParticipantId = conversation.participants.find(
      (p: string) => p !== user.userId,
    )
    if (!otherParticipantId) return

    const profile = await DashboardProfile.findOne({ authUserId: user.userId })
      .select("displayName")
      .lean()

    const event: TypingEventPayload = {
      type: isTyping ? "typing:start" : "typing:stop",
      conversationId,
      userId: user.userId,
      userName: profile?.displayName || "User",
    }

    await emitEvent(otherParticipantId, event)
  } catch {
    // Silently ignore
  }
}
