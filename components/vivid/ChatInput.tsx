"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon, StopIcon } from "@hugeicons/core-free-icons"

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  isGenerating?: boolean
  onStop?: () => void
}

export default function ChatInput({
  onSend,
  disabled = false,
  isGenerating = false,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail?.text
      if (text) {
        onSend(text)
      }
    }
    window.addEventListener("vivid:suggestion", handler)
    return () => window.removeEventListener("vivid:suggestion", handler)
  }, [onSend])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-4 md:px-6 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 rounded-2xl border border-border/50 bg-card shadow-sm focus-within:border-border focus-within:shadow-md transition-all px-4 py-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Vivid AI..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 py-0.5 max-h-40 scrollbar-thin"
          />

          {isGenerating ? (
            <button
              onClick={onStop}
              className="shrink-0 p-2 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground transition-colors"
              title="Stop generating"
            >
              <HugeiconsIcon icon={StopIcon} className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className="shrink-0 p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send message"
            >
              <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Vivid AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}
