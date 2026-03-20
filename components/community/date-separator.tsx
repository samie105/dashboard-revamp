"use client"

import { cn } from "@/lib/utils"

type DateSeparatorProps = {
  date: Date
  className?: string
}

export function DateSeparator({ date, className }: DateSeparatorProps) {
  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    yesterday.setHours(0, 0, 0, 0)

    if (compareDate.getTime() === today.getTime()) {
      return "Today"
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return "Yesterday"
    } else {
      const daysDiff = Math.floor(
        (today.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff < 7) {
        return date.toLocaleDateString("en-US", { weekday: "long" })
      } else if (daysDiff < 365) {
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })
      } else {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      }
    }
  }

  return (
    <div className={cn("flex items-center justify-center my-4", className)}>
      <div className="bg-muted px-3 py-1 rounded-full">
        <span className="text-xs font-medium text-muted-foreground">
          {formatDate(date)}
        </span>
      </div>
    </div>
  )
}

export function groupMessagesByDate<T extends { timestamp: Date }>(messages: T[]) {
  const groups: { date: Date; messages: T[] }[] = []

  messages.forEach((message) => {
    const messageDate = new Date(message.timestamp)
    messageDate.setHours(0, 0, 0, 0)

    const existingGroup = groups.find(
      (g) => g.date.getTime() === messageDate.getTime()
    )

    if (existingGroup) {
      existingGroup.messages.push(message)
    } else {
      groups.push({
        date: new Date(messageDate),
        messages: [message],
      })
    }
  })

  return groups
}
