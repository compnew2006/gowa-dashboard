# GOWA UI — Product Requirements Document

> Web dashboard for [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice).
> Compiles to a single self-contained HTML file. No external requests at runtime.

---

## 1. Product Overview

**What it is:** A multi-user browser dashboard that manages WhatsApp Multi-Device sessions through a gowa backend API, fronted by a separate auth middleware that handles user management, roles, permissions, and JWT authentication. The UI is hosted separately from both services and communicates exclusively via REST and WebSocket.

**Who it's for:**
- **Admins** manage users, roles, permissions, device assignments, and chat-to-agent routing.
- **Agents** (dashboard users) are assigned one WhatsApp device each and handle their assigned chats — sending messages, browsing history, managing groups, etc.
- **Viewers** have read-only access to chats assigned to them.

**Delivery format:** One self-contained `index.html` file (all JS, CSS, fonts, images inlined). Survives `file://` and any mount path. No CDN dependencies.

---

## 2. Feature Inventory

### 2.1 Authentication (JWT)

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F01  | Login Page                   | Email + password login form at `/login` (first gate before `/connect`) |
| F02  | JWT Access Token             | Short-lived access token (15 min) returned on login, attached to all API requests |
| F03  | JWT Refresh Token           | Long-lived refresh token (7 days) stored in localStorage, used to silently renew access token |
| F04  | Silent Token Refresh         | Auto-refresh access token before expiry; redirect to `/login` on refresh failure |
| F05  | Logout                       | Clear both tokens, redirect to `/login`                           |
| F06  | Auth Guard (JWT)             | Axios interceptor attaches `Authorization: Bearer <token>` to every request |
| F07  | 401 → Login Redirect         | On JWT expiry (401 from auth middleware), clear tokens and redirect to `/login` |

**Minimum requirements:**
- `/login` page with email input, password input, and submit button
- Error messages: invalid credentials, account deactivated, server unreachable
- Tokens stored in `localStorage` (access + refresh)
- Automatic silent refresh before access token expiry
- Redirect to `/login` when unauthenticated

### 2.1b Server Connection (post-auth)

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F08  | Server Connect               | Connect to a gowa server by URL + optional Basic Auth credentials |
| F09  | Zero-Config Mode             | Auto-detect same-origin gowa server (when gowa serves the UI)     |
| F10  | Credential Persistence       | Server URL, username, and password stored in browser localStorage |
| F11  | Connection Probing           | Distinguish gowa server from arbitrary web servers (not-gowa check) |
| F12  | Disconnect                   | Clear stored connection and return to connect screen               |

**Note:** The existing `/connect` page is preserved as a post-login step. Users must authenticate (JWT) before they can connect to a gowa server.

### 2.2 Device Management

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F13  | List Devices                 | Grid display of all registered device slots (requires `devices.see_all` permission or admin) |
| F14  | Create Device                | Add a new device slot (optional ID, webhook URL, webhook secret)   |
| F15  | Delete Device                | Remove a device slot with confirmation dialog                      |
| F16  | Login via QR                 | Pair device by scanning a QR code (polling/refresh)                |
| F17  | Login via Pairing Code       | Pair device using a phone number to get a pairing code            |
| F18  | Logout Device                | End WhatsApp session on a device                                   |
| F19  | Reconnect Device             | Re-establish connection for a disconnected device                  |
| F20  | Device Selection             | Global device switcher (admin only; non-admin users see only their assigned device) |
| F21  | Device State Badge           | Visual indicator: disconnected / connecting / connected / logged_in|
| F22  | Device Avatar                | Fetch and display WhatsApp profile picture per device              |
| F23  | Device Webhook Config        | View, set, and update webhook URL, secret, events, TLS skip for each device |
| F24  | Passkey Confirmation         | Dialog to confirm passkey requests via WebSocket events           |

**Minimum requirements:**
- Device list with state, JID/phone, and created date
- Create device dialog with optional webhook fields
- Per-device actions: login QR, login code, reconnect, logout, delete, webhook config
- Global device switcher persisted to localStorage

