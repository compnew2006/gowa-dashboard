# Unified Login Gate

## Summary
Today two gates coexist: the gowa Basic-Auth connection (`useConnection`) gates the whole `AppShell` and redirects to `/connect`, while the CRM JWT (`useAuthStore`) gates only `/crm/*` via `RequireAuth` -> `/login`. Per your decision, the JWT `/login` becomes the **single** gate for every route. The gowa connection stops being a routing gate and becomes an editable "Connection" panel inside `/settings`. The NestJS backend at `:4000` is assumed always running.

## Routing changes (`src/App.tsx`)
- Wrap the entire `AppShell` route group inside a single `<Route element={<RequireAuth />}>`, so every page (including `/settings` and `/crm/*`) requires the JWT.
- Remove the now-redundant inner `<Route element={<RequireAuth />}>` around the CRM routes (they become plain children).
- Remove the public `/connect` route and its `import ConnectPage`. Add `<Route path="/connect" element={<Navigate to="/settings" replace />} />` inside the gated group for backward compatibility with old links.
- `/login` stays the only public route; `*` still redirects to `/`.

## App-shell no longer gates on gowa (`src/components/layout/app-shell.tsx`)
- Delete the block `if (status !== 'connected') return <Navigate to="/connect" replace />`.
- Keep the short `status === 'booting'` spinner (avoids a flash of API errors while the stored connection re-probes).
- Add a slim, non-blocking banner above `<main>` shown when `status !== 'connected' && status !== 'booting'`: a message like "Not connected to a gowa server" with a `Link` to `/settings`. This guides first-time/unconnected users without reintroducing a second gate.

## Move the gowa connection form into Settings
- Extract the connect form (fields + `connect()` call + inline `unauthorized/unreachable/not-gowa` status messages) from `src/pages/connect.tsx` into a reusable component `src/features/session/connection-form.tsx` driven by `useConnection` (URL, username, password, Connect button, status text; no page-level `<Navigate>`).
- `src/pages/settings.tsx`: replace the current read-only "Connection" card (which only shows server/username + Disconnect) with `<ConnectionForm />`, keeping the Disconnect action and the existing "Server" (`GET /app/info`) card unchanged.
- Delete `src/pages/connect.tsx` (its route now redirects to `/settings`).

## Unified logout + identity (`src/components/layout/user-menu.tsx`)
- Source identity from `useAuthStore` (show the CRM user email / `fullName`); optionally keep the gowa `baseUrl` as a secondary muted line.
- "Log out" now ends the unified session: best-effort `logout()` from `@/api/crm/auth`, then `useAuthStore.getState().logout()`, then `navigate('/login')`. It must NOT wipe the gowa connection config (that stays as saved settings). Add `useNavigate`.

## RequireAuth polish (`src/components/auth/require-auth.tsx`)
- Update the doc comment (it now gates the whole app, not just CRM). Behavior unchanged: redirect to `/login` when `token` is null. Keep `LoginPage`'s existing post-login `navigate('/')` (which routes to `/chats`).

## Notes / invariants preserved
- No `import()`/lazy, `HashRouter`, single-file rule untouched.
- `lib/http.ts` (gowa Basic-Auth interceptor) and `lib/ws.ts` (query-string WS auth, already no-ops until connected) are unchanged — the frontend still talks to gowa directly. CRM `lib/api.ts` 401 -> `useAuthStore.logout()` now naturally bounces the user to `/login` app-wide.
- New user-facing strings go through `t()`.

## Test Plan
- `npm run typecheck`, `npm run lint`, `npm run build` (+ single-file assertion).
- Manual: logged-out visit to any route (e.g. `/chats`, `/settings`, `/crm`) redirects to `/login`; after login you land on `/chats`; `/settings` shows the editable Connection form and connecting works; unconnected state shows the banner but pages remain reachable; Log out clears JWT and returns to `/login` while the saved gowa connection persists; `/connect` redirects to `/settings`.

## Assumptions
- NestJS backend `:4000` is always available (JWT login is a hard dependency).
- Keeping the brief gowa `booting` spinner in the shell is acceptable; the gowa connection is configuration, not a gate.