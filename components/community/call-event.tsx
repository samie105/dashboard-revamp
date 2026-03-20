"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  CallIncoming04Icon,
  CallOutgoing04Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type CallEventProps = {
  content: string
  isOwn: boolean
  timestamp: Date
  onCallback?: (type: "video" | "audio") => void
}

function parseCallEvent(content: string, isOwn: boolean) {
  if (content.startsWith("CALL_EVENT:")) {
    const parts = content.split(":")
    const type = (parts[1] === "video" ? "video" : "audio") as "video" | "audio"
    const status = parts[2] || "completed"
    const durationStr = parts[3] || "0"
    const isCaller = isOwn

    const isMissed = status === "missed"
    const isDeclined = status === "declined"
    const isFailed = status === "failed"
    const isCompleted = status === "completed"
    const isOngoing = status === "ongoing"
    const duration = durationStr !== "0" ? durationStr : null

    return { type, isMissed, isDeclined, isFailed, isCompleted, isOngoing, duration, isCaller }
  }

  const isVideo = content.includes("Video") || content.includes("📹")
  const type: "video" | "audio" = isVideo ? "video" : "audio"
  const isMissed = content.toLowerCase().includes("missed")
  const isDeclined = content.toLowerCase().includes("declined")
  const isFailed = content.toLowerCase().includes("failed")
  const isCompleted = !isMissed && !isDeclined && !isFailed
  const durationMatch = content.match(/·\s*(.+)$/)
  const duration = isCompleted && durationMatch ? durationMatch[1].trim() : null

  return { type, isMissed, isDeclined, isFailed, isCompleted, isOngoing: false, duration, isCaller: isOwn }
}

export function isCallEventMessage(content: string): boolean {
  if (content.startsWith("CALL_EVENT:")) return true
  return (
    content.startsWith("📹") ||
    content.startsWith("📞") ||
    (content.includes("call") &&
      (content.includes("Missed") ||
        content.includes("declined") ||
        content.includes("failed") ||
        content.includes("Video call ·") ||
        content.includes("Voice call ·")))
  )
}

export function CallEvent({ content, isOwn, timestamp, onCallback }: CallEventProps) {
  const { type, isMissed, isDeclined, isFailed, isOngoing, duration, isCaller } = parseCallEvent(content, isOwn)

  const getStatusLabel = () => {
    if (isOngoing) return "Ongoing"
    if (duration) return duration
    if (isFailed) return "Failed"
    if (isMissed) return isCaller ? "No answer" : "Missed"
    if (isDeclined) return "Declined"
    return "Completed"
  }

  const isNegative = isMissed || isDeclined || isFailed
  const CallIcon = type === "video" ? Video01Icon : Call02Icon
  const StatusIcon = isCaller ? CallOutgoing04Icon : CallIncoming04Icon

  const timeStr = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className={cn("flex items-center py-1", isOwn ? "justify-end" : "justify-start")}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-muted">
          <HugeiconsIcon icon={CallIcon} size={12} className="text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={StatusIcon} size={10} className={isNegative ? "text-destructive" : "text-muted-foreground"} />
            <span className="text-xs font-medium">
              {type === "video" ? "Video" : "Voice"} call
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn("text-[10px]", isNegative ? "text-destructive" : "text-muted-foreground")}>
              {getStatusLabel()}
            </span>
            <span className="text-[10px] text-muted-foreground">· {timeStr}</span>
          </div>
        </div>

        {isNegative && !isFailed && onCallback && (
          <button
            onClick={() => onCallback(type)}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            title={`Call back (${type})`}
          >
            <HugeiconsIcon icon={CallIcon} size={12} className="text-primary" />
          </button>
        )}
      </div>
    </div>
  )
}