### 2.3 Send Messages (Compose)

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F25  | Send Text                    | Send a text message with optional reply threading and forwarding  |
| F26  | Send Image                   | Send image file or URL with caption, view-once, compress options   |
| F27  | Send Video                   | Send video file or URL with caption, view-once, compress, GIF options |
| F28  | Send File                    | Send document/file with caption                                    |
| F29  | Send Audio                   | Send audio file or URL with push-to-talk option                    |
| F30  | Send Sticker                 | Send sticker file or URL                                           |
| F31  | Send Contact (vCard)         | Send a contact card with name and phone number                     |
| F32  | Send Location                | Send a location pin (latitude + longitude)                         |
| F33  | Send Link Preview            | Send a link with optional caption                                  |
| F34  | Send Poll                    | Create and send a poll with question, options, and max answers     |
| F35  | Send Presence                | Set account presence (available, unavailable, etc.)                |
| F36  | Send Chat Presence           | Set typing/paused chat presence for a specific chat               |
| F37  | cURL Preview                 | Copy equivalent cURL command for any compose action                |

**Minimum requirements:**
- Recipient field shared across all compose types (persisted recent recipients)
- File upload or URL input for media types
- Optional caption, reply-to, forwarding, and view-once fields
- Toast notifications for success/error on every send
- cURL command preview dialog

### 2.4 Message Actions (Act on Existing Messages)

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F38  | React to Message             | Add or remove emoji reaction on a message                          |
| F39  | Edit Message                 | Update text of a previously sent message                           |
| F40  | Mark as Read                 | Mark a specific message as read                                     |
| F41  | Star / Unstar Message        | Toggle starred status on a message                                 |
| F42  | Revoke Message               | Delete message for everyone (unsend)                              |
| F43  | Delete Message (for me)       | Delete message locally                                             |
| F44  | Forward Message              | Forward a message to another chat                                  |
| F45  | Download Media              | Download media attachment from a message                            |

**Minimum requirements:**
- Message ID input + action selector
- Per-action form fields (emoji picker for react, new text for edit, phone for forward)
- Toast notifications for success/error
- cURL preview for each action

### 2.5 Chat Viewer

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F40  | Chat List                    | Scrollable list of all chats with search and media filter          |
| F41  | Chat List Infinite Scroll    | Paginated chat list (50 per page), auto-loads at 80% scroll       |
| F42  | Chat List Search             | Filter chats by name/JID                                            |
| F43  | Chat List Media Filter       | Filter to only chats that contain media                             |
| F44  | Chat List Polling            | Auto-refresh every 5 seconds                                       |
| F45  | Chat List Unread Badges      | Per-chat unread count badges (client-side until server supports it) |
| F46  | Message Conversation View    | Full message history for a selected chat                           |
| F47  | Message Infinite Scroll (up)  | Load older messages when scrolling to top                           |
| F48  | Message Newest-at-Bottom     | Messages displayed chronologically, newest at bottom                |
| F49  | Message Day Separators       | Visual date dividers between messages from different days          |
| F50  | Message Auto-Scroll          | Auto-scroll to bottom on new chat, new message, and send success    |
| F51  | Message Scroll Anchor        | Preserved scroll position when prepending older messages           |
| F52  | Per-Bubble Reply             | Reply to a specific message from its bubble                        |
| F53  | Per-Bubble React             | React to a message from its bubble (emoji picker dropdown)         |
| F54  | Reaction Pills               | Grouped emoji reactions displayed inside message bubbles           |
| F55  | Message Media Display        | Inline rendering of images, videos, audio, documents, stickers      |
| F56  | Media Preview Dialog         | Full-size media viewer with send-as capability                     |
| F57  | Media Burst Grouping         | Cluster consecutive media messages into a burst gallery             |
| F58  | Chat Compose Bar             | Text input, file attachment (drag & drop), and send button          |
| F59  | Master-Detail Layout         | Side-by-side chat list + conversation (responsive)                 |
| F60  | Mobile Master-Detail         | Full-screen conversation with back button on mobile                |
| F61  | Multi-Device Chat Merge      | View chats from all devices in a single merged list                 |
| F62  | Chat Pin / Archive           | Pin or archive chats from the conversation view                    |
| F63  | Disappearing Messages Timer  | Set ephemeral message timer for a chat                              |
| F64  | Unread Divider               | Visual separator showing last-read position in conversation        |
| F65  | Link Detection               | Auto-detect and linkify URLs in message text                        |
| F66  | Export Chat Media            | Download all media from a conversation as a ZIP file                 |

