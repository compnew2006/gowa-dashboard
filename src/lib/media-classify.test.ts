import { describe, expect, it } from 'vitest'
import { canHaveCaption, classifyMedia, type ClassifiableFile } from './media-classify'

function mk(type: string, name = 'x'): ClassifiableFile {
  return { type, name }
}

describe('classifyMedia', () => {
  it('classifies image MIME prefixes as image', () => {
    expect(classifyMedia(mk('image/png', 'photo.png'))).toBe('image')
    expect(classifyMedia(mk('image/jpeg', 'photo.jpg'))).toBe('image')
    expect(classifyMedia(mk('image/webp', 'shot.webp'))).toBe('image')
    expect(classifyMedia(mk('image/gif', 'anim.gif'))).toBe('image')
  })

  it('classifies video MIME prefixes as video', () => {
    expect(classifyMedia(mk('video/mp4', 'clip.mp4'))).toBe('video')
    expect(classifyMedia(mk('video/webm', 'clip.webm'))).toBe('video')
    expect(classifyMedia(mk('video/quicktime', 'clip.mov'))).toBe('video')
  })

  it('classifies audio MIME prefixes as audio', () => {
    expect(classifyMedia(mk('audio/mpeg', 'song.mp3'))).toBe('audio')
    expect(classifyMedia(mk('audio/ogg', 'voice.ogg'))).toBe('audio')
    expect(classifyMedia(mk('audio/wav', 'clip.wav'))).toBe('audio')
    expect(classifyMedia(mk('audio/x-m4a', 'voice.m4a'))).toBe('audio')
  })

  it('classifies documents as file', () => {
    expect(classifyMedia(mk('application/pdf', 'doc.pdf'))).toBe('file')
    expect(
      classifyMedia(
        mk('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'r.docx'),
      ),
    ).toBe('file')
    expect(classifyMedia(mk('application/zip', 'bundle.zip'))).toBe('file')
    expect(classifyMedia(mk('text/plain', 'notes.txt'))).toBe('file')
    expect(classifyMedia(mk('application/json', 'data.json'))).toBe('file')
  })

  it('falls back to file for an empty type', () => {
    expect(classifyMedia(mk('', 'no-extension'))).toBe('file')
  })

  it('falls back to file for an unknown type', () => {
    expect(classifyMedia(mk('application/x-some-future-format', 'thing.xyz'))).toBe('file')
  })
})

describe('canHaveCaption', () => {
  it('allows a caption on images', () => {
    expect(canHaveCaption('image')).toBe(true)
  })

  it('allows a caption on videos', () => {
    expect(canHaveCaption('video')).toBe(true)
  })

  it('allows a caption on documents', () => {
    expect(canHaveCaption('file')).toBe(true)
  })

  it('does not allow a caption on audio', () => {
    expect(canHaveCaption('audio')).toBe(false)
  })
})
