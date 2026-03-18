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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  // Listen for suggestion clicks from the empty state
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

  // Focus the input on mount
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
    <div className="border-t border-border/40 bg-card px-4 md:px-8 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-accent/50 rounded-2xl border border-border/50 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all px-4 py-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Vivid AI..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground py-1.5 max-h-40 scrollbar-thin"
          />

          {isGenerating ? (
            <button
              onClick={onStop}
              className="shrink-0 p-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
              title="Stop generating"
            >
              <HugeiconsIcon icon={StopIcon} className="h-4.5 w-4.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className="shrink-0 p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send message"
            >
              <HugeiconsIcon icon={SentIcon} className="h-4.5 w-4.5" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Vivid AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  )
}
