-- =====================================================================
-- Players choose their own display name on first sign-in.
-- New accounts start with name_confirmed = false (pre-filled from Google);
-- the app asks them to confirm or change it before entering the league.
-- Display names are unique (case-insensitive) so "Recorded by" is clear.
-- =====================================================================

alter table public.profiles add column name_confirmed boolean not null default false;

-- Accounts that already exist keep their current names.
update public.profiles set name_confirmed = true;

create or replace function public.update_my_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := regexp_replace(btrim(coalesce(new_name, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if char_length(clean) not between 2 and 40 then
    raise exception 'Name must be 2–40 characters.';
  end if;
  if exists (select 1 from public.profiles where lower(display_name) = lower(clean) and id <> auth.uid()) then
    raise exception 'That name is already taken by another player.';
  end if;
  update public.profiles set display_name = clean, name_confirmed = true where id = auth.uid();
end;
$$;
