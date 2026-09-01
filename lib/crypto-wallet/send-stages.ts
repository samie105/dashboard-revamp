/**
 * The send flow's three-step story, and the mapping from the backend's
 * fine-grained intent statuses onto it.
 *
 * The backend owns a longer vocabulary than a person needs to read
 * ("created", "simulated", "validated", "signed", "submitted", "pending",
 * "unknown", "confirmed", "failed", "expired") and it is free to grow one
 * without asking this client. So the default is deliberately NOT zero: an
 * unrecognised status means "no news since we handed it to the network", not
 * "we're back at the start". Answering 0 would un-tick a checklist the user
 * already watched complete — the flow kit's `useStageProgress` keeps the
 * rendered index monotonic on top of this, but the honest raw answer belongs
 * here too.
 *
 * `failed`/`expired` also answer 1: the status screen renders those as a
 * failure verdict rather than a checklist, and 1 is the truthful "it got as
 * far as the network" position if a caller does show the stages.
 */
export const SEND_STAGES = [
  { key: "sign", label: "Signed on this device" },
  { key: "submit", label: "Submitted to the network" },
  { key: "confirm", label: "Confirmed on-chain" },
] as const

export function sendStageIndex(status: string): number {
  switch (status) {
    case "created": case "simulated": case "validated": return 0
    case "signed": case "submitted": case "pending": case "unknown": return 1
    case "confirmed": return SEND_STAGES.length
    case "failed": case "expired": return 1
    default: return 1
  }
}
