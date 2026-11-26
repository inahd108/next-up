/** "45 min", "1.5 h", "34 h", "1,204 h". */
export function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return '0 h'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 10) return `${(Math.round(hours * 10) / 10).toLocaleString('en')} h`
  return `${Math.round(hours).toLocaleString('en')} h`
}

/** Whole hours with thousands separators, for totals. */
export function formatHours(minutes: number): string {
  return Math.round(minutes / 60).toLocaleString('en')
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago", "2 years ago". */
export function formatRelative(unixSeconds: number, nowMs: number = Date.now()): string {
  if (!unixSeconds) return 'never'
  const days = Math.floor((nowMs / 1000 - unixSeconds) / 86400)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = Math.round(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

/** "Synced 5 min ago" style relative time for millisecond timestamps. */
export function formatSince(ms: number, nowMs: number = Date.now()): string {
  const minutes = Math.floor((nowMs - ms) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatRelative(Math.floor(ms / 1000), nowMs)
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${(Math.round(gb * 10) / 10).toLocaleString('en')} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}
