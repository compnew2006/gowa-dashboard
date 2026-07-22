# gowa-crm backend

A NestJS multi-tenant CRM proxy that sits in front of the [gowa](https://github.com/aldinokemal/go-whatsapp-web-multidevice) (go-whatsapp-web-multidevice) REST + WebSocket API. It adds:

- **JWT auth** for browser sessions (15-min access tokens, 7-day rotating refresh tokens with reuse detection).
- An **encrypted device vault** (AES-256-GCM) so the browser never sees gowa's Basic-Auth password.
- A **transparent reverse-proxy** (`/api/v1/proxy/**`) that injects the device credential server-side and forwards to gowa.
- A **single-use WebSocket ticket** flow so the browser doesn't put credentials in the WS URL.
- Multi-tenant Postgres schema with **Row-Level Security** + audit triggers, contacts, campaigns, and a BullMQ-backed webhook ingest.

> **Status: runnable.** This backend is independent of the gowa-ui frontend (which still talks to gowa directly). It is additive — wire the frontend to it later when you're ready to migrate.

---

## Quick start

### Prerequisites
- Node 22, npm
- Postgres 13+ (Homebrew `postgresql@14` works; `gen_random_uuid()` is built-in)
- Redis (`brew services start redis`)
- The **gowa binary** running on `http://127.0.0.1:3080` with `APP_BASIC_AUTH=admin:admin123` (see `whatsapp_9.0.0_darwin_arm64/.env`)

### Steps
```bash
cd backend

# 1. Configure env (generate secrets; defaults work for local dev)
cp .env.example .env
# then edit JWT_SECRET / JWT_REFRESH_SECRET / ENCRYPTION_MASTER_KEY:
#   openssl rand -hex 32      # for JWT_SECRET / JWT_REFRESH_SECRET
#   openssl rand -base64 32   # for ENCRYPTION_MASTER_KEY

# 2. Install
npm install

# 3. Create the DB + apply schema + RLS
npm run migrate

# 4. Seed roles, default workspace, and the admin user
npm run seed
# (uses DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD from .env)

# 5. Start gowa in another terminal (the proxy target)
cd ../whatsapp_9.0.0_darwin_arm64 && ./darwin-arm64 rest

# 6. Start the NestJS backend (watches for changes)
npm run start:dev
# -> http://127.0.0.1:4000/api/v1
```

---

## Architecture

```
Browser ──Bearer JWT──▶ NestJS :4000
                          │
            ┌─────────────┼──────────────┐
            ▼             ▼              ▼
       /auth/login   /devices        /proxy/**
       (JWT issue)   (vault CRUD)    (forward to gowa)
                          │              │
                          ▼              ▼
                     AES decrypt    Basic Auth + X-Device-Id
                          │              │
                          └──────┬───────┘
                                 ▼
                         gowa binary :3080
                       (REST + WebSocket)
```

> **Implementation note:** `/auth/*` and `/devices/*` are Nest controllers. `/proxy/**` is **raw Express middleware** mounted in `src/main.ts` on the underlying HTTP adapter (not a Nest controller). This is deliberate — Nest 10's router-explorer mishandles wildcards under a global prefix, so the catch-all is bypassed. The handler does JWT verification, vault decryption, and axios forwarding inline.

### Request flow for proxied calls
1. Browser sends `GET /api/v1/proxy/devices` with `Authorization: Bearer <jwt>` + `X-Device-Id: egypt`.
2. NestJS verifies the JWT → extracts `workspaceId`.
3. Looks up device `egypt` in the `devices` table scoped to that workspace.
4. AES-256-GCM decrypts the stored `enc_ciphertext` → recovers the gowa password.
5. Forwards to `http://127.0.0.1:3080/devices` with `Authorization: Basic <base64(admin:decrypted)>` + `X-Device-Id: egypt`.
6. Returns gowa's `{code, message, results}` envelope unchanged.

---

## API surface

### Auth (`/api/v1/auth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/login` | public | Email + password → `{accessToken}` + sets `gowa_refresh` httpOnly cookie |
| `POST` | `/register` | public | Invite a new user (assigns `Agent` role in default workspace) |
| `POST` | `/refresh` | cookie | Rotate refresh token, return new access JWT |
| `POST` | `/logout` | JWT | Revoke the token family |
| `POST` | `/ws-ticket` | JWT | Issue a 30s single-use WS ticket (`{deviceId}` body) |
| `GET`  | `/health` | public | Liveness probe |

### Devices (`/api/v1/devices`) — the NestJS-managed vault
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/` | (any authenticated) | List devices in the caller's workspace (no secrets returned) |
| `POST` | `/` | (any authenticated) | Register a device (`{deviceId, name, basicAuthUser, basicAuthPassword}` — password encrypted at rest) |
| `DELETE` | `/:deviceId` | (any authenticated) | Remove a device |

### Users (`/api/v1/users`) — admin-only
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/` | `users:manage` | List workspace users (with role) |
| `GET` | `/:id` | `users:manage` | Get one user |
| `POST` | `/` | `users:manage` | Create user (`{email, password, fullName?, roleId?}`) — defaults to `Agent` |
| `PATCH` | `/:id` | `users:manage` | Update `{fullName?, avatarUrl?, isActive?}` |
| `POST` | `/:id/role` | `users:manage` | Change role (`{roleId}`); SuperAdmin can only be granted by SuperAdmin |
| `DELETE` | `/:id` | `@Roles('SuperAdmin','Admin')` | Remove user (cannot delete yourself) |

### Contacts (`/api/v1/contacts`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/?search=&limit=&offset=` | `contacts:read` \| `contacts:manage` | Paginated list with search |
| `GET` | `/:id` | `contacts:read` \| `contacts:manage` | Get one contact |
| `POST` | `/` | `contacts:write` \| `contacts:manage` | Create (`{jid, name?, phoneNumber, email?, notes?, assignedUserId?}`) |
| `PATCH` | `/:id` | `contacts:write` \| `contacts:manage` | Update |
| `DELETE` | `/:id` | `contacts:manage` | Remove (admin only) |

### Messages ledger (`/api/v1/messages`) — read-only history
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/:jidUri?limit=&before=&after=` | `chats:read` | Paginated message history for a chat (newest-first) |
| `GET` | `/by-id/:messageId` | `chats:read` | Single message by id |
| `GET` | `/stats` | `chats:read` \| `audit:read` | `{total, inbound, outbound}` counts |

### Audit log (`/api/v1/audit`) — admin-only
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/?userId=&action=&targetType=&since=&until=&limit=&offset=` | `audit:read` | Filtered audit log (action is a prefix match: `auth.login`, `contact`, `proxy.post`, ...) |

**Permission vocabulary** (see `db/seed.ts` CORE_ROLES):
```
SuperAdmin → ['*']
Admin      → workspace:manage | users:manage | devices:admin | chats:read |
              chats:write | contacts:manage | campaigns:manage | audit:read
Manager    → devices:read | chats:read | chats:write | contacts:manage |
              campaigns:read | campaigns:write
Agent      → chats:read | chats:write | contacts:read | contacts:write
```

Apply permission gates with `@RequirePermissions('perm')` (any-of) or `@Roles('Admin')` (any-of role names). The global `RolesGuard` resolves the role's permissions per request via `PermissionsService`.

### Proxy (`/api/v1/proxy/**`) — passthrough to gowa
Any method, any path under `/proxy/`. Forwards to gowa with the decrypted Basic Auth. Examples:
- `GET /proxy/devices` → gowa `GET /devices`
- `GET /proxy/chats?limit=50` → gowa `GET /chats?limit=50`
- `POST /proxy/send/message` → gowa `POST /send/message`
- `GET /proxy/app/info` → gowa `GET /app/info`

### Webhooks (`/api/v1/webhooks`)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/` | HMAC-SHA256-signed gowa events (raw-body verified) → BullMQ queue |

### WebSocket
- Connect to `ws://127.0.0.1:4000/?ticket=<single-use-ticket>` (Socket.IO).
- The gateway validates the ticket, looks up the device's gowa creds, and opens an upstream WS to `ws://127.0.0.1:3080/ws?device_id=<jid>` with `Authorization` on the handshake header (credential never in the URL).

---

## Configuration (`.env`)

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | `postgres://<user>@localhost:5432/gowa_crm` (Homebrew trusts localhost) |
| `REDIS_URL` | yes | `redis://localhost:6379` | For WS tickets + BullMQ |
| `JWT_SECRET` | **yes (prod)** | — | HS256 signing key; `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **yes (prod)** | — | HMAC key for refresh-token hashing |
| `ENCRYPTION_MASTER_KEY` | **yes (prod)** | — | scrypt-derived into the AES vault key; `openssl rand -base64 32` |
| `DEFAULT_ADMIN_EMAIL` | yes | `admin@gowa-crm.local` | First-run admin |
| `DEFAULT_ADMIN_PASSWORD` | yes | `ChangeMe!2026` | Bcrypt-hashed (rounds=12) on seed |
| `GOWA_UPSTREAM_URL` | yes | `http://127.0.0.1:3080` | The gowa binary |
| `WEBHOOK_SECRET` | yes (prod) | `dev-webhook-secret` | Must match gowa's `--webhook-secret` |
| `CORS_ALLOWED_ORIGINS` | no | `*` | Comma-separated origins |
| `AI_INTENT_ENABLED` | no | `false` | Opt-in Gemini intent enrichment (requires `GEMINI_API_KEY`) |
| `PORT` | no | `4000` | |
| `NODE_ENV` | no | `development` | |

---

## Database

- **17 tables** defined in `src/db/schema.ts` (Drizzle ORM).
- **No `pgvector` dependency** — the original `messages_history.embedding` column was removed because (a) pgvector isn't installed and requires a Postgres restart, and (b) it fed an AI worker that called a non-existent model. Re-add it only with a real embedding pipeline.
- **RLS** (`src/db/rls.sql`): all tenant tables have `ENABLE + FORCE ROW LEVEL SECURITY` and `workspace_id`-scoped policies. The script is idempotent (`DROP POLICY IF EXISTS` + helper function).
- **Audit triggers** on `devices` and `campaigns` write to `audit_logs` via a `SECURITY DEFINER` function that reads the same session variables as the RLS policies.

### Re-run migrations
The schema DDL is re-runnable (`CREATE TABLE IF NOT EXISTS`); the RLS script is idempotent. `npm run migrate` is safe to call repeatedly. For real schema evolution, switch to `drizzle-kit generate` + a migrations folder.

---

## Verified smoke test (the proof it runs)

```text
=== Auth ===
✅ 1. Login               : 200   (real HS256 JWT, 364 chars)
✅ 2. Health (public)     : 200
✅ 3. Refresh rotation    : 200   (new access token issued)
🛡️  4. Wrong password      : 401

=== Users (admin CRUD) ===
✅ 5. List users          : 200   (with role binding)
✅ 6. Create Agent        : 201
✅ 7. Get user            : 200
✅ 8. Update user         : 200
✅ 9. Agent logs in       : 200

=== RolesGuard enforcement ===
🛡️ 10. Agent → /users     : 403  (no users:manage)
🛡️ 11. Agent → /audit     : 403  (no audit:read)
✅ 12. Agent → /contacts   : 200  (has contacts:read+write)

=== Contacts (CRUD) ===
✅ 13. Create              : 201
🛡️ 14. Duplicate jid       : 409
✅ 15. List with search    : 200
✅ 16. Update              : 200
🛡️ 17. Agent delete        : 403  (needs contacts:manage)
✅ 18. Admin delete         : 200

=== Messages ledger + Audit ===
✅ 19. Message stats       : 200
✅ 20. Messages by jid     : 200
✅ 21. Audit auth.login    : 200  (filter returns rows)
✅ 22. Audit contact.*     : 200  (trigger-driven)

=== Devices vault ===
✅ 23. Admin lists devices : 200
```

Run them yourself: `npm test` (boots NestJS, 23 tests, ~1s).

## Audit trail coverage

The `audit_logs` table records every meaningful mutation:

| Source | Trigger | Action prefix | Example |
|---|---|---|---|
| DB trigger on `devices` | `AFTER INSERT/UPDATE` | `device.mutate` | registering a device |
| DB trigger on `campaigns` | `AFTER INSERT/UPDATE` | `campaign.mutate` | creating a broadcast |
| DB trigger on `contacts` | `AFTER INSERT/UPDATE/DELETE` | `contact.mutate` | adding a CRM contact |
| DB trigger on `messages_history` | `AFTER INSERT` | `message.persisted` | webhook ingested a message |
| DB trigger on `workspace_members` | `AFTER INSERT/UPDATE/DELETE` | `workspace_member.mutate` | user-role assignment |
| `AuthController.login` | app code (best-effort) | `auth.login` | successful JWT issuance |
| `AuthController.logout` | app code (best-effort) | `auth.logout` | token family revoked |
| `main.ts` proxy middleware | app code (best-effort) | `proxy.<method>` | every POST/PUT/PATCH/DELETE forwarded to gowa |

Query it with `GET /api/v1/audit?action=<prefix>&limit=&offset=&userId=&targetType=&since=&until=`.

Encryption-at-rest verified:
```text
vault: user=admin, cipher=c3cc9b4e3a837de2..., iv=1cb8a60b6353ed51c44d3924
```
(no plaintext `admin123` in the DB)

---

## What's NOT wired (intentional)

- **The gowa-ui frontend still talks to gowa directly** (`src/lib/http.ts` + `src/lib/ws.ts` were reverted to keep the working integration). Migrating the frontend to talk to this backend is a separate, user-approved change.
- **The BullMQ GenAI pipeline** is feature-flagged off (`AI_INTENT_ENABLED=false`). It compiles but doesn't call any external AI API until you opt in.
- **The `ContactsService`** is registered but has no controller yet — its `syncContacts` / `updateReadCursorThrottled` methods are ready to be exposed when the CRM UI lands.

---

## Security notes

- Passwords hashed with **bcrypt (rounds=12)** — not the original unsalted SHA-256.
- Refresh tokens hashed with **HMAC-SHA256 keyed by `JWT_REFRESH_SECRET`** — not plain SHA-256.
- **Reuse detection**: a rotated/revoked refresh token triggers family-wide revocation.
- The device vault uses **AES-256-GCM** with a random 96-bit IV per record; the master key is scrypt-derived (lazily, not in the constructor) from `ENCRYPTION_MASTER_KEY`.
- Webhook HMAC verified over the **raw body** (not re-serialized JSON) with `timingSafeEqual` + a 5-minute replay window.
- **`FORCE ROW LEVEL SECURITY`** is set on every tenant table so even the table owner is subject to the policies.

## Known caveats
- The DB role NestJS connects as (`noiemany` on Homebrew) is a superuser-equivalent, so it bypasses RLS. For real tenant isolation, create a non-superuser app role and connect with that. The application-level `workspaceId` scoping in `DevicesService` is the actual enforcement today.
- `express` body parsing means multipart uploads (`/send/image` etc.) through the proxy will arrive as a parsed object, not a raw stream. For binary media uploads, talk to gowa directly or extend the proxy to stream multipart.
