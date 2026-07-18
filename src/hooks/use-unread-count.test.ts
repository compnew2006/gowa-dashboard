import { describe, expect, it } from 'vitest'
import { formatUnread } from '@/hooks/use-unread-count'

describe('formatUnread', () => {
  it('renders small counts as their literal string', () => {
    expect(formatUnread(1)).toBe('1')
    expect(formatUnread(7)).toBe('7')
  })

  it('renders 99 as "99" (boundary, not collapsed)', () => {
    expect(formatUnread(99)).toBe('99')
  })

  it('renders counts above 99 as "99+"', () => {
    expect(formatUnread(100)).toBe('99+')
    expect(formatUnread(9999)).toBe('99+')
  })

  it('renders zero as "0"', () => {
    expect(formatUnread(0)).toBe('0')
  })
})
