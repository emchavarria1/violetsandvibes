create table if not exists public.circle_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint circle_suggestions_name_length_check check (char_length(trim(name)) between 3 and 80),
  constraint circle_suggestions_note_length_check check (note is null or char_length(trim(note)) <= 240),
  constraint circle_suggestions_status_check check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists circle_suggestions_user_created_idx
  on public.circle_suggestions (user_id, created_at desc);

create unique index if not exists circle_suggestions_pending_unique_idx
  on public.circle_suggestions (user_id, lower(name))
  where status = 'pending';

alter table public.circle_suggestions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on p.polrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public'
      and c.relname = 'circle_suggestions'
      and p.polname = 'circle_suggestions_insert_own'
  ) then
    execute $sql$
      create policy circle_suggestions_insert_own
        on public.circle_suggestions
        for insert
        to authenticated
        with check (
          auth.uid() = user_id
          and status = 'pending'
          and char_length(trim(name)) between 3 and 80
          and (note is null or char_length(trim(note)) <= 240)
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
      and c.relname = 'circle_suggestions'
      and p.polname = 'circle_suggestions_select_admin'
  ) then
    execute $sql$
      create policy circle_suggestions_select_admin
        on public.circle_suggestions
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.admin_roles ar
            where ar.user_id = auth.uid()
          )
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
      and c.relname = 'circle_suggestions'
      and p.polname = 'circle_suggestions_update_admin'
  ) then
    execute $sql$
      create policy circle_suggestions_update_admin
        on public.circle_suggestions
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.admin_roles ar
            where ar.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.admin_roles ar
            where ar.user_id = auth.uid()
          )
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
      and c.relname = 'circle_suggestions'
      and p.polname = 'circle_suggestions_select_own'
  ) then
    execute $sql$
      create policy circle_suggestions_select_own
        on public.circle_suggestions
        for select
        to authenticated
        using (auth.uid() = user_id);
    $sql$;
  end if;
end
$$;
