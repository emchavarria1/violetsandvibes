-- Keep circle chat memberships aligned with profile privacy_settings.social_circles
-- and backfill existing users so joined circles already have memberships.

create or replace function public.sync_circle_memberships_for_user(
  p_user_id uuid,
  p_privacy_settings jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle_name text;
  v_conversation_id uuid;
begin
  if p_user_id is null then
    return;
  end if;

  -- Remove memberships from circle chats the user no longer belongs to.
  delete from public.conversation_members cm
  using public.conversations c
  where c.id = cm.conversation_id
    and c.kind = 'circle'
    and cm.user_id = p_user_id
    and lower(coalesce(c.circle_name, '')) not in (
      select lower(trim(value))
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(p_privacy_settings -> 'social_circles', '[]'::jsonb)) = 'array'
            then coalesce(p_privacy_settings -> 'social_circles', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as value
      where trim(value) <> ''
    );

  for v_circle_name in
    select distinct trim(value)
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(coalesce(p_privacy_settings -> 'social_circles', '[]'::jsonb)) = 'array'
          then coalesce(p_privacy_settings -> 'social_circles', '[]'::jsonb)
        else '[]'::jsonb
      end
    ) as value
    where trim(value) <> ''
  loop
    insert into public.conversations (created_by, kind, circle_name)
    values (p_user_id, 'circle', v_circle_name)
    on conflict do nothing;

    select c.id
      into v_conversation_id
    from public.conversations c
    where c.kind = 'circle'
      and lower(c.circle_name) = lower(v_circle_name)
    limit 1;

    if v_conversation_id is null then
      continue;
    end if;

    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation_id, p_user_id)
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.sync_circle_memberships_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_circle_memberships_for_user(new.id, new.privacy_settings);
  return new;
end;
$$;

drop trigger if exists trg_sync_circle_memberships_from_profile on public.profiles;
create trigger trg_sync_circle_memberships_from_profile
after insert or update of privacy_settings on public.profiles
for each row
execute function public.sync_circle_memberships_from_profile();

do $$
declare
  v_profile record;
begin
  for v_profile in
    select p.id, p.privacy_settings
    from public.profiles p
  loop
    perform public.sync_circle_memberships_for_user(v_profile.id, v_profile.privacy_settings);
  end loop;
end
$$;
