"use client"

import { Group, Panel, Separator, type Orientation } from "react-resizable-panels"
import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  direction,
  ...props
}: React.ComponentProps<typeof Group> & { direction?: Orientation }) {
  return (
    <Group
      className={cn("flex h-full w-full", className)}
      orientation={direction ?? props.orientation}
      {...props}
    />
  )
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof Panel>) {
  return <Panel className={cn(className)} {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      className={cn(
        "relative flex w-px items-center justify-center bg-border/20 after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-[''] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:right-0 data-[panel-group-direction=vertical]:after:-top-1 data-[panel-group-direction=vertical]:after:-bottom-1 [&[data-panel-group-direction=vertical]>div]:rotate-90 hover:bg-border/50 transition-colors",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <svg width="10" height="10" viewBox="0 0 10 10" className="fill-muted-foreground">
            <circle cx="3" cy="2" r="0.8" /><circle cx="7" cy="2" r="0.8" />
            <circle cx="3" cy="5" r="0.8" /><circle cx="7" cy="5" r="0.8" />
            <circle cx="3" cy="8" r="0.8" /><circle cx="7" cy="8" r="0.8" />
          </svg>
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
