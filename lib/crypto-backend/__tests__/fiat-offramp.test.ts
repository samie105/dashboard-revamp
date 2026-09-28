import { describe, expect, it } from "vitest"

import {
  FIAT_BENEFICIARIES_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_QUOTE_OFFRAMP,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import {
  beneficiaryRequirementMatches,
  buildOfframpQuoteRequest,
  buildOnswitchBeneficiaryPayload,
  isOfframpQuoteUsable,
  offrampOptions,
  offrampOrderView,
  offrampStageIndex,
  verifiedOnswitchBeneficiaries,
} from "@/lib/crypto-backend/fiat-offramp"

describe("OnSwitch offramp contract", () => {
  it("derives African payout options from config and builds the provider quote body", () => {
    const options = offrampOptions(FIAT_CONFIG_AVAILABLE)
    const ngn = options.find((option) => option.countryCode === "NG")
    expect(ngn).toBeDefined()
    expect(buildOfframpQuoteRequest(ngn!, "62.45")).toMatchObject({
      provider: "onswitch",
      direction: "offramp",
      country: "NG",
      currency: "NGN",
      channel: "BANK",
      amount: "62.45",
    })
  })

  it("only permits verified, owned beneficiaries for the selected corridor", () => {
    const [verified] = verifiedOnswitchBeneficiaries(FIAT_BENEFICIARIES_LIST, {
      countryCode: "NG",
      currencyCode: "NGN",
      channel: "BANK",
    })
    expect(verified?.id).toBe(FIAT_BENEFICIARIES_LIST[0].id)
    expect(verifiedOnswitchBeneficiaries([
      { ...FIAT_BENEFICIARIES_LIST[0], ownershipStatus: "pending" },
      { ...FIAT_BENEFICIARIES_LIST[0], status: "pending" },
    ], { countryCode: "NG", currencyCode: "NGN", channel: "BANK" })).toEqual([])
  })

  it("maps provider requirement paths to the lookup payload without persisting raw values", () => {
    const payload = buildOnswitchBeneficiaryPayload({
      country: "NG",
      holderName: "Example User",
      holderType: "individual",
      requirements: [
        { path: "bank.account_number", required: true },
        { path: "bank.nuban_code", required: true },
      ],
      values: {
        "bank.account_number": "3048915627",
        "bank.nuban_code": "058",
      },
    })
    expect(payload).toEqual({
      country: "NG",
      beneficiary: {
        holder_type: "INDIVIDUAL",
        holder_name: "Example User",
        account_number: "3048915627",
        bank_code: "058",
      },
    })
    expect(beneficiaryRequirementMatches({ path: "bank.account_number", required: true, regex: "^\\d{10}$" }, "3048915627")).toBe(true)
    expect(beneficiaryRequirementMatches({ path: "bank.account_number", required: true, regex: "^\\d{10}$" }, "123")).toBe(false)
  })

  it("maps expiry, signing and terminal order states safely", () => {
    expect(isOfframpQuoteUsable(FIAT_QUOTE_OFFRAMP, Date.parse("2026-09-26T10:50:00.000Z"))).toBe(true)
    expect(offrampOrderView({ state: "crypto_intent_ready" }).screen).toBe("sign")
    expect(offrampStageIndex("crypto_intent_ready")).toBe(1)
    expect(offrampOrderView({ state: "reversed", failureReason: "provider reversal" }).terminal).toBe(true)
  })
})
