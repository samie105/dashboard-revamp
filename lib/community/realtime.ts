/**
 * Cloudflare RealtimeKit API helper (server-side only)
 * Uses Dyte REST API with Basic Auth (OrgId:ApiKey)
 */

const REALTIME_ORG_ID = process.env.CLOUDFLARE_REALTIME_ORG_ID!
const REALTIME_API_KEY = process.env.CLOUDFLARE_REALTIME_API_KEY!
const BASE_URL = "https://api.dyte.io/v2"

const BASIC_AUTH =
  typeof Buffer !== "undefined"
    ? Buffer.from(`${REALTIME_ORG_ID}:${REALTIME_API_KEY}`).toString("base64")
    : btoa(`${REALTIME_ORG_ID}:${REALTIME_API_KEY}`)

type MeetingResponse = {
  success: boolean
  result?: { id: string; title: string }
  data?: { id: string; title: string }
  errors?: Array<{ message: string }>
}

type ParticipantResponse = {
  success: boolean
  result?: { id: string; auth_token: string; custom_participant_id: string }
  data?: { id: string; token: string; custom_participant_id: string }
  errors?: Array<{ message: string }>
}

async function cfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${BASIC_AUTH}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RealtimeKit API error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function createMeeting(title: string): Promise<string> {
  const data = await cfFetch<MeetingResponse>("/meetings", {
    method: "POST",
    body: JSON.stringify({ title, live: true }),
  })

  const meeting = data.result || data.data
  if (!meeting) {
    throw new Error(data.errors?.[0]?.message || "Failed to create meeting")
  }

  return meeting.id
}

export async function addParticipant(
  meetingId: string,
  opts: { name: string; customParticipantId: string; presetName?: string },
): Promise<{ participantId: string; authToken: string }> {
  const data = await cfFetch<ParticipantResponse>(`/meetings/${meetingId}/participants`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      preset_name: opts.presetName || "group_call_host",
      custom_participant_id: opts.customParticipantId,
    }),
  })

  const participant = data.result || data.data
  if (!participant) {
    throw new Error(data.errors?.[0]?.message || "Failed to add participant")
  }

  return {
    participantId: participant.id,
    authToken:
      (participant as Record<string, string>).auth_token ||
      (participant as Record<string, string>).token ||
      "",
  }
}

export async function endMeeting(meetingId: string): Promise<void> {
  try {
    await cfFetch(`/meetings/${meetingId}`, { method: "DELETE" })
  } catch {
    // Meeting may already be ended
  }
}
