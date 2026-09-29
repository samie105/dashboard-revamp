import { describe, expect, it } from "vitest"

import {
  FIAT_BENEFICIARIES_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_QUOTE_OFFRAMP,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import {
  beneficiaryRequirementMatches,
  beneficiaryFormValues,
  automaticBeneficiaryField,
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

  it("keeps the African payout selector on the product's Ethereum/Solana allowlist", () => {
    const config = {
      ...FIAT_CONFIG_AVAILABLE,
      assetRoutes: [
        ...FIAT_CONFIG_AVAILABLE.assetRoutes,
        {
          ...FIAT_CONFIG_AVAILABLE.assetRoutes[0],
          providerAssetId: "arbitrum:usdc",
          providerChain: "arbitrum",
          localNetworkId: "arbitrum-one",
        },
      ],
    }

    expect(offrampOptions(config).every((option) => option.network !== "arbitrum-one")).toBe(true)
  })

  it("accepts provider-created ready destinations without claiming ownership verification", () => {
    const ready = { ...FIAT_BENEFICIARIES_LIST[0], status: "ready", ownershipStatus: "unknown" }
    expect(verifiedOnswitchBeneficiaries([ready], { countryCode: "NG", currencyCode: "NGN", channel: "BANK" })).toEqual([ready])
    expect(verifiedOnswitchBeneficiaries([ready], { countryCode: "GH", currencyCode: "GHS", channel: "MOBILEMONEY" })).toEqual([])
  })

  it("keeps pending and rejected destinations unavailable", () => {
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

  it("fills technical fields automatically and prevents duplicate name/type inputs overriding the recipient", () => {
    const requirements = ["holder_type", "holder_name", "channel", "bank_code", "account_number"].map((path) => ({ path, required: true }))
    const values = beneficiaryFormValues(requirements, { holder_type: "BUSINESS", holder_name: "Wrong name", channel: "Opay", bank_code: "000013", account_number: "0123456789" }, { holderName: "Recipient Name", channel: "BANK", country: "NG", currency: "NGN" })
    expect(values).toMatchObject({ holder_type: "INDIVIDUAL", holder_name: "Recipient Name", channel: "BANK" })
    expect(requirements.filter((field) => !automaticBeneficiaryField(field.path)).map((field) => field.path)).toEqual(["bank_code", "account_number"])
    expect(buildOnswitchBeneficiaryPayload({ country: "NG", holderName: "Recipient Name", holderType: "individual", channel: "BANK", requirements, values })).toMatchObject({ beneficiary: { holder_type: "INDIVIDUAL", holder_name: "Recipient Name", channel: "BANK", bank_code: "000013", account_number: "0123456789" } })
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
