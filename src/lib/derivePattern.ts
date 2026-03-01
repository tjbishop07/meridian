/**
 * Derives a short, lowercase pattern from a transaction description.
 * Takes the first word (split on spaces and common separators), strips
 * trailing digits, and lowercases the result.
 *
 * Examples:
 *   "Starbucks Coffee #1234" → "starbucks"
 *   "NETFLIX.COM"            → "netflix"
 *   "COSTCO WHSE #0123"      → "costco"
 *   "Amazon.com*1A2B3C4D"    → "amazon"
 */
export function derivePattern(desc: string): string {
  const first = desc.trim().split(/[\s.*#_/\\@&!,]+/)[0];
  return (first.replace(/\d+$/, '') || desc.trim().slice(0, 20)).toLowerCase();
}
