/**
 * The one shape every modal in this app takes.
 *
 * These strings exist so that "our modals all look the same" is enforced by
 * imports rather than by everyone remembering. Before this, the shape lived
 * inline in `responsive-modal.tsx`, and the two surfaces that needed a
 * different SIZE (the money-flow modal, the trade ticket) copied the Base UI
 * plumbing instead and quietly grew their own presentation — a bottom drawer
 * on a phone while everything else was a centred card. Owner call, 2026-09-03:
 * one way in, everywhere.
 *
 * ONE SHAPE AT EVERY WIDTH: a card centred in the viewport with a 1rem gutter
 * around it, rounded on all four corners, scaling up from 97% as it fades in.
 *
 * Below 640px this used to be a bottom sheet, which is what the design-system
 * doc still describes (05: "Modal → bottom sheet under 640"). Owner call on
 * 2026-09-02, looking at the passphrase dialog: glued to both edges and pinned
 * to the floor, it read as a panel that had fallen off the layout rather than
 * a dialog addressed to you. The doc is the thing that is out of date.
 *
 * WHAT IS DELIBERATELY NOT HERE: size and inner layout. A modal's width, its
 * height and what it does with its own padding are its business — that is why
 * the money-flow modal can be 2xl-wide and a fixed height while a confirm
 * dialog is small and hugs its content. Only the SHAPE is shared.
 *
 * THE ONE SANCTIONED EXCEPTION is the app launcher on the mobile task bar
 * (`components/mobile-bottom-nav.tsx`). It is a navigation surface reached
 * from a bar welded to the bottom edge, so rising from that edge is the
 * gesture it is answering. Navigation drawers (`components/ui/sidebar.tsx`)
 * are excluded for the same reason: they are not modals.
 */

/** The frost behind every modal. Pair it with `MODAL_SURFACE`. */
export const MODAL_BACKDROP =
  "ws-backdrop-in data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200 bg-black/45 backdrop-blur-md fixed inset-0 z-50"

/**
 * The card itself: material, elevation, position and entrance.
 *
 * Callers add their own width cap (`sm:max-w-lg`), height and inner layout.
 * `max-w-[calc(100%-2rem)]` is what supplies the phone gutter, so a caller's
 * `sm:` width cap layers on top of it rather than replacing it.
 */
export const MODAL_SURFACE = [
  // ws-glass: modals are the top of the elevation ladder, so they get the
  // heavy frost — the page stays visible as material behind the surface
  // instead of disappearing behind a solid card.
  "ws-glass ws-glass-edge outline-none text-sm z-50 fixed shadow-2xl ring-1 ring-foreground/10",
  "ws-modal-in data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-closed:duration-200",
  "top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2",
  "max-w-[calc(100%-2rem)]",
  "rounded-2xl",
].join(" ")
