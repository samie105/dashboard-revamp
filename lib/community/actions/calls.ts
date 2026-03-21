"use server"

import { connectDB } from "@/lib/mongodb"
import { getAuthUser } from "@/lib/auth"
import Call, { type ICall, type CallType } from "@/models/Call"
import CommunityConversation from "@/models/CommunityConversation"
import CommunityMessage from "@/models/CommunityMessage"
import DashboardProfile from "@/models/DashboardProfile"
import { createMeeting, addParticipant } from "@/lib/community/realtime"
import {
  emitCallEvent,
  emitCallEventToMany,
  type CallEventPayload,
} from "@/lib/community/events"

async function initAction() {
  const [, user] = await Promise.all([connectDB(), getAuthUser()])
  return user
}

function backgroundWrite(promise: Promise<unknown>) {
  promise.catch((err) => console.error("[Call] Background write failed:", err))
}

export type CallWithDetails = {
  id: string
  conversationId: string
  callerId: string
  callerName: string
  callerAvatar: string | null
  receiverId: string
  receiverName: string
  receiverAvatar: string | null
  type: CallType
  status: ICall["status"]
  duration: number
  createdAt: Date
  answeredAt?: Date
  endedAt?: Date
}

export type ActiveCallInfo = {
  callId: string
  callType: CallType
  participantId: string
  participantName: string
  participantAvatar: string | null
  isIncoming: boolean
  conversationId: string
  authToken: string
  answeredAt: string
}

// ── Initiate a call ──

export async function initiateCall(
  receiverId: string,
  type: CallType,
): Promise<{ success: boolean; callId?: string; error?: string }> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const [conversation, _expireResult] = await Promise.all([
      CommunityConversation.findOne({
        participants: { $all: [user.userId, receiverId] },
      }).then(async (conv) => {
        if (conv) return conv
        return CommunityConversation.create({
          participants: [user.userId, receiverId],
          lastMessageAt: new Date(),
        })
      }),
      Call.updateMany(
        {
          status: "ringing",
          $or: [
            { callerId: user.userId, receiverId },
            { callerId: receiverId, receiverId: user.userId },
          ],
        },
        { status: "missed", endedAt: new Date() },
      ),
      Call.updateMany(
        {
          status: "ringing",
          createdAt: { $lt: new Date(Date.now() - 60_000) },
          $or: [{ callerId: user.userId }, { receiverId: user.userId }],
        },
        { status: "missed", endedAt: new Date() },
      ),
    ])

    const callerProfile = await DashboardProfile.findOne({ authUserId: user.userId })
      .select("displayName avatarUrl")
      .lean()

    const callerName = callerProfile?.displayName || `${user.firstName} ${user.lastName}`.trim()

    const call = await Call.create({
      conversationId: conversation._id,
      callerId: user.userId,
      receiverId,
      type,
      status: "ringing",
    })

    const eventPayload: CallEventPayload = {
      type: "call:incoming",
      callId: call._id.toString(),
      callType: type,
      callerId: user.userId,
      callerName,
      callerAvatar: callerProfile?.avatarUrl || null,
      receiverId,
      conversationId: conversation._id.toString(),
    }
    await emitCallEvent(receiverId, eventPayload)

    return { success: true, callId: call._id.toString() }
  } catch (error) {
    console.error("Error initiating call:", error)
    return { success: false, error: "Failed to initiate call" }
  }
}

// ── Prepare RTK room and deliver tokens ──

export async function prepareCallTokens(callId: string): Promise<{
  success: boolean
  callerToken?: string
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }
    if (call.callerId !== user.userId) return { success: false, error: "Not authorized" }
    if (call.status !== "ringing" && call.status !== "ongoing") {
      return { success: false, error: "Call is no longer active" }
    }

    const [callerProfile, receiverProfile] = await Promise.all([
      DashboardProfile.findOne({ authUserId: call.callerId }).select("displayName avatarUrl").lean(),
      DashboardProfile.findOne({ authUserId: call.receiverId }).select("displayName avatarUrl").lean(),
    ])

    const callerName = callerProfile?.displayName || `${user.firstName} ${user.lastName}`.trim()
    const receiverName = receiverProfile?.displayName || "User"

    const meetingId = await createMeeting(`${callerName} → ${receiverName} (${call.type})`)
    const presetName = "group_call_host"

    const [callerParticipant, receiverParticipant] = await Promise.all([
      addParticipant(meetingId, {
        name: callerName,
        customParticipantId: user.userId,
        presetName,
      }),
      addParticipant(meetingId, {
        name: receiverName,
        customParticipantId: call.receiverId,
        presetName,
      }),
    ])

    call.meetingId = meetingId
    call.callerToken = callerParticipant.authToken
    call.receiverToken = receiverParticipant.authToken
    await call.save()

    const basePayload: CallEventPayload = {
      type: "call:tokens-ready",
      callId: call._id.toString(),
      callType: call.type,
      callerId: user.userId,
      callerName,
      callerAvatar: callerProfile?.avatarUrl || null,
      receiverId: call.receiverId,
      conversationId: call.conversationId.toString(),
    }

    await emitCallEventToMany([user.userId, call.receiverId], {
      ...basePayload,
      authToken: receiverParticipant.authToken,
      status: callerParticipant.authToken,
    })

    return { success: true, callerToken: callerParticipant.authToken }
  } catch (error) {
    console.error("Error preparing call tokens:", error)
    return { success: false, error: "Failed to prepare call" }
  }
}

