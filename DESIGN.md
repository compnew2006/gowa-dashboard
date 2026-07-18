---
name: gowa-ui
description: A single-file operator's dashboard for go-whatsapp-web-multidevice — calm, precise, technical.
colors:
  # Twitter-blue primary (≈ #1d8cff light / #1dabff dark). Two committed values: vivid for both modes.
  twitter-blue: 'oklch(0.6723 0.1606 245)'
  twitter-blue-dark: 'oklch(0.6692 0.1607 245.01)'
  twitter-blue-ring: 'oklch(0.6818 0.1584 243.35)'
  # Neutrals — pure white / pure black surfaces with a faint brand-tinted ink (not warm-by-default).
  paper-white: 'oklch(1 0 0)'
  pure-black: 'oklch(0 0 0)'
  workshop-ink: 'oklch(0.1884 0.0128 248.51)'
  console-mist: 'oklch(0.9328 0.0025 228.79)'
  graphite: 'oklch(0.5 0.02 245)'
  graphite-dark: 'oklch(0.62 0.015 245)'
  pale-steel: 'oklch(0.9317 0.0118 231.66)'
  pale-steel-dark: 'oklch(0.2674 0.0047 248)'
  # Signal hues — status only, never decoration.
  signal-emerald: '#16a34a'
  signal-sky: '#0284c7'
  signal-amber: '#d97706'
  # Live WebSocket indicator (own token, greener than emerald-status).
  live-green: 'oklch(0.72 0.17 152)'
  live-green-bright: 'oklch(0.78 0.19 152)'
  # Destructive (shadcn default, kept).
  destructive: 'oklch(0.577 0.245 27.325)'
  destructive-bright: 'oklch(0.704 0.191 22.216)'
  # Chat bubbles (messaging surface).
  bubble-in: 'oklch(1 0 0)'
  bubble-out: 'oklch(0.93 0.045 245)'
typography:
  display:
    fontFamily: "'Bricolage Grotesque Variable', sans-serif"
    fontWeight: 500
    letterSpacing: '0em'
    purpose: 'H1–H3 headings only. Sets a quietly geometric, slightly humanist tone against the Figtree body.'
  body:
    fontFamily: "'Figtree Variable', sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.5'
    purpose: 'All UI text, labels, descriptions, table cells. The workhorse.'
  label:
    fontFamily: "'Figtree Variable', sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    letterSpacing: '0em'
    purpose: 'Compact UI labels: nav group headers (uppercase, tracked), badge text, table headers.'
  mono:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace"
    fontSize: '0.8125rem'
    fontWeight: 400
    purpose: 'Device IDs, JIDs, webhook secrets, event codes, push names — any identifier an operator scans.'
rounded:
  sm: 'calc(1.3rem - 4px)'
  md: 'calc(1.3rem - 2px)'
  lg: '1.3rem'
  xl: 'calc(1.3rem + 4px)'
  pill: '9999px'
spacing:
  control-tight: '0.25rem'
  control: '0.625rem'
  card-pad: '1rem'
  section-gap: '1.25rem'
components:
  button-primary:
    backgroundColor: '{colors.twitter-blue}'
    textColor: '{colors.paper-white}'
    rounded: '{rounded.lg}'
    padding: '0.625rem'
    height: '2rem'
  button-primary-hover:
    backgroundColor: 'oklch(0.6723 0.1606 245 / 80%)'
  button-outline:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.workshop-ink}'
    rounded: '{rounded.lg}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.graphite}'
    rounded: '{rounded.lg}'
  button-destructive:
    backgroundColor: 'oklch(0.577 0.245 27.325 / 10%)'
    textColor: '{colors.destructive}'
    rounded: '{rounded.lg}'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.workshop-ink}'
    rounded: '{rounded.lg}'
    height: '2rem'
    padding: '0.625rem'
  card:
    backgroundColor: '{colors.paper-white}'
    textColor: '{colors.workshop-ink}'
    rounded: '{rounded.xl}'
  badge-default:
    backgroundColor: '{colors.twitter-blue}'
    textColor: '{colors.paper-white}'
    rounded: '{rounded.pill}'
  nav-item:
    backgroundColor: 'transparent'
    textColor: '{colors.graphite}'
    rounded: '{rounded.pill}'
  nav-item-active:
    backgroundColor: '{colors.twitter-blue}'
    textColor: '{colors.paper-white}'
    rounded: '{rounded.pill}'
