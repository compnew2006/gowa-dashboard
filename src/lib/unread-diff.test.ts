import { describe, expect, it } from 'vitest'
import type { ChatInfo, MessageInfo } from '@/api/chat'
import { computeUnreadDelta, computeUnreadDeltaFromChats } from './unread-diff'

const CHAT_JID = 'c@us'

function mkMsg(partial: Partial<MessageInfo>): MessageInfo {
  return {
    id: partial.id ?? 'm1',
    chat_jid: partial.chat_jid ?? CHAT_JID,
    sender_jid: partial.sender_jid ?? 'peer@us',
    content: partial.content ?? '',
    timestamp: partial.timestamp ?? '2026-07-18T11:55:00Z',
    is_from_me: partial.is_from_me ?? false,
    media_type: partial.media_type ?? '',
    reactions: partial.reactions,
    filename: partial.filename ?? '',
    url: partial.url ?? '',
    file_length: partial.file_length ?? 0,
  }
}

function mkChat(partial: Partial<ChatInfo>): ChatInfo {
  return {
    jid: partial.jid ?? CHAT_JID,
    name: partial.name ?? '',
    last_message_time: partial.last_message_time ?? '2026-07-18T11:55:00Z',
    ephemeral_expiration: partial.ephemeral_expiration ?? 0,
    created_at: partial.created_at ?? '',
    updated_at: partial.updated_at ?? '',
    archived: partial.archived ?? false,
  }
}

describe('computeUnreadDelta (message-side)', () => {
  it('returns zero delta and null anchor when there is no new incoming message', () => {
    const messages = [mkMsg({ id: 'a' }), mkMsg({ id: 'b' })]
    const result = computeUnreadDelta('b', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 0, firstNewIncomingId: null })
  })

  it('returns delta 1 and the new id when one new incoming message arrives', () => {
    const messages = [mkMsg({ id: 'a' }), mkMsg({ id: 'b' }), mkMsg({ id: 'c' })]
    const result = computeUnreadDelta('b', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 1, firstNewIncomingId: 'c' })
  })

  it('suppresses the bump when the conversation is selected', () => {
    const messages = [mkMsg({ id: 'a' }), mkMsg({ id: 'b' }), mkMsg({ id: 'c' })]
    const result = computeUnreadDelta('b', messages, CHAT_JID, true)
    expect(result).toEqual({ delta: 0, firstNewIncomingId: null })
  })

  it('does not count outgoing (is_from_me) messages', () => {
    const messages = [
      mkMsg({ id: 'a', is_from_me: false }),
      mkMsg({ id: 'b', is_from_me: true }),
      mkMsg({ id: 'c', is_from_me: true }),
    ]
    const result = computeUnreadDelta('a', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 0, firstNewIncomingId: null })
  })

  it('counts multiple new incoming messages and anchors on the earliest', () => {
    const messages = [
      mkMsg({ id: 'a', is_from_me: false }),
      mkMsg({ id: 'b', is_from_me: false }),
      mkMsg({ id: 'c', is_from_me: true }),
      mkMsg({ id: 'd', is_from_me: false }),
    ]
    const result = computeUnreadDelta('a', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 2, firstNewIncomingId: 'b' })
  })

  it('ignores messages whose chat_jid does not match', () => {
    const messages = [
      mkMsg({ id: 'a', chat_jid: CHAT_JID }),
      mkMsg({ id: 'other', chat_jid: 'other@us' }),
      mkMsg({ id: 'b', chat_jid: CHAT_JID }),
    ]
    const result = computeUnreadDelta('a', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 1, firstNewIncomingId: 'b' })
  })

  it('treats a null prev-top as "everything is new" (first-observation fallback)', () => {
    const messages = [mkMsg({ id: 'a' }), mkMsg({ id: 'b', is_from_me: true }), mkMsg({ id: 'c' })]
    const result = computeUnreadDelta(null, messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 2, firstNewIncomingId: 'a' })
  })

  it('returns zero when prev-top id is not present and no incoming messages exist', () => {
    const messages: MessageInfo[] = []
    const result = computeUnreadDelta('gone', messages, CHAT_JID, false)
    expect(result).toEqual({ delta: 0, firstNewIncomingId: null })
  })
})

describe('computeUnreadDeltaFromChats (chats-side)', () => {
  it('seeds cursors on first sight without bumping', () => {
    const chats = [mkChat({ jid: 'a', last_message_time: 't1' })]
    const result = computeUnreadDeltaFromChats({}, chats, null)
    expect(result.bumps).toEqual([])
    expect(result.nextTimeByJid).toEqual({ a: 't1' })
  })

  it('bumps +1 when last_message_time advances on a non-selected chat', () => {
    const chats = [mkChat({ jid: 'a', last_message_time: 't2' })]
    const result = computeUnreadDeltaFromChats({ a: 't1' }, chats, null)
    expect(result.bumps).toEqual([{ jid: 'a', delta: 1 }])
    expect(result.nextTimeByJid).toEqual({ a: 't2' })
  })

  it('does not bump when last_message_time is unchanged', () => {
    const chats = [mkChat({ jid: 'a', last_message_time: 't1' })]
    const result = computeUnreadDeltaFromChats({ a: 't1' }, chats, null)
    expect(result.bumps).toEqual([])
  })

  it('suppresses the bump for the selected jid', () => {
    const chats = [mkChat({ jid: 'a', last_message_time: 't2' })]
    const result = computeUnreadDeltaFromChats({ a: 't1' }, chats, 'a')
    expect(result.bumps).toEqual([])
    // Cursor still advances so re-selecting later does not retroactively bump.
    expect(result.nextTimeByJid).toEqual({ a: 't2' })
  })

  it('skips chats that carry a server-supplied unread_count', () => {
    // Simulate the future backend field without changing the ChatInfo type:
    // the helper probes with `'unread_count' in chat`.
    const chat = mkChat({ jid: 'a', last_message_time: 't2' }) as ChatInfo & {
      unread_count?: number
    }
    chat.unread_count = 5
    const result = computeUnreadDeltaFromChats({ a: 't1' }, [chat], null)
    expect(result.bumps).toEqual([])
    expect(result.nextTimeByJid).toEqual({ a: 't2' })
  })

  it('handles a mixed poll with seeded, advanced, selected, and new chats', () => {
    const chats = [
      mkChat({ jid: 'seeded', last_message_time: 't1' }),
      mkChat({ jid: 'advanced', last_message_time: 't2' }),
      mkChat({ jid: 'selected', last_message_time: 't2' }),
      mkChat({ jid: 'fresh', last_message_time: 't1' }),
    ]
    const result = computeUnreadDeltaFromChats(
      { seeded: 't1', advanced: 't1', selected: 't1' },
      chats,
      'selected',
    )
    expect(result.bumps).toEqual([{ jid: 'advanced', delta: 1 }])
    expect(result.nextTimeByJid).toEqual({
      seeded: 't1',
      advanced: 't2',
      selected: 't2',
      fresh: 't1',
    })
  })
})
