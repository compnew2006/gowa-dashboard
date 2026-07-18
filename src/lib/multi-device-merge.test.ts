import { describe, expect, it } from 'vitest'
import type { ChatInfo } from '@/api/chat'
import type { RegistryDevice } from '@/api/types'
import { mergeDeviceChats, type PerDeviceChats } from './multi-device-merge'

function mkChat(partial: Partial<ChatInfo>): ChatInfo {
  return {
    jid: partial.jid ?? 'a@s.whatsapp.com',
    name: partial.name ?? 'A',
    last_message_time: partial.last_message_time ?? '2026-07-18T12:00:00Z',
    ephemeral_expiration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-07-18T12:00:00Z',
    archived: false,
  }
}

function mkDevice(id: string, display_name?: string): RegistryDevice {
  return {
    id,
    display_name,
    state: 'logged_in',
    created_at: '2026-01-01T00:00:00Z',
  }
}

function bucket(
  deviceId: string,
  chats: ChatInfo[],
  opts: Partial<Omit<PerDeviceChats, 'deviceId' | 'device' | 'chats'>> & {
    display_name?: string
  } = {},
): PerDeviceChats {
  return {
    deviceId,
    device: mkDevice(deviceId, opts.display_name),
    chats,
    hasMore: opts.hasMore ?? false,
    status: opts.status ?? 'ready',
  }
}

describe('mergeDeviceChats', () => {
  it('passes a single ready device through unchanged', () => {
    const result = mergeDeviceChats([
      bucket('d1', [mkChat({ jid: 'a@s.whatsapp.com', name: 'A' })]),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual(['a@s.whatsapp.com'])
    expect(result.errors).toEqual([])
    expect(result.hasNextPage).toBe(false)
  })

  it('concatenates disjoint chats from two devices sorted by recency desc', () => {
    const result = mergeDeviceChats([
      bucket('d1', [
        mkChat({ jid: 'a@s.whatsapp.com', last_message_time: '2026-07-18T11:00:00Z' }),
      ]),
      bucket('d2', [
        mkChat({ jid: 'b@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
      ]),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual(['b@s.whatsapp.com', 'a@s.whatsapp.com'])
  })

  it('dedupes a chat that exists on two devices to the device with newer activity', () => {
    const result = mergeDeviceChats([
      bucket('d1', [
        mkChat({ jid: 'shared@s.whatsapp.com', last_message_time: '2026-07-18T10:00:00Z' }),
      ]),
      bucket('d2', [
        mkChat({ jid: 'shared@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
      ]),
    ])
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]!
    expect(row.deviceId).toBe('d2')
    expect(row.chat.last_message_time).toBe('2026-07-18T12:00:00Z')
    // All owning devices are preserved on the row for the tooltip.
    expect(row.owningDeviceIds).toEqual(['d1', 'd2'])
  })

  it('excludes an errored device from rows but lists it in errors', () => {
    const result = mergeDeviceChats([
      bucket('d1', [mkChat({ jid: 'a@s.whatsapp.com' })]),
      bucket('d2', [mkChat({ jid: 'b@s.whatsapp.com' })], { status: 'error' }),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual(['a@s.whatsapp.com'])
    expect(result.errors).toEqual(['d2'])
  })

  it('excludes a still-loading device and shows the others', () => {
    const result = mergeDeviceChats([
      bucket('d1', [mkChat({ jid: 'a@s.whatsapp.com' })]),
      bucket('d2', [], { status: 'loading' }),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual(['a@s.whatsapp.com'])
    expect(result.errors).toEqual([])
  })

  it('ORs hasMore across devices into hasNextPage', () => {
    const bothExhausted = mergeDeviceChats([
      bucket('d1', [], { hasMore: false }),
      bucket('d2', [], { hasMore: false }),
    ])
    expect(bothExhausted.hasNextPage).toBe(false)

    const oneMore = mergeDeviceChats([
      bucket('d1', [], { hasMore: false }),
      bucket('d2', [], { hasMore: true }),
    ])
    expect(oneMore.hasNextPage).toBe(true)
  })

  it('sorts zero-time chats last', () => {
    const result = mergeDeviceChats([
      bucket('d1', [
        mkChat({ jid: 'zero@s.whatsapp.com', last_message_time: '0001-01-01T00:00:00Z' }),
        mkChat({ jid: 'live@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
      ]),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual([
      'live@s.whatsapp.com',
      'zero@s.whatsapp.com',
    ])
  })

  it('breaks ties on last_message_time by jid ascending for determinism', () => {
    const result = mergeDeviceChats([
      bucket('d1', [
        mkChat({ jid: 'b@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
        mkChat({ jid: 'a@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
      ]),
    ])
    expect(result.rows.map((r) => r.chat.jid)).toEqual(['a@s.whatsapp.com', 'b@s.whatsapp.com'])
  })

  it('keeps the winning device on dedup even when the newer-activity device is second', () => {
    const result = mergeDeviceChats([
      bucket('newerFirst', [
        mkChat({ jid: 'x@s.whatsapp.com', last_message_time: '2026-07-18T12:00:00Z' }),
      ]),
      bucket('olderSecond', [
        mkChat({ jid: 'x@s.whatsapp.com', last_message_time: '2026-07-18T10:00:00Z' }),
      ]),
    ])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.deviceId).toBe('newerFirst')
  })

  it('ignores hasMore from errored or loading devices when computing hasNextPage', () => {
    const result = mergeDeviceChats([
      bucket('d1', [mkChat({ jid: 'a@s.whatsapp.com' })], { hasMore: false }),
      bucket('d2', [], { status: 'error', hasMore: true }),
      bucket('d3', [], { status: 'loading', hasMore: true }),
    ])
    // Only the ready device's hasMore counts.
    expect(result.hasNextPage).toBe(false)
  })

  it('returns an empty merge for an all-loading input', () => {
    const result = mergeDeviceChats([bucket('d1', [], { status: 'loading' })])
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.hasNextPage).toBe(false)
  })
})
