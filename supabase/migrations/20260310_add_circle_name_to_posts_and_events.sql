alter table public.posts
  add column if not exists circle_name text;

create index if not exists posts_circle_name_idx
  on public.posts (circle_name);

alter table public.calendar_events
  add column if not exists circle_name text;

create index if not exists calendar_events_circle_name_idx
  on public.calendar_events (circle_name);
