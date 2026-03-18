"use client"

import React, { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Settings01Icon}
              className="h-5 w-5 text-primary"
            />
            <h3 className="text-base font-semibold text-foreground">
              Custom Instructions
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Tell Vivid AI how you&apos;d like it to respond. These instructions
            apply to this conversation only.
          </p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g., Always respond in bullet points. Focus on DeFi topics. Explain concepts simply..."
            rows={6}
            maxLength={2000}
            className="w-full bg-accent/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {value.length}/2000
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Instructions
          </button>
        </div>
      </div>
    </div>
  )
}
