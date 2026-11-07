/**
 * Showing a bundled service fee honestly: the fee row names its token, and the
 * user always sees what actually leaves the wallet, not only the provider amount.
 */

/** Exact decimal addition on strings, so a displayed total never picks up float error. */
export function addDecimalStrings(left: string, right: string): string {
  const [leftWhole = "0", leftFraction = ""] = left.split(".")
  const [rightWhole = "0", rightFraction = ""] = right.split(".")
  const places = Math.max(leftFraction.length, rightFraction.length)
  const a = `${leftWhole}${leftFraction.padEnd(places, "0")}`
  const b = `${rightWhole}${rightFraction.padEnd(places, "0")}`
  const width = Math.max(a.length, b.length)
  const x = a.padStart(width, "0")
  const y = b.padStart(width, "0")
  let carry = 0
  let digits = ""
  for (let index = width - 1; index >= 0; index -= 1) {
    const sum = Number(x[index]) + Number(y[index]) + carry
    digits = String(sum % 10) + digits
    carry = sum >= 10 ? 1 : 0
  }
  if (carry) digits = `1${digits}`
  const whole = (places === 0 ? digits : digits.slice(0, digits.length - places)).replace(/^0+(?=\d)/, "") || "0"
  const fraction = places === 0 ? "" : digits.slice(digits.length - places).replace(/0+$/, "")
  return fraction ? `${whole}.${fraction}` : whole
}

export interface FeeRowRow { label: string; value: string }

interface QuoteLike {
  sourceAmount: string
  sourceCurrency: string
  worldstreetFee?: string
  totalDebit?: string
}

export function hasServiceFee(value: { worldstreetFee?: string }): boolean {
  return Number(value.worldstreetFee) > 0
}

/** What leaves the wallet: the backend's figure when given, otherwise computed exactly. */
export function totalSent(quote: QuoteLike): string {
  if (!hasServiceFee(quote)) return quote.sourceAmount
  return quote.totalDebit ?? addDecimalStrings(quote.sourceAmount, quote.worldstreetFee!)
}

/** Rows to add after "You send": the fee with its token, then the true total. Empty when there is no fee. */
export function serviceFeeRows(quote: QuoteLike): FeeRowRow[] {
  if (!hasServiceFee(quote)) return []
  return [
    { label: "Service fee", value: `${quote.worldstreetFee} ${quote.sourceCurrency}` },
    { label: "Total you send", value: `${totalSent(quote)} ${quote.sourceCurrency}` },
  ]
}

/** The order screen's amount: the total debit, with the fee called out, when a fee applies. */
export function orderSentFigure(input: { symbol: string; amount?: string; worldstreetFee?: string; totalDebit?: string }): string | undefined {
  if (hasServiceFee(input) && input.amount) {
    const total = input.totalDebit ?? addDecimalStrings(input.amount, input.worldstreetFee!)
    return `${total} ${input.symbol} (includes a ${input.worldstreetFee} ${input.symbol} service fee)`
  }
  return input.amount ? `${input.amount} ${input.symbol}` : undefined
}
