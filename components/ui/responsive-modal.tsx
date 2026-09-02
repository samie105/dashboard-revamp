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

/* ─── Content — one centred card at every width ─── */
function ResponsiveModalContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
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
          /* ONE SHAPE AT EVERY WIDTH: a card centred in the viewport with a
             1rem gutter around it, rounded on all four corners.

             Below 640px this used to be a bottom sheet — `inset-x-0 bottom-0
             rounded-t-3xl` — which is the documented house pattern
             (design-system 05: "Modal → bottom sheet under 640"). Owner call
             on 2026-09-02, looking at the passphrase dialog: glued to both
             edges and pinned to the floor, it read as a panel that had fallen
             off the layout rather than a dialog addressed to you. Centred with
             room around it is the shape now; the design-system note is the one
             that is out of date.

             `max-w-[calc(100%-2rem)]` is what supplies the side gutter on a
             phone, and `sm:max-w-sm` caps it on anything larger.

             max-h + scroll stays load-bearing rather than polish: content
             taller than the screen has to scroll INSIDE the card, or the
             title and the primary action end up off both ends of it. */
          "ws-modal-in data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-closed:duration-200",
          "top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2",
          "max-w-[calc(100%-2rem)] sm:max-w-sm",
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain rounded-2xl p-4",
          className
        )}
        {...props}
      >
        {/* The drag handle went with the sheet — a grabber on a centred card
            advertises a gesture that does nothing.
            The close button stays STICKY rather than absolute: the card is a
            scroll container, and an absolutely-positioned X scrolls out of
            reach on exactly the tall content that made scrolling necessary.
            It sits in the flow at the top-right, in a row of its own, so it
            can never land on top of a title either. Zero height plus a
            negative margin keeps that row from pushing the content down. */}
        {children}

        {/* LAST in the DOM, FIRST on screen (`order-first`). Base UI focuses
            the first tabbable element when a dialog opens; with the close
            button written above the content it took that focus and opened
            every modal with a ring around its X. Ordering it visually instead
            leaves the focus where it has always landed — on the content —
            while the button still sits at the top-right. */}
        {showCloseButton && (
          <div className="sticky top-0 z-20 order-first -mt-1 flex h-0 shrink-0 justify-end">
            <DialogPrimitive.Close
              data-slot="responsive-modal-close"
              render={
                <Button
                  variant="ghost"
                  className="-mr-1 size-11 sm:size-9"
                  size="icon"
                />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
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
