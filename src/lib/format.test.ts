import { describe, expect, it } from 'vitest'
import { formatBytes, formatFileTimestamp, isZeroTime } from './format'

describe('isZeroTime', () => {
  it('treats Go zero time, epoch 0, empty, and garbage as zero', () => {
    expect(isZeroTime('0001-01-01T00:00:00Z')).toBe(true)
    expect(isZeroTime('1970-01-01T00:00:00Z')).toBe(true)
    expect(isZeroTime('')).toBe(true)
    expect(isZeroTime(undefined)).toBe(true)
    expect(isZeroTime('not-a-date')).toBe(true)
  })

  it('accepts real timestamps', () => {
    expect(isZeroTime('2026-07-14T06:00:00Z')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats zero and negatives as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })

  it('formats bytes without decimals when whole', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2000)).toBe('2 kB')
  })

  it('scales into MB and GB', () => {
    expect(formatBytes(50_000_000)).toBe('50 MB')
    expect(formatBytes(2_500_000_000)).toBe('2.5 GB')
  })
})

describe('formatFileTimestamp', () => {
  it('matches the user worked example byte-for-byte (10:40 AM)', () => {
    expect(formatFileTimestamp(new Date('2026-07-18T10:40:00'))).toBe('2026-07-18_10-40AM')
  })

  it('renders a single-digit PM hour without a leading zero (2:05 PM)', () => {
    expect(formatFileTimestamp(new Date('2026-07-18T14:05:00'))).toBe('2026-07-18_2-05PM')
  })

  it('zero-pads a single-digit minute and single-digit hour (9:05 AM)', () => {
    expect(formatFileTimestamp(new Date('2026-07-18T09:05:00'))).toBe('2026-07-18_9-05AM')
  })

  it('renders midnight as 12-00AM', () => {
    expect(formatFileTimestamp(new Date('2026-07-18T00:00:00'))).toBe('2026-07-18_12-00AM')
  })

  it('renders noon as 12-00PM', () => {
    expect(formatFileTimestamp(new Date('2026-07-18T12:00:00'))).toBe('2026-07-18_12-00PM')
  })

  it('is deterministic for an explicit Date argument', () => {
    const fixed = new Date('2026-07-18T10:40:00')
    expect(formatFileTimestamp(fixed)).toBe(formatFileTimestamp(fixed))
    expect(formatFileTimestamp(fixed)).toBe('2026-07-18_10-40AM')
  })
})
