"use client"

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react"
import { VideoCall } from "./video-call"
import { pollIncomingCall } from "@/lib/community/actions/calls"
import { useProfile } from "@/components/profile-provider"

type IncomingCallData = {
  callId: string
  callerName: string
  callerAvatar: string | null
  callType: "video" | "audio"
  conversationId: string
}

type OutgoingCallData = {
  receiverId: string
  receiverName: string
  receiverAvatar?: string
  callType: "video" | "audio"
}

type CallContextType = {
  startCall: (data: OutgoingCallData) => void
  isInCall: boolean
}

const CallContext = createContext<CallContextType>({
  startCall: () => {},
  isInCall: false,
})

export function useGlobalCall() {
  return useContext(CallContext)
}

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile()

  // Incoming call state
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [showIncoming, setShowIncoming] = useState(false)
  const [isIncomingMinimized, setIsIncomingMinimized] = useState(true)
  const dismissedCallsRef = useRef<Set<string>>(new Set())
  const answeredRef = useRef(false)

  // Outgoing call state
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallData | null>(null)
  const [showOutgoing, setShowOutgoing] = useState(false)
  const [isOutgoingMinimized, setIsOutgoingMinimized] = useState(true)

  const isInCall = showIncoming || showOutgoing

  // Poll for incoming calls
  useEffect(() => {
    if (!profile?.authUserId) return
    let active = true

    async function poll() {
      try {
        const result = await pollIncomingCall()
        if (!active) return

        if (result.incoming && !dismissedCallsRef.current.has(result.incoming.callId)) {
          setIncomingCall(result.incoming as IncomingCallData)
          setShowIncoming(true)
        } else if (!result.incoming) {
          // Only auto-close if we haven't answered yet
          if (incomingCall && !answeredRef.current) {
            setShowIncoming(false)
            setIncomingCall(null)
          }
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    const interval = setInterval(poll, 2000)
    poll()

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [profile?.authUserId, incomingCall])

  // Incoming call handlers
  const handleIncomingClose = useCallback(() => {
    if (incomingCall) dismissedCallsRef.current.add(incomingCall.callId)
    answeredRef.current = false
    setShowIncoming(false)
    setIncomingCall(null)
    setIsIncomingMinimized(true)
  }, [incomingCall])

  const handleIncomingEnded = useCallback(() => {
    if (incomingCall) dismissedCallsRef.current.add(incomingCall.callId)
    answeredRef.current = false
    setShowIncoming(false)
    setIncomingCall(null)
    setIsIncomingMinimized(true)
  }, [incomingCall])

  const handleIncomingAnswered = useCallback(() => {
    answeredRef.current = true
  }, [])

  // Outgoing call — start call minimized from anywhere
  const startCall = useCallback((data: OutgoingCallData) => {
    if (isInCall) return // Don't start a call if already in one
    setOutgoingCall(data)
    setShowOutgoing(true)
    setIsOutgoingMinimized(true)
  }, [isInCall])

  const handleOutgoingClose = useCallback(() => {
    setShowOutgoing(false)
    setOutgoingCall(null)
    setIsOutgoingMinimized(true)
  }, [])

  const handleOutgoingEnded = useCallback(() => {
    setShowOutgoing(false)
    setOutgoingCall(null)
    setIsOutgoingMinimized(true)
  }, [])

  return (
    <CallContext.Provider value={{ startCall, isInCall }}>
      {children}

      {/* Incoming call — starts minimized as a PIP */}
      {incomingCall && (
        <VideoCall
          open={showIncoming}
          onClose={handleIncomingClose}
          callType={incomingCall.callType}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar || undefined}
          isIncoming
          incomingCallId={incomingCall.callId}
          onCallStarted={handleIncomingAnswered}
          onCallEnded={handleIncomingEnded}
          isMinimized={isIncomingMinimized}
          onMinimize={() => setIsIncomingMinimized(true)}
          onRestore={() => setIsIncomingMinimized(false)}
        />
      )}

      {/* Outgoing call — starts minimized by default */}
      {outgoingCall && (
        <VideoCall
          open={showOutgoing}
          onClose={handleOutgoingClose}
          callType={outgoingCall.callType}
          callerName={outgoingCall.receiverName}
          callerAvatar={outgoingCall.receiverAvatar}
          receiverId={outgoingCall.receiverId}
          onCallEnded={handleOutgoingEnded}
          isMinimized={isOutgoingMinimized}
          onMinimize={() => setIsOutgoingMinimized(true)}
          onRestore={() => setIsOutgoingMinimized(false)}
        />
      )}
    </CallContext.Provider>
  )
}
