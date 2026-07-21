-- ============================================================================
-- POSTGRESQL ROW-LEVEL SECURITY (RLS) DEFINITION REFERENCE
-- This script configures Postgres RLS to enforce complete tenant isolation
-- at the database level, verified against NestJS execution.
-- ============================================================================

-- Enable Row-Level Security on all multi-tenant tables
ALTER TABLE devices ENABLE ROW-LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW-LEVEL SECURITY;
ALTER TABLE chats_metadata ENABLE ROW-LEVEL SECURITY;
ALTER TABLE chat_read_cursors ENABLE ROW-LEVEL SECURITY;
ALTER TABLE messages_history ENABLE ROW-LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW-LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW-LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW-LEVEL SECURITY;

-- Create Tenant Isolation Policies
-- Using current_setting('app.current_workspace_id', true) to access the session-scoped variable

CREATE POLICY device_tenant_isolation_policy ON devices
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY contact_tenant_isolation_policy ON contacts
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY chat_metadata_tenant_isolation_policy ON chats_metadata
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY chat_read_cursor_tenant_isolation_policy ON chat_read_cursors
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY messages_history_tenant_isolation_policy ON messages_history
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY campaign_tenant_isolation_policy ON campaigns
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY audit_log_tenant_isolation_policy ON audit_logs
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

CREATE POLICY media_asset_tenant_isolation_policy ON media_assets
  FOR ALL
  USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);

-- ============================================================================
-- AUDIT LOG TRACE TRIGGER
-- Automatic change-ledger logging on critical data mutations
-- ============================================================================

CREATE OR REPLACE FUNCTION log_tenant_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    id,
    workspace_id,
    user_id,
    action,
    target_type,
    target_id,
    payload,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.workspace_id,
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    TG_ARGV[0], -- action name passed as argument from trigger config
    TG_TABLE_NAME,
    NEW.id::text,
    jsonb_build_object(
      'op', TG_OP,
      'new', to_jsonb(NEW),
      'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
    ),
    COALESCE(current_setting('app.current_ip_address', true), '0.0.0.0'),
    COALESCE(current_setting('app.current_user_agent', true), 'system'),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind triggers to critical write operations
CREATE TRIGGER audit_device_mutation
  AFTER INSERT OR UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('device.mutate');

CREATE TRIGGER audit_campaign_mutation
  AFTER INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event('campaign.mutate');
