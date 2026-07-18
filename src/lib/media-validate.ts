import { classifyMedia } from '@/lib/media-classify'

/**
 * 16 MiB cap, matching WhatsApp's documented document limit and the Vue
 * reference. The compose affordance is for quick attachment, not for the full
 * Send suite; the per-type (`max_image_size`, `max_video_size`) limits from
 * `useAppInfo()` can override this via the `limits.maxBytes` argument when the
 * caller has them, but this constant is the fallback the unit tests pin and
 * the value the picker uses when `useAppInfo` is not yet loaded.
 */
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export interface MediaLimits {
  maxBytes: number
}

/**
 * Validate a picked file before the preview dialog opens. Two checks, in
 * order:
 *
 * 1. Size: `file.size` must be `<= limits.maxBytes`. The default cap is the
 *    16 MiB constant above; the caller passes a smaller value from
 *    `useAppInfo()` when it has loaded per-type limits. Verb+object rejection
 *    copy: "File too large".
 * 2. Type: the file's MIME must classify to one of the four buckets
 *    (`image/*`, `video/*`, `audio/*`, or anything `classifyMedia` falls
 *    through to `/send/file`). Because `classifyMedia` is deliberately
 *    permissive (empty and unknown MIME both return `'file'`), this check is
 *    currently a no-op future-hook — kept as an explicit step so a tighter
 *    allow-list can land here without reshaping the API. The verb+object
 *    copy is "Unsupported file type" if a future revision rejects.
 *
 * The function is pure (no React, no toast) so it is unit-testable; the call
 * site in `message-view.tsx` is what surfaces `{ ok: false, reason }` via
 * `toast.error`. Rejection NEVER opens the preview dialog.
 */
export function validateMediaFile(file: File, limits: MediaLimits): ValidationResult {
  if (file.size > limits.maxBytes) {
    return { ok: false, reason: 'File too large' }
  }
  // Classification is permissive by design (see media-classify.ts). Touching
  // the classifier here keeps the validator and the picker in lock-step: if
  // a future revision tightens the allow-list, this is the single seam.
  classifyMedia(file)
  return { ok: true }
}
