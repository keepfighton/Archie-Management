export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Convert date strings to RFC3339 for Go time.Time parsing
export function toISODate(d: string): string {
  if (!d) return ''
  if (d.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(d)) return d
  if (d.includes('T')) return d + ':00Z'  // "2026-04-01T10:00" → "2026-04-01T10:00:00Z"
  return d + 'T00:00:00Z'                 // "2026-04-01" → "2026-04-01T00:00:00Z"
}

export function formatNumber(value: number | string | undefined): string {
  if (value === '' || value === undefined || value === null) return ''
  const n = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value
  if (isNaN(n)) return ''
  return n.toLocaleString('id-ID')
}

export function parseNumber(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export function formatIDR(value: number): string {
  return 'IDR' + Math.round(value).toLocaleString('id-ID')
}

export function terbilangIDR(value: number): string {
  const words = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  const spell = (input: number): string => {
    const n = Math.floor(Math.abs(input))
    if (n < 12) return words[n]
    if (n < 20) return `${spell(n - 10)} belas`
    if (n < 100) return `${spell(Math.floor(n / 10))} puluh ${spell(n % 10)}`.trim()
    if (n < 200) return `seratus ${spell(n - 100)}`.trim()
    if (n < 1000) return `${spell(Math.floor(n / 100))} ratus ${spell(n % 100)}`.trim()
    if (n < 2000) return `seribu ${spell(n - 1000)}`.trim()
    if (n < 1_000_000) return `${spell(Math.floor(n / 1000))} ribu ${spell(n % 1000)}`.trim()
    if (n < 1_000_000_000) return `${spell(Math.floor(n / 1_000_000))} juta ${spell(n % 1_000_000)}`.trim()
    if (n < 1_000_000_000_000) return `${spell(Math.floor(n / 1_000_000_000))} miliar ${spell(n % 1_000_000_000)}`.trim()
    return `${spell(Math.floor(n / 1_000_000_000_000))} triliun ${spell(n % 1_000_000_000_000)}`.trim()
  }
  const result = spell(value).replace(/\s+/g, ' ').trim()
  return result ? `${result.charAt(0).toUpperCase()}${result.slice(1)} rupiah` : 'Nol rupiah'
}
