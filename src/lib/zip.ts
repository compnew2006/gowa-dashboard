import JSZip from 'jszip'

export interface MediaZipEntry {
  filename: string
  blob: Blob
}

/**
 * Build a single ZIP Blob from the given entries. JSZip is a pure-JS library
 * with no worker requirement when used synchronously via `generateAsync`, so it
 * bundles cleanly into the single `dist/index.html` output (no `import()`, no
 * CDN — verified by the F1.2 build smoke check). Callers dedupe filenames via
 * `sanitizeZipFilename` + a collision Map before constructing the entries.
 */
export async function buildMediaZip(entries: readonly MediaZipEntry[]): Promise<Blob> {
  const zip = new JSZip()
  for (const entry of entries) {
    // Convert to ArrayBuffer so JSZip reads the bytes uniformly across the
    // browser and the node test runner — JSZip's internal type sniff does not
    // recognize Node's global Blob, while ArrayBuffer is universally accepted.
    const buffer = await entry.blob.arrayBuffer()
    zip.file(entry.filename, buffer)
  }
  return zip.generateAsync({ type: 'blob' })
}

/**
 * Reduce a possibly-path-laden or empty filename to a single safe basename and
 * fall back to the provided string when nothing usable remains. Pure on its
 * inputs and unit-testable without JSZip. Splitting on both `/` and `\`
 * handles Unix and Windows server-returned paths.
 */
export function sanitizeZipFilename(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/]+/g, '/').trim()
  const parts = cleaned.split('/')
  const basename = parts[parts.length - 1]?.trim() ?? ''
  return basename.length > 0 ? basename : fallback
}

/**
 * Collapse an arbitrary chat display name down to a filename-safe token. Any
 * run of characters that are not a Unicode letter, digit, underscore, dash,
 * or dot — i.e. whitespace, control characters, every Windows-illegal char,
 * and every symbol including emoji — becomes a single underscore, then
 * leading/trailing underscores, dots, and spaces are trimmed. The result may
 * be the empty string (e.g. an emoji-only name); the caller's `fallback`
 * covers that. This is an allow-list posture: it preserves accented Latin and
 * CJK letters (`José`, `李明`) while stripping emoji, because `\p{L}` matches
 * Unicode letters but not symbols. It is a sibling of `sanitizeZipFilename`
 * on purpose: that one reduces a path-laden filename to its basename (keeps
 * extensions, splits on `/`), this one collapses a display string to a token
 * (collapses runs, trims dots). Both live here because filename safety is the
 * module's domain. `\p{L}`/`\p{N}` are plain JS Unicode property escapes (with
 * the `u` flag), compatible with `erasableSyntaxOnly`.
 */
export function sanitizeChatName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^[_.\s]+|[_.\s]+$/g, '')
}

/**
 * Compose the final ZIP filename from a chat identifier and a download
 * timestamp. Sanitizes the identifier (falling back to the provided string
 * when nothing usable remains), concatenates `{sanitized}_{timestamp}.zip`,
 * and returns it. The timestamp is taken as-is — `formatFileTimestamp` already
 * guarantees it is filesystem-safe, so it is not re-sanitized here. This is
 * the single entry point the chat viewer calls; it never invokes
 * `sanitizeChatName` or `formatFileTimestamp` directly, so composition order
 * is owned in one place. Pure on its inputs and unit-testable without JSZip.
 */
export function buildChatZipName({
  identifier,
  timestamp,
  fallback = 'media',
}: {
  identifier: string
  timestamp: string
  fallback?: string
}): string {
  const sanitized = sanitizeChatName(identifier)
  const name = sanitized.length > 0 ? sanitized : fallback
  return `${name}_${timestamp}.zip`
}
