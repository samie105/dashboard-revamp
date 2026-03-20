/**
 * Server-side real-time event bus using Ably.
 * Channel naming: `user:<userId>` — one channel per user.
 * Event name: `event` — payload contains the type discriminator.
 */

import Ably from "ably"

// ── Call event types ──

export type CallEventType =
  | "call:incoming"
  | "call:answered"
  | "call:ended"
  | "call:declined"
  | "call:cancelled"
  | "call:busy"
  | "call:participant-rejoined"
  | "call:tokens-ready"

export type CallEventPayload = {
  type: CallEventType
  callId: string
  callType: "video" | "audio"
  callerId: string
  callerName: string
  callerAvatar: string | null
  receiverId: string
  conversationId: string
  status?: string
  authToken?: string
}

// ── Message event types ──

export type MessageEventType = "message:new" | "message:read" | "message:deleted"

export type MessageEventPayload = {
  type: MessageEventType
  messageId: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  messageType: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  timestamp: string
}

// ── Unified event type ──

export type SSEEventPayload = CallEventPayload | MessageEventPayload

// ── Ably REST client (server-side, lazy-initialized) ──

let _ablyRest: Ably.Rest | null = null

function getAblyRest(): Ably.Rest {
  if (!_ablyRest) {
    const key = process.env.ABLY_API_KEY
    if (!key) throw new Error("[Ably] ABLY_API_KEY environment variable is not set")
    _ablyRest = new Ably.Rest({ key })
  }
  return _ablyRest
}

export async function emitEvent(userId: string, event: SSEEventPayload): Promise<void> {
  try {
    const ably = getAblyRest()
    const channel = ably.channels.get(`user:${userId}`)
    await channel.publish("event", event)
  } catch (err) {
    console.error(`[Ably] Failed to publish ${event.type} to user:${userId}:`, err)
  }
}

export const emitCallEvent = emitEvent

export async function emitEventToMany(userIds: string[], event: SSEEventPayload): Promise<void> {
  await Promise.allSettled(userIds.map((userId) => emitEvent(userId, event)))
}

export const emitCallEventToMany = emitEventToMany

export async function createAblyToken(userId: string): Promise<Ably.TokenDetails> {
  const ably = getAblyRest()
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: userId,
    capability: { [`user:${userId}`]: ["subscribe"] },
    ttl: 60 * 60 * 1000,
  })
  return ably.auth.requestToken(tokenRequest)
}
