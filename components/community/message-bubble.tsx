"use client"

import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  File01Icon,
  PlayIcon,
  PauseIcon,
  Tick02Icon,
  TickDouble02Icon,
  Cancel01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Image02Icon,
  Download04Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useCallback } from "react"
import gsap from "gsap"

export type MessageType = {
  id: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  timestamp: Date
  isOwn: boolean
  type?: "text" | "image" | "file" | "voice" | "video" | "audio"
  fileUrl?: string
  fileUrls?: string[]
  fileName?: string
  fileSize?: string
  duration?: string
  waveform?: number[]
  isRead?: boolean
  isDelivered?: boolean
  status?: "pending" | "sent" | "error"
  uploadProgress?: number
  isNew?: boolean
}

type MessageBubbleProps = {
  message: MessageType
  showAvatar?: boolean
  showTimestamp?: boolean
}

export function MessageBubble({ message, showAvatar = true, showTimestamp = true }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [fullscreenMedia, setFullscreenMedia] = useState<{ type: "image" | "video"; index?: number } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const updateAudioProgressRef = useRef<() => void>(null)

  const updateAudioProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const audio = audioRef.current
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100)
        setCurrentTime(audio.currentTime)
      }
      animationFrameRef.current = requestAnimationFrame(() => updateAudioProgressRef.current?.())
    }
  }, [])

  useEffect(() => {
    updateAudioProgressRef.current = updateAudioProgress
  }, [updateAudioProgress])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        setIsPlaying(false)
      } else {
        setIsAudioLoading(true)
        audioRef.current.play().then(() => {
          setIsPlaying(true)
          setIsAudioLoading(false)
          animationFrameRef.current = requestAnimationFrame(updateAudioProgress)
        }).catch((err) => {
          console.error("Audio play failed:", err)
          setIsPlaying(false)
          setIsAudioLoading(false)
        })
      }
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    audioRef.current.currentTime = percentage * audioRef.current.duration
    setProgress(percentage * 100)
    setCurrentTime(audioRef.current.currentTime)
  }

  const renderContent = () => {
    switch (message.type) {
      case "image": {
        const urls = message.fileUrls && message.fileUrls.length > 0
          ? message.fileUrls
          : message.fileUrl
            ? [message.fileUrl]
            : []
        const count = urls.length

        if (count === 0) {
          return (
            <div className="min-w-56 aspect-4/3 bg-muted flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground text-xs">Loading image...</div>
            </div>
          )
        }

        return (
          <div className="space-y-1">
            <button
              onClick={() => setFullscreenMedia({ type: "image", index: 0 })}
              className="block relative bg-muted cursor-pointer active:scale-[0.98] transition-transform overflow-hidden w-full aspect-4/3"
              style={{ minWidth: 280 }}
            >
              <Image src={urls[0]} alt="" fill className="object-cover" sizes="280px" />
              {count > 1 && (
                <div
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                >
                  <HugeiconsIcon icon={Image02Icon} size={12} />
                  <span>{count}</span>
                </div>
              )}
            </button>
            {message.content && (
              <p className="text-sm px-3 py-1.5">{message.content}</p>
            )}
          </div>
        )
      }

      case "video":
        return (
          <div className="space-y-1">
            <button
              onClick={() => message.fileUrl && !message.uploadProgress ? setFullscreenMedia({ type: "video" }) : undefined}
              className={cn(
                "block overflow-hidden w-full min-w-56 relative aspect-video bg-black",
                message.fileUrl && !message.uploadProgress && "cursor-pointer active:scale-[0.98] transition-transform"
              )}
            >
              {message.fileUrl ? (
                <>
                  <video
                    src={message.fileUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    preload="metadata"
                    playsInline
                    muted
                  />
                  {message.uploadProgress != null && message.uploadProgress < 100 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <div className="relative h-14 w-14">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                          <circle
                            cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="3"
                            strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - (message.uploadProgress || 0) / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white tabular-nums">
                          {message.uploadProgress}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <HugeiconsIcon icon={PlayIcon} size={20} className="text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse text-white/50 text-xs">Loading video...</div>
                </div>
              )}
            </button>
            {message.content && (
              <p className="text-sm px-3 py-1.5">{message.content}</p>
            )}
          </div>
        )

      case "file":
        return (
          <div className="flex items-center gap-3 min-w-48">
            <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={File01Icon} size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName || "File"}</p>
              <p className="text-xs opacity-60">{message.fileSize || "—"}</p>
            </div>
          </div>
        )

      case "voice":
      case "audio":
        return (
          <div className={cn(
            "flex items-center gap-2.5 min-w-52 transition-opacity duration-300",
            hasPlayed && !isPlaying && "opacity-60"
          )}>
            {message.fileUrl && (
              <audio
                ref={audioRef}
                src={message.fileUrl}
                preload="auto"
                onEnded={() => {
                  setIsPlaying(false)
                  setHasPlayed(true)
                  setProgress(100)
                }}
                onTimeUpdate={(e) => {
                  const audio = e.currentTarget
                  if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
                    if (!isPlaying) {
                      setProgress((audio.currentTime / audio.duration) * 100)
                      setCurrentTime(audio.currentTime)
                    }
                  }
                }}
                onLoadedMetadata={(e) => {
                  const duration = e.currentTarget.duration
                  if (duration && !isNaN(duration)) {
                    setAudioDuration(duration)
                  }
                }}
                onCanPlay={() => {
                  if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                    setAudioDuration(audioRef.current.duration)
                  }
                }}
              />
            )}
            <button
              className={cn(
                "h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors",
                message.isOwn 
                  ? "hover:bg-primary-foreground/20" 
                  : "hover:bg-muted-foreground/20",
                !message.fileUrl && "opacity-50 cursor-not-allowed"
              )}
              onClick={message.fileUrl ? toggleAudio : undefined}
              disabled={!message.fileUrl || isAudioLoading}
            >
              {isAudioLoading ? (
                <div className={cn(
                  "h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin",
                  message.isOwn ? "text-primary-foreground" : ""
                )} />
              ) : (
                <HugeiconsIcon 
                  icon={isPlaying ? PauseIcon : PlayIcon} 
                  size={16} 
                  className={message.isOwn ? "text-primary-foreground" : ""}
                />
              )}
            </button>
            <div 
              className={cn(
                "flex-1 h-6 flex items-center relative",
                message.fileUrl ? "cursor-pointer" : "cursor-default"
              )}
              onClick={message.fileUrl ? handleProgressClick : undefined}
            >
              <div className={cn(
                "w-full h-0.75 rounded-full relative",
                message.isOwn ? "bg-primary-foreground/20" : "bg-muted-foreground/15"
              )}>
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    message.isOwn ? "bg-primary-foreground/80" : "bg-foreground/50"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full shadow-sm",
                  message.isOwn ? "bg-primary-foreground" : "bg-foreground/70"
                )}
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <span className={cn(
              "text-[10px] shrink-0 tabular-nums min-w-8 text-right",
              message.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {isPlaying || currentTime > 0
                ? formatDuration(currentTime)
                : message.duration || (audioDuration > 0 ? formatDuration(audioDuration) : "0:00")
              }
            </span>
          </div>
        )

      default:
        if (message.content) {
          return <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        }
        return <p className="text-sm text-muted-foreground/50 italic">Message</p>
    }
  }

  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bubbleRef.current || !message.isNew) return
    gsap.fromTo(
      bubbleRef.current,
      { y: 10, opacity: 0, scale: 0.97 },
      { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.2)" }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={bubbleRef}
      className={cn(
        "flex gap-2 transition-opacity duration-200",
        message.isOwn ? "justify-end" : "justify-start",
        message.status === "pending" ? "opacity-60" : "opacity-100",
      )}
    >
      {!message.isOwn && showAvatar && (
        <Avatar className="h-6 w-6 mt-1 shrink-0">
          <AvatarImage src={message.senderAvatar} />
          <AvatarFallback className="text-[10px]">
            {message.senderName?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      )}
      {!message.isOwn && !showAvatar && <div className="w-6 shrink-0" />}

      <div className={cn("flex flex-col max-w-[75%]", message.isOwn ? "items-end" : "items-start")}>
        {(() => {
          const isMedia = message.type === "image" || message.type === "video"
          
          const isSingle = showAvatar && showTimestamp
          const isGroupStart = showAvatar && !showTimestamp
          const isGroupMiddle = !showAvatar && !showTimestamp
          const isGroupEnd = !showAvatar && showTimestamp
          
          const getBubbleRadius = () => {
            if (isSingle) {
              return message.isOwn ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
            }
            if (isGroupStart) {
              return message.isOwn
                ? "rounded-2xl rounded-br-sm"
                : "rounded-2xl rounded-bl-sm"
            }
            if (isGroupMiddle) {
              return message.isOwn
                ? "rounded-l-2xl rounded-r-md"
                : "rounded-r-2xl rounded-l-md"
            }
            if (isGroupEnd) {
              return message.isOwn
                ? "rounded-2xl rounded-tr-sm rounded-br-md"
                : "rounded-2xl rounded-tl-sm rounded-bl-md"
            }
            return "rounded-2xl"
          }
          
          return (
            <div
              className={cn(
                "shadow-sm ring-1 ring-black/3 dark:ring-white/4",
                getBubbleRadius(),
                isMedia ? "p-0 overflow-hidden" : "px-3.5 py-2",
                message.isOwn
                  ? "bg-primary text-primary-foreground shadow-primary/10"
                  : "bg-muted/70 backdrop-blur-sm",
                message.status === "error" && "bg-destructive/90 text-destructive-foreground"
              )}
            >
              {isMedia ? (
                <div>
                  {renderContent()}
                </div>
              ) : (
                renderContent()
              )}
            </div>
          )
        })()}
        
        {(showTimestamp || message.status === "pending" || message.status === "error") && (
        <div className="flex items-center gap-1 mt-0.5 px-0.5">
          <span className="text-[10px] text-muted-foreground/70">
            {message.status === "pending" 
              ? "Sending..." 
              : message.status === "error"
                ? "Failed"
                : formatTime(message.timestamp)}
          </span>
          {message.isOwn && message.status !== "pending" && message.status !== "error" && (
            <HugeiconsIcon
              icon={message.isRead ? TickDouble02Icon : Tick02Icon}
              size={11}
              className={cn(
                message.isRead ? "text-primary" : "text-muted-foreground/60"
              )}
            />
          )}
        </div>
        )}
      </div>

      {fullscreenMedia && (() => {
        let viewerUrl: string | undefined
        let allUrls: string[] | undefined
        if (fullscreenMedia.type === "image") {
          const urls = message.fileUrls && message.fileUrls.length > 0
            ? message.fileUrls
            : message.fileUrl ? [message.fileUrl] : []
          viewerUrl = urls[fullscreenMedia.index ?? 0]
          allUrls = urls
        } else {
          viewerUrl = message.fileUrl
        }
        if (!viewerUrl) return null
        return (
          <FullscreenMediaViewer
            type={fullscreenMedia.type}
            url={viewerUrl}
            urls={allUrls}
            initialIndex={fullscreenMedia.index ?? 0}
            onClose={() => setFullscreenMedia(null)}
          />
        )
      })()}
    </div>
  )
}

