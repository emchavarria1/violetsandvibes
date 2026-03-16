-- Let users send a more human first signal than a binary swipe.
-- Stored on the existing likes relationship so matching still works.

alter table public.likes
  add column if not exists vibe text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'likes_vibe_check'
  ) then
    alter table public.likes
      add constraint likes_vibe_check
      check (
        vibe is null
        or vibe in ('curious', 'friendly', 'flirty', 'intrigued')
      );
  end if;
end
$$;

create index if not exists likes_liked_id_vibe_idx
  on public.likes (liked_id, vibe)
  where vibe is not null;
