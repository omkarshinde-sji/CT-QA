
-- Demo seed data: skip rows when referenced projects/users are absent
INSERT INTO project_members (project_id, user_id, role)
SELECT v.project_id, v.user_id, v.role
FROM (
  VALUES
    ('3ecefe6b-556a-4abf-ade5-6843c807f7ce'::uuid, 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39'::uuid, 'member'),
    ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5'::uuid, 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39'::uuid, 'member'),
    ('3ecefe6b-556a-4abf-ade5-6843c807f7ce'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'manager'),
    ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'manager'),
    ('7dc6bd63-56ec-4697-87a7-f4cee514ceaa'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'manager'),
    ('433fb262-7ab2-4a2c-b26d-c40a1eb70d76'::uuid, 'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid, 'viewer')
) AS v(project_id, user_id, role)
WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = v.project_id)
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO meetings (id, title, description, organizer_id, scheduled_at, duration_minutes, status, meeting_type, slug, summary, action_items, notes)
SELECT v.id, v.title, v.description, v.organizer_id, v.scheduled_at, v.duration_minutes, v.status, v.meeting_type, v.slug, v.summary, v.action_items::jsonb, v.notes
FROM (
  VALUES
    ('a1b2c3d4-0001-4000-8000-000000000001'::uuid,
     'Sprint Planning — Platform V2',
     'Plan sprint deliverables for the next two weeks including SSO integration, CSV export, and monitoring setup.',
     '78657387-d518-4b2e-88d8-eca802372ad5'::uuid,
     date_trunc('week', now()) + interval '1 day 10 hours',
     60, 'scheduled', 'internal', 'sprint-planning-platform-v2',
     'Team aligned on 3 key deliverables: SSO integration (IC lead), CSV export for productivity module, and monitoring alerts setup.',
     '["IC to complete SSO Entra integration by March 3", "PM to finalize CSV export requirements", "Admin to configure monitoring alerts in Datadog"]',
     'Sprint velocity target: 34 points. Carry-over from last sprint: 8 points.'),
    ('a1b2c3d4-0002-4000-8000-000000000002'::uuid,
     'Acme Corp — Quarterly Business Review',
     'Review Q4 performance metrics, discuss renewal terms, and present roadmap for Q1.',
     'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid,
     date_trunc('week', now()) + interval '2 days 14 hours',
     90, 'scheduled', 'client', 'acme-corp-qbr',
     'Acme expressed strong satisfaction with platform adoption (87% DAU). Renewal confirmed at +15% uplift.',
     '["Send updated pricing proposal by Friday", "Schedule technical deep-dive on SSO for Acme IT team", "Share Q1 product roadmap PDF"]',
     'Key stakeholders present: VP Engineering, Director of Product, IT Manager. NPS score: 9/10.'),
    ('a1b2c3d4-0003-4000-8000-000000000003'::uuid,
     'FinEdge — Proof of Concept Demo',
     'Live demo of the platform for FinEdge evaluation team. Focus on compliance features and audit trail.',
     'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid,
     date_trunc('week', now()) + interval '3 days 11 hours',
     45, 'scheduled', 'client', 'finedge-poc-demo',
     NULL::text, NULL::jsonb,
     'Prepare demo environment with sample compliance data. Focus areas: audit logs, RLS, data export.'),
    ('a1b2c3d4-0004-4000-8000-000000000004'::uuid,
     'Leadership Sync — Growth Strategy',
     'Weekly leadership alignment on growth targets, hiring pipeline, and product strategy.',
     'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid,
     date_trunc('week', now()) + interval '4 days 9 hours',
     30, 'scheduled', 'internal', 'leadership-sync-growth',
     'Agreed to accelerate hiring for 2 senior engineers. Q1 revenue tracking 12% above forecast.',
     '["HR to post senior engineer roles by Monday", "CEO to finalize partnership term sheet with CloudNova", "PM to present PLG metrics dashboard next week"]',
     'Attendees: CEO, Admin/CTO, PM lead. Mood: optimistic.')
) AS v(id, title, description, organizer_id, scheduled_at, duration_minutes, status, meeting_type, slug, summary, action_items, notes)
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.organizer_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status)
SELECT v.meeting_id, v.user_id, v.role, v.rsvp_status
FROM (
  VALUES
    ('a1b2c3d4-0001-4000-8000-000000000001'::uuid, '78657387-d518-4b2e-88d8-eca802372ad5'::uuid, 'organizer', 'accepted'),
    ('a1b2c3d4-0001-4000-8000-000000000001'::uuid, 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39'::uuid, 'attendee', 'accepted'),
    ('a1b2c3d4-0001-4000-8000-000000000001'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'attendee', 'accepted'),
    ('a1b2c3d4-0002-4000-8000-000000000002'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'organizer', 'accepted'),
    ('a1b2c3d4-0002-4000-8000-000000000002'::uuid, '78657387-d518-4b2e-88d8-eca802372ad5'::uuid, 'attendee', 'accepted'),
    ('a1b2c3d4-0002-4000-8000-000000000002'::uuid, 'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid, 'optional', 'tentative'),
    ('a1b2c3d4-0003-4000-8000-000000000003'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'organizer', 'accepted'),
    ('a1b2c3d4-0003-4000-8000-000000000003'::uuid, 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39'::uuid, 'attendee', 'accepted'),
    ('a1b2c3d4-0004-4000-8000-000000000004'::uuid, 'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid, 'organizer', 'accepted'),
    ('a1b2c3d4-0004-4000-8000-000000000004'::uuid, '78657387-d518-4b2e-88d8-eca802372ad5'::uuid, 'attendee', 'accepted'),
    ('a1b2c3d4-0004-4000-8000-000000000004'::uuid, 'e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'attendee', 'accepted')
) AS v(meeting_id, user_id, role, rsvp_status)
WHERE EXISTS (SELECT 1 FROM meetings m WHERE m.id = v.meeting_id)
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO ai_digest_logs (user_id, digest_type, subject, summary, was_read, sent_at)
SELECT v.user_id, v.digest_type, v.subject, v.summary::jsonb, v.was_read, v.sent_at
FROM (
  VALUES
    ('78657387-d518-4b2e-88d8-eca802372ad5'::uuid, 'daily', 'Your Daily Digest — Feb 25',
     '{"highlights": ["Sprint Planning scheduled for tomorrow at 10 AM", "3 tasks in progress: SSO, Newsletter, Access Review", "Acme QBR on Wednesday"], "tasks_due": 3, "meetings_today": 1, "action_items": 2}',
     false, now() - interval '2 hours'),
    ('c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid, 'daily', 'CEO Daily Brief — Feb 25',
     '{"highlights": ["Q1 revenue tracking 12% above forecast", "Leadership Sync scheduled for Thursday", "2 pending decisions: Acme billing, quarterly review"], "tasks_due": 2, "meetings_today": 0, "action_items": 1}',
     false, now() - interval '2 hours'),
    ('e46a6d4e-d69e-4bf5-9341-ba998e8da243'::uuid, 'daily', 'PM Daily Digest — Feb 25',
     '{"highlights": ["Acme Corp onboarding in progress — 60% complete", "FinEdge POC demo on Thursday", "Case study draft due this week", "3 projects actively managed"], "tasks_due": 4, "meetings_today": 0, "action_items": 3}',
     false, now() - interval '2 hours'),
    ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39'::uuid, 'daily', 'Your Daily Digest — Feb 25',
     '{"highlights": ["SSO integration — in progress, targeting March 3", "Sprint Planning tomorrow at 10 AM", "FinEdge demo prep needed by Thursday", "6 tasks assigned, 1 in progress"], "tasks_due": 5, "meetings_today": 0, "action_items": 2}',
     false, now() - interval '2 hours')
) AS v(user_id, digest_type, subject, summary, was_read, sent_at)
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id);
