"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { MODAL_BACKDROP, MODAL_SURFACE } from "@/components/ui/modal-surface"
import { recededClass, useIsTopModal } from "@/components/ui/modal-stack"
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
  /* One modal on screen at a time. When a flow opens the unlock dialog over
     its own ticket, this one recedes rather than closing — its state is the
     flow the user is in the middle of. See components/ui/modal-stack.ts. */
  const isTop = useIsTopModal()
  const receded = recededClass(isTop)

  return (
    <DialogPrimitive.Portal>
      {/* Overlay / backdrop — the app-wide frost. Hidden along with the card
          it belongs to, so two stacked modals never double the frost. */}
      <DialogPrimitive.Backdrop className={cn(MODAL_BACKDROP, receded)} />

      {/* Popup — a centred card at every width. This component is the
          REFERENCE IMPLEMENTATION of the house modal: it holds nothing of its
          own shape any more, only the size and inner layout that make it the
          everyday dialog. Anything that needs a different size imports the
          same two constants rather than re-deriving the shape, which is how
          the money-flow modal came to be a bottom drawer while this was a
          card. See components/ui/modal-surface.ts. */}
      <DialogPrimitive.Popup
        data-slot="responsive-modal-content"
        className={cn(
          MODAL_SURFACE,
          /* The everyday size: small, and hugging its own content.
             max-h + scroll stays load-bearing rather than polish: content
             taller than the screen has to scroll INSIDE the card, or the
             title and the primary action end up off both ends of it. */
          "sm:max-w-sm",
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain p-4",
          className,
          receded
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
