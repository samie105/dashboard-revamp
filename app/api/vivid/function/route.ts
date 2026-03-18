import { createFunctionHandler } from "@worldstreet/vivid-voice/server"
import { allFunctions } from "@/lib/vivid-functions"

export const POST = createFunctionHandler({
  functions: allFunctions,
})
