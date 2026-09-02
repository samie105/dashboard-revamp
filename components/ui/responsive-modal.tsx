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
      {/* Overlay / backdrop — the app-wide frost */}
      <DialogPrimitive.Backdrop
        className="ws-backdrop-in data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200 bg-black/45 backdrop-blur-md fixed inset-0 z-50"
      />

      {/* Popup — dialog on desktop, bottom sheet on mobile */}
      <DialogPrimitive.Popup
        data-slot="responsive-modal-content"
        className={cn(
          // ws-glass: modals are the top of the elevation ladder, so they get
          // the heavy frost — the page stays visible as material behind the
          // surface instead of disappearing behind a solid card.
          "ws-glass ws-glass-edge outline-none text-sm z-50 fixed shadow-2xl ring-1 ring-foreground/10",
          isDesktop
            ? "ws-modal-in data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-closed:duration-200 grid max-w-[calc(100%-2rem)] gap-4 rounded-2xl p-4 sm:max-w-sm top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2"
            : // max-h + scroll is load-bearing, not polish: the sheet is
              // anchored to bottom-0, so content taller than the viewport grows
              // UPWARD past the top of the screen and becomes unreachable —
              // the title and the primary action are the first things lost.
              // 92dvh + overscroll-contain is the recipe the trade ticket sheet
              // already uses (trade-client.tsx).
              "ws-sheet-in data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10 data-closed:duration-200 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto overscroll-contain inset-x-0 bottom-0 rounded-t-3xl p-4",
          className
        )}
        {...props}
      >
        {/* Mobile drag handle. Sticky, and it carries the close button: the
            sheet is now a scroll container, so an absolutely-positioned X
            would scroll out of reach on exactly the tall content that made
            scrolling necessary. `shrink-0` keeps the handle from being
            squeezed to nothing by a tall child. */}
        {!isDesktop && (
          <div className="sticky top-0 z-20 -mt-1 flex shrink-0 items-center justify-center pt-1 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="responsive-modal-close"
                render={
                  <Button
                    variant="ghost"
                    className="absolute top-0 right-0 size-11"
                    size="icon"
                  />
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>
        )}

        {children}

        {showCloseButton && isDesktop && (
          <DialogPrimitive.Close
            data-slot="responsive-modal-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
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
