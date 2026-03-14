-- Enable community visibility for local events and add info-request flow.
-- Owners can still edit/delete only their own events via existing policies.

-- 1) Allow authenticated users to view local community events from others.
do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'calendar_events'
      and p.polname = 'calendar_events_select_shared_local'
  ) then
    execute $sql$
      create policy calendar_events_select_shared_local
      on public.calendar_events
      for select
      to authenticated
      using (source = 'local');
    $sql$;
  end if;
end
$$;

-- 2) Requests for more event information.
create table if not exists public.calendar_event_info_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_info_requests_no_self check (requester_id <> owner_id),
  unique (event_id, requester_id)
);

create index if not exists calendar_event_info_requests_event_idx
  on public.calendar_event_info_requests (event_id);

create index if not exists calendar_event_info_requests_owner_idx
  on public.calendar_event_info_requests (owner_id, status, created_at desc);

create index if not exists calendar_event_info_requests_requester_idx
  on public.calendar_event_info_requests (requester_id, created_at desc);

create or replace function public.set_calendar_event_info_request_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select e.user_id into v_owner_id
  from public.calendar_events e
  where e.id = new.event_id;

  if v_owner_id is null then
    raise exception 'Event % does not exist.', new.event_id;
  end if;

  new.owner_id := v_owner_id;
  new.updated_at := now();

  if new.requester_id = new.owner_id then
    raise exception 'You cannot request more info on your own event.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_calendar_event_info_request_owner on public.calendar_event_info_requests;
create trigger trg_set_calendar_event_info_request_owner
before insert or update on public.calendar_event_info_requests
for each row
execute function public.set_calendar_event_info_request_owner();

create or replace function public.set_calendar_event_info_request_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_calendar_event_info_request_updated_at on public.calendar_event_info_requests;
create trigger trg_set_calendar_event_info_request_updated_at
before update on public.calendar_event_info_requests
for each row
execute function public.set_calendar_event_info_request_updated_at();

alter table public.calendar_event_info_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'calendar_event_info_requests'
      and p.polname = 'calendar_event_info_requests_select_participant'
  ) then
    execute $sql$
      create policy calendar_event_info_requests_select_participant
      on public.calendar_event_info_requests
      for select
      to authenticated
      using (
        requester_id = (select auth.uid())
        or owner_id = (select auth.uid())
      );
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'calendar_event_info_requests'
      and p.polname = 'calendar_event_info_requests_insert_own'
  ) then
    execute $sql$
      create policy calendar_event_info_requests_insert_own
      on public.calendar_event_info_requests
      for insert
      to authenticated
      with check (requester_id = (select auth.uid()));
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'calendar_event_info_requests'
      and p.polname = 'calendar_event_info_requests_update_owner'
  ) then
    execute $sql$
      create policy calendar_event_info_requests_update_owner
      on public.calendar_event_info_requests
      for update
      to authenticated
      using (owner_id = (select auth.uid()))
      with check (owner_id = (select auth.uid()));
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'calendar_event_info_requests'
      and p.polname = 'calendar_event_info_requests_delete_participant'
  ) then
    execute $sql$
      create policy calendar_event_info_requests_delete_participant
      on public.calendar_event_info_requests
      for delete
      to authenticated
      using (
        requester_id = (select auth.uid())
        or owner_id = (select auth.uid())
      );
    $sql$;
  end if;
end
$$;
