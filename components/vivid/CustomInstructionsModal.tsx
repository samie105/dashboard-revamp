"use client"

import React, { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

interface CustomInstructionsModalProps {
  isOpen: boolean
  instructions: string
  onSave: (instructions: string) => void
  onClose: () => void
}

export default function CustomInstructionsModal({
  isOpen,
  instructions,
  onSave,
  onClose,
}: CustomInstructionsModalProps) {
  const [value, setValue] = useState(instructions)

  if (!isOpen) return null

  const handleSave = () => {
    onSave(value)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border/30">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">
            Custom Instructions
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Tell Vivid AI how you&apos;d like it to respond. Applies to this conversation only.
          </p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g., Always respond in bullet points. Focus on DeFi topics..."
            rows={5}
            maxLength={2000}
            className="w-full bg-background border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-border focus:shadow-sm transition-all resize-none"
          />
          <p className="text-[11px] text-muted-foreground/50 mt-1.5 text-right">
            {value.length}/2,000
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