function FullscreenMediaViewer({
  type,
  url,
  urls,
  initialIndex = 0,
  onClose,
}: {
  type: "image" | "video"
  url: string
  urls?: string[]
  initialIndex?: number
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const activeUrl = type === "image" && urls && urls.length > 1 ? urls[currentIndex] : url

  const hasGallery = type === "image" && urls && urls.length > 1

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === " " && type === "video") {
        e.preventDefault()
        togglePlay()
      }
      if (hasGallery) {
        if (e.key === "ArrowLeft") setCurrentIndex((i) => Math.max(0, i - 1))
        if (e.key === "ArrowRight") setCurrentIndex((i) => Math.min((urls?.length ?? 1) - 1, i + 1))
      }
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [onClose, type, hasGallery, urls?.length, togglePlay])

  const handleDownload = async () => {
    try {
      const response = await fetch(activeUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `image-${currentIndex + 1}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(activeUrl, "_blank")
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    if (video.duration && !isNaN(video.duration)) {
      setProgress((video.currentTime / video.duration) * 100)
      setCurrentTime(video.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    videoRef.current.currentTime = percentage * videoRef.current.duration
    setProgress(percentage * 100)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all duration-300"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-white" />
        </button>
        {type === "image" && (
          <button
            onClick={handleDownload}
            className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all duration-300"
          >
            <HugeiconsIcon icon={Download04Icon} size={18} className="text-white" />
          </button>
        )}
      </div>

      <div
        className="relative w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "image" ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={activeUrl}
              alt=""
              fill
              className="object-contain p-8"
              sizes="100vw"
              priority
            />
            {hasGallery && (
              <>
                {currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex((i) => i - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-all"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={20} className="text-white" />
                  </button>
                )}
                {currentIndex < (urls?.length ?? 1) - 1 && (
                  <button
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-all"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-white" />
                  </button>
                )}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                  <span className="text-white/80 text-xs tabular-nums mr-1">{currentIndex + 1}/{urls!.length}</span>
                  {urls!.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-200",
                        i === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative max-w-full max-h-full w-full h-full flex flex-col items-center justify-center">
            <video
              ref={videoRef}
              src={url}
              className="max-w-full max-h-[calc(100%-80px)] rounded-lg bg-black"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />

            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center hover:bg-white/25 transition-all duration-300"
              >
                <HugeiconsIcon icon={PlayIcon} size={28} className="text-white ml-1" />
              </button>
            )}

            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md">
              <button
                onClick={togglePlay}
                className="h-10 w-10 shrink-0 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all duration-300"
              >
                <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={20} className="text-white" />
              </button>

              <span className="text-xs text-white/80 tabular-nums min-w-10">
                {formatDuration(currentTime)}
              </span>

              <div
                ref={progressBarRef}
                className="flex-1 h-8 flex items-center cursor-pointer"
                onClick={handleSeek}
              >
                <div className="w-full h-1 bg-white/20 rounded-full relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-md"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
              </div>

              <span className="text-xs text-white/80 tabular-nums min-w-10 text-right">
                {formatDuration(duration)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
