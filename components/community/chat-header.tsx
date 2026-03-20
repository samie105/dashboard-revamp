"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Video01Icon,
  Call02Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

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
  return (
    <div className="shrink-0 border-b bg-background px-3 py-2.5">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        {showBackButton && (
          <Button size="icon" variant="ghost" className="h-9 w-9 md:hidden" onClick={onBack}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
          </Button>
        )}

        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar} />
            <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{name}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center border rounded-lg overflow-hidden divide-x">
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-none border-0" onClick={onAudioCall}>
            <HugeiconsIcon icon={Call02Icon} size={18} />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-none border-0" onClick={onVideoCall}>
            <HugeiconsIcon icon={Video01Icon} size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}
