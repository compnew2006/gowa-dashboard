// Deterministic colored avatar: a single initial on a tinted disc, where the
// hue is picked from a small brand-harmonized palette by hashing the name.
// L/C are held roughly constant (matching the steel-blue brand tokens), so the
// six stops read as a family rather than a rainbow.

const AVATAR_HUES = [225, 260, 200, 30, 330, 152]

function pickHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]!
}

export function ChatAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const hue = pickHue(name || '?')
  const initial = (name || '?').trim().slice(0, 1).toUpperCase() || '?'

  const dimension =
    size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm'

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold select-none ${dimension} ${className ?? ''}`}
      style={{
        // Light-on-dark-safe tinted disc. Background uses the brand's muted
        // chroma band; text sits at the foreground L for guaranteed contrast.
        backgroundColor: `oklch(0.92 0.04 ${hue})`,
        color: `oklch(0.34 0.06 ${hue})`,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}
