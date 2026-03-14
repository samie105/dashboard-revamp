import { createTokenHandler, createClerkValidator } from "@worldstreet/vivid-voice/server"
import { auth } from "@clerk/nextjs/server"

export const POST = createTokenHandler({
  openAIApiKey: process.env.OPENAI_API_KEY,
  voice: "alloy",
  validateRequest: createClerkValidator(auth),
})
