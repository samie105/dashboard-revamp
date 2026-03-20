"use server"

import { getAuthUser } from "@/lib/auth"
import { createAblyToken } from "@/lib/community/events"

export async function getAblyTokenAction() {
  const user = await getAuthUser()
  if (!user) throw new Error("Unauthorized")
  const token = await createAblyToken(user.userId)
  return {
    token: token.token,
    expires: token.expires,
    issued: token.issued,
    capability: token.capability,
    clientId: token.clientId,
  }
}
