/**
 * Split a message body into a flat list of text and link tokens so the chat
 * viewer can render `https?://` URLs as anchors while leaving plain prose alone.
 *
 * The contract is behavioural, not the regex literal: every assertion in
 * `linkify.test.ts` must hold. The two load-bearing decisions are (1) the URL
 * boundary is the `https?://` prefix — never a bare domain — because bare-domain
 * detection false-positives on version strings, IPs, and filenames; and (2) the
 * link's `value` and `href` are the same verbatim source substring, so the text
 * renders exactly as the user typed it and the anchor points where it claims.
 *
 * The body class is deliberately permissive (any non-whitespace, non-quote,
 * non-angle-bracket character) so it tolerates query strings, fragments, ports,
 * and parenthesised path segments like Wikipedia disambiguators. A two-step trim
 * then strips sentence-terminal punctuation (`. , ; : ! ?`) and any trailing
 * closing bracket that does not have a matching opener inside the run, so a URL
 * that ends a sentence does not swallow the period and a URL wrapped in prose
 * parens does not keep the closing paren.
 */

export type MessageTextToken =
  { kind: 'text'; value: string } | { kind: 'link'; value: string; href: string }

const URL_RE = /https?:\/\/[^\s"'<>`]+/g

/**
 * Strip trailing punctuation the regex greedily swallowed. Sentence terminals
 * (`. , ; : ! ?`) are always removed; a trailing `)`, `]`, or `}` is removed
 * only when there is no matching opener inside the run, so a balanced pair such
 * as `URL_(disambiguation)` survives intact while a prose-wrapping paren drops.
 */
function trimTrailingPunctuation(run: string): string {
  let out = run
  // Drop a single trailing sentence-terminal character. These are never part of
  // a well-formed URL suffix, so stripping unconditionally matches what users
  // expect when a URL ends a sentence ("See https://example.com.").
  if (/[.,;:!?]$/.test(out)) {
    out = out.slice(0, -1)
  }
  // Drop a trailing closing bracket only when it has no matching opener inside
  // the (already punctuation-trimmed) run. A balanced Wikipedia-style URL keeps
  // its parens; an unbalanced prose-paren wraps off.
  if (/[)\]}]$/.test(out)) {
    const opener = out[out.length - 1] === ')' ? '(' : out[out.length - 1] === ']' ? '[' : '{'
    if (!out.includes(opener)) {
      out = out.slice(0, -1)
    }
  }
  return out
}

/**
 * Tokenize `text` into alternating `text` and `link` tokens. Returns `[]` for
 * empty input and `[{ kind: 'text', value: text }]` when there is no URL match
 * (the hot path — most messages are plain prose and must not allocate more than
 * one token). Zero-length gaps between adjacent URLs are kept in the array as
 * `text` tokens with `value === ''` so the renderer can skip them with `null`.
 */
export function tokenizeMessageText(text: string): MessageTextToken[] {
  if (text === '') return []

  const tokens: MessageTextToken[] = []
  let lastEnd = 0
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const raw = match[0]
    const url = trimTrailingPunctuation(raw)
    const matchEnd = match.index + url.length
    const lead = text.slice(lastEnd, match.index)
    tokens.push({ kind: 'text', value: lead })
    if (url.length > 0) {
      tokens.push({ kind: 'link', value: url, href: url })
      lastEnd = matchEnd
    } else {
      // The match collapsed entirely under trimming. Advance past the raw match
      // so the loop terminates, but emit nothing — there is no URL to render.
      lastEnd = match.index + raw.length
    }
  }

  if (tokens.length === 0) {
    // No URL matched at all — return the input as a single text token.
    return [{ kind: 'text', value: text }]
  }

  tokens.push({ kind: 'text', value: text.slice(lastEnd) })
  return tokens
}
