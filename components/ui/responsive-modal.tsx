"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

/* ─── Context to share viewport mode with children ─── */
const DesktopContext = React.createContext(true)

/* ─── Root ─── */
function ResponsiveModal({ ...props }: DialogPrimitive.Root.Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)")

  return (
    <DesktopContext value={isDesktop}>
      <DialogPrimitive.Root data-slot="responsive-modal" {...props} />
    </DesktopContext>
  )
}

/* ─── Trigger ─── */
function ResponsiveModalTrigger({
  ...props
}: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger
      data-slot="responsive-modal-trigger"
      {...props}
    />
  )
}

/* ─── Close ─── */
function ResponsiveModalClose({ ...props }: DialogPrimitive.Close.Props) {
  return (
    <DialogPrimitive.Close data-slot="responsive-modal-close" {...props} />
  )
}

/* ─── Content (Dialog on desktop, Bottom Sheet on mobile) ─── */
function ResponsiveModalContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  const isDesktop = React.useContext(DesktopContext)

  return (
    <DialogPrimitive.Portal>
      {/* Overlay / backdrop */}
      <DialogPrimitive.Backdrop
        className="data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50"
      />

      {/* Popup — dialog on desktop, bottom sheet on mobile */}
      <DialogPrimitive.Popup
        data-slot="responsive-modal-content"
        className={cn(
          "bg-background outline-none text-sm z-50 fixed",
          isDesktop
            ? "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 ring-1 duration-100 sm:max-w-sm top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2"
            : "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:slide-out-to-bottom-10 data-open:slide-in-from-bottom-10 flex flex-col gap-4 shadow-lg transition duration-200 ease-in-out inset-x-0 bottom-0 rounded-t-xl border-t p-4",
          className
        )}
        {...props}
      >
        {/* Mobile drag handle */}
        {!isDesktop && (
          <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20" />
        )}

        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="responsive-modal-close"
            render={
              <Button
                variant="ghost"
                className={cn(
                  "absolute",
                  isDesktop ? "top-2 right-2" : "top-3 right-3"
                )}
                size="icon"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

/* ─── Header ─── */
function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-modal-header"
      className={cn("gap-1.5 flex flex-col", className)}
      {...props}
    />
  )
}

/* ─── Footer ─── */
function ResponsiveModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = React.useContext(DesktopContext)

  return (
    <div
      data-slot="responsive-modal-footer"
      className={cn(
        isDesktop
          ? "bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          : "flex flex-col-reverse gap-2 pt-2",
        className
      )}
      {...props}
    />
  )
}

/* ─── Title ─── */
function ResponsiveModalTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="responsive-modal-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

/* ─── Description ─── */
function ResponsiveModalDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="responsive-modal-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
}
