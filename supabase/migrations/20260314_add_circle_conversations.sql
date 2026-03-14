-- Add persistent circle conversations so each community circle can open
-- into a real shared chat instead of a mock/filter-only state.

alter table public.conversations
  add column if not exists kind text not null default 'direct',
  add column if not exists circle_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_kind_check'
  ) then
    alter table public.conversations
      add constraint conversations_kind_check
      check (kind in ('direct', 'circle'));
  end if;
end
$$;

create index if not exists conversations_kind_idx
  on public.conversations (kind);

create index if not exists conversations_circle_name_idx
  on public.conversations (circle_name)
  where circle_name is not null;

create unique index if not exists conversations_circle_name_unique_idx
  on public.conversations (lower(circle_name))
  where kind = 'circle' and circle_name is not null;

create or replace function public.get_or_create_circle_conversation(p_circle_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_circle_name text := nullif(trim(p_circle_name), '');
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if v_circle_name is null then
    raise exception 'Circle name is required.';
  end if;

  loop
    select c.id
      into v_conversation_id
    from public.conversations c
    where c.kind = 'circle'
      and lower(c.circle_name) = lower(v_circle_name)
    limit 1;

    exit when v_conversation_id is not null;

    begin
      insert into public.conversations (created_by, kind, circle_name)
      values (v_user_id, 'circle', v_circle_name)
      returning id into v_conversation_id;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, v_user_id)
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

grant execute
on function public.get_or_create_circle_conversation(text)
to authenticated;

-- Keep circle cards live when membership/profile data changes.
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;