**Minimum requirements:**
- Searchable, paginated chat list with 5s polling
- Full message history view with upward infinite scroll
- Auto-scroll to bottom with user-position preservation
- Per-bubble reply and react actions
- Inline media rendering (images, video, audio, files, stickers)
- Chat compose bar with text input and file attachment
- Responsive master-detail layout
- Deterministic colored avatars per chat

### 2.6 Group Management

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F67  | List My Groups               | Display all groups the device belongs to                            |
| F68  | Create Group                 | Create a new group with title and initial participants              |
| F69  | Join Group via Link          | Join a group using its invite link                                  |
| F70  | Leave Group                  | Leave a group                                                       |
| F71  | Group Info                   | View group details (name, topic, creation date, participant count)  |
| F72  | Group Info from Link         | Preview a group's info before joining via invite link               |
| F73  | List Participants            | View all group members with admin badges                            |
| F74  | Add Participants             | Add members to a group by JID/phone                                 |
| F75  | Remove Participants          | Remove members from a group                                        |
| F76  | Promote to Admin             | Grant admin privileges to a participant                              |
| F77  | Demote from Admin            | Revoke admin privileges from a participant                          |
| F78  | Set Group Name               | Change the group name                                               |
| F79  | Set Group Topic              | Change the group description/topic                                  |
| F80  | Set Group Photo              | Upload a new group profile picture                                  |
| F81  | Set Group Locked             | Toggle whether only admins can edit group info                      |
| F82  | Set Group Announce           | Toggle whether only admins can send messages                        |
| F83  | Get Invite Link              | Retrieve or reset the group invite link                             |
| F84  | Participant Join Requests    | View, approve, or reject pending join requests                      |

**Minimum requirements:**
- Group list with selection to open detail sheet
- Create and join dialogs
- Full participant management (add, remove, promote, demote)
- Group settings (name, topic, photo, locked, announce)
- Invite link management

### 2.7 Account & Lookups

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F85  | My Profile Card              | Display own WhatsApp profile info (name, verified name, status)    |
| F86  | Change Avatar                | Upload a new profile picture                                       |
| F87  | Change Push Name             | Update WhatsApp display name                                       |
| F88  | My Privacy Settings          | View current privacy settings (group_add, last_seen, status, etc.) |
| F89  | My Contacts                  | View contacts synced to the device                                  |
| F90  | User Info Lookup             | Look up any user's public info by phone or LID                     |
| F91  | User Check                   | Check whether a phone number is on WhatsApp                        |
| F92  | Avatar Lookup                | Fetch a user's or group's profile picture                          |
| F93  | Business Profile Lookup      | Fetch a WhatsApp Business account's public profile                  |

**Minimum requirements:**
- Profile display with change avatar and push name forms
- Privacy settings view (read-only)
- Contact list view
- Four lookup types: user info, user check, avatar, business profile

### 2.8 Channels & Calls

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F94  | Newsletter List              | View all newsletters/channels the device follows                   |
| F95  | Newsletter Messages          | View messages within a newsletter                                  |
| F96  | Unfollow Newsletter          | Stop following a newsletter/channel                                |
| F97  | Reject Incoming Call         | Reject an incoming call by caller JID and call ID                   |

**Minimum requirements:**
- Newsletter list with unfollow action
- Newsletter message viewer
- Call rejection form

### 2.9 Settings & UI

