"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { deleteMessage } from "@/lib/community/actions/messages"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

type MessageContextMenuProps = {
  children: React.ReactNode
  messageId: string
  content: string
  isOwn: boolean
  onDeleted?: (messageId: string) => void
}

export function MessageContextMenu({
  children,
  messageId,
  content,
  isOwn,
  onDeleted,
}: MessageContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("touchstart", handleClick)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("touchstart", handleClick)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleScroll = () => setIsOpen(false)
    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [isOpen])

  const showMenu = useCallback((x: number, y: number) => {
    const menuWidth = 160
    const menuHeight = isOwn ? 96 : 48
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8)
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8)
    setPosition({ x: Math.max(8, adjustedX), y: Math.max(8, adjustedY) })
    setIsOpen(true)
  }, [isOwn])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    showMenu(e.clientX, e.clientY)
  }, [showMenu])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30)
      showMenu(x, y)
    }, 500)
  }, [showMenu])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setIsOpen(false)
  }, [content])

  const handleDeleteClick = useCallback(() => {
    setIsOpen(false)
    setShowDeleteConfirm(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true)
    const result = await deleteMessage(messageId)
    setShowDeleteConfirm(false)
    setIsDeleting(false)
    if (result.success) {
      onDeleted?.(messageId)
    }
  }, [messageId, onDeleted])

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="select-none"
      >
        {children}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)}>
          <div
            ref={menuRef}
            className="fixed min-w-37.5 py-1.5 rounded-xl bg-popover/95 backdrop-blur-xl shadow-lg border border-border/50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
            >
              <HugeiconsIcon icon={Copy01Icon} size={15} className="text-muted-foreground" />
              <span>Copy</span>
            </button>
            {isOwn && (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <HugeiconsIcon icon={Delete02Icon} size={15} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
