export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  const power = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1)
  const value = bytes / 1000 ** power
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[power]}`
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * True for missing/zero timestamps: gowa stores Go's zero time
 * (0001-01-01) on chat rows created from contact sync before any
 * message exists, and epoch 0 is equally meaningless to display.
 */
export function isZeroTime(iso: string | null | undefined): boolean {
  if (!iso) return true
  const millis = new Date(iso).getTime()
  return Number.isNaN(millis) || millis <= 0
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date)
}

/**
 * Render a download-time stamp for ZIP filenames as `YYYY-MM-DD_H-MMAM`, e.g.
 * `2026-07-18_10-40AM`. The hour is the 12-hour hour WITHOUT a leading zero
 * (so `9-05AM`, not `09-05AM`), the minute IS zero-padded to two digits, and
 * the meridiem is uppercased with no leading space. Midnight is `12-00AM`,
 * noon is `12-00PM`. Parts are taken straight from the Date accessors rather
 * than `Intl.DateTimeFormat` because Intl output is locale-dependent and
 * contains a colon and a space — all three are wrong inside a filename. The
 * default parameter lets callers omit it in production while tests pass a
 * fixed Date for byte-exact determinism.
 */
export function formatFileTimestamp(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const twelveHour = now.getHours() % 12 || 12
  const minute = String(now.getMinutes()).padStart(2, '0')
  const meridiem = now.getHours() < 12 ? 'AM' : 'PM'
  return `${year}-${month}-${day}_${twelveHour}-${minute}${meridiem}`
}
