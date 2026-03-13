-- Ensure notifications alert actions (mark read / clear read) are reliable.
-- This migration normalizes RLS and enables realtime publication for notifications.

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notifications'
      and p.polname = 'notifications_select_own'
  ) then
    execute $sql$
      create policy notifications_select_own
      on public.notifications
      for select
      to authenticated
      using (recipient_id = (select auth.uid()));
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notifications'
      and p.polname = 'notifications_update_own'
  ) then
    execute $sql$
      create policy notifications_update_own
      on public.notifications
      for update
      to authenticated
      using (recipient_id = (select auth.uid()))
      with check (recipient_id = (select auth.uid()));
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notifications'
      and p.polname = 'notifications_delete_own'
  ) then
    execute $sql$
      create policy notifications_delete_own
      on public.notifications
      for delete
      to authenticated
      using (recipient_id = (select auth.uid()));
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notifications'
      and p.polname = 'notifications_service_all'
  ) then
    execute $sql$
      create policy notifications_service_all
      on public.notifications
      for all
      to service_role
      using (true)
      with check (true);
    $sql$;
  end if;
end
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;
