-- ============================================================================
-- Setup Lead Follow-Up System Settings
-- ============================================================================
-- Initializes system_settings for lead follow-up module configuration.
-- ============================================================================

INSERT INTO system_settings (
  category,
  key,
  value,
  description,
  created_at,
  updated_at
) VALUES
  (
    'lead_followup',
    'min_interval_days',
    to_jsonb(3),
    'Minimum allowed follow-up interval in days',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'max_interval_days',
    to_jsonb(90),
    'Maximum allowed follow-up interval in days',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'default_interval_days',
    to_jsonb(7),
    'Default follow-up interval in days',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_open_tracking',
    to_jsonb(true),
    'Enable email open tracking via pixels',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_click_tracking',
    to_jsonb(true),
    'Enable email click tracking via link rewriting',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'auto_status_enabled',
    to_jsonb(true),
    'Enable automatic status rule application',
    NOW(),
    NOW()
  )
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
