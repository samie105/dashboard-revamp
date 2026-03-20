"use client"

import { useRef, useEffect } from "react"
import gsap from "gsap"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  Call02Icon,
  ArrowLeft01Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type ChatHeaderProps = {
  name: string
  avatar?: string
  subtitle?: string
  isOnline?: boolean
  onVideoCall?: () => void
  onAudioCall?: () => void
  onBack?: () => void
  showBackButton?: boolean
}

export function ChatHeader({
  name,
  avatar,
  subtitle,
  isOnline,
  onVideoCall,
  onAudioCall,
  onBack,
  showBackButton = false,
}: ChatHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)

  // GSAP entrance
  useEffect(() => {
    if (!headerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { y: -8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" }
      )
      if (actionsRef.current) {
        gsap.fromTo(
          actionsRef.current.children,
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, stagger: 0.06, duration: 0.25, ease: "back.out(1.4)", delay: 0.15 }
        )
      }
    }, headerRef)
    return () => ctx.revert()
  }, [name])

  // Typing-dot animation for "Online"
  useEffect(() => {
    if (!statusRef.current || !isOnline) return
    gsap.fromTo(statusRef.current, { opacity: 0.5 }, { opacity: 1, duration: 0.8, ease: "sine.inOut", repeat: -1, yoyo: true })
  }, [isOnline])

  return (
    <div ref={headerRef} className="shrink-0 border-b border-border/30 bg-background/80 backdrop-blur-xl px-3 py-2">
      <div className="flex items-center gap-2.5 max-w-4xl mx-auto">
        {showBackButton && (
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 md:hidden"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>
        )}

        {/* Avatar with status ring */}
        <div className="relative shrink-0">
          <Avatar className={cn(
            "h-9 w-9 ring-2 transition-all",
            isOnline ? "ring-emerald-500/30" : "ring-transparent",
          )}>
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-xs font-medium bg-muted">
              {name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-background" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[13px] truncate text-foreground/90">{name}</h3>
          {isOnline ? (
            <span ref={statusRef} className="text-[11px] text-emerald-500 font-medium">Online</span>
          ) : subtitle ? (
            <p className="text-[11px] text-muted-foreground/60 truncate">{subtitle}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/40">Offline</p>
          )}
        </div>

        {/* Action buttons */}
        <div ref={actionsRef} className="flex items-center gap-0.5">
          <button
            onClick={onAudioCall}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all active:scale-90"
          >
            <HugeiconsIcon icon={Call02Icon} size={17} />
          </button>
          <button
            onClick={onVideoCall}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all active:scale-90"
          >
            <HugeiconsIcon icon={Video01Icon} size={17} />
          </button>
          <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-all active:scale-90">
            <HugeiconsIcon icon={MoreVerticalIcon} size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
