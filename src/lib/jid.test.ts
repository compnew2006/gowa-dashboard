import { describe, expect, it } from 'vitest'
import { composeJid, isStatus, jidToPhone } from './jid'

describe('composeJid', () => {
  it('appends the user suffix', () => {
    expect(composeJid('628123', 'user')).toBe('628123@s.whatsapp.net')
  })

  it('appends the group suffix', () => {
    expect(composeJid('12345', 'group')).toBe('12345@g.us')
  })

  it('appends newsletter and lid suffixes', () => {
    expect(composeJid('abc', 'newsletter')).toBe('abc@newsletter')
    expect(composeJid('99', 'lid')).toBe('99@lid')
  })

  it('returns the status broadcast jid regardless of phone', () => {
    expect(composeJid('anything', 'status')).toBe('status@broadcast')
    expect(composeJid('', 'status')).toBe('status@broadcast')
  })

  it('passes through a value that already contains a jid', () => {
    expect(composeJid('12345@g.us', 'user')).toBe('12345@g.us')
  })

  it('returns empty for a blank phone (non-status)', () => {
    expect(composeJid('   ', 'user')).toBe('')
  })
})

describe('isStatus', () => {
  it('is true only for status', () => {
    expect(isStatus('status')).toBe(true)
    expect(isStatus('user')).toBe(false)
  })
})

describe('jidToPhone', () => {
  it('returns the local part of an individual (user) jid', () => {
    expect(jidToPhone('056183319@s.whatsapp.net')).toBe('056183319')
  })

  it('returns the local part of a group jid', () => {
    expect(jidToPhone('1203630@g.us')).toBe('1203630')
  })

  it('returns the local part of a newsletter jid', () => {
    expect(jidToPhone('abc@newsletter')).toBe('abc')
  })

  it('returns the local part of a LID jid', () => {
    expect(jidToPhone('99@lid')).toBe('99')
  })

  it('returns "status" for the status broadcast jid', () => {
    expect(jidToPhone('status@broadcast')).toBe('status')
  })

  it('returns the empty string for empty input', () => {
    expect(jidToPhone('')).toBe('')
  })

  it('returns the empty string for whitespace-only input', () => {
    expect(jidToPhone('   ')).toBe('')
  })

  it('returns the whole input when there is no @ (never throws)', () => {
    expect(jidToPhone('no-at-sign')).toBe('no-at-sign')
  })
})