// ── Answer a call ──

export async function answerCall(callId: string): Promise<{
  success: boolean
  authToken?: string
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }
    if (call.receiverId !== user.userId) {
      return { success: false, error: "Not authorized to answer this call" }
    }
    if (call.status !== "ringing") {
      return { success: false, error: "Call is no longer ringing" }
    }

    call.status = "ongoing"
    call.answeredAt = new Date()

    const eventPayload: CallEventPayload = {
      type: "call:answered",
      callId,
      callType: call.type,
      callerId: call.callerId,
      callerName: "",
      callerAvatar: null,
      receiverId: user.userId,
      conversationId: call.conversationId.toString(),
    }
    await Promise.all([call.save(), emitCallEvent(call.callerId, eventPayload)])

    return { success: true, authToken: call.receiverToken }
  } catch (error) {
    console.error("Error answering call:", error)
    return { success: false, error: "Failed to answer call" }
  }
}

// ── Decline a call ──

export async function declineCall(callId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }
    if (call.receiverId !== user.userId) return { success: false, error: "Not authorized" }
    if (call.status !== "ringing") return { success: false, error: "Call is no longer ringing" }

    call.status = "declined"
    call.endedAt = new Date()

    const eventPayload: CallEventPayload = {
      type: "call:declined",
      callId,
      callType: call.type,
      callerId: call.callerId,
      callerName: "",
      callerAvatar: null,
      receiverId: user.userId,
      conversationId: call.conversationId.toString(),
      status: "declined",
    }
    await Promise.all([call.save(), emitCallEvent(call.callerId, eventPayload)])
    backgroundWrite(insertCallSystemMessage(call))

    return { success: true }
  } catch (error) {
    console.error("Error declining call:", error)
    return { success: false, error: "Failed to decline call" }
  }
}

// ── End a call ──

export async function endCall(callId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId)
    if (!call) return { success: false, error: "Call not found" }

    const isParticipant = call.callerId === user.userId || call.receiverId === user.userId
    if (!isParticipant) return { success: false, error: "Not authorized" }

    if (["completed", "missed", "declined", "failed"].includes(call.status)) {
      return { success: true }
    }

    const endTime = new Date()
    let duration = 0
    if (call.answeredAt) {
      duration = Math.floor((endTime.getTime() - call.answeredAt.getTime()) / 1000)
    }

    const wasRinging = call.status === "ringing"
    const callerEnded = call.callerId === user.userId
    const newStatus = wasRinging ? (callerEnded ? "missed" : "declined") : "completed"

    const updated = await Call.findOneAndUpdate(
      { _id: callId, status: { $nin: ["completed", "missed", "declined", "failed"] } },
      { status: newStatus, endedAt: endTime, duration },
      { new: true },
    )

    if (updated) {
      const otherUserId = call.callerId === user.userId ? call.receiverId : call.callerId
      const eventType = wasRinging ? ("call:cancelled" as const) : ("call:ended" as const)

      const eventPayload: CallEventPayload = {
        type: eventType,
        callId,
        callType: call.type,
        callerId: call.callerId,
        callerName: "",
        callerAvatar: null,
        receiverId: call.receiverId,
        conversationId: call.conversationId.toString(),
        status: newStatus,
      }
      await emitCallEvent(otherUserId, eventPayload)
      backgroundWrite(insertCallSystemMessage(updated))
    }

    return { success: true }
  } catch (error) {
    console.error("Error ending call:", error)
    return { success: false, error: "Failed to end call" }
  }
}

// ── Get call status ──

