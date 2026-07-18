import { describe, expect, it } from 'vitest'
import { MAX_MEDIA_BYTES, validateMediaFile } from './media-validate'

function mkFile(size: number, type = 'image/png', name = 'photo.png'): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateMediaFile', () => {
  it('accepts a file exactly at the 16 MiB boundary', () => {
    const result = validateMediaFile(mkFile(MAX_MEDIA_BYTES), { maxBytes: MAX_MEDIA_BYTES })
    expect(result).toEqual({ ok: true })
  })

  it('rejects a file one byte over the 16 MiB boundary', () => {
    const result = validateMediaFile(mkFile(MAX_MEDIA_BYTES + 1), { maxBytes: MAX_MEDIA_BYTES })
    expect(result).toEqual({ ok: false, reason: 'File too large' })
  })

  it('rejects a 17 MiB file', () => {
    const result = validateMediaFile(mkFile(17 * 1024 * 1024), { maxBytes: MAX_MEDIA_BYTES })
    expect(result).toEqual({ ok: false, reason: 'File too large' })
  })

  it('accepts a 1 MiB image', () => {
    const result = validateMediaFile(mkFile(1024 * 1024, 'image/jpeg', 'p.jpg'), {
      maxBytes: MAX_MEDIA_BYTES,
    })
    expect(result).toEqual({ ok: true })
  })

  it('accepts an audio file', () => {
    const result = validateMediaFile(mkFile(2048, 'audio/mpeg', 'song.mp3'), {
      maxBytes: MAX_MEDIA_BYTES,
    })
    expect(result).toEqual({ ok: true })
  })

  it('accepts a document (falls through to /send/file)', () => {
    const result = validateMediaFile(mkFile(2048, 'application/pdf', 'doc.pdf'), {
      maxBytes: MAX_MEDIA_BYTES,
    })
    expect(result).toEqual({ ok: true })
  })

  it('accepts a file with an empty MIME type', () => {
    const result = validateMediaFile(mkFile(2048, '', 'no-extension'), {
      maxBytes: MAX_MEDIA_BYTES,
    })
    expect(result).toEqual({ ok: true })
  })

  it('honours a smaller caller-supplied limit (useAppInfo override path)', () => {
    // The caller can thread a per-type limit from useAppInfo() (e.g.
    // max_image_size). A file under the 16 MiB default but over the override
    // must be rejected so the operator learns the real ceiling before send.
    const result = validateMediaFile(mkFile(2 * 1024 * 1024, 'image/png'), {
      maxBytes: 1024 * 1024,
    })
    expect(result).toEqual({ ok: false, reason: 'File too large' })
  })

  it('accepts a zero-byte edge case at the size boundary', () => {
    // An empty file is the smallest legal input; the validator must not reject
    // it on a strict-less-than rule. (A 0-byte send is server-rejected, but
    // that surfaces through useActionMutation's error toast — not here.)
    const result = validateMediaFile(mkFile(0, 'image/png'), { maxBytes: MAX_MEDIA_BYTES })
    expect(result).toEqual({ ok: true })
  })
})
