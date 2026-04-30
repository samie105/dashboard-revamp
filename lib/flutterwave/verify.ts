import { flutterwaveFetch } from "./client"

export interface FlutterwaveCharge {
  id: string
  tx_ref: string
  amount: number
  currency: string
  status: string
  customer: {
    id: string
    email: string
    name: string
  }
  payment_type: string
  created_at: string
}

/**
 * Verify a charge by its ID via Flutterwave API.
 */
export async function verifyCharge(chargeId: string): Promise<FlutterwaveCharge> {
  return flutterwaveFetch<FlutterwaveCharge>(`/charges/${chargeId}`)
}
