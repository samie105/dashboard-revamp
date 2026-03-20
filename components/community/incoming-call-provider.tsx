"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { VideoCall } from "./video-call"
import { pollIncomingCall } from "@/lib/community/actions/calls"

type IncomingCallData = {
  callId: string
  callerName: string
  callerAvatar: string | null
  callType: "video" | "audio"
  conversationId: string
}

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [showCall, setShowCall] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const result = await pollIncomingCall()
        if (!active) return

        if (result.incoming && !dismissedCallsRef.current.has(result.incoming.callId)) {
          setIncomingCall(result.incoming as IncomingCallData)
          setShowCall(true)
        } else if (!result.incoming) {
          if (incomingCall) {
            setShowCall(false)
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
  }, [incomingCall])

  const handleClose = useCallback(() => {
    if (incomingCall) {
      dismissedCallsRef.current.add(incomingCall.callId)
    }
    setShowCall(false)
    setIncomingCall(null)
  }, [incomingCall])

  const handleCallEnded = useCallback(() => {
    if (incomingCall) {
      dismissedCallsRef.current.add(incomingCall.callId)
    }
    setShowCall(false)
    setIncomingCall(null)
  }, [incomingCall])

  return (
    <>
      {children}

      {incomingCall && (
        <VideoCall
          open={showCall}
          onClose={handleClose}
          callType={incomingCall.callType}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar || undefined}
          isIncoming
          incomingCallId={incomingCall.callId}
          onCallEnded={handleCallEnded}
        />
      )}
    </>
  )
}
