"use client"

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallEnd01Icon,
  Video01Icon,
  WifiConnected01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoCall } from "./video-call"
import {
  endCall as endCallAction,
  pollIncomingCall,
  cleanupOrphanedCalls,
  getActiveCall,
  rejoinCall,
} from "@/lib/community/actions/calls"
import { updatePresence } from "@/lib/community/actions/messages"
import { useSSEEvents } from "@/lib/community/use-events"
import { useProfile } from "@/components/profile-provider"
import { callSounds } from "@/lib/community/call-sounds"
import { rtkClient, preloadRTKSDK } from "@/lib/community/rtk-client"
import { avatarUrl } from "@/lib/utils"
import type { CallEventPayload, SSEEventPayload } from "@/lib/community/events"

type CallType = "video" | "audio"
type CallState =
  | "idle"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "busy"
  | "reconnecting"

type CallInfo = {
  callId: string | null
  callType: CallType
  participantId: string
  participantName: string
  participantAvatar?: string
  isIncoming: boolean
  conversationId?: string
  authToken?: string
  isReconnection?: boolean
  originalAnsweredAt?: string
}

type CallContextType = {
  activeCall: CallInfo | null
  callState: CallState
  isMinimized: boolean
  remoteRejoined: boolean
  startCall: (params: {
    participantId: string
    participantName: string
    participantAvatar?: string
    callType: CallType
  }) => void
  endCall: () => void
  setMinimized: (minimized: boolean) => void
  onCallConnected: (callId: string) => void
  onCallEnded: () => void
  hasOngoingCall: boolean
  /** @deprecated Use startCall instead */
  isInCall: boolean
}

const CallContext = createContext<CallContextType | null>(null)

export function useGlobalCall() {
  const context = useContext(CallContext)
  if (!context) throw new Error("useGlobalCall must be used within IncomingCallProvider")
  return context
}

export function useOngoingCall() {
  const context = useContext(CallContext)
  return context?.hasOngoingCall ?? false
}