export async function getCallStatus(callId: string): Promise<{
  success: boolean
  status?: string
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findOne({ _id: callId })
    if (!call) return { success: false, error: "Call not found" }

    return { success: true, status: call.status }
  } catch (error) {
    console.error("Error getting call status:", error)
    return { success: false, error: "Failed to get call status" }
  }
}

// ── Poll incoming call ──

export async function pollIncomingCall(): Promise<{
  incoming: {
    callId: string
    callerId: string
    callerName: string
    callerAvatar: string | null
    callType: CallType
    conversationId: string
    authToken?: string
  } | null
}> {
  try {
    const user = await initAction()
    if (!user) return { incoming: null }

    const staleThreshold = new Date(Date.now() - 30_000)
    const [, incomingCall] = await Promise.all([
      Call.updateMany(
        {
          status: "ringing",
          createdAt: { $lt: staleThreshold },
          $or: [{ callerId: user.userId }, { receiverId: user.userId }],
        },
        { status: "missed", endedAt: new Date() },
      ),
      Call.findOne({
        receiverId: user.userId,
        status: "ringing",
        createdAt: { $gte: staleThreshold },
      })
        .sort({ createdAt: -1 })
        .lean(),
    ])

    if (!incomingCall) return { incoming: null }

    const callerProfile = await DashboardProfile.findOne({ authUserId: incomingCall.callerId })
      .select("displayName avatarUrl")
      .lean()

    return {
      incoming: {
        callId: incomingCall._id.toString(),
        callerId: incomingCall.callerId,
        callerName: callerProfile?.displayName || "Unknown",
        callerAvatar: callerProfile?.avatarUrl || null,
        callType: incomingCall.type,
        conversationId: incomingCall.conversationId.toString(),
        authToken: incomingCall.receiverToken,
      },
    }
  } catch (error) {
    console.error("Error polling incoming calls:", error)
    return { incoming: null }
  }
}

// ── Get active call ──

