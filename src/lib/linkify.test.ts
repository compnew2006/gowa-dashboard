import { describe, expect, it } from 'vitest'
import { tokenizeMessageText } from './linkify'

describe('tokenizeMessageText', () => {
  it('returns [] for empty input', () => {
    expect(tokenizeMessageText('')).toEqual([])
  })

  it('passes plain text through as a single text token (hot path)', () => {
    const text = 'No link here, just plain prose.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  it('returns a single link token for a sole URL', () => {
    const url = 'https://example.com'
    const tokens = tokenizeMessageText(url)
    expect(tokens).toEqual([
      { kind: 'text', value: '' },
      { kind: 'link', value: url, href: url },
      { kind: 'text', value: '' },
    ])
  })

  it('keeps the scheme and query string in both value and href', () => {
    const url = 'https://example.com/path?q=1&r=2'
    const tokens = tokenizeMessageText(url)
    const link = tokens.find((t) => t.kind === 'link')
    expect(link).toEqual({ kind: 'link', value: url, href: url })
  })

  it('splits a URL embedded in prose into [text, link, text]', () => {
    const tokens = tokenizeMessageText('Check this https://example.com when you can.')
    expect(tokens).toEqual([
      { kind: 'text', value: 'Check this ' },
      { kind: 'link', value: 'https://example.com', href: 'https://example.com' },
      { kind: 'text', value: ' when you can.' },
    ])
  })

  it('returns [link, text, link] for two URLs separated by prose', () => {
    const tokens = tokenizeMessageText('https://a.com and https://b.com')
    expect(tokens).toEqual([
      { kind: 'text', value: '' },
      { kind: 'link', value: 'https://a.com', href: 'https://a.com' },
      { kind: 'text', value: ' and ' },
      { kind: 'link', value: 'https://b.com', href: 'https://b.com' },
      { kind: 'text', value: '' },
    ])
  })

  it('matches a URL with a port', () => {
    const url = 'https://host:8080/path'
    const tokens = tokenizeMessageText(url)
    const link = tokens.find((t) => t.kind === 'link')
    expect(link).toEqual({ kind: 'link', value: url, href: url })
  })

  it('matches a URL with a fragment', () => {
    const url = 'https://host/path#frag'
    const tokens = tokenizeMessageText(url)
    const link = tokens.find((t) => t.kind === 'link')
    expect(link).toEqual({ kind: 'link', value: url, href: url })
  })

  it('preserves the Facebook query string with & and =', () => {
    const url = 'https://m.facebook.com/stories/123?story_id=456&mibextid=abc'
    const tokens = tokenizeMessageText(url)
    expect(tokens).toEqual([
      { kind: 'text', value: '' },
      { kind: 'link', value: url, href: url },
      { kind: 'text', value: '' },
    ])
  })

  it('does not false-positive on a version string', () => {
    const text = 'Upgraded to v1.5.0 today.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  it('does not false-positive on a bare IP address', () => {
    const text = 'Ping 127.0.0.1 to test.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  it('does not false-positive on a bare domain', () => {
    const text = 'Visit example.com later.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  it('does not swallow a trailing period that ends a sentence', () => {
    const tokens = tokenizeMessageText('See https://example.com.')
    expect(tokens).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', value: 'https://example.com', href: 'https://example.com' },
      { kind: 'text', value: '.' },
    ])
  })

  it('does not match an ftp:// scheme', () => {
    const text = 'Grab it at ftp://example.com/file.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  it('does not match a mailto: scheme', () => {
    const text = 'Email me at mailto:user@example.com please.'
    expect(tokenizeMessageText(text)).toEqual([{ kind: 'text', value: text }])
  })

  // Mitigation beyond the literal spec scope: a parenthesised path segment
  // (Wikipedia disambiguators are the canonical example) stays intact so the
  // AUDITOR's concern is closed. The closing paren is preserved because it has
  // a matching opener inside the run.
  it('preserves a balanced parenthesised path segment', () => {
    const url = 'https://en.wikipedia.org/wiki/URL_(disambiguation)'
    const tokens = tokenizeMessageText(url)
    expect(tokens).toEqual([
      { kind: 'text', value: '' },
      { kind: 'link', value: url, href: url },
      { kind: 'text', value: '' },
    ])
  })

  // A URL wrapped in prose parens drops the closing paren because it has no
  // matching opener inside the run.
  it('drops an unbalanced prose wrapping paren', () => {
    const url = 'https://example.com'
    const tokens = tokenizeMessageText(`(see ${url})`)
    const link = tokens.find((t) => t.kind === 'link')
    expect(link).toEqual({ kind: 'link', value: url, href: url })
  })
})
