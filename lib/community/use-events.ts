"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as Ably from "ably"
import type { CallEventPayload, MessageEventPayload, TypingEventPayload, SSEEventPayload } from "@/lib/community/events"

type RealtimeEventHandler = (event: SSEEventPayload) => void

let _ablyClient: Ably.Realtime | null = null

function getAblyClient(): Ably.Realtime {
  if (!_ablyClient) {
    _ablyClient = new Ably.Realtime({
      authCallback: async (_data, callback) => {
        try {
          const { getAblyTokenAction } = await import("@/lib/community/actions/ably")
          const tokenDetails = await getAblyTokenAction()
          callback(null, tokenDetails)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Token request failed"
          callback({ message: msg, name: "AuthError", code: 40000, statusCode: 500 }, null)
        }
      },
      disconnectedRetryTimeout: 1000,
      suspendedRetryTimeout: 5000,
    })
  }
  return _ablyClient
}

export function useSSEEvents(userId: string | null, onEvent: RealtimeEventHandler) {
  const [isConnected, setIsConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!userId) return

    const ably = getAblyClient()
    const channelName = `user:${userId}`

    const onConnectionStateChange = (stateChange: Ably.ConnectionStateChange) => {
      setIsConnected(stateChange.current === "connected")
    }
    ably.connection.on(onConnectionStateChange)
    setIsConnected(ably.connection.state === "connected")

    const channel = ably.channels.get(channelName)
    channelRef.current = channel

    const onMessage = (message: Ably.Message) => {
      try {
        const data = message.data as SSEEventPayload
        if (data && data.type) onEventRef.current(data)
      } catch (err) {
        console.error("[Ably] Failed to process message:", err)
      }
    }

    channel.subscribe("event", onMessage)

    return () => {
      channel.unsubscribe("event", onMessage)
      ably.connection.off(onConnectionStateChange)
      channelRef.current = null
    }
  }, [userId])

  return { isConnected }
}

export function useCallEvents(userId: string | null, onEvent: (event: CallEventPayload) => void) {
  const handler = useCallback(
    (event: SSEEventPayload) => {
      if (event.type.startsWith("call:")) onEvent(event as CallEventPayload)
    },
    [onEvent],
  )
  return useSSEEvents(userId, handler)
}

export function useMessageEvents(userId: string | null, onEvent: (event: MessageEventPayload) => void) {
  const handler = useCallback(
    (event: SSEEventPayload) => {
      if (event.type.startsWith("message:")) onEvent(event as MessageEventPayload)
    },
    [onEvent],
  )
  return useSSEEvents(userId, handler)
}

export function useTypingEvents(userId: string | null, onEvent: (event: TypingEventPayload) => void) {
  const handler = useCallback(
    (event: SSEEventPayload) => {
      if (event.type.startsWith("typing:")) onEvent(event as TypingEventPayload)
    },
    [onEvent],
  )
  return useSSEEvents(userId, handler)
}
