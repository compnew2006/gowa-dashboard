# AGENTS.md

Workspace instructions for ZCode agents working in `gowa-ui`.

## What this is

Browser dashboard for [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) ("gowa"). The whole app compiles to **one self-contained HTML file** (no external requests) and is hosted separately from the gowa backend, which stays a pure API. Read `README.md` before touching build, routing, or release config — the single-file constraint is load-bearing.

Stack: React 19, TypeScript (`target: es2023`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), Vite 8, Tailwind CSS 4, shadcn/ui (`style: radix-nova`, `baseColor: neutral`), TanStack Query 5, Zustand 5, react-router-dom 7 (`HashRouter`), axios, sonner toasts, lucide icons.

## The 4-agent swarm (universal)

This repo ships a 4-agent orchestration pipeline (Planner → Reviewer → Builder → Auditor, coordinated by a GENERAL orchestrator) that is **stack-agnostic and MCP-optional**. It is how spec-driven changes should be made here: the Planner locks THIS stack (React 19 + TS + Vite 8 + Tailwind 4 + shadcn/ui + oxlint + vitest) from `package.json` on every run, and the rest of the swarm measures against that lock.

- **Runtime definitions**: `.zcode/agents/*.md` (the source of truth the ZCode CLI dispatches). **Human-readable mirror**: `agents/*.md` (kept in sync; same content, plus `agents/README.md` for the overview).
- **Slash commands**: `/swarm <requirement>` (full pipeline), `/plan`, `/review`, `/build`, `/audit` (single phase). Defined in `.zcode/commands/`.
- **Skill selection**: `.zcode/SKILLS_MAP.md` — skills are picked by detected stack × agent role. The 16 local skills in `.agents/skills/` override the global catalog for this repo because they are pinned to these exact versions.
- **MCP setup**: `.zcode/MCP_SETUP.md` + `.mcp.json.example`. The swarm runs with zero MCP config (falls back to native Read/Grep/Glob/Edit/Write); registering Serena + Socraticode + codebase-memory-mcp raises fidelity. Each agent states its fallback tier at the top of its output.
- **Spec output**: every change-set lives in `specs/<slug>/` (`spec.md`, `plan.md`, `tasks.md`, plus the Builder's `implementation_report.md`). The folder is the durable record from design through audit.

When working on this repo, the conventions in THIS file override the swarm's universal defaults wherever they conflict (single-file rule, `HashRouter`, no `import()`, etc.). The Planner reads this file and locks those conventions into the spec.

## Commands

```bash
npm run dev          # Vite dev server on :3000; /gowa proxies to VITE_DEFAULT_SERVER_URL (ws included)
npm run build        # tsc -b && vite build -> emits exactly one file: dist/index.html
npm run typecheck    # tsc -b  (CI runs this)
npm run lint         # oxlint  (plugins: react, typescript, oxc; rules-of-hooks=error)
npm run format       # prettier --write .   |   npm run format:check
npm run test         # vitest run  (no watch in CI)
```

Node 22 (see `.github/workflows/ci.yml`). Tests are colocated as `*.test.ts` next to the module under `src/lib` and `src/stores` (e.g. `curl.test.ts`, `url.test.ts`, `jid.test.ts`, `recipient.test.ts`).

## The single-file rule (do not break)

CI asserts `dist/` contains **exactly one file**. To keep it that way:

- **No `import()` / `React.lazy`** — code splitting breaks `vite-plugin-singlefile`.
- **No CDN scripts, remote fonts, or remote images** — everything is inlined. Fonts come from `@fontsource-variable/*` packages; the logo is a bundled `.webp` (see "Regenerating the logo" in README before touching `src/assets/`).
- **`HashRouter` only** — the output must survive `file://` and any mount path. Don't switch to `BrowserRouter`.
- `index.html` is the Vite template and the release template; the favicon is inlined as base64.

## Architecture & layer rules

There are **two independent layers** in this repo. The single-file React UI in `src/` is the load-bearing one (it ships in every release); the optional CRM proxy in `backend/` is additive and the frontend does not depend on it.

```
src/                      # The single-file React UI (ships as dist/index.html)
  api/        one module per gowa resource (send, message, chat, group, user, devices, newsletter, call, app)
              Each endpoint exports BOTH a `*Request(payload): ApiRequest` builder AND a `send*()` wrapper.
  lib/        framework-agnostic helpers (http, ws, url, jid, curl, api-error, backoff, format, events)
              + *.test.ts. No React, no Zustand imports here (except `lib/http.ts` and `lib/ws.ts`, which read from stores).
  stores/     Zustand stores: connection, device, recipient. Persisted to localStorage.
  hooks/      React hooks (use-action-mutation, use-devices, use-app-info, use-device-guard, use-device-avatar).
  components/
    ui/       shadcn/ui primitives — managed by `shadcn` CLI, don't hand-edit casually.
    shared/   cross-feature widgets (curl-dialog, result-panel, recipient-field, page-header...).
    layout/   app shell, sidebar, device switcher, theme toggle, ws badge, user menu, logo.
  features/   feature folders (send, message, messaging, chat, group, account, newsletter, call, session, devices).
              One form/widget per file. Pages compose these. `features/chat/` is the chat viewer
              (distinct from `pages/messaging.tsx`) and includes `chat-avatar.tsx` (deterministic
              colored avatar shared by the list and the conversation header).
  pages/      top-level routes mounted in App.tsx.
  App.tsx     routes + bootstrap effects (wsClient.sync, WS event -> query invalidation).
  main.tsx    providers: QueryClient, ThemeProvider (next-themes, class attr), TooltipProvider, HashRouter, Toaster.

backend/                  # OPTIONAL NestJS auth/proxy (independent of src/, runs on :4000)
              See backend/README.md for the full contract. Talks to gowa upstream on :3080.
  src/
    main.ts              bootstrap + raw Express middleware mounting the /api/v1/proxy/** catch-all
                         (Nest 10's wildcard router is broken under a global prefix — bypass it).
    app.module.ts        wires DrizzleModule (global DB provider), JwtModule, BullMQ, the global
                         JwtAuthGuard + ThrottlerGuard + HttpExceptionFilter.
    db/                  schema.ts (Drizzle; NO pgvector dep — the embedding column was dropped),
                         rls.sql (idempotent + FORCE ROW LEVEL SECURITY), db.module.ts (the
                         PostgresJsDatabase provider that every service injects), migrate.ts,
                         seed.ts (bcrypt rounds=12), tenancy.service.ts.
    modules/
      auth/              JWT (HS256, 15m access / 7d rotating refresh w/ family reuse detection),
                         AES-256-GCM credential vault (crypto.service.ts), Passport-JWT strategy,
                         /auth/login|register|refresh|logout|ws-ticket|health, ws-ticket.service.ts
                         (Redis single-use tickets for the WS gateway).
      devices/           devices.service.ts (encrypted CRUD for the device vault), devices.controller.ts,
                         proxy.interceptor.ts (legacy, kept for future handlers — the live proxy
                         is the middleware in main.ts).
      webhooks/          webhooks.controller.ts (HMAC-SHA256 over RAW body, 5-min replay window,
                         timingSafeEqual) -> BullMQ -> webhooks.processor.ts (AI enrichment
                         feature-flagged off by default; model fixed to gemini-2.0-flash).
      ws/                ws-gateway.ts (Socket.IO) — consumes the single-use ticket, opens an
                         upstream ws://gowa:3080/ws with Authorization header (no creds in URL).
    common/              @Public() decorator, @CurrentUser() param decorator, HttpExceptionFilter
                         (returns gowa-style {code,message,results} envelope), WorkspaceGuard.
```

**Hard separation rules:**

- The frontend (`src/`) MUST NOT import from `backend/`. They are separate build targets with separate `tsconfig`s and separate `package.json`s. The frontend is a browser bundle; the backend is a Node service.
- The frontend talks to gowa directly today (Basic Auth in the axios interceptor at `lib/http.ts`, query-string auth on the WS in `lib/ws.ts`). Re-routing it through `:4000` is an opt-in migration that has NOT happened yet — do not do it casually.
- The backend is not part of CI's single-file assertion. CI only builds `src/` into `dist/index.html`. The backend has its own `npm run typecheck` (`npx tsc --noEmit` inside `backend/`).

### Core Pages & Route Mappings

- **`pages/dashboard.tsx`**: Home dashboard with overall device connection metrics and QR session scanning.
- **`pages/chats.tsx`**: Conversation interface featuring a full-bleed responsive master-detail layout.
- **`pages/messaging.tsx`**: Bulk/workspace messaging playground for single-recipient quick sends and bulk target broadcasts.
- **`pages/groups.tsx`**: Groups dashboard to view, select, and interact with WhatsApp group channels.
- **`pages/account.tsx`**: User profile details retrieved from the API connection.
- **`pages/settings.tsx`**: Connection management hub — the editable Connection form (mounted from `features/session/connection-form.tsx`) for gowa server URL + basic-auth username/password with connect-on-submit and credential verification state, the Disconnect action, and the Server (`GET /app/info`) card (version, OS, media size limits). The unified login gate's connection setup lives here; the deleted `pages/connect.tsx` is gone.

**Request flow that every action form follows** (mirror it for new endpoints):

1. `src/api/<resource>.ts` builds an `ApiRequest` (`{ method: 'POST', path, json?, form? }`) via `clean()` for JSON or a `form` object for multipart. Export both `fooRequest()` (builder) and `sendFoo()` (executor).
2. `exec()` in `api/request.ts` sends via the shared axios instance and unwraps the gowa envelope `{ code, message, results }` (see `lib/http.ts` `results<T>()`).
3. Forms call `useActionMutation(sendFoo, { successMessage })` — it does the toast-on-success / toast-on-error dance. Don't re-implement mutation toasts.
4. The same `ApiRequest` is handed to `<FormActions request={...} />` (from `components/shared/curl-dialog.tsx`) so the user can copy the equivalent `curl`. **Keep the request builder and the executor sharing the same `ApiRequest`** — that's what stops the cURL view from drifting from the real call (see `lib/curl.ts`).

**Auth & device headers** are attached by the axios interceptor in `lib/http.ts`, not by callers:

- `Authorization: Basic <base64(user:pass)>` from `useConnection`.
- `X-Device-Id: <encodeURIComponent(deviceId)>` from `useDeviceStore`.
- The cURL renderer in `lib/curl.ts` mirrors these headers — if you change one, change the other.
- **Two distinct 401 paths** (do not conflate them):
  - **gowa 401** (any request through `lib/http.ts`): the response interceptor calls `useConnection.getState().markUnauthorized()`, flipping `useConnection` to `unauthorized`. There is NO redirect — pages stay reachable, and the app-shell banner surfaces "Not connected to a gowa server" until the user fixes the connection on `/settings`.
  - **CRM 401** (any request through `lib/api.ts`, the NestJS axios client): the response interceptor calls `useAuthStore.getState().logout()`, which clears the JWT. Because the unified JWT gate (`RequireAuth`) now wraps the whole `AppShell`, clearing it redirects the user to `/login`.

**WebSocket** (`lib/ws.ts`): `wsClient.sync()` reconciles the socket against `useConnection` + `useDeviceStore`. Credentials go in the **query string** (`?device_id=&authorization=`) because browsers can't set headers on `ws://`. Reconnect uses `lib/backoff.ts`. Events fan out via the tiny pub/sub in `lib/events.ts` (`onWsEvent` / `emitWsEvent`); `App.tsx` is the only subscriber that mutates query cache.

**Server URL handling** (`lib/url.ts`): `normalizeBaseUrl`, `rerootServerUrl` (re-roots server-built absolute URLs like `qr_link` onto the configured base, stripping `APP_BASE_PATH`), `toWebSocketUrl`, `sameOriginBaseUrl` (zero-config mode when gowa serves the UI itself). Read this file before changing anything that constructs URLs.

### Chat viewer feature notes (`pages/chats.tsx` + `features/chat/*`)

The chat viewer is distinct from the Messaging workspace (`pages/messaging.tsx` + `useRecipientStore`). `pages/chats.tsx` mounts `<MessageView chat={selected} />` inside a responsive master-detail layout and addresses one specific chat. Future agents must not regress these behaviours:

- **Full-bleed master-detail.** `app-shell.tsx` branches on `location.pathname === '/chats'`: `<main>` loses its padding (becomes `flex-1`) and `<Outlet/>` is wrapped in `h-[calc(100svh-3.5rem)]` instead of the centered `max-w-5xl` column every other page uses. `pages/chats.tsx` renders a single `bg-card` surface with `aside` (chat list, `w-full md:w-80 lg:w-96`, `border-r`) + `section` (conversation, `flex-1`) side-by-side. Mobile master-detail: `mobileShowConversation` state hides the aside and shows the section full-width on tap; the `md:hidden` back arrow in `MessageView`'s header (passed as `onBack`) flips it back. **Do not wrap `ChatList` or `MessageView` in padded `<Card>` divs** — that doubled the chrome and overflowed the viewport.
- **RTL & Internationalization (i18n) Styling Alignment.** The dashboard supports RTL languages (`ar`, `ur`) via the direction layout configuration tracked in the i18n store. When styling components, do not use raw `text-left` or `text-right` unilaterally on text content that needs to support internationalized flow direction. Always utilize `text-start` or `text-end`, or explicitly pair directional utility styles such as `ltr:text-left rtl:text-right` to ensure consistent visual alignment in RTL locales.
- **Message Search, Debouncing, and Instant Filtering.** To support quick, responsive message searches without overloading the backend or causing lagging input typing states:
  - Inside `MessageView`, user search query input is debounced via the `useDebounce` hook (with a 300ms delay) before being passed to `useInfiniteQuery`'s `queryKey` and request parameters as `debouncedSearch`.
  - While deep background API network calls compile or poll, an immediate in-memory synchronous filter (`filteredOrdered`) is evaluated on the reversed message list copy `ordered` to match typing instantly. The interface maps and renders over `filteredOrdered` rather than the raw `ordered` array.
- **Loading State and Spinner Resilience.** To prevent full-screen list blanking, flicker, and flash when users are typing search terms or toggle filter options:
  - **In `ChatList`**: The primary full-screen loader spinner is only displayed when `isLoading` is true AND the visible list is empty (`visibleChats.length === 0`).
  - **In `MessageView`**: The conversation-level loading spinner is only shown when `isLoading` is true AND the filtered message list is empty (`filteredOrdered.length === 0`).
- **All-Devices Mode Media Download Scoping.** In environments managing multiple connected WhatsApp sessions (the All-Devices Mode), all media export and thumbnail functions (`downloadMedia`, `useMediaExport`, `MessageMedia`, `BurstThumbnail`) must correctly route request scoping to the originating device:
  - An optional `deviceId?: string` argument is parsed by the hook and query handlers.
  - When provided, the basic client fetches passing `deviceId` assign it to the `X-Device-Id` header (via standard HTTP Basic interceptor logic), matching standard API request structures so files are compiled correctly per device.
- **Chat list infinite scroll (`features/chat/chat-list.tsx`).** `useInfiniteQuery` (`PAGE_SIZE = 50`) with `queryKey: ['chats', deviceId, { search, hasMedia }]`, polling via `refetchInterval: deviceId ? 5_000 : false`, `placeholderData: keepPreviousData`. Pages flatten via `data.pages.flatMap((p) => p.data)` and dedupe by `jid` defensively (polling can shift a chat between pages). A plain `<div ref={scrollRef} className="overflow-y-auto">` (NOT `ScrollArea` — it doesn't expose a viewport ref for `IntersectionObserver.root`) holds the list, with a 1px sentinel at the bottom observed with `rootMargin: '0px 0px 200px 0px'` to preload the next page at ~80% scroll. `getPreviousPageParam: () => undefined` (top-down, newest-first; no upward paging). No Prev/Next buttons.
- **Message ordering — newest at bottom (`features/chat/message-view.tsx`).** Messages load via `useInfiniteQuery` (`PAGE_SIZE = 50`); each page's `data` is newest-first, pages are ordered newest-page-first (page 0 = newest). `const messages = data?.pages.flatMap((p) => p.data) ?? []` flattens newest-first, then `const ordered = [...messages].reverse()` produces the chronological top-to-bottom copy the render loop maps over; the day-separator comparison reads `ordered[index - 1]`. The cached `data.pages` reference is NEVER mutated (flatMap + spread-then-reverse is mandatory). Older pages stream in via upward infinite scroll (see below) — there is no Newer/Older pager.
- **Upward infinite scroll (older messages).** An `IntersectionObserver` rooted on the scroll container watches a 1px sentinel at the TOP of the content with `rootMargin: '200px 0px 0px 0px'`. The callback is gated by `observerArmedRef` (see "anti-loop" below) plus `hasNextPage && !isFetchingNextPage`, then calls `fetchNextPage({ cancelRefetch: false })`. `getNextPageParam` walks forward by `lastPage.pagination.offset + lastPage.data.length` until that sum reaches `pagination.total`; `getPreviousPageParam: () => undefined`. Newer messages arrive via the 5s poll (`refetchInterval: 5_000`), not backwards paging. The sentinel, a loading spinner (while `isFetchingNextPage`), and a "Start of conversation" line (when `!hasNextPage && ordered.length > 0`) render above the message list. Each message wrapper carries `data-msg-id={message.id}` so the load-older anchor (below) can find it.
- **Auto-scroll — four coordinated concerns, NOT a single `messages.length` effect.** The message list is a plain `<div ref={scrollRef} className="... overflow-y-auto ...">`, NOT a `ScrollArea` (radix ScrollArea doesn't forward a viewport ref). Scroll behavior is split across refs so that prepending older pages does NOT yank the user:
  - **`stickToBottomRef`** arms on `chat.jid` change (new chat) and in `sendMutation.onSuccess` (so the invalidation refetch scrolls the just-sent message into view). A `useLayoutEffect([chat.jid, data, isLoading])` performs the instant `scrollRef.current.scrollTop = scrollRef.current.scrollHeight` ONLY when the flag is set, then clears it. **`useLayoutEffect` (not `useEffect`)** is mandatory: it runs after DOM mutation but before paint, so a re-mount with TanStack-cached data sees the fully-laid-out `scrollHeight` and lands at the bottom. Deps use `data` (the query result ref), not `ordered.length`, because cache hydration can hand back a new `data` object while the derived length stays the same. `draft` is deliberately ABSENT from the deps so the scroll doesn't fire on every keystroke.
  - **`isNearBottomRef`** is updated by an `onScroll` handler (`scrollHeight - scrollTop - clientHeight < 80`). A `useEffect([data, isLoading])` re-arms `stickToBottomRef` after each fetch/refetch (including polls) ONLY when the user was near the bottom, so a poll that arrives while the user is reading history leaves them where they are.
  - **`observerArmedRef` (anti-loop):** the observer callback short-circuits when this ref is `false`. `fetchNextPage` sets it `false` synchronously before firing; `handleScroll` re-arms it only when `scrollTop > 100` (user has scrolled down away from the top). `useEffect([chat.jid])` re-arms on chat switch. Without this, a prepend pushes the sentinel back into the viewport's top edge and `fetchNextPage` chains forever — 50 → 100 → 150 … in a death loop.
  - **Load-older anchor (`anchorIdRef`, DOM-node based):** on the `isFetchingNextPage` false→true edge, capture `ordered[0]?.id`. On the true→false edge, look up `scrollRef.current.querySelector('[data-msg-id="…"]')` (via `CSS.escape`) and set `scrollTop = anchorEl.offsetTop - clientTop`. DOM-node anchoring (not `scrollHeight` delta) is mandatory — delta drifts when media loads asynchronously and grows a bubble above the anchor after the restore. If the anchor element vanished during the fetch (rare — message deleted), skip silently.
  - **Send-success** sets `stickToBottomRef.current = true` before invalidating, so the refetch that grows `ordered.length` triggers the bottom jump regardless of prior scroll position.
- **Per-bubble Reply + React buttons.** `MessageBubble` accepts `chatJid: string`, `deviceId: string`, `onReply: (m) => void`, and `ordered: readonly MessageInfo[]`, all threaded from `MessageView` in the render loop. Reply sets local `replyTarget` state → renders a preview chip between the scroll container and the compose form → threads `reply_message_id: replyTarget?.id || undefined` into `sendText` (`clean()` drops it when empty, so no-target sends are byte-identical to before) → cleared in `onSuccess`. The same `reply_message_id` is threaded into every media send builder (`features/chat/media-preview-dialog.tsx`). React reuses `reactRequest` + `exec` + `useActionMutation` (the same trio as `features/message/message-forms.tsx`) via a `DropdownMenu` picker (Popover is NOT installed); on success it invalidates `['chat-messages', deviceId, chatJid]`. Reactions render as grouped emoji pills built by a `reactionsByEmoji` `useMemo` that produces `Map<string, ReactionInfo[]>` (the value preserves the full reaction list, NOT a count, so the tooltip can list each reactor's phone via `jidToPhone(sender_jid)`). One pill per emoji; the count is shown only when `list.length > 1`; each pill is wrapped in a `Tooltip` listing reactors. Empty reactions render nothing.
- **In-bubble reply/quote preview.** `MessageBubble` resolves the quoted target via `getReplyTargetInfo(message, ordered)` (a `useMemo`): it reads the backend's primary fields `reply_to_message_id` / `reply_to_message_text` / `reply_to_message_sender` first; if those are missing it looks up the message by id in `ordered` (so click-to-scroll works); only then does it fall back to the legacy aliases `reply_message_id` / `quoted_message_id` / `quoted_message_text` / `quoted_message_sender` (kept as defense-in-depth). When resolved, a quote box renders at the TOP of the bubble with `border-l-4 p-2 pl-2.5 text-xs`, accent color flipping with `is_from_me` (`border-primary-foreground/40` on outgoing, `border-primary/50` on incoming). Clicking it scrolls to `[data-msg-id="…"]` (via `CSS.escape`) and applies a 1.5s `animate-pulse` highlight. The backend populates the primary fields in both `CreateMessage` (receive) and `StoreSentMessageWithContext` (send) — see the gowa-cloned `AGENTS.md` "MESSAGE MODEL GAPS" section.

**Hard invariant:** `phone` is ALWAYS `chat.jid` in this file — for both `sendText` and the react payload. NEVER import `useRecipientStore` / `useRecipientJid` here; the global Messaging-workspace recipient must not leak into the chat viewer (it would silently address replies/reactions to the wrong chat).

**WebSocket invalidation for chat data.** `App.tsx`'s `onWsEvent` switch has an explicit `case 'message.event':` (and a `default` branch kept as resilience) that invalidates both `['chats']` and `['chat-messages']`. The backend emits `code: "message.event"` from `handleMessage` on BOTH the message branch and the reaction branch (`src/infrastructure/whatsapp/event_message_handler.go`, constant `WsCodeMessageEvent` in `event_message.go`) — so a reaction or new message lands in the UI within ~1s instead of waiting for the 5s `refetchInterval` poll. The WS code is the literal lowercase dotted string `'message.event'` because `lib/ws.ts` performs NO case transform on `event.code`; do not change the spelling on one side without the other. The `WsEventCode` union in `src/lib/events.ts` carries the same literal.

**Known data gaps (backend-driven, do NOT try to render these yet):** message delivery/read `status` (✓ / ✓✓ / blue ✓✓) — gowa does not return a `status` field; per-chat unread count — gowa does not return `unread_count` on `ChatInfo`. Both require backend work in `gowa-cloned/src`.

- `status`: capture receipt events in `event_receipt.go` and surface them on `MessageInfo`.
- **Reactions and reply/quote context are NO LONGER data gaps** — both render today. See "Per-bubble Reply + React buttons" and "In-bubble reply/quote preview" above for the contract.
- `unread_count`: gowa's `ChatInfo` (in `gowa-cloned/src/domains/chat/chat.go`) does not carry an unread field. The required backend change is to add a field named `UnreadCount` of type `uint32` with the JSON tag `unread_count`, populate it inside the `ListChats` path by counting message-store rows where `is_from_me` is false and the chat's per-chat last-read cursor predates the message timestamp, and expose it on the `GET /chats` response. This requires gowa to track a per-chat last-read cursor, which it does not today. The client-side fallback in place is the persisted Zustand store `src/stores/unread.ts`, keyed by `${deviceId}|${jid}`, fed by the 5s chat-list poll through `src/lib/unread-diff.ts` and `src/hooks/use-unread-bump.ts`. The selector hook `src/hooks/use-unread-count.ts` prefers the server value the moment the field appears, detected with `'unread_count' in chat`, so the badge lights up from the server with no further UI change. The in-conversation divider in `features/chat/message-view.tsx` is similarly client-driven today and clears on visibility or focus return.

## Conventions

- **Path alias**: import via `@/...` (maps to `./src/*`). Configured in `tsconfig.app.json` and `vite.config.ts`.
- **Prettier**: no semicolons, single quotes, 100 cols, `prettier-plugin-tailwindcss` (Tailwind class sorting is enforced).
- **TypeScript is strict-ish**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` (use `import type` for types), `erasableSyntaxOnly` (no TS-only runtime features like enums or parameter properties — use union types / plain objects).
- **Components**: shadcn/ui in `components/ui` (config in `components.json` — `aliases.utils = @/lib/utils`); `cn()` lives in `lib/utils.ts`. Feature widgets go in `features/*`, shared widgets in `components/shared`.
- **State**: Zustand. Persisted stores use `persist` + `createJSONStorage(() => localStorage)` and a versioned `name` (e.g. `gowa-ui.connection.v1`). Selectors should be narrow: `useConnection((s) => s.status)`.
- **Toasts**: `sonner` via `<Toaster richColors position="top-right" />` in `main.tsx`. For action results, go through `useActionMutation`; otherwise `import { toast } from 'sonner'`.
- **Naming**: files are kebab-case; React components are PascalCase; API functions are camelCase (`sendX` / `xRequest`).
- **Tests**: plain `*.test.ts` colocated with the module, run with `vitest run`. Prefer unit tests for pure helpers in `lib/` and `stores/`.

## Gotchas

- **`/gowa` dev proxy** (`vite.config.ts`): lets you develop against a gowa server without CORS support by hitting `http://localhost:5173/gowa`. The proxy target is `VITE_DEFAULT_SERVER_URL` (default `http://localhost:3000`, see `.env.example`). Don't assume the UI and gowa are same-origin in dev.
- **Zero-config mode**: when gowa serves the UI itself, `boot()` probes `sameOriginBaseUrl()` and relies on the browser replaying cached basic-auth on same-origin requests. Don't add an auth header unconditionally in that path.
- **WebSocket auth is in the query string** — only safe under TLS. Don't "fix" this by moving it to a header; browsers can't.
- **`rerootServerUrl` exists because gowa builds absolute URLs from the `Host` header**, which is wrong behind proxies. Any new server-returned URL that will be rendered as a link/image probably needs rerooting.
- **Release asset name is fixed**: every `v*` tag publishes exactly `gowa-ui.html` (+ `.sha256`). The gowa backend fetches `releases/latest` by that exact name and verifies the checksum. Don't rename it (see `.github/workflows/release.yml`).
- **CI gates**: `typecheck` + `lint` + `build` + the single-file assertion all run on every PR. Run them locally before pushing.
- **`backend/` is a runnable NestJS proxy (independent of the frontend).** It boots on `:4000` with its own JWT auth, encrypted device vault, and a `/api/v1/proxy/**` passthrough to the gowa binary. See `backend/README.md` for the full quick-start. **The gowa-ui frontend still talks to gowa directly** via the axios interceptor in `lib/http.ts` and the query-string auth in `lib/ws.ts` — that integration is the load-bearing one for the running app. Do NOT re-route the frontend through `/api/v1/*` until you explicitly decide to migrate it; the backend is additive and the two can coexist.
