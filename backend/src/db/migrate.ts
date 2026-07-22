import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Standalone migration runner. Usage: `npm run migrate`.
 *
 * Strategy: instead of relying on drizzle-kit's generated migration folder
 * (which needs a separate `drizzle-kit generate` step), we issue hand-written
 * `CREATE TABLE IF NOT EXISTS` DDL that mirrors `schema.ts` exactly. This keeps
 * the first-run experience to a single command and avoids pgvector entirely.
 *
 * Re-runnable: every statement uses IF NOT EXISTS. The RLS script is itself
 * idempotent (DROP IF EXISTS + FORCE).
 */
async function ensureDatabase(url: string): Promise<void> {
  const parsed = new URL(url)
  const dbName = parsed.pathname.replace(/^\//, '')
  if (!dbName) throw new Error(`DATABASE_URL must include a database name: ${url}`)

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = postgres(adminUrl.toString(), { max: 1, prepare: false })

  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
    console.log(`Created database "${dbName}".`)
  } else {
    console.log(`Database "${dbName}" already exists.`)
  }
  await admin.end()
}

// Full DDL mirroring schema.ts. Column types/defaults match the drizzle
// definitions. uuid PKs rely on gen_random_uuid() (built-in since PG13).
const DDL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  slug varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_slug_unique_idx ON workspaces(slug);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  permissions text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_unique ON roles(name);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  password_hash text NOT NULL,
  full_name varchar(100),
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique_idx ON users(email);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  family_id uuid NOT NULL,
  replaced_by_token_id uuid,
  ip_address varchar(45),
  is_revoked boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_token_hash_idx ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS refresh_token_family_idx ON refresh_tokens(family_id);
ALTER TABLE refresh_tokens
  DROP CONSTRAINT IF EXISTS refresh_tokens_replaced_by_token_id_fkey;
ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_replaced_by_token_id_fkey
  FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS workspaces_table_placeholder(id int); -- no-op guard

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

DROP TABLE IF EXISTS workspaces_table_placeholder;

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  device_id varchar(100) NOT NULL,
  name varchar(100) NOT NULL,
  status varchar(50) NOT NULL,
  basic_auth_user varchar(100) NOT NULL,
  enc_ciphertext text NOT NULL,
  enc_iv varchar(100) NOT NULL,
  enc_tag varchar(100) NOT NULL,
  enc_key_id varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_id_workspace_idx ON devices(device_id, workspace_id);

CREATE TABLE IF NOT EXISTS device_members (
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, user_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  jid varchar(100) NOT NULL,
  name varchar(255),
  phone_number varchar(30) NOT NULL,
  email varchar(255),
  notes text,
  source_device_id varchar(100),
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contact_jid_workspace_idx ON contacts(jid, workspace_id);
CREATE INDEX IF NOT EXISTS contact_assigned_user_idx ON contacts(assigned_user_id);

-- Idempotent column add + index for the source_device_id column (added in v0.2).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source_device_id varchar(100);
CREATE INDEX IF NOT EXISTS contact_source_device_idx ON contacts(workspace_id, source_device_id);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  color varchar(20) NOT NULL DEFAULT '#CCCCCC',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS chats_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  jid varchar(100) NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  last_opened_at timestamptz,
  status varchar(50) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_jid_device_idx ON chats_metadata(jid, device_id);
CREATE INDEX IF NOT EXISTS chat_workspace_jid_idx ON chats_metadata(workspace_id, jid);

CREATE TABLE IF NOT EXISTS chat_read_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_jid varchar(100) NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  last_read_message_id varchar(255)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_read_cursor_idx ON chat_read_cursors(user_id, chat_jid, device_id);

CREATE TABLE IF NOT EXISTS messages_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id varchar(255) NOT NULL,
  jid varchar(100) NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  direction varchar(10) NOT NULL,
  message_type varchar(30) NOT NULL,
  status varchar(20) NOT NULL,
  content_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS msg_history_id_idx ON messages_history(message_id);
CREATE INDEX IF NOT EXISTS msg_workspace_jid_created_idx ON messages_history(workspace_id, jid, created_at);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  message_template text NOT NULL,
  delay_min integer NOT NULL DEFAULT 5,
  delay_max integer NOT NULL DEFAULT 15,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  error_message text,
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  target_type varchar(50) NOT NULL,
  target_id varchar(100),
  payload jsonb,
  ip_address varchar(45) NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  file_size integer NOT NULL,
  storage_path text NOT NULL,
  uploader_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`

async function applyRlsPolicies(db: ReturnType<typeof drizzle>): Promise<void> {
  const rlsPath = path.join(__dirname, 'rls.sql')
  if (!fs.existsSync(rlsPath)) {
    console.warn(`RLS SQL not found at ${rlsPath} — skipping.`)
    return
  }
  const rlsSql = fs.readFileSync(rlsPath, 'utf-8')
  await db.execute(sql.raw(rlsSql))
  console.log('Applied RLS policies + audit triggers.')
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set.')

  await ensureDatabase(url)

  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { schema })

  console.log('Applying schema DDL...')
  await db.execute(sql.raw(DDL))
  console.log('Schema DDL applied.')

  await applyRlsPolicies(db)

  await client.end()
  console.log('Migration complete. Run `npm run seed` next.')
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