export function IncomingCallProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile()
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null)
  const [callState, setCallState] = useState<CallState>("idle")
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCallUI, setShowCallUI] = useState(false)
  const [remoteRejoined, setRemoteRejoined] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())
  const callTabChannelRef = useRef<BroadcastChannel | null>(null)

  // Refs for latest state in callbacks
  const activeCallRef = useRef<CallInfo | null>(null)
  const callStateRef = useRef<CallState>("idle")

  useEffect(() => {
    activeCallRef.current = activeCall
    callStateRef.current = callState
  }, [activeCall, callState])

  const hasOngoingCall =
    callState === "connecting" ||
    callState === "connected" ||
    callState === "ringing" ||
    callState === "reconnecting"

  // ── Multi-tab sync via BroadcastChannel ──
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel("call-tab-sync")
    callTabChannelRef.current = channel

    channel.onmessage = (event) => {
      const { type, callId } = event.data || {}
      const current = activeCallRef.current

      if (
        (type === "call:answered-on-other-tab" || type === "call:started-on-other-tab") &&
        current?.callId === callId &&
        callStateRef.current === "ringing"
      ) {
        dismissedCallsRef.current.add(callId)
        setActiveCall(null)
        setCallState("idle")
        setShowCallUI(false)
        setIsMinimized(false)
      }

      if (type === "call:ended-on-other-tab" && current?.callId === callId) {
        dismissedCallsRef.current.add(callId)
        setActiveCall(null)
        setCallState("idle")
        setShowCallUI(false)
        setIsMinimized(false)
      }
    }

    return () => {
      channel.close()
      callTabChannelRef.current = null
    }
  }, [])

  // ── Preload sounds + RTK SDK + presence heartbeat ──
  useEffect(() => {
    callSounds.preload()
    preloadRTKSDK().catch(() => {})
    // Global presence heartbeat — keeps lastSeen updated across all pages
    updatePresence()
    const presenceInterval = setInterval(() => updatePresence(), 45_000)

    // Update presence immediately when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") updatePresence()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(presenceInterval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  // ── On mount: check for active call (reconnection), then cleanup stale ──
  useEffect(() => {
    let cancelled = false

    async function checkAndCleanup() {
      try {
        const { activeCall: existingCall } = await getActiveCall()
        if (cancelled) return

        if (existingCall) {
          setActiveCall({
            callId: existingCall.callId,
            callType: existingCall.callType,
            participantId: existingCall.participantId,
            participantName: existingCall.participantName,
            participantAvatar: existingCall.participantAvatar || undefined,
            isIncoming: existingCall.isIncoming,
            conversationId: existingCall.conversationId,
            authToken: existingCall.authToken,
            isReconnection: true,
            originalAnsweredAt: existingCall.answeredAt,
          })
          setCallState("reconnecting")
          setShowCallUI(true)
          setIsMinimized(true)
          return
        }

        // Destroy leftover RTK client if idle
        if (callStateRef.current === "idle" && (rtkClient.isInRoom || rtkClient.client)) {
          rtkClient.destroy().catch(() => {})
        }

        await cleanupOrphanedCalls()
      } catch {
        // Ignore
      }
    }

    checkAndCleanup()
    return () => { cancelled = true }
  }, [])

  // ── beforeunload: end call via server action ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = activeCallRef.current
      const state = callStateRef.current
      if (!current?.callId) return
      if (state !== "connecting" && state !== "connected" && state !== "ringing") return

      endCallAction(current.callId).catch(() => {})
      try { rtkClient.destroy().catch(() => {}) } catch { /* ignore */ }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // ── Auto-close busy state ──
  useEffect(() => {
    if (callState !== "busy") return
    callSounds.playDeclined()
    const timer = setTimeout(() => {
      setActiveCall(null)
      setCallState("idle")
      setShowCallUI(false)
      setIsMinimized(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [callState])

  // ── Handle Ably call events (PRIMARY incoming call detection) ──
  const handleCallEvent = useCallback((event: CallEventPayload) => {
    switch (event.type) {
      case "call:incoming": {
        const isInActiveCall =
          rtkClient.isInRoom ||
          (callStateRef.current !== "idle" &&
            callStateRef.current !== "ended" &&
            callStateRef.current !== "reconnecting")

        if (isInActiveCall) {
          // Same caller calling again — update to newer call
          const current = activeCallRef.current
          if (current && current.participantId === event.callerId && callStateRef.current === "ringing") {
            setActiveCall((prev) => prev ? { ...prev, callId: event.callId, authToken: event.authToken } : prev)
            return
          }

          // Auto-decline — already in a call
          ;(async () => {
            try {
              const { declineCall } = await import("@/lib/community/actions/calls")
              await declineCall(event.callId)
            } catch { /* ignore */ }
          })()
          return
        }

        if (dismissedCallsRef.current.has(event.callId)) return

        setActiveCall({
          callId: event.callId,
          callType: event.callType,
          participantId: event.callerId,
          participantName: event.callerName,
          participantAvatar: event.callerAvatar || undefined,
          isIncoming: true,
          conversationId: event.conversationId,
          authToken: event.authToken,
        })
        setCallState("ringing")
        setShowCallUI(true)
        setIsMinimized(true)
        break
      }

      case "call:cancelled":
      case "call:declined":
      case "call:ended": {
        const current = activeCallRef.current
        if (current?.callId === event.callId) {
          dismissedCallsRef.current.add(event.callId)
          setCallState("ended")
        }
        break
      }

      case "call:answered": {
        // VideoCall handles the join logic
        break
      }

      case "call:busy": {
        setCallState("busy")
        break
      }

      case "call:tokens-ready": {
        const current = activeCallRef.current
        if (current?.callId === event.callId && current.isIncoming) {
          setActiveCall((prev) => prev ? { ...prev, authToken: event.authToken } : prev)
        }
        break
      }

      case "call:participant-rejoined": {
        const current = activeCallRef.current
        if (current?.callId === event.callId) {
          setRemoteRejoined(true)
          setTimeout(() => setRemoteRejoined(false), 5000)
        }
        break
      }
    }
  }, [])

  // Forward ALL Ably events + handle call events
  const handleAllEvents = useCallback(
    (event: SSEEventPayload) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sse:event", { detail: event }))
      }
      if (event.type.startsWith("call:")) {
        handleCallEvent(event as CallEventPayload)
      }
    },
    [handleCallEvent],
  )

  useSSEEvents(profile?.authUserId ?? null, handleAllEvents)

  // ── Polling FALLBACK (20s) — only when idle ──
  useEffect(() => {
    const poll = async () => {
      if (rtkClient.isInRoom) return
      if (callStateRef.current !== "idle" && callStateRef.current !== "ended") return

      try {
        const result = await pollIncomingCall()
        if (result.incoming && callStateRef.current === "idle") {
          if (dismissedCallsRef.current.has(result.incoming.callId)) return
          setActiveCall({
            callId: result.incoming.callId,
            callType: result.incoming.callType,
            participantId: result.incoming.callerId,
            participantName: result.incoming.callerName,
            participantAvatar: result.incoming.callerAvatar || undefined,
            isIncoming: true,
            conversationId: result.incoming.conversationId,
            authToken: result.incoming.authToken,
          })
          setCallState("ringing")
          setShowCallUI(true)
          setIsMinimized(true)
        }
      } catch { /* ignore */ }
    }

    const interval = setInterval(poll, 20000)
    return () => clearInterval(interval)
  }, [])

  // ── Actions ──

  const startCall = useCallback(
    (params: {
      participantId: string
      participantName: string
      participantAvatar?: string
      callType: CallType
    }) => {
      if (rtkClient.isInRoom) return
      if (
        callStateRef.current === "connecting" ||
        callStateRef.current === "connected" ||
        callStateRef.current === "ringing"
      ) return

      setActiveCall({
        callId: null,
        callType: params.callType,
        participantId: params.participantId,
        participantName: params.participantName,
        participantAvatar: params.participantAvatar,
        isIncoming: false,
      })
      setCallState("connecting")
      setShowCallUI(true)
      setIsMinimized(false)
      callSounds.resume()
      callTabChannelRef.current?.postMessage({ type: "call:started-on-other-tab", callId: "outgoing" })
    },
    [],
  )

  const handleRejoin = useCallback(async () => {
    const current = activeCallRef.current
    if (!current?.callId || !current.authToken) return

    setCallState("connecting")

    try {
      const result = await rejoinCall(current.callId)
      if (!result.success) {
        setActiveCall(null)
        setCallState("idle")
        setShowCallUI(false)
        setIsMinimized(false)
        return
      }

      const token = result.authToken || current.authToken
      await rtkClient.init(token, { audio: true, video: current.callType === "video" })
      await rtkClient.joinRoom()
      try { await rtkClient.client?.self.enableAudio() } catch { /* ignore */ }
      if (current.callType === "video") {
        try { await rtkClient.client?.self.enableVideo() } catch { /* ignore */ }
      }

      setActiveCall((prev) => prev ? { ...prev, isReconnection: false } : prev)
    } catch {
      setActiveCall(null)
      setCallState("idle")
      setShowCallUI(false)
      setIsMinimized(false)
    }
  }, [])

  const handleDismissReconnection = useCallback(async () => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
      try { await endCallAction(current.callId) } catch { /* ignore */ }
    }
    try { await rtkClient.leaveRoom() } catch { /* ignore */ }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
  }, [])

  const endCall = useCallback(() => {
    if (activeCallRef.current?.callId) {
      dismissedCallsRef.current.add(activeCallRef.current.callId)
    }
    setCallState("ended")
  }, [])

  const onCallConnected = useCallback((callId: string) => {
    setActiveCall((prev) => (prev ? { ...prev, callId } : prev))
    callTabChannelRef.current?.postMessage({ type: "call:answered-on-other-tab", callId })
  }, [])

  const onCallEnded = useCallback(() => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
      callTabChannelRef.current?.postMessage({ type: "call:ended-on-other-tab", callId: current.callId })
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
    setRemoteRejoined(false)
  }, [])

  const handleClose = useCallback(() => {
    const current = activeCallRef.current
    if (current?.callId) {
      dismissedCallsRef.current.add(current.callId)
      endCallAction(current.callId).catch(() => {})
      callTabChannelRef.current?.postMessage({ type: "call:ended-on-other-tab", callId: current.callId })
    }
    setActiveCall(null)
    setCallState("idle")
    setShowCallUI(false)
    setIsMinimized(false)
    setRemoteRejoined(false)
  }, [])

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callState,
        isMinimized,
        remoteRejoined,
        startCall,
        endCall,
        setMinimized: setIsMinimized,
        onCallConnected,
        onCallEnded,
        hasOngoingCall,
        isInCall: hasOngoingCall,
      }}
    >
      {children}

      {/* Reconnection banner */}
      {activeCall && showCallUI && callState === "reconnecting" && (
        <ReconnectionBanner
          callInfo={activeCall}
          remoteRejoined={remoteRejoined}
          onRejoin={handleRejoin}
          onDismiss={handleDismissReconnection}
        />
      )}

      {/* Normal call UI */}
      {activeCall && showCallUI && callState !== "reconnecting" && (
        <VideoCall
          open={!isMinimized}
          onClose={handleClose}
          callType={activeCall.callType}
          callerName={activeCall.participantName}
          callerAvatar={activeCall.participantAvatar}
          isIncoming={activeCall.isIncoming}
          incomingCallId={activeCall.isIncoming ? activeCall.callId || undefined : undefined}
          incomingAuthToken={activeCall.isIncoming ? activeCall.authToken : undefined}
          receiverId={!activeCall.isIncoming ? activeCall.participantId : undefined}
          onCallStarted={onCallConnected}
          onCallEnded={onCallEnded}
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onRestore={() => setIsMinimized(false)}
          isReconnection={activeCall.isReconnection}
          reconnectionAuthToken={activeCall.isReconnection ? activeCall.authToken : undefined}
          originalAnsweredAt={activeCall.originalAnsweredAt}
          remoteRejoined={remoteRejoined}
        />
      )}
    </CallContext.Provider>
  )
}

