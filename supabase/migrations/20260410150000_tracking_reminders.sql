-- Tracking reminder preferences (browser notifications + in-app nudges)

alter table public.app_settings
  add column if not exists tracking_reminders jsonb not null default '{
    "enabled": false,
    "time": "20:00",
    "days": [0, 1, 2, 3, 4, 5, 6],
    "last_sent_at": null
  }'::jsonb;
