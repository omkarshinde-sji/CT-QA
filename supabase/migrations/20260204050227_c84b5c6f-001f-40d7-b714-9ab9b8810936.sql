-- Insert Google Meet integration fields (client_id and client_secret)
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  is_required,
  display_order,
  placeholder,
  help_text
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type,
  v.is_required,
  v.display_order,
  v.placeholder,
  v.help_text
FROM integration_providers p
CROSS JOIN (
  VALUES
    (
      'client_id',
      'Client ID',
      'text',
      true,
      1,
      'Enter your Google OAuth Client ID',
      'Get this from the Google Cloud Console under APIs & Services > Credentials'
    ),
    (
      'client_secret',
      'Client Secret',
      'password',
      true,
      2,
      'Enter your Google OAuth Client Secret',
      'Get this from the Google Cloud Console under APIs & Services > Credentials'
    )
) AS v(field_key, label, field_type, is_required, display_order, placeholder, help_text)
WHERE p.slug = 'google-meet'
ON CONFLICT (provider_id, field_key) DO NOTHING;
