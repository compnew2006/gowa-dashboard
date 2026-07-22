-- ============================================================================
-- POSTGRESQL ROW-LEVEL SECURITY (RLS)
-- Enforces complete tenant isolation at the database level.
-- This script is IDEMPOTENT: safe to run repeatedly (DROP IF EXISTS + CREATE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS + FORCE it on the owner (without FORCE, table owners and
--    BYPASSRLS roles skip every policy below — a silent isolation hole).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'devices', 'contacts', 'chats_metadata', 'chat_read_cursors',
    'messages_history', 'campaigns', 'audit_logs', 'media_assets',
    'workspace_members', 'tags', 'refresh_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE makes the table owner subject to the policies too.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tenant-isolation policies.
--    Each policy reads the session variable set by TenancyService. The
--    NULLIF(...,'') lets an unset/empty variable match nothing (deny by default).
-- ----------------------------------------------------------------------------

-- Helper: drop + recreate pattern so the script is re-runnable.
CREATE OR REPLACE FUNCTION gowa_replace_policy(tbl TEXT, pol TEXT, body TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
  EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (%s)', pol, tbl, body);
END $$;

-- Direct workspace_id-scoped tables
SELECT gowa_replace_policy('devices',          'device_tenant_policy',          'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('contacts',         'contact_tenant_policy',         'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('chats_metadata',   'chat_metadata_tenant_policy',   'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('chat_read_cursors','chat_read_cursor_tenant_policy','workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('messages_history', 'messages_history_tenant_policy','workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('campaigns',        'campaign_tenant_policy',        'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('audit_logs',       'audit_log_tenant_policy',       'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('media_assets',     'media_asset_tenant_policy',     'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');
SELECT gowa_replace_policy('tags',             'tag_tenant_policy',             'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');

-- Composite policies for join tables without a direct workspace_id column.

-- workspace_members: visible iff the workspace_id matches the tenant context.
SELECT gowa_replace_policy('workspace_members', 'workspace_member_tenant_policy',
  'workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid');

-- refresh_tokens: scoped by the user's workspace. We join users -> workspace_members.
SELECT gowa_replace_policy('refresh_tokens', 'refresh_token_tenant_policy',
  'user_id IN (
     SELECT wm.user_id FROM workspace_members wm
     WHERE wm.workspace_id = NULLIF(current_setting(''app.current_workspace_id'', true), '''')::uuid
   )');

-- ----------------------------------------------------------------------------
-- 3. Audit-log trigger function (idempotent CREATE OR REPLACE).
--    SECURITY DEFINER so it can write to audit_logs even though the caller is
--    subject to RLS. The trigger reads the same session variables as the RLS
--    policies, so the audit row inherits the current tenant context.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_tenant_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
  v_target_id text;
  v_new jsonb;
  v_old jsonb;
  v_new_json jsonb;
  v_old_json jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_workspace_id := OLD.workspace_id;
    -- composite-PK tables (workspace_members) have no `id`; fall back to the
    -- whole row's primary-key-ish fields concatenated.
    v_target_id := COALESCE((v_old_json->>'id'), concat_ws('|', v_old_json->>'workspace_id', v_old_json->>'user_id'));
    v_new := NULL;
    v_old := v_old_json;
  ELSE
    v_new_json := to_jsonb(NEW);
    v_workspace_id := NEW.workspace_id;
    v_target_id := COALESCE((v_new_json->>'id'), concat_ws('|', v_new_json->>'workspace_id', v_new_json->>'user_id'));
    v_new := v_new_json;
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  END IF;

  INSERT INTO audit_logs (
    id, workspace_id, user_id, action, target_type, target_id,
    payload, ip_address, user_agent, created_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    TG_ARGV[0],
    TG_TABLE_NAME,
    v_target_id,
    jsonb_build_object('op', TG_OP, 'new', v_new, 'old', v_old),
    COALESCE(NULLIF(current_setting('app.current_ip_address', true), ''), '0.0.0.0'),
    COALESCE(NULLIF(current_setting('app.current_user_agent', true), ''), 'system'),
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind triggers idempotently.
DROP TRIGGER IF EXISTS audit_device_mutation ON devices;
CREATE TRIGGER audit_device_mutation
  AFTER INSERT OR UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('device.mutate');

DROP TRIGGER IF EXISTS audit_campaign_mutation ON campaigns;
CREATE TRIGGER audit_campaign_mutation
  AFTER INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('campaign.mutate');

DROP TRIGGER IF EXISTS audit_contact_mutation ON contacts;
CREATE TRIGGER audit_contact_mutation
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('contact.mutate');

DROP TRIGGER IF EXISTS audit_message_insert ON messages_history;
CREATE TRIGGER audit_message_insert
  AFTER INSERT ON messages_history
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('message.persisted');

DROP TRIGGER IF EXISTS audit_workspace_member_mutation ON workspace_members;
CREATE TRIGGER audit_workspace_member_mutation
  AFTER INSERT OR UPDATE OR DELETE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('workspace_member.mutate');

-- Cleanup helper.
DROP FUNCTION IF EXISTS gowa_replace_policy(TEXT, TEXT, TEXT);
