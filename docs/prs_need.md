# Upstream PRs needed (gowa backend)

This file tracks backend bugs in [`aldinokemal/go-whatsapp-web-multidevice`](https://github.com/aldinokemal/go-whatsapp-web-multidevice) ("gowa") that cannot be fixed from this repo (`gowa-ui`) and require an upstream pull request. Each entry documents the symptom the UI sees, the precise backend location, the root cause, the proposed fix, and the UI-side workaround currently shipping (if any).

Entries:
- **PR 1** — `DownloadMedia` does not scope its message lookup by `device_id` (UI workaround shipping).
- **PR 2** — Quoted-reply context is never persisted or surfaced (no UI workaround possible — data missing).
- **PR 3** — Message reactions do not round-trip into `GET /chat/:jid/messages` (no UI workaround possible — data missing).

The UI workaround (when one exists) keeps the dashboard usable today; the upstream PR removes the root cause so the workaround can eventually be deleted.

---

## PR 1 — Scope `DownloadMedia`'s message lookup by device_id

### Status

- **Open** (not yet filed as of 2026-07-21).
- **UI workaround shipping**: `src/api/message.ts` `downloadMedia()` retries once with `?phone=<deviceId>` on the specific `does not belong to chat` envelope string. See `specs/fix-file-send-bubble-error/followup-download-fallback.md` for the full investigation.

### Symptom (what the user sees)

When a user with **linked / companion WhatsApp devices** (e.g. two phones paired to the same account, or a phone + WhatsApp Web) sends a document, image, video, or audio file from the chat viewer:

1. The file is delivered to the recipient correctly — no send failure.
2. The `/message/<id>/download` endpoint returns a non-2xx envelope whose `message` field is the literal string:
   ```
   message <MESSAGE_ID> does not belong to chat <CHAT_JID>
   ```
3. The chat viewer's inline media renderer (`src/features/chat/message-media.tsx`) used to paint that raw string verbatim inside the outgoing bubble, making it look like the send had failed.

### Precise backend location

- File: `src/usecase/message.go`
- Function: `serviceMessage.DownloadMedia`
- Line: **87** (as of `main` on 2026-07-21)

```go
// Query the message from chat storage
message, err := service.chatStorageRepo.GetMessageByID(request.MessageID)
```

The attribution check at line 296 then fails:

```go
// Verify the message is from the specified chat
if message.ChatJID != dataWaRecipient.String() {
    return response, fmt.Errorf("message %s does not belong to chat %s", request.MessageID, dataWaRecipient.String())
}
```

### Root cause (proven from a real user database)

Direct inspection of the user's `chatstorage.db` for three failing message ids (`3EB020B0AC3178E36F5CF8`, `3EB08D23D06C9090996317`, `3EB0F9D0782FA7BC344190`) shows the same shape every time — **two rows per message id**:

```
id                       chat_jid                       device_id                       is_from_me
3EB0F9D0782FA7BC344190   201007181781@s.whatsapp.net    966561853319@s.whatsapp.net     0
3EB0F9D0782FA7BC344190   966561853319@s.whatsapp.net    201007181781@s.whatsapp.net     1
```

The `messages` table's primary key is `(id, chat_jid, device_id)`. When the user pairs `966561853319` and `201007181781` as linked devices on the same WhatsApp account, every message is stored twice — once per device's perspective.

`GetMessageByID(id)` (in `src/infrastructure/chatstorage/sqlite_repository.go:88`) does `WHERE id = ? LIMIT 1` with **no device filter**:

```go
func (r *SQLiteRepository) GetMessageByID(id string) (*domainChatStorage.Message, error) {
	query := `
		SELECT id, chat_jid, device_id, sender, content, timestamp, is_from_me, ...
		FROM messages
		WHERE id = ?
		LIMIT 1
	`
	message, err := r.scanMessage(r.db.QueryRow(query, id))
	...
}
```

SQLite's `LIMIT 1` against the primary-key index returns whichever row it scans first — non-deterministically. The attribution check then fails ~50% of the time, surfacing the misleading envelope string.

The repository already has a perfectly good device-scoped variant right next to it (`sqlite_repository.go:108`):

```go
func (r *SQLiteRepository) GetMessageByIDAndDevice(deviceID, id string) (*domainChatStorage.Message, error) {
	query := `
		SELECT id, chat_jid, device_id, sender, content, timestamp, is_from_me, ...
		FROM messages
		WHERE id = ? AND device_id = ?
		LIMIT 1
	`
	...
}
```

…and the usecase has `deviceIDFromContext(ctx)` available (used elsewhere in the codebase, e.g. `src/usecase/send.go:97` for reply-context lookup). The `DownloadMedia` REST handler (`src/ui/rest/message.go`) already propagates the device into context via `whatsapp.ContextWithDevice(c.Context(), getDeviceFromCtx(c))`. Every primitive needed to fix this correctly already exists — the usecase just does not wire them together.

### Proposed fix (one-line change in `src/usecase/message.go`)

Replace line 87:

```go
// Before
message, err := service.chatStorageRepo.GetMessageByID(request.MessageID)
```

with:

```go
// After
deviceID := deviceIDFromContext(ctx)
message, err := service.chatStorageRepo.GetMessageByIDAndDevice(deviceID, request.MessageID)
```

That single change eliminates the multi-device attribution race at the source. No REST handler change, no schema change, no migration. Existing single-device setups are byte-identical (the device-scoped query returns the same row the unscoped one did when there is only one device).

### Suggested test (for the PR)

A unit test in `src/usecase/` that:

1. Seeds the fake `chatStorageRepo` with two rows sharing an id but differing in `device_id` and `chat_jid`.
2. Calls `DownloadMedia` with `deviceIDFromContext` set to one of the two devices.
3. Asserts the returned metadata corresponds to the matching device's row — not the other one.

The repository already has `GetMessageByIDAndDevice` test coverage in `sqlite_repository_test.go`; the gap is only at the usecase layer.

### Why the UI cannot fix this fully

- The UI passes the conversation's `deviceId` via the `X-Device-Id` header (already wired through `src/lib/http.ts` and `src/api/message.ts`). The backend ignores it for this endpoint.
- The UI cannot read the `chat_jid` of "the other row" directly — it has no `GetMessages`-by-id-only endpoint, and even if it did, that endpoint would have the same unscoped-lookup bug.
- The two-row structure is symmetric, so a UI-side `?phone=<deviceId>` fallback covers the other row. This is what `src/api/message.ts` does today. It is a workaround, not a fix — it doubles the request count on the failure path and relies on an envelope-string match that could change wording in a future gowa release.

### Related backend locations to audit in the same PR

The same unscoped-lookup antipattern may exist in other usecase methods that take a `message_id`. A grep for `GetMessageByID(` (without `AndDevice`) across `src/usecase/` will surface any siblings worth converting in the same PR for consistency.

---

## PR 2 — Persist and surface quoted-reply context on messages

### Status

- **Open** (not yet filed as of 2026-07-21).
- **UI workaround shipping**: none possible. The chat viewer (`src/features/chat/message-view.tsx` `getReplyTargetInfo`) already reads every plausible field name (`reply_to_message_id`, `reply_to_message_text`, `reply_to_message_sender`, plus the `reply_message_id` / `quoted_message_*` aliases). The backend never populates any of them, so quoted replies render as plain bubbles. Verified live — see "Root cause" below.

### Symptom (what the user sees)

When the user replies to a specific message in the chat viewer (per-bubble Reply button → compose → send), or when an incoming WhatsApp message is itself a quote:

1. The reply is delivered to WhatsApp correctly as a quote (visible in the WhatsApp client with the quoted bubble attached).
2. In the gowa-ui chat viewer the message renders as a **plain bubble** — no quote box, no anchor link, no highlighted target. Both outgoing and incoming quotes are affected.

### Precise backend location

- File: `src/domains/chat/chat.go` — the API response struct `MessageInfo` has **no** reply fields. Current fields (as of `main` on 2026-07-21): `ID, ChatJID, SenderJID, Content, Timestamp, IsFromMe, MediaType, Reactions, CallMetadata, Filename, URL, FileLength, CreatedAt, UpdatedAt`.
- File: `src/domains/chatstorage/chatstorage.go` — the stored `Message` entity also has **no** reply columns.
- File: `src/usecase/chat.go` lines **205–237** — the `Message → MessageInfo` conversion loop. There is nothing to copy because neither struct carries the fields.
- File: `src/infrastructure/chatstorage/sqlite_repository.go`:
  - `getMigrations()` — the `messages` table (Migration 2) has no reply columns. Migration list currently ends at **29**; the next one is **30**.
  - `StoreMessage` (line 306) — INSERT/UPDATE column list omits any reply fields.
  - `scanMessage` (line 965) — Scan column list omits any reply fields.
  - Every `SELECT id, chat_jid, device_id, sender, content, ... FROM messages` query (lines 90, 110, 334, 372, 509, 582, …) omits reply fields.

### Root cause (proven live, not speculation)

Authenticated against the user's running gowa backend (`http://127.0.0.1:3080`, device `egypt`, conversation `966561853319@s.whatsapp.net`) and pulled the conversation that contains the user's quoted reply:

```bash
GET /chat/966561853319@s.whatsapp.net/messages?limit=15  (15 messages)
```

Every message has exactly these 12 keys and nothing else:

```
id, chat_jid, sender_jid, content, timestamp, is_from_me,
media_type, filename, url, file_length, created_at, updated_at
```

Zero messages carry any `reply_*` or `quote_*` field. The user's own quoted reply `"هذا رد"` (message id `3EB018927A220989ACCC5D`, `is_from_me: true`) is stored as a plain message — the quote context was attached for the outbound whatsmeow payload (see `src/usecase/send.go:90` `mergeReplyContext`) but **never persisted** to `chatstorage.db`.

The `chatstorage/AGENTS.md` already foreshadows the intent — *"Use `GetMessageByIDAndDevice` for device-scoped ID lookups such as quoted replies"* — but the write side and the response surface were never implemented. `mergeReplyContext` is the only place that knows the (id, sender, content) of the quoted target at send time, and it throws that knowledge away after building the whatsmeow `ContextInfo`.

### Proposed fix (four small changes)

**1. Migration 30** in `getMigrations()` (`src/infrastructure/chatstorage/sqlite_repository.go`):

```go
// Migration 30: Add quoted-reply context columns to messages
`ALTER TABLE messages ADD COLUMN reply_to_message_id VARCHAR(255) DEFAULT '';
ALTER TABLE messages ADD COLUMN reply_to_message_text TEXT DEFAULT '';
ALTER TABLE messages ADD COLUMN reply_to_message_sender VARCHAR(255) DEFAULT '';`,
```

**2. Domain fields** in `src/domains/chatstorage/chatstorage.go` `Message`:

```go
// Add to struct Message (new columns from Migration 30)
ReplyToMessageID     string    `db:"reply_to_message_id"`
ReplyToMessageText   string    `db:"reply_to_message_text"`
ReplyToMessageSender string    `db:"reply_to_message_sender"`
```

…and in `src/domains/chat/chat.go` `MessageInfo`:

```go
// Add to struct MessageInfo (API response surface)
ReplyToMessageID     string `json:"reply_to_message_id,omitempty"`
ReplyToMessageText   string `json:"reply_to_message_text,omitempty"`
ReplyToMessageSender string `json:"reply_to_message_sender,omitempty"`
```

**3. Persistence** — extend the write side in `src/infrastructure/chatstorage/sqlite_repository.go`:

- `StoreMessage` UPDATE (line ~314): add the three columns to the `SET` clause and args.
- `StoreMessage` INSERT (line ~334): add the three columns to the column list, VALUES placeholders, and args.
- `scanMessage` (line 965): Scan the three new columns (`&message.ReplyToMessageID, &message.ReplyToMessageText, &message.ReplyToMessageSender`) **at the end** of the Scan call — appending columns at the end preserves column order for any hand-written SELECT that lists columns explicitly.
- Every `SELECT … FROM messages` query (lines 90, 110, 334, 372, 509, 582, and any others): add the three new columns to the SELECT list so `scanMessage`'s arity matches.

Then populate them at the two write entry points:

- **Incoming**: `src/infrastructure/whatsapp/event_message_handler.go:45` `chatStorageRepo.CreateMessage(ctx, evt)`. whatsmeow exposes the quoted target on every message variant via `evt.Message.GetExtendedMessage().GetContextInfo()` (and each media variant carries its own `GetContextInfo()`). Extract:
  - `replyToID = contextInfo.GetStanzaId()` (the quoted message's id)
  - `replyToSender = contextInfo.GetParticipant()` (the quoted message's sender JID)
  - `replyToText` = first non-nil of `contextInfo.GetQuotedMessage().GetConversation()`, `.GetExtendedTextMessage().GetText()`, `.GetImageMessage().GetCaption()`, `.GetVideoMessage().GetCaption()`, or fall back to a bracketed media-type label (`[image]`, `[video]`, …) — mirror what `mergeReplyContext` writes on the send side.
  - Set these on the `*domainChatStorage.Message` before `CreateMessage` stores it.
- **Outgoing**: `src/usecase/send.go:90` `mergeReplyContext`. It already resolves the `*domainChatStorage.Message` for the quoted target (`GetMessageByIDAndDevice`). After `client.SendMessage` succeeds and the sent row is stored, write the three fields onto the just-stored outgoing `Message`. The cleanest spot is wherever `send.go` stores the sent message (search for `StoreMessage`/`StoreMessagesBatch` in `send.go` and the `event_message_handler` self-reaction path — the sent-row store happens via the whatsmeow event loop echoing the sent message back, so populating the fields on the incoming-receipt path covers it too).

**4. Surface on the API** — in `src/usecase/chat.go` lines 212–223 (the `messageInfo := domainChat.MessageInfo{ … }` literal), add:

```go
ReplyToMessageID:     message.ReplyToMessageID,
ReplyToMessageText:   message.ReplyToMessageText,
ReplyToMessageSender: message.ReplyToMessageSender,
```

The gowa-ui client already reads exactly these three field names — no frontend change needed. The `omitempty` JSON tags mean a plain message sends nothing extra (byte-identical to today).

### Suggested test (for the PR)

1. **Schema test** in `sqlite_repository_test.go`: after running `getMigrations()`, `PRAGMA table_info(messages)` includes the three new columns.
2. **Round-trip test**: store a `Message` with `ReplyToMessageID/Text/Sender` set, then `GetMessages` returns them populated.
3. **Conversion test** in `usecase/chat_test.go`: a `Message` with the three fields set produces a `MessageInfo` with the same three fields (non-empty) and a plain `Message` produces `MessageInfo` fields that JSON-serialize to omitted keys.
4. **Incoming-quote extraction test**: feed `event_message_handler` a fake `*events.Message` whose `Message.ExtendedMessage.ContextInfo` has `StanzaId`/`Participant`/`QuotedMessage` set; assert the stored row carries them.

### Why the UI cannot fix this fully

- The gowa `/chat/:jid/messages` response carries no reply context (12 keys per message — proven live). The frontend cannot fabricate which message was quoted.
- The send endpoint's response is `{message_id, status}` only — no echo of the reply context the UI just sent in the request body, so the UI can't even patch its local cache optimistically with confidence (the field names the UI would write into its cache must match what the next poll returns, and the poll returns nothing).
- The WebSocket `message.event` payload is consumed by `App.tsx` only as an invalidation signal (`event.code`); gowa-ui has no code path that extracts `ContextInfo` from a raw whatsmeow event frame, and even if it did, the client only sees events for messages addressed to it, not historical quotes.
- AGENTS.md in this repo contains a stale claim that the backend populates these fields in `CreateMessage` and `StoreSentMessageWithContext`; that claim is false on every version of gowa I can inspect (upstream `main` and the user's Jul-19 precompiled binary). The note should be corrected as part of this PR's coordination.

### Related backend locations to audit in the same PR

- `src/usecase/send.go` — confirm the sent-message storage path (whichever line persists the outgoing row after `client.SendMessage`) writes the reply fields. If sent rows are only stored via the whatsmeow event echo, ensure the echo path in `event_message_handler.CreateMessage` handles `evt.Info.IsFromMe == true` correctly (it already does for reactions).
- The `chatstorage_wrapper.go` (`src/infrastructure/whatsapp/chatstorage_wrapper.go`) — any method that proxies `StoreMessage`/`scanMessage` must pass the new columns through.
- Chatwoot forward payload (`src/usecase/chatwoot.go` if present) — consider including `reply_to_message_id`/`reply_to_message_text` in the Chatwoot message metadata for parity, but this is optional scope.

---

## PR 3 — Ensure message reactions round-trip into `GET /chat/:jid/messages`

### Status

- **Open** (not yet filed as of 2026-07-21).
- **UI workaround shipping**: none. The chat viewer (`src/features/chat/message-view.tsx:177–186` `reactionsByEmoji` memo, `:264–291` grouped emoji pills) renders reactions correctly whenever `message.reactions` is non-empty. The backend does not return the array, so nothing renders.
- **Partially fixed on `main`**: the `Message → MessageInfo` conversion at `src/usecase/chat.go:227–236` DOES populate `messageInfo.Reactions` from `message.Reactions`. The user's running binary (precompiled, Jul 19) predates this wiring.

### Symptom (what the user sees)

When the user reacts to a message in the chat viewer (per-bubble react picker → emoji), or when a reaction arrives from the other party:

1. The reaction is delivered to WhatsApp correctly (visible in the WhatsApp client).
2. In the gowa-ui chat viewer the message shows **no reaction pill** — for either the user's own reaction or incoming reactions.

### Precise backend location

- File: `src/usecase/chat.go` lines **227–236** — the reaction-conversion loop exists on `main`:
  ```go
  if len(message.Reactions) > 0 {
      messageInfo.Reactions = make([]domainChat.ReactionInfo, 0, len(message.Reactions))
      for _, reaction := range message.Reactions {
          messageInfo.Reactions = append(messageInfo.Reactions, domainChat.ReactionInfo{
              Emoji:     reaction.Emoji,
              SenderJID: reaction.ReactorJID,
              IsFromMe:  reaction.IsFromMe,
              Timestamp: reaction.Timestamp.Format(time.RFC3339),
          })
      }
  }
  ```
- File: `src/infrastructure/whatsapp/event_message_handler.go:36–43` — the incoming-reaction store path:
  ```go
  if isReactionMessage(evt) {
      if err := chatStorageRepo.CreateReaction(ctx, evt); err != nil {
          log.Errorf("Failed to store incoming reaction %s: %v", evt.Info.ID, err)
      }
      handleWebhookForward(ctx, evt, client)
      return
  }
  ```
- File: `src/infrastructure/chatstorage/sqlite_repository.go:1951–2010` — `CreateReaction` / `reactionFromEvent` parses `evt.Message.GetReactionMessage().GetKey().GetID()` and stores a row in `message_reactions`.
- File: `src/usecase/message.go:63–117` — `ReactMessage` sends the reaction to WhatsApp via `client.BuildReaction(...)` + `client.SendMessage`, but does **not** store the reaction locally. It relies on the event echo from `handleMessage` to store it via `CreateReaction`.

### Root cause (proven live, not speculation)

Sent a test reaction via the user's running gowa backend to confirm the round-trip:

```bash
POST /message/3EB018927A220989ACCC5D/reaction  {emoji:"👍"}
→ 200 SUCCESS  (returned reaction message id 3EB01CD6D49F2EE61EAF42)
```

WhatsApp accepted the reaction. Re-fetched the conversation 2 seconds later:

```bash
GET /chat/966561853319@s.whatsapp.net/messages?limit=15
```

The target message (`3EB018927A220989ACCC5D`) **still has no `reactions` field** in the response. Across all 15 messages, zero carry a `reactions` key. (The test reaction was removed afterward to restore the conversation state.)

Two compounding causes:

1. **Binary is stale.** The user's precompiled binary (`whatsapp_9.0.0_darwin_arm64/darwin-arm64`, built Jul 19) does not include the `usecase/chat.go:227–236` reaction-conversion loop that exists on `main`. So even reactions that ARE stored never reach the API response.
2. **Self-reactions may not round-trip.** `ReactMessage` in `src/usecase/message.go` sends to WhatsApp but stores nothing locally. The reaction row is only created when the event echo comes back through `handleMessage` → `isReactionMessage` → `CreateReaction`. If the echo is missed, dropped, or the binary's `isReactionMessage`/`reactionFromEvent` path does not fire for self-reactions, the row is never written and the next poll has nothing to return.

### Proposed fix (ship in two layers)

**Layer A — release / binary update (immediate):**

Cut a new gowa release that includes the `usecase/chat.go:227–236` reaction-conversion loop (already merged on `main`). Have the gowa-ui README bump the pinned gowa version once that release is published. This alone makes stored reactions visible.

**Layer B — write-through on send (hardening, in the same PR or a follow-up):**

Make `ReactMessage` in `src/usecase/message.go` store the reaction locally immediately after `client.SendMessage` succeeds, so the UI does not depend on the event echo:

```go
// After client.SendMessage(ctx, dataWaRecipient, msg) succeeds:
deviceID := deviceIDFromContext(ctx)
selfJID := /* resolve from client.Store.ID.ToNonAD() as reactionFromEvent already does */
isFromMe := true
reaction := &domainChatStorage.Reaction{
    MessageID:   request.MessageID,
    ChatJID:     dataWaRecipient.String(),
    DeviceID:    deviceID,
    ReactorJID:  selfJID,
    Emoji:       request.Emoji,
    IsFromMe:    isFromMe,
    Timestamp:   ts.Timestamp,
    CreatedAt:   time.Now(),
    UpdatedAt:   time.Now(),
}
if err := service.chatStorageRepo.StoreReaction(reaction); err != nil {
    log.Warnf("Reaction sent but local store failed for %s: %v", request.MessageID, err)
}
```

When `request.Emoji == ""` (a remove), call `service.chatStorageRepo.DeleteReaction(request.MessageID, selfJID, deviceID)` instead. This mirrors the semantics already used by the event-echo path and makes the optimistic UI invalidation (`message.event` → invalidate `['chat-messages']`) return the new pill on the very next poll, even if the echo is delayed or dropped.

Note the reuse: `StoreReaction` and `DeleteReaction` already exist (`sqlite_repository.go:419` and `:460`) and are exactly what `CreateReaction` calls. No new repository method is needed.

### Suggested test (for the PR)

1. **Conversion test** in `usecase/chat_test.go` (covers Layer A): a `Message` with `Reactions: [{Emoji:"👍", ReactorJID:"x@s.whatsapp.net", IsFromMe:true, Timestamp: t}]` produces a `MessageInfo` whose `Reactions` slice has one entry with `Emoji="👍"`, `SenderJID="x@s.whatsapp.net"`, `IsFromMe=true`. A `Message` with empty `Reactions` produces a `MessageInfo` whose JSON-serialized `Reactions` is omitted (`omitempty`).
2. **Write-through test** (covers Layer B): `serviceMessage.ReactMessage` with a valid emoji stores a row via `StoreReaction`; with `Emoji: ""` calls `DeleteReaction`. Assert the repository mock receives the expected call.
3. **Round-trip integration test**: call `ReactMessage`, then `GetChatMessages` for the same chat, assert the target message's `Reactions` includes the just-sent emoji with `IsFromMe: true`.

### Why the UI cannot fix this fully

- The `/chat/:jid/messages` response omits the `reactions` key entirely on the user's binary, and even on a current `main` build it only returns what `CreateReaction` stored via the event echo. The UI cannot create reaction rows server-side.
- The reaction-send response is `{message_id, status}` only — no echo of the emoji, so the UI cannot reliably patch its local cache (it would have to optimistically inject a pill that may not match the server's eventual state, and that pill would vanish on the next poll that returns no `reactions`).
- The UI already invalidates `['chat-messages']` on the `message.event` WS signal (so once the backend stores and returns reactions, pills appear with no further UI change). The bottleneck is purely the write-through + response-surface gap in the backend.

### Related backend locations to audit in the same PR

- `src/usecase/message.go` `StarMessage` / `MarkAsRead` / `RevokeMessage` / `DeleteMessage` — same write-then-pray-for-echo pattern. Consider applying the same local write-through for any of these whose state the UI displays. (`DeleteMessage` already deletes the row directly, so it is fine; `StarMessage` may need the same treatment if/when the UI surfaces star state.)
- `src/infrastructure/whatsapp/event_message.go:59` `isReactionMessage` — confirm it correctly recognizes self-reaction echoes (where `evt.Info.IsFromMe` is true). The `reactionFromEvent` resolver handles the `IsFromMe` JID fallback already; the gate at line 36 must not exclude them.

---

## How to add a new entry to this file

When the UI ships a workaround for a backend bug that cannot be fixed from this repo, add an entry here using the same shape:

1. **Status** — Open / Filed (link the PR) / Merged (link the commit + version). When merged and the gowa version pinned in `README.md` is bumped past the fix, delete the UI workaround and remove the entry.
2. **Symptom** — what the user sees, in their words.
3. **Precise backend location** — `file:line` in `aldinokemal/go-whatsapp-web-multidevice`.
4. **Root cause** — proven with evidence (DB dump, log, or repro), not speculation.
5. **Proposed fix** — the smallest backend diff that removes the root cause.
6. **Suggested test** — what the PR's test should assert.
7. **Why the UI cannot fix this fully** — the boundary that forces the workaround.
8. **Related locations to audit** — any sibling code with the same antipattern.

Keep entries in this file even after the UI workaround is removed, until the upstream fix is confirmed shipped in the gowa version this repo pins. Outdated entries should be moved to a "Resolved" section at the bottom with the gowa version that fixed them, so contributors can see the history of upstream coordination.
