-- Personalized activity trackers (gym, reading, etc.) per user

alter table public.app_settings
  add column if not exists trackers jsonb not null default '[]'::jsonb;

alter table public.gym_sessions
  add column if not exists tracker_id text not null default 'gym';

create index if not exists gym_sessions_user_tracker_month_idx
  on public.gym_sessions (user_id, tracker_id, month);
