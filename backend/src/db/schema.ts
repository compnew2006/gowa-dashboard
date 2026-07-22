import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  varchar,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'

// NOTE: the original scaffold imported `vector` from drizzle-orm/pg-core and
// declared an `embedding vector(1536)` column + an HNSW index on
// `messages_history`. That required the `pgvector` Postgres extension, which
// is not installed on this machine and would need a brew install + Postgres
// restart to add. The embedding column fed an AI enrichment worker that
// called a non-existent model (`gemini-3.6-flash`). Both have been removed so
// the schema runs on stock Postgres 13+ (only `gen_random_uuid()` is needed,
// which is built-in since PG13). Re-add the column + extension only if you
// revive semantic search with a real embedding pipeline.

// ==========================================
// 1. WORKSPACE & TENANCY LAYER
// ==========================================

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugUniqueIdx: uniqueIndex('workspace_slug_unique_idx').on(table.slug),
}))

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
}))

// ==========================================
// 2. IDENTITY & ROLE-BASED ACCESS CONTROL
// ==========================================

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  permissions: text('permissions').array().notNull(), // e.g. ['chats:read', 'chats:write', 'contacts:manage', 'devices:admin']
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailUniqueIdx: uniqueIndex('user_email_unique_idx').on(table.email),
}))

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  familyId: uuid('family_id').notNull(),
  // Self-reference: the new token that replaced this one. Enforced as a real FK now.
  replacedByTokenId: uuid('replaced_by_token_id'),
  ipAddress: varchar('ip_address', { length: 45 }),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('refresh_token_hash_idx').on(table.tokenHash),
  familyIdx: index('refresh_token_family_idx').on(table.familyId),
}))

// ==========================================
// 3. WHATSAPP SESSION & DEVICE CONFIGURATION
// ==========================================

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  deviceId: varchar('device_id', { length: 100 }).notNull(), // Maps directly to gowa engine device ID
  name: varchar('name', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(), // 'CONNECTED', 'DISCONNECTED', 'PAIRING'
  basicAuthUser: varchar('basic_auth_user', { length: 100 }).notNull(),
  encCiphertext: text('enc_ciphertext').notNull(),
  encIv: varchar('enc_iv', { length: 100 }).notNull(),
  encTag: varchar('enc_tag', { length: 100 }).notNull(),
  encKeyId: varchar('enc_key_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  deviceWorkspaceIdx: uniqueIndex('device_id_workspace_idx').on(table.deviceId, table.workspaceId),
}))

export const deviceMembers = pgTable('device_members', {
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.deviceId, table.userId] }),
}))

// ==========================================
// 4. CRM CLIENT & CONVERSATION SEGMENTS
// ==========================================

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  jid: varchar('jid', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 30 }).notNull(),
  email: varchar('email', { length: 255 }),
  notes: text('notes'),
  // The gowa device_id this contact was synced from (null = manually created).
  // Preserved on re-sync so the origin is stable.
  sourceDeviceId: varchar('source_device_id', { length: 100 }),
  // Every gowa device_id this contact appears on (deduped set). The same
  // contact synced from 2-3 devices stays a SINGLE row; each device is unioned
  // here so we can show "from egypt, Saudi" badges.
  sourceDeviceIds: text('source_device_ids').array(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  contactJidWorkspaceIdx: uniqueIndex('contact_jid_workspace_idx').on(table.jid, table.workspaceId),
  assignedUserIdx: index('contact_assigned_user_idx').on(table.assignedUserId),
  sourceDeviceIdx: index('contact_source_device_idx').on(table.workspaceId, table.sourceDeviceId),
}))

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).default('#CCCCCC').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const contactTags = pgTable('contact_tags', {
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tagId] }),
}))

// ==========================================
// 5. CHAT TELEMETRY, MUTATIONS & HISTORIC INDEX
// ==========================================

export const chatsMetadata = pgTable('chats_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  jid: varchar('jid', { length: 100 }).notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  lastOpenedAt: timestamp('last_opened_at'),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // 'ACTIVE', 'ARCHIVED', 'BLOCKED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  chatJidDeviceIdx: uniqueIndex('chat_jid_device_idx').on(table.jid, table.deviceId),
  workspaceJidIdx: index('chat_workspace_jid_idx').on(table.workspaceId, table.jid),
}))

export const chatReadCursors = pgTable('chat_read_cursors', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  chatJid: varchar('chat_jid', { length: 100 }).notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
  lastReadMessageId: varchar('last_read_message_id', { length: 255 }),
}, (table) => ({
  userReadCursorIdx: uniqueIndex('user_read_cursor_idx').on(table.userId, table.chatJid, table.deviceId),
}))

export const messagesHistory = pgTable('messages_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  messageId: varchar('message_id', { length: 255 }).notNull(),
  jid: varchar('jid', { length: 100 }).notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }), // Nullable for incoming messages
  direction: varchar('direction', { length: 10 }).notNull(), // 'INBOUND' | 'OUTBOUND'
  messageType: varchar('message_type', { length: 30 }).notNull(), // 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'STICKER'
  status: varchar('status', { length: 20 }).notNull(), // 'SENT', 'DELIVERED', 'READ', 'FAILED'
  contentSummary: text('content_summary'), // Non-PII sanitised copy or safe preview text
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  msgHistoryIdIdx: uniqueIndex('msg_history_id_idx').on(table.messageId),
  workspaceJidCreatedIdx: index('msg_workspace_jid_created_idx').on(table.workspaceId, table.jid, table.createdAt),
}))

// ==========================================
// 6. BROADCAST CAMPAIGN AUTOMATION
// ==========================================

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(), // 'PENDING', 'RUNNING', 'COMPLETED', 'PAUSED'
  messageTemplate: text('message_template').notNull(),
  delayMin: integer('delay_min').default(5).notNull(), // Anti-ban random delay bounds (seconds)
  delayMax: integer('delay_max').default(15).notNull(),
  scheduledAt: timestamp('scheduled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const campaignRecipients = pgTable('campaign_recipients', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // 'PENDING', 'SENT', 'FAILED'
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
})

// ==========================================
// 7. HISTORIC SECURITY AUDITING
// ==========================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // 'auth.login', 'message.send', 'device.pairing'
  targetType: varchar('target_type', { length: 50 }).notNull(), // 'user', 'message', 'device', 'contact'
  targetId: varchar('target_id', { length: 100 }),
  payload: jsonb('payload'), // Change ledger, excluding authentication secrets
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ==========================================
// 8. RICH MEDIA ASSETS STORE
// ==========================================

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(), // Secure Object Storage pointer
  uploaderUserId: uuid('uploader_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