---

# Design System: gowa-ui

## 1. Overview

**Creative North Star: "The Instrument Panel"**

gowa-ui is a dashboard for operators running a self-hosted gowa server. The interface should read like a well-instrumented console: the system's state — which devices are connected, whether the WebSocket is live, what just happened — is always visible and always legible, and nothing decorative competes with it. Every screen is built to be scanned first and read second.

The system is **calm, precise, technical**. Calm: a single vivid Twitter-blue accent (`oklch(0.6723 0.1606 245)` ≈ `#1d8cff`), pure white and pure black surfaces, flat form, and motion that only fires on state change. No gradients, no hero metrics, no decorative chrome. Precise: compact controls (`h-8` is the default, not the small size), verb+object labels, monospaced identifiers, exactly-named states. Technical: the user is an operator, and we respect that — device IDs, JIDs, event codes, and webhook secrets are shown plainly in JetBrains Mono, never hidden behind polish.

This system explicitly rejects the generic SaaS dashboard template: no indigo-to-violet gradient heroes, no big-number-with-tiny-label metric strips, no identical icon-heading-text card grids, no glassmorphism, no side-stripe accent borders, no per-section uppercase eyebrow kickers, no `01 / 02 / 03` numbered scaffolding. Identity comes from the vivid Twitter-blue brand and the technical content, not from a category template.

**Key Characteristics:**

- **Restrained color.** One Twitter-blue primary, pure white/black neutrals, three status hues reserved for state, one live-green for the WebSocket. Nothing else carries color.
- **Compact density.** `h-8` controls, `h-5` badges, tight gaps. This is a tool operators live in, not a marketing surface.
- **Flat by default, lift on interaction.** Cards use a 1px ring at rest; shadow appears only on hover. Depth signals state, never decoration.
- **Two sans + one mono.** Bricolage Grotesque for headings, Figtree for everything else, JetBrains Mono for identifiers. Three families is the ceiling; we don't reach for a fourth.
- **Motion conveys state.** 150–250ms transitions, a staggered page entrance, a single live-dot pulse. All gated by `prefers-reduced-motion`.

## 2. Colors: The Twitter Blue + Signal Palette

A single brand hue carries the identity; three signal hues carry state; one live hue carries the WebSocket. Everything else is pure neutral — white in light mode, black in dark mode — with a faint brand-tinted ink for body text.

### Primary

- **Twitter Blue** (`oklch(0.6723 0.1606 245)` ≈ `#1d8cff`, light) / **Twitter Blue Dark** (`oklch(0.6692 0.1607 245.01)` ≈ `#1dabff`, dark): the brand accent. Primary buttons, active nav items, focus rings (`--ring` at `oklch(0.6818 0.1584 243.35)`), links, default badges, chart-1. Used on ≤10% of any given screen; its rarity is the point. Vivid and saturated (chroma 0.16) — this is a confidently-blue brand, not a muted steel.
- **Twitter Blue Ring** (`oklch(0.6818 0.1584 243.35)` ≈ `#3d99f6`): focus-ring variant, fractionally brighter and cooler so it reads against the pure-white / pure-black surfaces.

### Neutral

