/** Display metadata for provider country codes used by local fiat rails. */

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  BJ: "Benin",
  CD: "Democratic Republic of the Congo",
  CI: "Côte d’Ivoire",
  CM: "Cameroon",
  EG: "Egypt",
  ET: "Ethiopia",
  GA: "Gabon",
  GH: "Ghana",
  GM: "The Gambia",
  GN: "Guinea",
  KE: "Kenya",
  LR: "Liberia",
  ML: "Mali",
  MW: "Malawi",
  NG: "Nigeria",
  RW: "Rwanda",
  SL: "Sierra Leone",
  SN: "Senegal",
  TG: "Togo",
  TZ: "Tanzania",
  UG: "Uganda",
  ZA: "South Africa",
  ZM: "Zambia",
}

function normalizedCode(countryCode: string): string {
  return countryCode.trim().toUpperCase()
}

/** Convert an ISO 3166-1 alpha-2 code into its native flag emoji. */
export function countryFlagForCode(countryCode: string): string {
  const code = normalizedCode(countryCode)
  if (!/^[A-Z]{2}$/.test(code)) return "🌍"
  return String.fromCodePoint(...Array.from(code, (letter) => 127397 + letter.charCodeAt(0)))
}

/**
 * Prefer a provider-supplied name, then the supported-corridor fallback, and
 * finally the browser's locale data for an unfamiliar valid country code.
 */
export function countryNameForCode(countryCode: string, providerName?: string): string {
  const code = normalizedCode(countryCode)
  const supplied = providerName?.trim()
  if (supplied) return supplied
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code]

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" })
    return displayNames.of(code) ?? code
  } catch {
    return code
  }
}

/** Compact label used by country selectors and route summaries. */
export function countryLabelForCode(countryCode: string, providerName?: string): string {
  return `${countryFlagForCode(countryCode)} ${countryNameForCode(countryCode, providerName)}`
}
