export type MediaKind = 'image' | 'video' | 'audio' | 'file'

/**
 * The bit a picker carries that we actually classify on. A `File` satisfies
 * this, but a plain `{ type, name }` works too — the validator and the preview
 * dialog only need the MIME and the filename, and the unit tests pass a plain
 * object so they do not have to construct real `File` instances.
 */
export interface ClassifiableFile {
  type: string
  name: string
}

/**
 * Map a picked file to the send endpoint that should carry it. The mapping is
 * driven entirely by the MIME `type`'s prefix, so the validator, the preview
 * dialog, and the executor all agree on which endpoint fires for a given file:
 *
 * - `image/*`  → `POST /send/image` (`imageRequest` / `sendImage`)
 * - `video/*`  → `POST /send/video` (`videoRequest` / `sendVideo`)
 * - `audio/*`  → `POST /send/audio` (`audioRequest` / `sendAudio`)
 * - everything else (PDF, doc, zip, empty, unknown) → `POST /send/file`
 *   (`fileRequest` / `sendFile`)
 *
 * Unknown or empty MIME deliberately falls through to `'file'`: WhatsApp
 * accepts a broad range of document types (`.docx`, `.zip`, `.pdf`, …) that
 * all ride the `/send/file` endpoint, and an empty `type` is what some OS
 * pickers hand back for documents without a registered handler. The companion
 * validator (`media-validate.ts`) is what rejects genuinely unsupported types
 * if a tighter allow-list is desired; classification stays permissive.
 */
export function classifyMedia(file: ClassifiableFile): MediaKind {
  const type = file.type
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

/**
 * Whether a kind accepts a caption. WhatsApp's `/send/audio` endpoint does not
 * carry a `caption` field (audio is sent as a pure attachment, optionally as
 * a PTT), so the preview dialog hides the caption Textarea for it. Images,
 * videos, and documents all accept captions.
 */
export function canHaveCaption(kind: MediaKind): boolean {
  return kind !== 'audio'
}
