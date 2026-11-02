const MS_PER_DAY = 86_400_000

/** Window in which an exception counts as "about to expire". */
export const EXPIRING_SOON_DAYS = 7

/** Longest validity an exception may be granted for. */
export const MAX_VALIDITY_DAYS = 90

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function today(): Date {
  return new Date()
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Whole days from today until `isoDate`; negative once it is in the past. */
export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`)
  const start = new Date(toIsoDate(today()) + 'T00:00:00')
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY)
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Relative wording for the validity column: overdue and imminent expiries read
 * as a countdown, anything further out as a plain date.
 */
export function formatExpiry(isoDate: string): string {
  const days = daysUntil(isoDate)
  if (days < 0) return `Venció hace ${Math.abs(days)} días`
  if (days === 0) return 'Vence hoy'
  if (days <= EXPIRING_SOON_DAYS) return `En ${days} días`
  return formatDate(isoDate)
}

/** True while the expiry deserves visual emphasis in the table. */
export function isExpiryUrgent(isoDate: string): boolean {
  return daysUntil(isoDate) <= EXPIRING_SOON_DAYS
}