- **Paper White** (`oklch(1 0 0)` = `#ffffff`, light body background): the page surface. Pure white — the new theme does not tint the body toward the brand hue; identity is carried by the primary and the ink, not the surface.
- **Pure Black** (`oklch(0 0 0)` = `#000000`, dark body background): the dark-mode surface. True black, OLED-friendly, the high-contrast pair to Paper White.
- **Workshop Ink** (`oklch(0.1884 0.0128 248.51)` ≈ `#101418`, light foreground) / **Console Mist** (`oklch(0.9328 0.0025 228.79)` ≈ `#eceef1`, dark foreground): body text. Carries a faint blue tint (chroma ≤0.013) at the brand hue so the ink reads as gowa's, not as neutral gray. High contrast against their backgrounds (≥10:1 light, ≥10:1 dark).
- **Graphite** (`oklch(0.5 0.02 245)` ≈ `#566474`, light) / **Graphite Dark** (`oklch(0.62 0.015 245)` ≈ `#7e8a99`, dark): muted-foreground — secondary labels, descriptions, nav inactive, placeholder text. Deliberately re-tuned (not the pasted theme's value, which matched the foreground and lost hierarchy); verified ≥4.5:1 against Paper White and Pure Black.
- **Pale Steel** (`oklch(0.9317 0.0118 231.66)` ≈ `#dde1e6`, light border) / `oklch(0.2674 0.0047 248)` ≈ `#34373d` (dark border): hairline borders, input borders, dividers. Subtle on purpose.
- **Card White** (`oklch(1 0 0)` = `#ffffff`, light card, flush with body) / `oklch(0.2097 0.008 274.53)` ≈ `#1c1c24` (dark card): card and popover surfaces. In light mode the card sits on the same white as the body and is separated by the 1px ring, not a tonal step; in dark mode the card is one step lifted from pure black.

### Signal (status only — never decoration)

- **Signal Emerald** (`#16a34a`, Tailwind emerald-600): device `logged_in` state. Pairs the hue with the word "Logged in" — color is never the only signal.
- **Signal Sky** (`#0284c7`, Tailwind sky-600): device `connected` state.
- **Signal Amber** (`#d97706`, Tailwind amber-600): device `connecting` state, plus WebSocket `connecting` (with `animate-pulse`).
- **Live Green** (`oklch(0.72 0.17 152)` ≈ `#35c26d`, light) / **Live Green Bright** (`oklch(0.78 0.19 152)` ≈ `#33d977`, dark): the WebSocket live dot. Greener and more saturated than Signal Emerald so "live updates" reads as distinct from "device logged in". Owns the `.live-dot` pulse.

### Destructive

- **Destructive** (`oklch(0.577 0.245 27.325)` ≈ `#e7000b`, light) / `oklch(0.704 0.191 22.216)` ≈ `#ff6467` (dark): the shadcn default red, kept. Destructive buttons use a 10% tint background + full-saturation text (never a solid red button except in AlertDialog confirmations).

### Named Rules

**The One Voice Rule.** Twitter Blue is the only brand accent. It appears on primary actions, the active nav item, focus rings, links, and default badges — and nowhere else. If a second "brand-ish" color seems needed, the answer is a neutral, not a new hue.

**The Signal-Only Rule.** Signal Emerald, Signal Sky, and Signal Amber exist exclusively to encode device/WebSocket state. They never decorate cards, never tint headings, never appear in marketing-style accents. A status badge with a tinted background (`bg-emerald-500/15`) and a colored label is the only correct use.

**The Ink-Toward-Brand Rule.** Surfaces are pure white and pure black — identity is NOT carried by tinting the background (the previous blue-tinted-neutral move is retired). Instead, the body ink (`--foreground`) and the muted ink (`--muted-foreground`) carry a faint blue tint (chroma ≤0.02) at the brand hue, so the text reads as gowa's against an otherwise neutral surface. Neutrals used purely as surfaces (Paper White, Pure Black, Card White) stay at chroma 0.

## 3. Typography

**Display Font:** Bricolage Grotesque Variable (sans-serif fallback)
**Body Font:** Figtree Variable (`sans-serif` fallback)
**Mono Font:** JetBrains Mono Variable (`ui-monospace, monospace` fallback)

**Character:** A quietly geometric display face against a workhorse humanist sans. Bricolage Grotesque gives headings a slight humanist warmth without going decorative; Figtree carries everything else with even color and open counters. The pairing reads as "a tool made by people who care," not as "a font flex." JetBrains Mono earns its place by making identifiers scannable — a device ID in mono is faster to verify than the same ID in proportional type.

### Hierarchy

- **Display** (Bricolage Grotesque, weight 500, page H1, ~`text-2xl`/`1.5rem`, `leading-snug`): page titles ("Devices", "Messaging", "Groups"). One per page, top-left.
- **Headline** (Bricolage Grotesque, weight 500, card titles, `text-base`/`1rem`, `leading-snug`): card and dialog titles. The `font-heading` class is applied via `h1, h2, h3 { @apply font-heading }` in `index.css`.
- **Title** (Figtree, weight 500, `text-sm`/`0.875rem`): section labels, list-item primary text, form-field group headings.
- **Body** (Figtree, weight 400, `text-sm`/`0.875rem`, `leading-1.5`): descriptions, table cells, dialog body copy, form helper text. Prose line length is naturally capped by the `max-w-5xl` page container; long-form prose would target 65–75ch but rarely appears in this product.
- **Label** (Figtree, weight 500, `text-xs`/`0.75rem`): nav group headers (`tracking-wider uppercase`, the only intentional eyebrow and reserved for nav grouping), badge text, table headers, compact metadata.
- **Mono** (JetBrains Mono, weight 400, `text-sm`/`0.875rem` → `0.8125rem` for tight identifier rows): device IDs, JIDs, webhook secrets, event codes, push names. Apply via `font-mono`.

### Named Rules

**The Mono-for-Identifiers Rule.** Anything an operator might copy, compare, or scan — a device ID, a JID, a webhook secret, an event code, a push name — is set in JetBrains Mono. Proportional type is for prose and labels; mono is for data the user verifies.

**The No-Fluid-Type Rule.** Product UI holds a fixed rem scale. No `clamp()` on headings. Users view at consistent DPI, and a fluid H1 that shrinks in a sidebar looks worse, not better. The only responsive type move is structural: collapse the sidebar into a Sheet below `md`.

**The Uppercase-Eyebrow Reservation Rule.** The `tracking-wider uppercase` treatment is reserved for nav group headers ("Overview", "Messaging", "Directory", "System") — a single deliberate system, not a per-section reflex. Do not add uppercase eyebrows above page sections, card groups, or form fieldsets.

## 4. Elevation

**Flat by default, lift on interaction.** This system does not use shadows as ambient decoration. Cards, inputs, and popovers read as surfaces through background tone and a 1px ring — not through drop shadows. Depth appears only as a response to state: a card lifts on hover, a popover sits above content via a tonal step plus the ring.

### Shadow Vocabulary

- **Resting:** none. Cards use `ring-1 ring-foreground/10` (a 1px ring at 10% foreground opacity), not a shadow.
- **Hover lift** (`.card-lift` utility: `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`): the only place `shadow-md` appears. A 2px upward translate plus Tailwind's `shadow-md`. Reserved for genuinely interactive cards (e.g. a device card you can click to select).
- **Popover/Dialog:** shadcn defaults carry a subtle shadow via Radix; this is acceptable because it encodes "this floats above content," not decoration.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. A card with both a 1px border AND a soft wide drop shadow (≥16px blur) is the codex ghost-card tell and is prohibited — pick the ring or a small (≤8px) shadow, never both as decoration.

**The Depth-Means-State Rule.** When you reach for a shadow, ask what state it encodes. Hover, elevation, focus — valid. "Looks nice" — not valid. If the answer is decoration, use tone or the ring instead.

## 5. Components

Every component leads with shape, then color assignment, then states. The whole vocabulary is shadcn/ui (`radix-nova` style) on Radix primitives; preserve it on custom controls.

### Buttons

- **Shape:** confidently rounded (`rounded-lg` = `1.3rem` ≈ `20.8px`), compact (`h-8` default, `h-7` small, `h-9` large). The new theme's larger radius is intentional — buttons, inputs, and cards all share the rounder vocabulary. Buttons cap at `rounded-lg`; cards go to `rounded-xl`.
- **Primary** (`button-primary`): Twitter Blue bg, Paper White text, `text-sm font-medium`, `px-2.5`. Hover dims to 80% (`hover:bg-primary/80`) — a subtle state change, not a gradient. Focus: `ring-3 ring-ring/50` + `border-ring`.
- **Outline** (`button-outline`): Pale Steel border on Paper White bg; hover shifts to Console Mist bg. The default non-primary action.
- **Ghost** (`button-ghost`): transparent; hover shifts to Console Mist. Used in toolbars and icon buttons (theme toggle, mobile menu, device-card menu).
- **Destructive** (`button-destructive`): 10% Destructive tint bg + full Destructive text — never a solid red button outside AlertDialog confirmations. Hover deepens to 20% tint.
- **Link** (`button-link`): Twitter Blue text, underline on hover.
- **Icon buttons** (`size="icon"` → `size-8`): ghost variant, square. Always paired with `aria-label` (see theme-toggle, mobile menu).
- **Sizes:** `xs` (`h-6`), `sm` (`h-7`), default (`h-8`), `lg` (`h-9`), plus `icon-xs/sm/lg`. The default IS the size; reach for `lg` only on connection/CTA moments (the connect form's submit).

### Badges

- **Shape:** full pill (`rounded-4xl`), compact (`h-5`, `px-2`, `text-xs`).
- **Default:** Twitter Blue bg + Paper White text.
- **Secondary:** Console Mist-tinted bg, used as the base for status badges.
- **State Badge pattern** (`StateBadge`): `variant="secondary"` overridden with a signal-hue tint — `bg-emerald-500/15 text-emerald-600` for logged_in, sky for connected, amber for connecting, muted for disconnected. Always paired with the plain-word label ("Logged in", "Connected", "Connecting", "Disconnected").
- **Destructive:** 10% red tint + red text (mirrors the destructive button).

### Cards / Containers

- **Corner:** `rounded-xl` (≈ `1.556rem` ≈ `24.9px`, = `--radius` + 4px) — the largest radius in the system. Cards and nothing else.
- **Background:** Card White (light, flush with the Paper White body — separated by the ring, not a tonal step) / `oklch(0.2097 0.008 274.53)` (dark, one step lifted from Pure Black).
- **Border/ring:** `ring-1 ring-foreground/10` — no shadow at rest.
- **Padding:** `--card-spacing: 1rem` default, `0.75rem` for `size="sm"`. Header/content share the horizontal padding; footer adds a top border + `bg-muted/50`.
- **No nested cards.** A card inside a card is always wrong; use a tonal panel or plain div.

### Inputs / Fields

- **Shape:** `rounded-lg`, `h-8` (matches buttons), full-width, `px-2.5 py-1`.
- **Style:** Pale Steel border, transparent bg, `text-base` on mobile → `md:text-sm` (prevents iOS zoom).
- **Focus:** `border-ring` + `ring-3 ring-ring/50`. No glow, no color shift — the ring is the signal.
- **Error:** `aria-invalid` swaps border to Destructive + adds `ring-3 ring-destructive/20`.
- **Disabled:** `bg-input/50`, `pointer-events-none`, `opacity-50`.

### Navigation

- **Sidebar:** `w-60`, Sidebar-tinted bg (one step lifted from body), `border-r`. Collapses into a left `Sheet` below `md`.
- **Nav item:** `rounded-full` pill (the only pill outside badges), `px-3 py-2`, `text-sm font-medium`, Graphite inactive text. Hover: `bg-sidebar-accent/50`. Active: Twitter Blue-tinted accent bg + accent-foreground text.
- **Nav group header:** `text-[11px] font-medium tracking-wider uppercase text-muted-foreground` — the reserved eyebrow treatment, one per group.
- **Top bar:** `h-14`, `border-b`, holds mobile menu + logo (mobile), device switcher, WsBadge, theme toggle.

### WsBadge (signature)

A 10px (`size-2.5`) dot in the top bar that encodes WebSocket state: Live Green + `.live-dot` pulse when connected, Signal Amber + `animate-pulse` when connecting, muted-gray/40 when offline. Wrapped in a Tooltip with the plain-word label ("Live updates connected"). The single most important indicator in the shell — it tells the operator whether what they're seeing is current.

### StateBadge (signature)

The semantic-status pattern used across device cards, session dialogs, and anywhere device/WebSocket state appears. Secondary badge + signal-hue tint + plain-word label. Color is never the only signal: the word always travels with the hue.

### DeviceCard (signature)

The primary unit of the dashboard. Avatar + push name (mono ID) + StateBadge + a `...` menu of mutations (login QR, login code, reconnect, logout, webhook, delete). Selecting it scopes the whole app to that device. Delete is gated behind an `AlertDialog`. Embodies the "one surface, every device" principle from PRODUCT.md.

### ThemeToggle

A single ghost icon button in the top bar that flips between light and dark. Reads `resolvedTheme` from `next-themes` (not `theme`, so a user in `system` mode still toggles against the actually-rendered theme) and calls `setTheme(isDark ? 'light' : 'dark')`. Same Sun/Moon cross-fade icon pair as the original 3-way dropdown, but the dropdown is gone — the full Light/Dark/System picker still lives on the Settings page (`src/pages/settings.tsx`) for users who want auto-following OS theme. `aria-label` dynamically announces "Switch to light theme" / "Switch to dark theme". The full 3-way dropdown is intentionally not in the shell — it was overkill for a quick flip and the system option is a set-once preference, not a daily toggle.

### ChatViewer (signature)

The messenger surface at `/chats`, distinct from the Messaging workspace. Two panes inside a single `bg-card rounded-xl border` shell that fills the full main area (no `max-w-5xl` centered column, no outer padding — `app-shell.tsx` special-cases `/chats` so the layout owns the whole viewport below the top bar). A `border-r` divider separates them.

- **List pane** (`aside`, `w-full md:w-80 lg:w-96`): sticky filter header (recessed `bg-muted/40` search input + `text-xs` "With media only" toggle) → plain `overflow-y-auto` list of rows (NOT `ScrollArea` — it doesn't expose a viewport ref for `IntersectionObserver.root`) → single muted footer line `{loaded} of {total} chats`. Each row: `<ChatAvatar>` + two-line body (name + timestamp-or-JID). Selected row = full `bg-accent text-accent-foreground` tint, no side-stripe. Infinite scroll: 50 per page, 200px bottom `rootMargin` preloads next page at ~80% scroll.
- **Conversation pane** (`section`, `flex-1`): avatar header (`<ChatAvatar size="sm">` + name + mono JID + `<ChatControls>`), optional mobile back arrow (`md:hidden`, only when `onBack` is passed), recessed search + "Media only" filter row, then the message scroll surface (`bg-muted/30`, no inner border — the outer `bg-card` shell already provides chrome), then the reply preview chip (context chip with `border-l-2 border-primary` — the sanctioned exception to the side-stripe ban; side-stripes on cards/list-items/callouts are still banned), then the compose bar. No Newer/Older pager — older messages load via upward infinite scroll.
- **ChatAvatar** (`features/chat/chat-avatar.tsx`): circular disc, single initial, deterministic hue from a 6-stop brand-harmonized palette (L/C held roughly constant, only hue varies). Used by both the list rows (`size="md"`) and the conversation header (`size="sm"`), so chat identity is visually consistent across panes.
- **Message bubbles:** `rounded-2xl` + a single tail corner (`rounded-br-sm` outgoing, `rounded-bl-sm` incoming), `bg-bubble-out` / `bg-bubble-in` (the brand tokens). Group reactions into per-emoji pills with counts (`Map<string, number>`), never a joined string. Hover-only Reply + React buttons.
- **Mobile master-detail:** tapping a chat sets `mobileShowConversation` → the aside hides and the section fills the width. The mobile back arrow in the conversation header clears it. Desktop (md+) ignores the flag; both panes are always visible.

## 6. Do's and Don'ts

### Do:

- **Do** use Twitter Blue (`oklch(0.6723 0.1606 245)` light / `oklch(0.6692 0.1607 245.01)` dark) as the single brand accent, on ≤10% of any screen: primary buttons, active nav, focus rings, links, default badges.
- **Do** keep surfaces pure (Paper White / Pure Black) and carry the brand tint in the ink (`--foreground`, `--muted-foreground` at chroma ≤0.02 toward hue 245). Identity lives in the primary and the ink, not in a tinted background.
- **Do** set device IDs, JIDs, webhook secrets, event codes, and push names in JetBrains Mono. An identifier in proportional type is a missed scan.
- **Do** pair every status color with a plain-word label. StateBadge and WsBadge are the templates: "Logged in" + emerald, "Live updates connected" + live-green.
- **Do** keep controls compact: `h-8` buttons and inputs, `h-5` badges, `text-sm` body. The default size IS the size.
- **Do** gate every animation behind `@media (prefers-reduced-motion: reduce)`. The `.stagger`, `.live-dot`, and `.card-lift` utilities already do this; new ones must too.
- **Do** convey depth with the 1px ring (`ring-1 ring-foreground/10`) and background tone first, shadows only on hover.
- **Do** label icon-only buttons with `aria-label` (theme toggle: "Toggle theme", mobile menu: "Open navigation").
- **Do** write verb+object button labels: "Delete device", "Reconnect", "Copy cURL", not "OK" or "Yes".

### Don't:

- **Don't** use the generic SaaS dashboard template — no indigo-to-violet gradient heroes, no big-number-with-tiny-label metric strips, no identical icon-heading-text card grids. (Directly from PRODUCT.md's anti-references.)
- **Don't** apply gradient text (`background-clip: text` + gradient), glassmorphism, or side-stripe accent borders (`border-left > 1px` as a colored stripe). These are absolute bans.
- **Don't** add a `tracking-wider uppercase` eyebrow above every section. That treatment is reserved for nav group headers.
- **Don't** pair a 1px border with a ≥16px-blur drop shadow on the same element. That's the ghost-card tell — pick the ring or a small (≤8px) shadow, not both.
- **Don't** round cards past `rounded-xl` (= `--radius` + 4px ≈ 24.9px). The token scales as a system; reaching for an ad-hoc larger radius on one card breaks the vocabulary. Full-pill is for badges and nav items only.
- **Don't** use a second "brand-ish" color when Twitter Blue feels tired. The answer is a neutral or a Signal hue, not a new accent.
- **Don't** use color as the only signal for state. A green dot alone is inaccessible; a green dot + "Connected" label is correct.
- **Don't** use Signal hues (emerald/sky/amber) for decoration. They encode device/WebSocket state and nothing else.
- **Don't** put a card inside a card. Use a tonal panel or a plain div.
- **Don't** use a display font (Bricolage Grotesque) in UI labels, buttons, or data. Display is for H1–H3 only.
- **Don't** add orchestrated page-load choreography. The `.stagger` entrance is the one permitted entrance and it's subtle; users load into a task, they don't want to watch the page assemble.