| ID   | Feature                      | Description                                                        |
|------|------------------------------|--------------------------------------------------------------------|
| F98  | Connection Settings          | View and disconnect from current gowa server                         |
| F99  | Server Info Display          | Show gowa version, OS, and max file size limits                     |
| F100 | Theme Toggle                 | Light / Dark / System theme switcher                               |
| F101 | Sidebar Collapse             | Collapsible sidebar (icon-only rail) persisted across sessions     |
| F102 | Mobile Navigation Drawer     | Sheet-based nav drawer for mobile viewports                         |
| F103 | WebSocket Status Badge       | Live indicator: disconnected / connecting / connected               |
| F104 | User Menu                    | Account menu in header (connected account info, disconnect)         |
| F105 | Media Burst Gap Setting      | Configure media burst clustering interval (1–60 minutes)            |

---

## 3. API Endpoints

All endpoints are relative to the configured gowa server base URL.
Authentication: `Authorization: Basic <base64(user:pass)>` header.
Device scoping: `X-Device-Id: <encoded_device_id>` header.

### 3.1 App

| Method | Path                    | Description                  | Key Parameters / Payload        |
|--------|-------------------------|------------------------------|---------------------------------|
| GET    | `/app/info`             | Server metadata              | —                               |
| POST   | `/app/passkey/confirm`   | Confirm a passkey request    | Header: `X-Device-Id`           |

### 3.2 Devices

| Method | Path                                  | Description              | Key Parameters / Payload                     |
|--------|---------------------------------------|--------------------------|----------------------------------------------|
| GET    | `/devices`                            | List all devices         | —                                            |
| POST   | `/devices`                            | Create a device         | `{ device_id?, webhook_url?, webhook_secret?, webhook_events?, webhook_insecure_skip_verify? }` |
| DELETE | `/devices/:device_id`                 | Delete a device         | Path param: `device_id`                      |
| GET    | `/devices/:device_id/login`          | Get login QR            | Path param: `device_id` → `{ qr_link, qr_duration }` |
| POST   | `/devices/:device_id/login/code`      | Login with pairing code | Path param: `device_id`, Query: `phone` → `{ pair_code }` |
| POST   | `/devices/:device_id/logout`         | Logout device           | Path param: `device_id`                      |
| POST   | `/devices/:device_id/reconnect`      | Reconnect device        | Path param: `device_id`                      |
| GET    | `/devices/:device_id/status`         | Device connection status| Path param: `device_id` → `{ is_connected, is_logged_in }` |
| GET    | `/devices/:device_id/webhook`        | Get webhook config       | Path param: `device_id` → webhook config     |
| PATCH  | `/devices/:device_id/webhook`        | Update webhook config    | Path param: `device_id`, Body: `{ webhook_url, webhook_secret?, webhook_events?, webhook_insecure_skip_verify? }` |

### 3.3 Send Messages

All POST. Response: `{ message_id, status }`.

| Path                       | Payload Fields                                                                                      | Content-Type        |
|----------------------------|-----------------------------------------------------------------------------------------------------|---------------------|
| `/send/message`            | `{ phone, message, reply_message_id?, is_forwarded?, duration? }`                                  | JSON                |
| `/send/image`              | `{ phone, caption?, image, image_url, view_once?, compress?, is_forwarded?, reply_message_id?, duration? }` | Multipart           |
| `/send/video`              | `{ phone, caption?, video, video_url, view_once?, compress?, gif_playback?, is_forwarded?, reply_message_id?, duration? }` | Multipart      |
| `/send/file`               | `{ phone, caption?, file, file_url, is_forwarded?, reply_message_id?, duration? }`                    | Multipart           |
| `/send/audio`              | `{ phone, audio, audio_url, ptt?, reply_message_id?, is_forwarded? }`                               | Multipart           |
| `/send/sticker`            | `{ phone, sticker, sticker_url, is_forwarded? }`                                                     | Multipart           |
| `/send/contact`            | `{ phone, contact_name, contact_phone }`                                                             | JSON                |
| `/send/location`           | `{ phone, latitude, longitude }`                                                                     | JSON                |
| `/send/link`               | `{ phone, link, caption? }`                                                                          | JSON                |
| `/send/poll`               | `{ phone, question, options[], max_answer }`                                                          | JSON                |
| `/send/presence`           | `{ type }`                                                                                           | JSON                |
| `/send/chat-presence`      | `{ phone, action }`                                                                                  | JSON                |

