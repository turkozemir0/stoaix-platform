/**
 * Telefon numarasını E.164 formatına normalize eder.
 * Türkiye varsayılan ülke kodu: 90
 */
export function normalizePhone(raw: string, defaultCC = '90'): string | null {
  const d = raw.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('90') && d.length === 12) return `+${d}`
  if (d.startsWith('0') && d.length === 11) return `+90${d.slice(1)}`
  if (d.length === 10) return `+${defaultCC}${d}`
  if (d.length > 10) return `+${d}`
  return null
}
