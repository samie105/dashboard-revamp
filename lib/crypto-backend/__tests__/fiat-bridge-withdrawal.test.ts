import { describe, expect, it } from "vitest"

import {
  FIAT_BENEFICIARIES_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_ORDER_BRIDGE_WITHDRAWAL,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import {
  bridgeWithdrawalChannelOptions,
  bridgeWithdrawalNetworkOptions,
  bridgeWithdrawalOrderView,
  buildBridgeWithdrawalRequest,
  selectBridgeWithdrawalNetwork,
  verifiedBridgeBeneficiaries,
} from "@/lib/crypto-backend/fiat-bridge-withdrawal"
import type { FiatBeneficiary } from "@/lib/crypto-backend/types"

const BRIDGE_BENEFICIARY: FiatBeneficiary = {
  ...FIAT_BENEFICIARIES_LIST[0],
  id: "bridge-beneficiary-1",
  provider: "bridge",
  country: "US",
  currency: "USD",
  channel: "ach",
  holderName: "EXAMPLE USER",
}

describe("Bridge USD withdrawal contract", () => {
  it("derives only backend-declared payout channels and owned USDC networks", () => {
    expect(bridgeWithdrawalChannelOptions(FIAT_CONFIG_AVAILABLE).map((item) => item.channel)).toEqual(["ach", "wire"])
    expect(bridgeWithdrawalNetworkOptions(FIAT_CONFIG_AVAILABLE, ["arbitrum-one"]).map((item) => item.networkId)).toEqual(["arbitrum-one"])
    expect(bridgeWithdrawalNetworkOptions(FIAT_CONFIG_AVAILABLE)).toEqual([])
    expect(selectBridgeWithdrawalNetwork(FIAT_CONFIG_AVAILABLE, ["arbitrum-one"])?.networkId).toBe("arbitrum-one")
  })

  it("only selects verified, owned USD beneficiaries for Bridge", () => {
    expect(verifiedBridgeBeneficiaries([
      BRIDGE_BENEFICIARY,
      { ...BRIDGE_BENEFICIARY, id: "pending", status: "pending" },
      { ...BRIDGE_BENEFICIARY, id: "unowned", ownershipStatus: "pending" },
      { ...BRIDGE_BENEFICIARY, id: "wire", channel: "wire" },
    ], "ach").map((beneficiary) => beneficiary.id)).toEqual(["bridge-beneficiary-1"])
  })

  it("sends the public USDC symbol and leaves canonical token resolution to the backend", () => {
    expect(buildBridgeWithdrawalRequest({
      walletId: "wallet-1",
      networkId: "ethereum-mainnet",
      amount: "100.00",
      beneficiaryId: BRIDGE_BENEFICIARY.id,
      channel: "ach",
    })).toEqual({
      provider: "bridge",
      walletId: "wallet-1",
      networkId: "ethereum-mainnet",
      asset: "USDC",
      amount: "100.00",
      beneficiaryId: BRIDGE_BENEFICIARY.id,
      channel: "ach",
    })
  })

  it("maps the Bridge order lifecycle into the sign/review/problem screens", () => {
    expect(bridgeWithdrawalOrderView(FIAT_ORDER_BRIDGE_WITHDRAWAL).screen).toBe("sign")
    expect(bridgeWithdrawalOrderView({ ...FIAT_ORDER_BRIDGE_WITHDRAWAL, state: "manual_review", reviewReason: "review" }).screen).toBe("review")
    expect(bridgeWithdrawalOrderView({ ...FIAT_ORDER_BRIDGE_WITHDRAWAL, state: "completed" }).screen).toBe("completed")
  })
})

