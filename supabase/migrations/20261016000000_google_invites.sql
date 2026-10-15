-- =====================================================================
-- Invite-only sign-in (Google or email).
-- Admins add player emails to `invites`. Supabase Auth calls
-- hook_before_user_created for every new account and rejects any email
-- that has not been invited, so strangers can't even create an account.
-- =====================================================================

create table public.invites (
  email       text primary key check (email = lower(btrim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role        text not null default 'user' check (role in ('user', 'admin')),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invites enable row level security;
revoke all on public.invites from anon;
create policy "Admins read invites"   on public.invites for select to authenticated using (public.is_admin());
create policy "Admins create invites" on public.invites for insert to authenticated with check (public.is_admin());
create policy "Admins update invites" on public.invites for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete invites" on public.invites for delete to authenticated using (public.is_admin());

create function public.invites_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.invited_by := coalesce(auth.uid(), new.invited_by);
  new.created_at := now();
  new.accepted_at := null;
  return new;
end;
$$;

create trigger invites_before_insert
  before insert on public.invites
  for each row execute function public.invites_before_insert();

-- ---------------------------------------------------------------------
-- Auth hook: runs inside Supabase Auth before any user is created
-- (Google sign-in, email sign-up, or the admin API).
-- Allowed: invited emails, plus the very first account of a brand-new
-- league (so the owner can sign in and claim the administrator role).
-- ---------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if user_email <> '' and exists (select 1 from public.invites where email = user_email) then
    return '{}'::jsonb;
  end if;
  if not exists (select 1 from public.profiles) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email has not been invited to the league. Ask a league administrator to invite you.'
  ));
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant select on public.invites, public.profiles to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- New profiles take their role from the invite, and their display name
-- from Google ("full_name"/"name") when available.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites where email = lower(btrim(coalesce(new.email, '')));
  insert into public.profiles (id, email, display_name, role, must_change_password)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(inv.role, 'user'),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  if inv.email is not null then
    update public.invites set accepted_at = now() where email = inv.email;
  end if;
  return new;
end;
$$;
