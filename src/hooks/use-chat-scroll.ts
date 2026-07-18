import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Toggles the `is-scrolling` class on a `.chat-scroll` container so the
 * polished scrollbar (see `index.css`) reveals its thumb only while the user
 * is actually scrolling, and fades it back to transparent a moment after
 * scrolling stops. The `:hover` reveal in the CSS covers the pointer-inside
 * case; this hook covers the keyboard / wheel / trackpad-inertia case.
 *
 * Kept deliberately tiny and side-effect-only: it does not touch scroll
 * position, does not interfere with the `IntersectionObserver`-driven infinite
 * scroll the chat surfaces already own, and reuses the existing ref so no new
 * DOM node is introduced.
 *
 * @param ref  the scroll container (the element carrying `.chat-scroll`)
 * @param deps optional extra deps that re-bind the listener when the container
 *             swaps (e.g. chat switch in the message view)
 */
export function useChatScroll(
  ref: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown> = [],
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      el.classList.add('is-scrolling')
      clearTimeout(timer)
      timer = setTimeout(() => el.classList.remove('is-scrolling'), 600)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
