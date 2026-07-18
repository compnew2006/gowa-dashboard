import type { MessageInfo } from '@/api/chat'

export interface MediaBurst {
  files: MessageInfo[]
  isCollectible: boolean
}

/**
 * Select the most recent cluster of incoming media messages where each
 * consecutive pair is within `maxGapMs` of the next. Mirrors the Vue
 * `useMediaBurst` gap walk at `useMediaBurst.ts:60-77` — a burst is the longest
 * trailing run of incoming media whose consecutive gaps are all within the
 * threshold; the first gap larger than `maxGapMs` closes the cluster. When
 * multiple clusters exist, only the most recent is "the burst" (matches the
 * chip's "files just in" copy). This is a pure function — the call site
 * (`useMediaBurst`) re-runs it on each poll-driven data change.
 *
 * Filter: incoming only (`!is_from_me`), a non-empty `media_type`, and a
 * positive `file_length`. The survivors are sorted chronologically
 * (oldest first) by `Date.parse(timestamp)` — the function is pure and must
 * not assume input order, even though the live caller passes an already
 * chronological array. The cluster walk then seeds with the newest survivor
 * (last element of the ascending array) and walks downward, pushing each
 * message whose absolute timestamp gap to the previously-walked message is
 * `<= maxGapMs`. The first gap `> maxGapMs` closes the loop, and a NaN gap
 * (from a NaN-parsed timestamp) closes it too — a malformed message must not
 * sneak into the burst. A final `reverse()` restores oldest-first order so
 * the dialog reads top-to-bottom like the conversation. `isCollectible`
 * becomes true at two or more files: one file is a normal download, two or
 * more is where offering a ZIP is worth the UI.
 */
export function selectRecentMediaBurst(
  messages: readonly MessageInfo[],
  maxGapMs: number,
): MediaBurst {
  const filtered: MessageInfo[] = []
  for (const message of messages) {
    if (message.is_from_me) continue
    if (!message.media_type) continue
    if (!message.file_length || message.file_length <= 0) continue
    filtered.push(message)
  }
  // Defensive chronological sort (oldest first). The live caller already
  // hands back a chronological array, but purity requires we not assume it.
  filtered.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))

  if (filtered.length === 0) return { files: [], isCollectible: false }

  // Walk backwards from the newest (last in ascending order), pushing each
  // message whose absolute gap to the previously-walked message is within the
  // threshold. The first gap > maxGapMs (or a NaN gap) closes the cluster.
  const reversed: MessageInfo[] = [filtered[filtered.length - 1]!]
  for (let i = filtered.length - 2; i >= 0; i--) {
    const current = filtered[i]!
    const previous = filtered[i + 1]!
    const gap = Math.abs(Date.parse(previous.timestamp) - Date.parse(current.timestamp))
    if (Number.isNaN(gap) || gap > maxGapMs) break
    reversed.push(current)
  }
  // Restore chronological (oldest first) order so the dialog reads top-to-bottom.
  const files = reversed.reverse()
  return { files, isCollectible: files.length >= 2 }
}