### 3.4 Message Actions

All POST to `/message/:message_id/:action`. Response varies by action.

| Path Suffix         | Payload                    | Description               |
|---------------------|----------------------------|---------------------------|
| `/message/:id/reaction` | `{ phone, emoji }`       | React (empty emoji = remove) |
| `/message/:id/revoke`   | `{ phone }`               | Delete for everyone       |
| `/message/:id/delete`    | `{ phone }`               | Delete for me              |
| `/message/:id/update`    | `{ phone, message }`      | Edit message text          |
| `/message/:id/read`      | `{ phone }`               | Mark as read               |
| `/message/:id/star`      | `{ phone, is_starred: true }`  | Star message         |
| `/message/:id/unstar`    | `{ phone, is_starred: false }` | Unstar message       |
| `/message/:id/forward`    | `{ phone, force_reupload? }` | Forward message        |
| GET `/message/:id/download` | Query: `phone`           | Download media attachment  |

### 3.5 Chats

| Method | Path                         | Description              | Key Parameters / Payload                       |
|--------|------------------------------|--------------------------|----------------------------------------------|
| GET    | `/chats`                     | List chats               | Query: `{ limit?, offset?, search?, has_media? }` → `{ data: ChatInfo[], pagination }` |
| GET    | `/chat/:jid/messages`        | Get chat messages        | Path: `jid`, Query: `{ limit?, offset?, search?, media_only?, is_from_me?, start_time?, end_time? }` → `{ data: MessageInfo[], pagination, chat_info }` |
| POST   | `/chat/:jid/pin`             | Pin/unpin chat           | `{ pinned: boolean }`                          |
| POST   | `/chat/:jid/archive`         | Archive/unarchive chat   | `{ archived: boolean }`                        |
| POST   | `/chat/:jid/disappearing`    | Set ephemeral timer       | `{ timer_seconds: number }`                    |

### 3.6 Groups

| Method | Path                                | Description              | Key Parameters / Payload                       |
|--------|-------------------------------------|--------------------------|----------------------------------------------|
| GET    | `/user/my/groups`                   | List my groups           | — → `{ data: MyGroup[] }`                     |
| POST   | `/group`                            | Create a group          | `{ title, participants[] }` → `{ group_id }`  |
| POST   | `/group/join-with-link`             | Join via invite link    | `{ link }` → `{ group_id }`                   |
| POST   | `/group/leave`                      | Leave a group            | `{ group_id }`                                |
| GET    | `/group/info`                       | Get group info           | Query: `{ group_id }`                          |
| GET    | `/group/info-from-link`             | Preview group from link | Query: `{ link }` → `{ group_id, name, topic, ... }` |
| GET    | `/group/participants`               | List participants       | Query: `{ group_id }` → `{ group_id, name, participants[] }` |
| POST   | `/group/participants`               | Add participants         | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| POST   | `/group/participants/remove`        | Remove participants      | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| POST   | `/group/participants/promote`       | Promote to admin         | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| POST   | `/group/participants/demote`        | Demote from admin        | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| GET    | `/group/participant-requests`       | List join requests       | Query: `{ group_id }` → `ParticipantRequestEntry[]` |
| POST   | `/group/participant-requests/approve`| Approve join requests    | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| POST   | `/group/participant-requests/reject`| Reject join requests     | `{ group_id, participants[] }` → `ParticipantStatus[]` |
| POST   | `/group/photo`                      | Set group photo          | Multipart: `{ group_id, photo }`              |
| POST   | `/group/name`                       | Set group name           | `{ group_id, name }`                          |
| POST   | `/group/topic`                      | Set group topic          | `{ group_id, topic }`                         |
| POST   | `/group/locked`                     | Toggle locked            | `{ group_id, locked: boolean }`               |
| POST   | `/group/announce`                   | Toggle announce          | `{ group_id, announce: boolean }`              |
| GET    | `/group/invite-link`                | Get invite link          | Query: `{ group_id, reset? }` → `{ invite_link }` |

