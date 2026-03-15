-- Let users keep calendar events private or share them intentionally.
-- Private events stay on the user's own calendar only.
-- Shared and circle events remain visible to the community according to RLS.

alter table public.calendar_events
  add column if not exists visibility text;

update public.calendar_events
set visibility = case
  when circle_name is not null then 'circle'
  else 'shared'
end
where visibility is null;

alter table public.calendar_events
  alter column visibility set default 'shared';

alter table public.calendar_events
  alter column visibility set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_visibility_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_visibility_check
      check (visibility in ('private', 'shared', 'circle'));
  end if;
end
$$;

create index if not exists calendar_events_user_visibility_idx
  on public.calendar_events (user_id, visibility, starts_at);

drop policy if exists calendar_events_select_shared_local on public.calendar_events;

create policy calendar_events_select_shared_local
on public.calendar_events
for select
to authenticated
using (
  source = 'local'
  and visibility in ('shared', 'circle')
);
