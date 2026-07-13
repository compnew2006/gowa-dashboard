import { describe, expect, it } from 'vitest'
import { formatBytes } from './format'

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