export async function getActiveCall(): Promise<{ activeCall: ActiveCallInfo | null }> {
  try {
    const user = await initAction()
    if (!user) return { activeCall: null }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const call = await Call.findOne({
      $or: [{ callerId: user.userId }, { receiverId: user.userId }],
      status: "ongoing",
      answeredAt: { $gte: twoHoursAgo },
    })
      .sort({ answeredAt: -1 })
      .lean()

    if (!call) return { activeCall: null }

    const isCaller = call.callerId === user.userId
    const otherUserId = isCaller ? call.receiverId : call.callerId
    const authToken = isCaller ? call.callerToken : call.receiverToken

    if (!authToken) return { activeCall: null }

    const otherProfile = await DashboardProfile.findOne({ authUserId: otherUserId })
      .select("displayName avatarUrl")
      .lean()

    return {
      activeCall: {
        callId: call._id.toString(),
        callType: call.type,
        participantId: otherUserId,
        participantName: otherProfile?.displayName || "Unknown",
        participantAvatar: otherProfile?.avatarUrl || null,
        isIncoming: !isCaller,
        conversationId: call.conversationId.toString(),
        authToken,
        answeredAt: call.answeredAt?.toISOString() || new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("Error getting active call:", error)
    return { activeCall: null }
  }
}

// ── Rejoin call ──

export async function rejoinCall(callId: string): Promise<{
  success: boolean
  authToken?: string
  error?: string
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Unauthorized" }

    const call = await Call.findById(callId).lean()
    if (!call) return { success: false, error: "Call not found" }
    if (call.status !== "ongoing") return { success: false, error: "Call is not ongoing" }

    const isCaller = call.callerId === user.userId
    const isReceiver = call.receiverId === user.userId
    if (!isCaller && !isReceiver) return { success: false, error: "Not a participant" }

    const authToken = isCaller ? call.callerToken : call.receiverToken
    if (!authToken) return { success: false, error: "No auth token available" }

    const otherUserId = isCaller ? call.receiverId : call.callerId

    const callerProfile = await DashboardProfile.findOne({ authUserId: call.callerId })
      .select("displayName avatarUrl")
      .lean()

    const eventPayload: CallEventPayload = {
      type: "call:participant-rejoined",
      callId: call._id.toString(),
      callType: call.type,
      callerId: call.callerId,
      callerName: callerProfile?.displayName || "",
      callerAvatar: callerProfile?.avatarUrl || null,
      receiverId: call.receiverId,
      conversationId: call.conversationId.toString(),
    }
    await emitCallEvent(otherUserId, eventPayload)

    return { success: true, authToken }
  } catch (error) {
    console.error("Error rejoining call:", error)
    return { success: false, error: "Failed to rejoin call" }
  }
}

// ── Recent calls for activity pill ──

export type RecentCallItem = {
  id: string
  participantId: string
  participantName: string
  participantAvatar: string | null
  type: CallType
  status: ICall["status"]
  duration: number
  isCaller: boolean
  createdAt: Date
  conversationId: string
}

export async function getRecentCalls(limit = 10): Promise<{
  success: boolean
  calls: RecentCallItem[]
}> {
  try {
    const user = await initAction()
    if (!user) return { success: false, calls: [] }

    const calls = await Call.find({
      $or: [{ callerId: user.userId }, { receiverId: user.userId }],
      status: { $in: ["completed", "missed", "declined", "failed"] },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    if (calls.length === 0) return { success: true, calls: [] }

    // Collect unique participant IDs
    const participantIds = [
      ...new Set(
        calls.map((c) =>
          c.callerId === user.userId ? c.receiverId : c.callerId
        )
      ),
    ]

    const profiles = await DashboardProfile.find({
      authUserId: { $in: participantIds },
    }).lean()

    const profileMap = new Map(profiles.map((p) => [p.authUserId, p]))

    const items: RecentCallItem[] = calls.map((c) => {
      const isCaller = c.callerId === user.userId
      const otherId = isCaller ? c.receiverId : c.callerId
      const profile = profileMap.get(otherId)

      return {
        id: c._id.toString(),
        participantId: otherId,
        participantName: profile?.displayName || "User",
        participantAvatar: profile?.avatarUrl || null,
        type: c.type,
        status: c.status,
        duration: c.duration,
        isCaller,
        createdAt: c.createdAt,
        conversationId: c.conversationId.toString(),
      }
    })

    return { success: true, calls: items }
  } catch (error) {
    console.error("Error fetching recent calls:", error)
    return { success: false, calls: [] }
  }
}

// ── Cleanup orphaned calls ──

export async function cleanupOrphanedCalls(): Promise<{ cleaned: number }> {
  try {
    const user = await initAction()
    if (!user) return { cleaned: 0 }

    const now = new Date()
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const sixtySecondsAgo = new Date(Date.now() - 60_000)

    const orphanedCalls = await Call.find({
      $and: [
        { $or: [{ callerId: user.userId }, { receiverId: user.userId }] },
        {
          $or: [
            { status: "ringing", createdAt: { $lt: sixtySecondsAgo } },
            { status: "ongoing", answeredAt: { $lt: twoHoursAgo } },
          ],
        },
      ],
    }).lean()

    let cleaned = 0

    for (const call of orphanedCalls) {
      const isRinging = call.status === "ringing"
      const newStatus = isRinging ? "missed" : "completed"
      let duration = 0
      if (call.answeredAt) {
        duration = Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000)
      }

      const updated = await Call.findOneAndUpdate(
        { _id: call._id, status: { $nin: ["completed", "missed", "declined", "failed"] } },
        { status: newStatus, endedAt: now, duration },
        { new: true },
      )

      if (updated) {
        cleaned++
        const otherUserId =
          call.callerId === user.userId ? call.receiverId : call.callerId

        const eventPayload: CallEventPayload = {
          type: "call:ended",
          callId: call._id.toString(),
          callType: call.type,
          callerId: call.callerId,
          callerName: "",
          callerAvatar: null,
          receiverId: call.receiverId,
          conversationId: call.conversationId.toString(),
          status: newStatus,
        }
        emitCallEvent(otherUserId, eventPayload).catch(() => {})
        backgroundWrite(insertCallSystemMessage(updated))
      }
    }

    return { cleaned }
  } catch (error) {
    console.error("Error cleaning up orphaned calls:", error)
    return { cleaned: 0 }
  }
}

// ── Helper ──

async function insertCallSystemMessage(call: ICall) {
  let durationStr: string | null = null

  if (call.status === "completed") {
    const mins = Math.floor(call.duration / 60)
    const secs = call.duration % 60
    durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const content = `CALL_EVENT:${call.type}:${call.status}:${durationStr || "0"}:${call.callerId}`

  await CommunityMessage.create({
    conversationId: call.conversationId,
    senderId: call.callerId,
    receiverId: call.receiverId,
    content,
    type: "text",
    isRead: false,
    isDelivered: true,
  })

  const msg = await CommunityMessage.findOne({ conversationId: call.conversationId })
    .sort({ createdAt: -1 })

  if (msg) {
    await CommunityConversation.findByIdAndUpdate(call.conversationId, {
      lastMessage: msg._id,
      lastMessageAt: msg.createdAt,
    })
  }
}