### 3.7 User / Account

| Method | Path                              | Description              | Key Parameters / Payload           |
|--------|-----------------------------------|--------------------------|------------------------------------|
| GET    | `/user/info`                      | User info lookup         | Query: `phone` → user info data    |
| GET    | `/user/avatar`                    | Get avatar               | Query: `{ phone, is_preview?, is_community? }` → `{ url, id, type }` |
| POST   | `/user/avatar`                    | Change own avatar        | Multipart: `{ avatar }`            |
| POST   | `/user/pushname`                  | Change push name         | `{ push_name }`                     |
| GET    | `/user/my/privacy`                | Get privacy settings     | — → `{ group_add, last_seen, status, profile, read_receipts }` |
| GET    | `/user/my/newsletters`            | List newsletters         | — → `{ data: NewsletterMetadata[] }` |
| GET    | `/user/my/contacts`               | List contacts            | — → `{ data: Contact[] }`          |
| GET    | `/user/check`                     | Check if on WhatsApp     | Query: `phone` → `{ is_on_whatsapp }` |
| GET    | `/user/business-profile`          | Business profile lookup  | Query: `phone` → business data      |

### 3.8 Newsletters

| Method | Path                    | Description              | Key Parameters / Payload                        |
|--------|-------------------------|--------------------------|-------------------------------------------------|
| POST   | `/newsletter/unfollow`  | Unfollow a newsletter    | `{ newsletter_id }`                              |
| GET    | `/newsletter/messages`   | Get newsletter messages  | Query: `{ newsletter_id, count?, before? }` → messages |

### 3.9 Calls

| Method | Path            | Description          | Key Parameters / Payload      |
|--------|-----------------|----------------------|-------------------------------|
| POST   | `/call/reject`  | Reject incoming call | `{ caller_jid, call_id }` → `{ status }` |

---

## 4. WebSocket Events

**Connection:** `ws://<server>/ws?device_id=<id>&authorization=<base64>`

| Event Code                  | Direction      | Description                        |
|-----------------------------|----------------|------------------------------------|
| `FETCH_DEVICES`             | Client → Server| Request device list refresh        |
| `LOGIN_SUCCESS`             | Server → Client| Device paired successfully          |
| `LIST_DEVICES`              | Server → Client| Device list updated                 |
| `DEVICE_LOGGED_OUT`         | Server → Client| Device session ended                |
| `DEVICE_REMOVED`            | Server → Client| Device slot deleted                 |
| `PASSKEY_REQUEST`           | Server → Client| Passkey confirmation required      |
| `PASSKEY_CONFIRMATION`      | Server → Client| Passkey confirmed                   |
| `PASSKEY_ERROR`             | Server → Client| Passkey error                       |
| `DEVICE_WEBHOOK_UPDATED`    | Server → Client| Device webhook changed              |
| `DEVICE_WEBHOOK_CONFIG_UPDATED` | Server → Client| Device webhook config updated    |

**Reconnect:** Exponential backoff (`lib/backoff.ts`).

---

## 5. Pages & Navigation

| Route      | Page             | Description                              |
|------------|------------------|------------------------------------------|
| `/connect`  | Connect         | Server connection form (no shell)        |
| `/`         | → `/chats`      | Default redirect                         |
| `/devices`  | Dashboard       | Device management grid                    |
| `/messaging`| Messaging       | Compose & act-on-message workspace        |
| `/chats`    | Chats           | Master-detail chat viewer                |
| `/groups`   | Groups          | Group directory with detail sheet        |
| `/account`  | Account         | Profile, privacy, contacts, lookups       |
| `/misc`     | Channels & Calls| Newsletters and call rejection          |
| `/settings` | Settings        | Connection, server info, appearance       |

