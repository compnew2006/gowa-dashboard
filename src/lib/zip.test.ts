import { describe, expect, it } from 'vitest'
import { buildChatZipName, buildMediaZip, sanitizeChatName, sanitizeZipFilename } from './zip'

describe('sanitizeZipFilename', () => {
  it('returns the basename of a unix path', () => {
    expect(sanitizeZipFilename('/statics/media/photo.jpg', 'file')).toBe('photo.jpg')
  })

  it('returns the basename of a windows path', () => {
    expect(sanitizeZipFilename('C:\\uploads\\doc.pdf', 'file')).toBe('doc.pdf')
  })

  it('falls back when the name is empty', () => {
    expect(sanitizeZipFilename('', 'unnamed.bin')).toBe('unnamed.bin')
  })

  it('falls back when only path separators remain', () => {
    expect(sanitizeZipFilename('///', 'unnamed.bin')).toBe('unnamed.bin')
  })

  it('preserves the file extension', () => {
    expect(sanitizeZipFilename('voice-note.m4a', 'audio')).toBe('voice-note.m4a')
  })

  it('preserves a plain filename without slashes', () => {
    expect(sanitizeZipFilename('report.pdf', 'file')).toBe('report.pdf')
  })
})

describe('buildMediaZip', () => {
  it('resolves to a non-empty Blob', async () => {
    const blob = await buildMediaZip([{ filename: 'a.txt', blob: new Blob(['hello']) }])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('application/zip')
  })

  it('handles multiple entries', async () => {
    const blob = await buildMediaZip([
      { filename: 'a.txt', blob: new Blob(['aaa']) },
      { filename: 'b.txt', blob: new Blob(['bbbb']) },
    ])
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('sanitizeChatName', () => {
  it('keeps a plain ASCII name unchanged', () => {
    expect(sanitizeChatName('Mom')).toBe('Mom')
  })

  it('preserves Unicode letters (accented Latin)', () => {
    expect(sanitizeChatName('José')).toBe('José')
  })

  it('strips emoji and collapses the run to nothing usable', () => {
    expect(sanitizeChatName('Mom 💕')).toBe('Mom')
  })

  it('returns the empty string for an emoji-only name', () => {
    expect(sanitizeChatName('   💕   ')).toBe('')
  })

  it('replaces a slash with an underscore', () => {
    expect(sanitizeChatName('Test/QA')).toBe('Test_QA')
  })

  it('replaces every Windows-illegal char with an underscore', () => {
    expect(sanitizeChatName('a:b*c?d"e<f>g|h')).toBe('a_b_c_d_e_f_g_h')
  })

  it('trims leading whitespace', () => {
    expect(sanitizeChatName('  leading')).toBe('leading')
  })

  it('trims trailing dots and spaces', () => {
    expect(sanitizeChatName('trailing.   ')).toBe('trailing')
  })

  it('collapses runs of whitespace to a single underscore', () => {
    expect(sanitizeChatName('two  spaces')).toBe('two_spaces')
  })

  it('treats control characters (tab) as whitespace', () => {
    expect(sanitizeChatName('tab\there')).toBe('tab_here')
  })

  it('returns the empty string for empty input', () => {
    expect(sanitizeChatName('')).toBe('')
  })
})

describe('buildChatZipName', () => {
  it('composes a normal name and timestamp', () => {
    expect(buildChatZipName({ identifier: 'Mom', timestamp: '2026-07-18_10-40AM' })).toBe(
      'Mom_2026-07-18_10-40AM.zip',
    )
  })

  it('composes a numeric phone identifier (the user example)', () => {
    expect(buildChatZipName({ identifier: '056183319', timestamp: '2026-07-18_10-40AM' })).toBe(
      '056183319_2026-07-18_10-40AM.zip',
    )
  })

  it('falls back to the default media token when the identifier is empty', () => {
    expect(buildChatZipName({ identifier: '', timestamp: '2026-07-18_10-40AM' })).toBe(
      'media_2026-07-18_10-40AM.zip',
    )
  })

  it('honors an explicit fallback when the identifier is empty', () => {
    expect(
      buildChatZipName({ identifier: '', timestamp: '2026-07-18_10-40AM', fallback: 'chat' }),
    ).toBe('chat_2026-07-18_10-40AM.zip')
  })

  it('falls back when the identifier sanitizes down to nothing (emoji-only)', () => {
    expect(
      buildChatZipName({ identifier: '   💕   ', timestamp: '2026-07-18_10-40AM', fallback: 'media' }),
    ).toBe('media_2026-07-18_10-40AM.zip')
  })

  it('ignores the fallback when the identifier is non-empty after sanitization', () => {
    expect(
      buildChatZipName({ identifier: 'Mom', timestamp: '2026-07-18_10-40AM', fallback: 'media' }),
    ).toBe('Mom_2026-07-18_10-40AM.zip')
  })
})
