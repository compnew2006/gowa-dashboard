# AGENTS.md

Workspace instructions for ZCode agents working in `gowa-ui`.

## What this is

Browser dashboard for [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) ("gowa"). The whole app compiles to **one self-contained HTML file** (no external requests) and is hosted separately from the gowa backend, which stays a pure API. Read `README.md` before touching build, routing, or release config — the single-file constraint is load-bearing.

Stack: React 19, TypeScript (`target: es2023`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), Vite 8, Tailwind CSS 4, shadcn/ui (`style: radix-nova`, `baseColor: neutral`), TanStack Query 5, Zustand 5, react-router-dom 7 (`HashRouter`), axios, sonner toasts, lucide icons.

## Commands

```bash
npm run dev          # Vite dev server on :5173; /gowa proxies to VITE_DEFAULT_SERVER_URL (ws included)
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

```
src/
  api/        one module per gowa resource (send, message, chat, group, user, devices, newsletter, call, app)
              Each endpoint exports BOTH a `*Request(payload): ApiRequest` builder AND a `send*()` wrapper.
  lib/        framework-agnostic helpers (http, ws, url, jid, curl, api-error, backoff, format, events)
              + *.test.ts. No React, no Zustand imports here (except `lib/http.ts` and `lib/ws.ts`, which read from stores).
  stores/     Zustand stores: connection, device, recipient. Persisted to localStorage.
  hooks/      React hooks (use-action-mutation, use-devices, use-app-info, use-device-guard, use-device-avatar).
  components/
    ui/       shadcn/ui primitives — managed by `shadcn` CLI, don't hand-edit casually.
    shared/   cross-feature widgets (curl-dialog, result-panel, recipient-field, page-header...).
    layout/   app shell, sidebar, device switcher, theme toggle, ws badge, logo.
  features/   feature folders (send, message, messaging, chat, group, account, newsletter, call, session, devices).
              One form/widget per file. Pages compose these.
  pages/      top-level routes mounted in App.tsx.
  App.tsx     routes + bootstrap effects (wsClient.sync, WS event -> query invalidation).
  main.tsx    providers: QueryClient, ThemeProvider (next-themes, class attr), TooltipProvider, HashRouter, Toaster.
```

**Request flow that every action form follows** (mirror it for new endpoints):

1. `src/api/<resource>.ts` builds an `ApiRequest` (`{ method: 'POST', path, json?, form? }`) via `clean()` for JSON or a `form` object for multipart. Export both `fooRequest()` (builder) and `sendFoo()` (executor).
2. `exec()` in `api/request.ts` sends via the shared axios instance and unwraps the gowa envelope `{ code, message, results }` (see `lib/http.ts` `results<T>()`).
3. Forms call `useActionMutation(sendFoo, { successMessage })` — it does the toast-on-success / toast-on-error dance. Don't re-implement mutation toasts.
4. The same `ApiRequest` is handed to `<FormActions request={...} />` (from `components/shared/curl-dialog.tsx`) so the user can copy the equivalent `curl`. **Keep the request builder and the executor sharing the same `ApiRequest`** — that's what stops the cURL view from drifting from the real call (see `lib/curl.ts`).

**Auth & device headers** are attached by the axios interceptor in `lib/http.ts`, not by callers:
- `Authorization: Basic <base64(user:pass)>` from `useConnection`.
- `X-Device-Id: <encodeURIComponent(deviceId)>` from `useDeviceStore`.
- The cURL renderer in `lib/curl.ts` mirrors these headers — if you change one, change the other.
- A 401 from anywhere flips `useConnection` to `unauthorized`, which routes the user to `/connect`.

**WebSocket** (`lib/ws.ts`): `wsClient.sync()` reconciles the socket against `useConnection` + `useDeviceStore`. Credentials go in the **query string** (`?device_id=&authorization=`) because browsers can't set headers on `ws://`. Reconnect uses `lib/backoff.ts`. Events fan out via the tiny pub/sub in `lib/events.ts` (`onWsEvent` / `emitWsEvent`); `App.tsx` is the only subscriber that mutates query cache.

**Server URL handling** (`lib/url.ts`): `normalizeBaseUrl`, `rerootServerUrl` (re-roots server-built absolute URLs like `qr_link` onto the configured base, stripping `APP_BASE_PATH`), `toWebSocketUrl`, `sameOriginBaseUrl` (zero-config mode when gowa serves the UI itself). Read this file before changing anything that constructs URLs.

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
