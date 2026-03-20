"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import gsap from "gsap"
import dynamic from "next/dynamic"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MailSend01Icon,
  Add01Icon,
  Mic01Icon,
  Image02Icon,
  Video01Icon,
  FileEditIcon,
  Cancel01Icon,
  StopIcon,
  PlayIcon,
  Delete02Icon,
  PauseIcon,
  SmileIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { EmojiClickData } from "emoji-picker-react"

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })

export type Attachment = {
  file: File
  preview?: string
  type: "image" | "video" | "document" | "audio"
  waveform?: number[]
  duration?: string
}

type MessageInputProps = {
  onSendMessage: (content: string, attachments?: Attachment[]) => void
  disabled?: boolean
}

const WAVEFORM_BARS = 40

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(WAVEFORM_BARS).fill(4))
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const waveformSamplesRef = useRef<number[]>([])
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // GSAP glow on focus
  useEffect(() => {
    if (!inputRowRef.current) return
    if (isFocused) {
      gsap.to(inputRowRef.current, {
        boxShadow: "0 0 0 2px rgba(var(--primary-rgb, 99,102,241), 0.15)",
        duration: 0.25,
        ease: "power2.out",
      })
    } else {
      gsap.to(inputRowRef.current, {
        boxShadow: "0 0 0 0px transparent",
        duration: 0.2,
        ease: "power2.out",
      })
    }
  }, [isFocused])

  const hasContent = message.trim().length > 0 || attachments.length > 0 || audioBlob

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const analyzeAudio = useCallback(function analyze() {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1)

    waveformSamplesRef.current.push(normalizedLevel)

    const newLevels: number[] = []
    const bandSize = Math.floor(dataArray.length / WAVEFORM_BARS)
    
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      let sum = 0
      for (let j = 0; j < bandSize; j++) {
        sum += dataArray[i * bandSize + j]
      }
      const bandAverage = sum / bandSize
      const height = Math.max(4, Math.min(28, (bandAverage / 255) * 28))
      newLevels.push(height)
    }
    
    setAudioLevels(newLevels)

    animationFrameRef.current = requestAnimationFrame(analyze)
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      waveformSamplesRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        setAudioBlob(blob)
        
        const samples = waveformSamplesRef.current
        const finalWaveform: number[] = []
        const step = samples.length / WAVEFORM_BARS
        
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          const start = Math.floor(i * step)
          const end = Math.floor((i + 1) * step)
          let sum = 0
          for (let j = start; j < end; j++) {
            sum += samples[j] || 0
          }
          finalWaveform.push(sum / (end - start))
        }
        
        setWaveformData(finalWaveform)
        
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      setRecordingTime(0)
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      analyzeAudio()
    } catch (err) {
      console.error("Failed to start recording:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      setAudioLevels(Array(WAVEFORM_BARS).fill(4))
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    
    setIsRecording(false)
    setAudioBlob(null)
    setRecordingTime(0)
    setWaveformData([])
    setAudioLevels(Array(WAVEFORM_BARS).fill(4))
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const togglePreview = () => {
    if (!audioBlob) return

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(URL.createObjectURL(audioBlob))
      previewAudioRef.current.onended = () => {
        setIsPlayingPreview(false)
        setPreviewProgress(0)
      }
      previewAudioRef.current.ontimeupdate = () => {
        if (previewAudioRef.current) {
          const progress = (previewAudioRef.current.currentTime / previewAudioRef.current.duration) * 100
          setPreviewProgress(progress)
        }
      }
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause()
      setIsPlayingPreview(false)
    } else {
      previewAudioRef.current.play()
      setIsPlayingPreview(true)
    }
  }

  const handleFileSelect = (accept: string, type: Attachment["type"]) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept
      fileInputRef.current.multiple = type === "image"
      fileInputRef.current.onclick = () => {
        fileInputRef.current!.value = ""
      }
      fileInputRef.current.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || [])
        const maxImages = 8
        const currentImageCount = attachments.filter((a) => a.type === "image").length
        
        const filesToAdd = type === "image" 
          ? files.slice(0, maxImages - currentImageCount)
          : files.slice(0, 1)
        
        const newAttachments: Attachment[] = filesToAdd.map((file) => ({
          file,
          type,
          preview: type === "image" || type === "video" ? URL.createObjectURL(file) : undefined,
        }))
        setAttachments((prev) => {
          if (type === "video") {
            return [...prev.filter((a) => a.type !== "video"), ...newAttachments]
          }
          return [...prev, ...newAttachments]
        })
      }
      fileInputRef.current.click()
    }
    setIsPopoverOpen(false)
  }

  const addMoreImages = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*"
      fileInputRef.current.multiple = true
      fileInputRef.current.onclick = () => {
        fileInputRef.current!.value = ""
      }
      fileInputRef.current.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || [])
        const maxImages = 8
        const currentImageCount = attachments.filter((a) => a.type === "image").length
        const filesToAdd = files.slice(0, maxImages - currentImageCount)
        
        const newAttachments: Attachment[] = filesToAdd.map((file) => ({
          file,
          type: "image" as const,
          preview: URL.createObjectURL(file),
        }))
        setAttachments((prev) => [...prev, ...newAttachments])
      }
      fileInputRef.current.click()
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const attachment = prev[index]
      if (attachment.preview) URL.revokeObjectURL(attachment.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSend = () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" })
      const audioBlobUrl = URL.createObjectURL(audioBlob)
      onSendMessage("", [{
        file: audioFile,
        type: "audio",
        preview: audioBlobUrl,
        waveform: waveformData,
        duration: formatTime(recordingTime),
      }])
      setAudioBlob(null)
      setRecordingTime(0)
      setWaveformData([])
      setPreviewProgress(0)
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    } else if (message.trim() || attachments.length > 0) {
      onSendMessage(message.trim(), attachments.length > 0 ? attachments : undefined)
      setMessage("")
      setAttachments([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji)
    setIsEmojiPickerOpen(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const currentAttachments = attachments
    return () => {
      currentAttachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview))
    }
  }, [attachments])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handleResize = () => {
      if (!containerRef.current) return
      const offsetFromBottom = window.innerHeight - vv.height - vv.offsetTop
      containerRef.current.style.transform =
        offsetFromBottom > 0 ? `translateY(-${offsetFromBottom}px)` : ""
    }

    vv.addEventListener("resize", handleResize)
    vv.addEventListener("scroll", handleResize)
    return () => {
      vv.removeEventListener("resize", handleResize)
      vv.removeEventListener("scroll", handleResize)
    }
  }, [])

  // Voice recording UI
  if (isRecording || audioBlob) {
    return (
      <div className="px-2 py-2 bg-background">
        <div className="flex items-center gap-1.5 max-w-3xl mx-auto bg-muted/50 rounded-full p-1 pl-2">
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={cancelRecording}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </button>

          <div className="flex-1 flex items-center gap-2 px-2">
            {isRecording ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                <span className="text-[11px] font-medium text-muted-foreground shrink-0 tabular-nums">{formatTime(recordingTime)}</span>
                <div className="flex-1 flex items-center justify-center gap-[1.5px] h-5 overflow-hidden">
                  {audioLevels.map((height, i) => (
                    <div
                      key={i}
                      className="w-[1.5px] bg-muted-foreground/40 rounded-full transition-all duration-75"
                      style={{ height: `${Math.min(height, 20)}px` }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={togglePreview}
                >
                  <HugeiconsIcon icon={isPlayingPreview ? PauseIcon : PlayIcon} size={12} />
                </button>
                <div className="flex-1 flex items-center gap-[1.5px] h-5 overflow-hidden">
                  {waveformData.length > 0 ? (
                    waveformData.map((level, i) => {
                      const isPast = (i / waveformData.length) * 100 <= previewProgress
                      return (
                        <div
                          key={i}
                          className={cn(
                            "w-[1.5px] rounded-full transition-colors duration-75",
                            isPast ? "bg-muted-foreground" : "bg-muted-foreground/25"
                          )}
                          style={{ height: `${Math.max(3, level * 20)}px` }}
                        />
                      )
                    })
                  ) : (
                    Array(WAVEFORM_BARS).fill(0).map((_, i) => (
                      <div
                        key={i}
                        className="w-[1.5px] bg-muted-foreground/25 rounded-full"
                        style={{ height: "3px" }}
                      />
                    ))
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{formatTime(recordingTime)}</span>
              </>
            )}
          </div>

          <button
            className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all active:scale-95 hover:bg-primary/90"
            onClick={isRecording ? stopRecording : handleSend}
          >
            <HugeiconsIcon icon={isRecording ? StopIcon : MailSend01Icon} size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="shrink-0 px-2 py-2 bg-background border-t">
      <input ref={fileInputRef} type="file" className="hidden" />

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-2 px-2 max-w-3xl mx-auto">
          {(() => {
            const images = attachments.filter((a) => a.type === "image")
            const videos = attachments.filter((a) => a.type === "video")
            const others = attachments.filter((a) => a.type !== "image" && a.type !== "video")
            const imageCount = images.length
            const canAddMore = imageCount < 8

            return (
              <div className="space-y-2">
                {imageCount > 0 && (
                  <div className="relative">
                    <div className={cn(
                      "grid gap-1 rounded-xl overflow-hidden",
                      imageCount === 1 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                      {images.slice(0, 2).map((attachment, index) => {
                        const originalIndex = attachments.indexOf(attachment)
                        return (
                          <div key={originalIndex} className={cn(
                            "relative bg-muted",
                            imageCount === 1 ? "aspect-4/3" : "aspect-square"
                          )}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={attachment.preview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              onClick={() => removeAttachment(originalIndex)}
                              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} size={12} />
                            </button>
                            {index === 1 && imageCount > 2 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white text-lg font-semibold">+{imageCount - 2}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {canAddMore && (
                      <button
                        onClick={addMoreImages}
                        className="absolute bottom-2 left-2 h-7 px-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs flex items-center gap-1 hover:bg-black/60 transition-colors"
                      >
                        <HugeiconsIcon icon={Add01Icon} size={12} />
                        Add
                      </button>
                    )}
                  </div>
                )}

                {videos.map((attachment) => {
                  const originalIndex = attachments.indexOf(attachment)
                  return (
                    <div key={originalIndex} className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video src={attachment.preview} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                          <HugeiconsIcon icon={Video01Icon} size={18} className="text-white" />
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(originalIndex)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} />
                      </button>
                    </div>
                  )
                })}

                {others.map((attachment) => {
                  const originalIndex = attachments.indexOf(attachment)
                  return (
                    <div key={originalIndex} className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                      <HugeiconsIcon icon={FileEditIcon} size={14} className="text-muted-foreground" />
                      <span className="text-[11px] truncate flex-1">{attachment.file.name}</span>
                      <button
                        onClick={() => removeAttachment(originalIndex)}
                        className="h-5 w-5 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Input Row */}
      <div ref={inputRowRef} className="flex items-center gap-1.5 max-w-3xl mx-auto bg-muted/40 rounded-full p-1 pl-1.5 ring-1 ring-border/10 transition-colors">
        <div className={cn(
          "transition-all duration-150",
          hasContent ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        )}>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger
              render={
                <button
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  disabled={disabled}
                >
                  <HugeiconsIcon icon={Add01Icon} size={18} />
                </button>
              }
            />
            <PopoverContent side="top" align="start" className="w-auto p-1 rounded-xl border-muted">
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleFileSelect("image/*", "image")}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <HugeiconsIcon icon={Image02Icon} size={16} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Photo</span>
                </button>
                <button
                  onClick={() => handleFileSelect("video/*", "video")}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <HugeiconsIcon icon={Video01Icon} size={16} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Video</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className="flex-1 bg-transparent py-2 px-2 text-sm outline-none placeholder:text-muted-foreground/40"
        />

        <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
          <PopoverTrigger
            render={
              <button
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                disabled={disabled}
              >
                <HugeiconsIcon icon={SmileIcon} size={18} />
              </button>
            }
          />
          <PopoverContent side="top" align="end" className="w-auto p-0 border-0 bg-transparent shadow-none">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              width={320}
              height={400}
              lazyLoadEmojis
            />
          </PopoverContent>
        </Popover>

        {hasContent ? (
          <button
            className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all active:scale-95 hover:bg-primary/90"
            onClick={handleSend}
            disabled={disabled}
          >
            <HugeiconsIcon icon={MailSend01Icon} size={16} />
          </button>
        ) : (
          <button
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            onClick={startRecording}
            disabled={disabled}
          >
            <HugeiconsIcon icon={Mic01Icon} size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
