import { beforeEach, describe, expect, it } from 'vitest'
import { unreadKey, useUnreadStore } from '@/stores/unread'

describe('unreadKey', () => {
  it('joins device id and jid with a pipe', () => {
    expect(unreadKey('dev1', 'c@us')).toBe('dev1|c@us')
  })

  it('produces distinct keys for distinct device/jid pairs', () => {
    expect(unreadKey('dev1', 'a@us')).not.toBe(unreadKey('dev1', 'b@us'))
    expect(unreadKey('dev1', 'a@us')).not.toBe(unreadKey('dev2', 'a@us'))
  })
})

describe('useUnreadStore', () => {
  beforeEach(() => {
    useUnreadStore.setState({ counts: {} })
  })

  it('bump increments the count for the keyed pair', () => {
    useUnreadStore.getState().bump('dev1', 'a@us', 1)
    useUnreadStore.getState().bump('dev1', 'a@us', 2)
    expect(useUnreadStore.getState().counts).toEqual({ 'dev1|a@us': 3 })
  })

  it('bump clamps at zero on a negative delta (no negative unread counts)', () => {
    useUnreadStore.getState().set('dev1', 'a@us', 2)
    useUnreadStore.getState().bump('dev1', 'a@us', -5)
    expect(useUnreadStore.getState().counts).toEqual({})
  })

  it('bump on a missing key with a negative delta is a no-op (still zero, key absent)', () => {
    useUnreadStore.getState().bump('dev1', 'a@us', -3)
    expect(useUnreadStore.getState().counts).toEqual({})
  })

  it('set overwrites the count', () => {
    useUnreadStore.getState().set('dev1', 'a@us', 5)
    expect(useUnreadStore.getState().counts).toEqual({ 'dev1|a@us': 5 })
    useUnreadStore.getState().set('dev1', 'a@us', 7)
    expect(useUnreadStore.getState().counts).toEqual({ 'dev1|a@us': 7 })
  })

  it('set with zero or negative removes the key', () => {
    useUnreadStore.getState().set('dev1', 'a@us', 5)
    useUnreadStore.getState().set('dev1', 'a@us', 0)
    expect(useUnreadStore.getState().counts).toEqual({})
  })

  it('clear removes the key', () => {
    useUnreadStore.getState().set('dev1', 'a@us', 5)
    useUnreadStore.getState().clear('dev1', 'a@us')
    expect(useUnreadStore.getState().counts).toEqual({})
  })

  it('clear is a no-op on a missing key (does not throw)', () => {
    expect(() => useUnreadStore.getState().clear('dev1', 'missing@us')).not.toThrow()
    expect(useUnreadStore.getState().counts).toEqual({})
  })

  it('keeps per-device, per-jid counters independent', () => {
    useUnreadStore.getState().bump('dev1', 'a@us', 1)
    useUnreadStore.getState().bump('dev2', 'a@us', 3)
    useUnreadStore.getState().bump('dev1', 'b@us', 2)
    expect(useUnreadStore.getState().counts).toEqual({
      'dev1|a@us': 1,
      'dev2|a@us': 3,
      'dev1|b@us': 2,
    })
  })
})
