-- Profile gamification: peak XP, level progress, earned badges (syncs across devices)

alter table public.app_settings
  add column if not exists gamification jsonb not null default '{"version":1,"peak_xp":0,"earned_badges":{}}'::jsonb;
