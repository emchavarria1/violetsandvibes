-- Surface "Send a Vibe" in alerts so recipients see the tone immediately.

alter table public.notifications
  add column if not exists vibe text;

alter table public.notifications
  drop constraint if exists notifications_type_check;

update public.notifications
set type = case lower(btrim(type))
  when 'like' then 'post_like'
  when 'comment' then 'post_comment'
  when 'reply' then 'comment_reply'
  when 'new_post' then 'new_post'
  else lower(btrim(type))
end
where type is not null;

update public.notifications
set type = 'message'
where type is null
   or btrim(type) = ''
   or type not in (
     'post_like',
     'post_comment',
     'comment_reply',
     'match',
     'message',
     'event',
     'new_post',
     'vibe'
   );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_vibe_check'
  ) then
    alter table public.notifications
      add constraint notifications_vibe_check
      check (
        vibe is null
        or vibe in ('curious', 'friendly', 'flirty', 'intrigued')
      );
  end if;
end
$$;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'post_like',
      'post_comment',
      'comment_reply',
      'match',
      'message',
      'event',
      'new_post',
      'vibe'
    )
  );

create unique index if not exists notifications_vibe_unique
  on public.notifications (recipient_id, actor_id, type)
  where type = 'vibe';

create or replace function public.notify_profile_vibe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vibe is null or new.liker_id = new.liked_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.vibe is not distinct from old.vibe then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, vibe, created_at, read_at)
  values (new.liked_id, new.liker_id, 'vibe', new.vibe, now(), null)
  on conflict (recipient_id, actor_id, type)
  where type = 'vibe'
  do update
  set vibe = excluded.vibe,
      created_at = now(),
      read_at = null;

  return new;
end;
$$;

drop trigger if exists trg_notify_profile_vibe on public.likes;
create trigger trg_notify_profile_vibe
after insert or update of vibe on public.likes
for each row
execute function public.notify_profile_vibe();
