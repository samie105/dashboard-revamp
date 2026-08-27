import { CryptoBackendClient, cryptoBackendClient } from "@/lib/crypto-backend"

import { createPasskeyCredential, getPasskeyAssertion } from "./passkey"

export async function registerWalletPasskey(client: CryptoBackendClient = cryptoBackendClient) {
  const options = await client.createPasskeyRegistrationOptions()
  const credential = await createPasskeyCredential(options)
  const result = await client.verifyPasskeyRegistration(options.ceremonyId, credential.response)
  return {
    ...result,
    credentialId: credential.response.id as string,
    prfOutput: credential.prfOutput,
  }
}

export async function authenticateWalletPasskey(client: CryptoBackendClient = cryptoBackendClient) {
  const options = await client.createPasskeyAuthenticationOptions()
  const credential = await getPasskeyAssertion(options)
  const result = await client.verifyPasskeyAuthentication(options.ceremonyId, credential.response)
  return { ...result, credentialId: credential.response.id as string, prfOutput: credential.prfOutput }
}
