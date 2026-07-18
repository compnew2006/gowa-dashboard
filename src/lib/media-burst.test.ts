import { describe, expect, it } from 'vitest'
import type { MessageInfo } from '@/api/chat'
import { selectRecentMediaBurst } from './media-burst'

const MIN = 60_000

function mk(partial: Partial<MessageInfo>): MessageInfo {
  return {
    id: partial.id ?? 'm1',
    chat_jid: partial.chat_jid ?? 'c@us',
    sender_jid: partial.sender_jid ?? 'peer@us',
    content: partial.content ?? '',
    timestamp: partial.timestamp ?? '2026-07-18T11:55:00Z',
    is_from_me: partial.is_from_me ?? false,
    media_type: partial.media_type ?? 'image',
    reactions: partial.reactions,
    filename: partial.filename ?? 'photo.jpg',
    url: partial.url ?? '',
    file_length: partial.file_length ?? 1024,
  }
}

describe('selectRecentMediaBurst', () => {
  it('returns empty for an empty input', () => {
    const result = selectRecentMediaBurst([], 5 * MIN)
    expect(result.files).toEqual([])
    expect(result.isCollectible).toBe(false)
  })

  it('returns empty when every message is outgoing', () => {
    const messages = [mk({ id: '1', is_from_me: true }), mk({ id: '2', is_from_me: true })]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files).toEqual([])
    expect(result.isCollectible).toBe(false)
  })

  it('is not collectible for a single incoming file', () => {
    const messages = [mk({ id: '1', timestamp: '2026-07-18T11:55:00Z' })]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['1'])
    expect(result.isCollectible).toBe(false)
  })

  it('collects two files within maxGapMs in chronological order', () => {
    // 60s apart, maxGapMs = 120_000 — both collected.
    const messages = [
      mk({ id: 'a', timestamp: '2026-07-18T11:54:00Z' }),
      mk({ id: 'b', timestamp: '2026-07-18T11:55:00Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 2 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['a', 'b'])
    expect(result.isCollectible).toBe(true)
  })

  it('keeps only the most-recent file when two are separated by more than maxGapMs', () => {
    // 28min apart, maxGapMs = 5 * MIN — only the most recent survives.
    const messages = [
      mk({ id: 'old', timestamp: '2026-07-18T11:27:00Z' }),
      mk({ id: 'new', timestamp: '2026-07-18T11:55:00Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['new'])
    expect(result.isCollectible).toBe(false)
  })

  it('returns the most-recent cluster for the user two-cluster example', () => {
    // maxGapMs = 5 * MIN. 10:00->10:01 = 60s (within), 10:01->10:45 = 44min
    // (closes), 10:45->10:50 = 5min (within), 10:50->10:54 = 4min (within).
    // Burst = [10:45, 10:50, 10:54] — the most recent cluster.
    const messages = [
      mk({ id: 'a', timestamp: '2026-07-18T10:00:00Z' }),
      mk({ id: 'b', timestamp: '2026-07-18T10:01:00Z' }),
      mk({ id: 'c', timestamp: '2026-07-18T10:45:00Z' }),
      mk({ id: 'd', timestamp: '2026-07-18T10:50:00Z' }),
      mk({ id: 'e', timestamp: '2026-07-18T10:54:00Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['c', 'd', 'e'])
    expect(result.isCollectible).toBe(true)
  })

  it('excludes messages with file_length === 0', () => {
    const messages = [
      mk({ id: 'zero', file_length: 0 }),
      mk({ id: 'ok', file_length: 1024, timestamp: '2026-07-18T11:55:30Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['ok'])
  })

  it('excludes messages with empty media_type', () => {
    const messages = [
      mk({ id: 'blank', media_type: '' }),
      mk({ id: 'video', media_type: 'video', timestamp: '2026-07-18T11:55:30Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['video'])
  })

  it('excludes outgoing (is_from_me) messages', () => {
    const messages = [
      mk({ id: 'out', is_from_me: true }),
      mk({ id: 'in', timestamp: '2026-07-18T11:55:30Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['in'])
  })

  it('sorts survivors chronologically regardless of input order', () => {
    // Same two messages as the chronological test, passed newest-first.
    const messages = [
      mk({ id: 'b', timestamp: '2026-07-18T11:55:00Z' }),
      mk({ id: 'a', timestamp: '2026-07-18T11:54:00Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 2 * MIN)
    expect(result.files.map((m) => m.id)).toEqual(['a', 'b'])
    expect(result.isCollectible).toBe(true)
  })

  it('breaks the cluster when a NaN timestamp is encountered', () => {
    // The most recent message has a NaN timestamp; the gap is NaN, the loop
    // breaks on the very first comparison, and the NaN message itself is the
    // seed (so the burst is just that one message — but Date.parse on its own
    // timestamp is NaN, so it survives the filter but yields a single-element
    // non-collectible burst). Use a NaN-timestamped message that is NOT the
    // newest position to prove the NaN-gap clause closes the walk.
    const messages = [
      mk({ id: 'broken', timestamp: 'not-a-date' }),
      mk({ id: 'good', timestamp: '2026-07-18T11:55:00Z' }),
    ]
    const result = selectRecentMediaBurst(messages, 5 * MIN)
    // The good (newer-by-sort, NaN sorts low) message is the seed; the broken
    // message's gap is NaN, the loop breaks, and broken is excluded.
    expect(result.files.map((m) => m.id)).toEqual(['good'])
    expect(result.isCollectible).toBe(false)
  })
})