**Navigation groups:**
- **Overview:** Devices
- **Messaging:** Messaging, Chats
- **Directory:** Groups, Account
- **System:** Channels & Calls, Settings

---

## 6. State Management

| Store              | Persistence Key          | State Fields                                          |
|--------------------|--------------------------|-------------------------------------------------------|
| `useConnection`    | `gowa-ui.connection.v1`  | `baseUrl`, `username`, `password`, `status`          |
| `useDeviceStore`   | `gowa-ui.device.v1`      | `selectedDeviceId`                                    |
| `useRecipientStore`| `gowa-recipient`         | `recipient { phone, type }`, `recents[]`              |
| `useSettingsStore` | `gowa-ui.settings.v1`    | `mediaBurstGapMin`, `sidebarCollapsed`                 |
| `useUnreadStore`   | `gowa-ui.unread.v1`      | `counts: Record<deviceId|jid, number>`                 |
| `useWsStore`       | (not persisted)          | `status: disconnected | connecting | connected`           |

---

## 7. Real-Time Behavior

| Concern                  | Mechanism                                           |
|--------------------------|-----------------------------------------------------|
| Chat list refresh        | `useInfiniteQuery` with `refetchInterval: 5000ms`  |
| Message list refresh     | `useInfiniteQuery` with `refetchInterval: 5000ms`  |
| Device list invalidation | WebSocket events: LOGIN_SUCCESS, LIST_DEVICES, DEVICE_LOGGED_OUT, DEVICE_REMOVED |
| Auto-scroll              | `useLayoutEffect` + `stickToBottom` / `isNearBottom` refs |
| Older messages load       | `IntersectionObserver` on top sentinel (200px margin) |
| Chat list pre-load       | `IntersectionObserver` on bottom sentinel (200px margin) |
| WebSocket reconnect      | Exponential backoff with `wsClient.sync()` reconciliation |

---

## 8. Test Coverage

**17 test files** covering pure helpers and stores:

| Module                | Tests Cover                                         |
|-----------------------|-----------------------------------------------------|
| `lib/api-error.ts`    | Error extraction and formatting                      |
| `lib/backoff.ts`      | Exponential backoff delay calculation                |
| `lib/curl.ts`         | cURL command generation                              |
| `lib/format.ts`       | Date/byte formatting                               |
| `lib/jid.ts`          | JID parsing and composition                         |
| `lib/linkify.ts`      | URL tokenization in message text                    |
| `lib/media-burst.ts`  | Media burst clustering algorithm                    |
| `lib/media-classify.ts`| Media type classification by extension              |
| `lib/media-validate.ts`| File size validation against server limits          |
| `lib/multi-device-merge.ts` | Cross-device chat list merging                 |
| `lib/unread-diff.ts`  | Unread count delta computation                      |
| `lib/url.ts`           | Base URL normalization and WebSocket URL construction|
| `lib/zip.ts`           | ZIP filename generation                             |
| `stores/recipient.ts` | Recipient store set/push logic                       |
| `stores/settings.ts`   | Settings store clamp logic                          |
| `stores/unread.ts`     | Unread counter bump/set/clear                        |
| `hooks/use-unread-count.ts` | Server-value preference hook                 |

---

## 9. Known Data Gaps (Backend Required)

| Gap                          | Current Fallback                         | Required Backend Change                                           |
|------------------------------|------------------------------------------|---------------------------------------------------------------------|
| Message delivery/read status | Not rendered                             | gowa must return `status` field on message responses                |
| Reply quote preview          | Not rendered                             | gowa must return `reply_to_*` fields on message responses           |
| Per-chat unread count        | Client-side `useUnreadStore`            | gowa `ChatInfo` needs `unread_count: uint32` field, populated from message store |
| In-conversation read cursor  | Client-side `unread-diff.ts`            | gowa needs per-chat last-read cursor tracking                       |
