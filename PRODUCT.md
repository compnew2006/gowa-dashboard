# Product

## Register

product

## Users

Operators and developers running a self-hosted [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) (gowa) server. They administer WhatsApp devices, send and receive messages, manage groups, newsletters, and channels, and wire up webhooks — usually from a desk, often alongside other tabs. They are technical: comfortable with basic auth, device IDs, WebSocket status, JIDs, and REST APIs. The job to be done is "control one or more gowa devices from a single, fast, dependable surface" — pair a device, watch it stay connected, and execute the full messaging suite (send, receive, react, delete, revoke, forward, star, manage groups and account) without leaving the browser.

The UI ships as a single self-contained HTML file that can be served by gowa, hosted on any static host, or opened directly — so it must work for someone running it next to a production server, a developer proxying to localhost, and an operator just opening the file. First-run must be self-explanatory; daily use must be fast.

## Product Purpose

gowa-ui is a web dashboard for gowa that achieves feature parity with gowa's embedded dashboard, then surpasses it. The backend stays a pure API; the UI ships separately. It exists because the embedded dashboard is a Go template app and a modern, single-file React UI is faster to navigate, easier to theme, and portable to any host.

Success looks like: an operator can pair a device, see live WebSocket state, send any message type, act on incoming messages, manage groups and account settings, and configure webhooks — all from one tab, in light or dark mode, on desktop or mobile, without thinking about the tool. Releases tag as `v*` and publish exactly one asset (`gowa-ui.html`) that gowa fetches, checksum-verifies, caches, and serves at `/`.

## Brand Personality

**Calm, precise, technical.** Three words that show up in every screen.

- **Calm** — no shouting. Motion is purposeful and rare. The palette stays restrained: a single vivid Twitter-blue primary (`oklch(0.6723 0.1606 245)` ≈ `#1d8cff` light / `#1dabff` dark), pure white and pure black surfaces, and a single live green for connection state. No gradients, no hero metrics, no decorative chrome. The interface gets out of the way of the work.
- **Precise** — every label says what will happen. Buttons are verb + object ("Delete project", not "OK"). Statuses name their state ("Connected", "Reconnecting", "Offline") rather than gesturing. Densities are chosen, not defaulted. Numbers and IDs are monospaced where it helps scanning.
- **Technical** — the user is an operator. We show device IDs, JIDs, WebSocket events, push names, webhook secrets, and TLS state plainly, in a typeface that respects them (Bricolage Grotesque for headings, Figtree for body, JetBrains Mono for code and identifiers). We never hide the system; we organize it.

Emotional goal: quiet confidence. The tool feels like something built by people who run it themselves.

## Anti-references

- **Generic SaaS dashboards.** The indigo-to-violet gradient hero, the big-number-with-tiny-label metric strip, the identical icon-heading-text card grid, the "Trusted by" logo row, the three-tier pricing table — none of it. This is an operator's tool, not a marketing demo. Identity comes from the vivid Twitter-blue brand and the technical content, not from a category template.
- As a consequence: no gradient text, no glassmorphism as default, no side-stripe accent borders, no per-section uppercase eyebrow kickers, no numbered `01 / 02 / 03` scaffolding. (These are listed in the skill's absolute bans and are not in play here.)

## Design Principles

1. **The system is the content.** Show device state, JIDs, event codes, and connection status plainly and legibly. Organize complexity; never hide it behind decoration. The UI earns trust by being transparent about what it's doing.
2. **Quiet by default, loud only when it matters.** Most of the screen is calm surface and readable type. Loudness is reserved for things that need attention right now: a device went offline, a login QR is expiring, a destructive action is one click away. Restraint is what makes the exceptions land.
3. **Precision over polish.** Labels are verbs and objects. States are named exactly. Numbers are monospaced. Empty states explain what to do next. A precise interface is faster to use than a pretty one, and over time it is also the prettier one.
4. **One surface, every device.** The device switcher is central: the operator administers multiple WhatsApp devices from one tab. Every page is scoped to the selected device, and the connection state of that device is always visible. The shell must make multi-device operation feel like a first-class act, not an afterthought.
5. **Fast and dependable above all.** The single-file build, the HashRouter that survives `file://`, the WebSocket that reconnects with backoff, the connection gate that redirects to `/connect` — these are not implementation details, they are the product. The interface must never feel slow, flickery, or lost. Loading and empty states are part of the design, not error handling.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**.

- Body text contrast ≥ 4.5:1 against its background; large text (≥18px or bold ≥14px) ≥ 3:1. Placeholder text meets the same 4.5:1 — the muted-gray-on-tinted-white default is a known failure mode and is out of bounds.
- Full keyboard navigation: every interactive element is reachable and operable, with visible focus indicators. The shadcn/ui + Radix base already provides this; preserve it on every custom control.
- `prefers-reduced-motion: reduce` is respected. The existing `.stagger` entrance and `.live-dot` pulse already disable themselves under reduced motion; every new animation must do the same.
- Icons paired with labels for primary actions (the nav and device switcher already do this); `aria-label` on icon-only buttons (e.g. the mobile menu toggle already does).
- Color is never the only signal: connection state pairs color with a word ("Connected" / "Offline") and an icon; status badges pair color with text.
- Mobile is a real surface, not a shrunk desktop. The shell already collapses the sidebar into a Sheet below `md`; every new page must work at that breakpoint.
