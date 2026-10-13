/**
 * What a decimal field keeps of what was typed: digits and one point, with
 * leading zeros folded away ("000" → "0", "0005" → "5", "00.5" → "0.5").
 * The zero before a point stays, so "0.05" types normally.
 */
export function cleanDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
  if (s.startsWith(".")) s = `0${s}`
  return s.replace(/^0+(?=\d)/, "")
}
