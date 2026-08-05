"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useVividOptional } from "@worldstreet/vivid-voice"
import type { VividAgentState } from "@worldstreet/vivid-voice"
import SilkOrb from "./silk-orb"

/**
 * Vivid's presence on the page, in two forms.
 *
 * Idle: the silk orb alone in the bottom-right corner — no chrome, no icon,
 * just the field. Tap to start.
 *
 * Live: the orb docks into a slim capsule centred at the bottom of the screen —
 * the Codex grammar: one quiet bar that says who is listening, lets the user
 * hand Vivid their camera, and always shows the way out. The page stays the
 * star; the capsule is furniture.
 */

const STATE_LABELS: Record<VividAgentState, string> = {
  idle: "",
  connecting: "Connecting",
  ready: "Ready",
  listening: "Listening",
  processing: "Thinking",
  speaking: "Speaking",
  error: "",
}

/** State dot inside the live capsule — brand while working, credit when talking. */
const STATE_DOT: Record<VividAgentState, string> = {
  idle: "bg-subtle",
  connecting: "bg-primary animate-pulse",
  ready: "bg-credit",
  listening: "bg-primary animate-pulse",
  processing: "bg-primary animate-pulse",
  speaking: "bg-credit animate-pulse",
  error: "bg-debit",
}

// Frames are downscaled before being sent to the model — big enough to read
// labels and charts, small enough to keep the data channel snappy.
const MAX_FRAME_WIDTH = 1024
const JPEG_QUALITY = 0.8

export default function VividVoiceControl() {
  const _vivid = useVividOptional()
  const state = _vivid?.state ?? "idle"
  const isConnected = _vivid?.isConnected ?? false
  const startSession = _vivid?.startSession ?? (async () => {})
  const endSession = _vivid?.endSession ?? (() => {})
  const getAudioLevels = _vivid?.getAudioLevels ?? (() => new Uint8Array(0))
  const sendImage = _vivid?.sendImage

  const [camActive, setCamActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const isLive = state !== "idle" && state !== "error"

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamActive(false)
  }, [])

  const enableCamera = useCallback(async () => {
    if (streamRef.current) return
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    })
    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      await video.play()
      // Wait until the first frame has real dimensions
      if (video.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve()
        })
      }
    }
    setCamActive(true)
  }, [])

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  }, [])

  // The lookAtCamera tool (lib/vivid-functions) dispatches vivid:look; we own the
  // camera stream and the realtime connection, so we capture a frame, inject it
  // into the conversation, and report back via vivid:look-result. The image is
  // sent WITHOUT triggerResponse — the tool result's response.create picks it up.
  useEffect(() => {
    const onLook = async () => {
      const done = (detail: Record<string, unknown>) =>
        window.dispatchEvent(new CustomEvent("vivid:look-result", { detail }))

      if (!sendImage) {
        done({ error: "Vision is not available in this session." })
        return
      }
      try {
        if (!streamRef.current) await enableCamera()
        const frame = captureFrame()
        if (!frame) {
          done({ error: "Could not capture a camera frame. The camera may still be starting up — try again." })
          return
        }
        sendImage(frame)
        done({
          success: true,
          note: "A fresh camera frame was attached to the conversation. Describe what you see in it.",
        })
      } catch {
        done({
          error:
            "Camera access failed or was denied. Ask the user to allow camera access in their browser.",
        })
      }
    }
    window.addEventListener("vivid:look", onLook)
    return () => window.removeEventListener("vivid:look", onLook)
  }, [sendImage, enableCamera, captureFrame])

  // Camera dies with the session
  useEffect(() => {
    if (!isConnected && streamRef.current) stopCamera()
  }, [isConnected, stopCamera])

  const start = useCallback(async () => {
    if (state === "connecting") return
    if (!isConnected) await startSession()
  }, [state, isConnected, startSession])

  const toggleCamera = useCallback(() => {
    if (camActive) stopCamera()
    else void enableCamera().catch(() => {})
  }, [camActive, stopCamera, enableCamera])

  return (
    <>
      {/* Hidden video sink for the camera stream — frames are captured from here */}
      <video ref={videoRef} muted playsInline className="hidden" />

      {/* Idle: the orb alone, bottom-right. Tap to start. */}
      {!isLive && (
        <div className="fixed bottom-5 right-5 z-50 max-md:bottom-24">
          <SilkOrb state={state} onClick={start} size="md" getAudioLevels={getAudioLevels} label="Talk to Vivid" />
        </div>
      )}

      {/* Live: the capsule, centred at the bottom — Vivid is in control. */}
      {isLive && (
        <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 max-md:bottom-24">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-card/90 py-1.5 pl-1.5 pr-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <SilkOrb state={state} size="xs" getAudioLevels={getAudioLevels} label="Vivid" />

            <div className="flex items-center gap-2 pl-2 pr-1.5 select-none" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />
              <span className="text-[12.5px] font-medium text-white/90 min-w-16">
                {STATE_LABELS[state]}
              </span>
            </div>

            <span className="h-5 w-px bg-white/[0.07]" aria-hidden />

            <CapsuleButton
              onClick={toggleCamera}
              label={camActive ? "Turn off camera" : "Let Vivid see your camera"}
              active={camActive}
            >
              <CameraIcon />
            </CapsuleButton>

            <CapsuleButton onClick={() => endSession()} label="End Vivid session" danger>
              <CloseIcon />
            </CapsuleButton>
          </div>
        </div>
      )}
    </>
  )
}

/** One round control inside the capsule — fill separates, never outline. */
function CapsuleButton({
  onClick,
  label,
  active = false,
  danger = false,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 ${
        danger
          ? "bg-debit-chip text-debit hover:bg-debit hover:text-white"
          : active
            ? "bg-primary text-black"
            : "bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] hover:text-white"
      }`}
    >
      {children}
      {active && !danger && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-credit ring-2 ring-card" />
      )}
    </button>
  )
}

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
