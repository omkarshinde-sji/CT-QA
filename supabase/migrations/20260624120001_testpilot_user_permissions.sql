-- Grant testpilot module access to users who already have per-module restrictions

INSERT INTO public.user_module_permissions (user_id, module_id)
SELECT DISTINCT ump.user_id, am.id
FROM public.user_module_permissions ump
CROSS JOIN public.app_modules am
WHERE am.slug = 'testpilot'
ON CONFLICT (user_id, module_id) DO NOTHING;