// ── Reconnection Banner ──

function ReconnectionBanner({
  callInfo,
  remoteRejoined,
  onRejoin,
  onDismiss,
}: {
  callInfo: CallInfo
  remoteRejoined: boolean
  onRejoin: () => void
  onDismiss: () => void
}) {
  const [isRejoining, setIsRejoining] = useState(false)

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const handleRejoin = async () => {
    setIsRejoining(true)
    await onRejoin()
    setIsRejoining(false)
  }

  return (
    <div className="fixed bottom-24 right-4 z-9999 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-border/50 bg-background">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatarUrl(callInfo.participantAvatar, callInfo.participantName)} alt={callInfo.participantName} />
            <AvatarFallback className="text-xs">{getInitials(callInfo.participantName)}</AvatarFallback>
          </Avatar>
          {remoteRejoined && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
              <HugeiconsIcon icon={WifiConnected01Icon} size={8} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{callInfo.participantName}</span>
          <span className="text-xs text-muted-foreground">
            {remoteRejoined ? "Participant is back" : `Active ${callInfo.callType} call`}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={onDismiss}
            disabled={isRejoining}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            <HugeiconsIcon icon={CallEnd01Icon} size={16} />
          </button>
          <button
            onClick={handleRejoin}
            disabled={isRejoining}
            className="h-9 px-3 rounded-full flex items-center justify-center gap-1.5 bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 text-xs font-medium"
          >
            {isRejoining ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <HugeiconsIcon icon={callInfo.callType === "video" ? Video01Icon : Call02Icon} size={14} />
                Rejoin
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
