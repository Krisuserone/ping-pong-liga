-- =====================================================================
-- Table Tennis League — initial schema
-- Tables: profiles (app users), players, matches, app_settings
-- Statistics are never stored: the player_stats view derives them from
-- matches, so they can never drift out of sync with the actual results.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles: one row per auth user, holding role and account status.
-- ---------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  display_name         text not null,
  role                 text not null default 'user'   check (role in ('user', 'admin')),
  status               text not null default 'active' check (status in ('active', 'disabled')),
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now()
);

comment on column public.profiles.id is 'Equals auth.users.id (the authentication provider ID).';

-- Create a profile automatically whenever an auth user is created.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, must_change_password)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep the email on the profile in sync if a user changes it.
create function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_change();

-- ---------------------------------------------------------------------
-- Permission helpers (security definer so they can read profiles
-- without recursing through RLS).
-- ---------------------------------------------------------------------
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------
create table public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 60),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

-- Case/whitespace-insensitive uniqueness prevents duplicate players.
create unique index players_name_unique on public.players (lower(btrim(name)));

create function public.players_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger players_before_write
  before insert or update on public.players
  for each row execute function public.players_before_write();

-- ---------------------------------------------------------------------
-- Matches (one row = one game to 21)
-- ---------------------------------------------------------------------
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  player_a_id    uuid not null references public.players (id) on delete restrict,
  player_b_id    uuid not null references public.players (id) on delete restrict,
  player_a_score integer not null,
  player_b_score integer not null,
  match_date     date not null default current_date,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null,
  constraint matches_different_players check (player_a_id <> player_b_id),
  constraint matches_score_a_range     check (player_a_score between 0 and 21),
  constraint matches_score_b_range     check (player_b_score between 0 and 21),
  constraint matches_no_tie            check (player_a_score <> player_b_score),
  constraint matches_date_not_future   check (match_date <= current_date + 1)
);

create index matches_match_date_idx on public.matches (match_date desc, created_at desc);
create index matches_player_a_idx   on public.matches (player_a_id);
create index matches_player_b_idx   on public.matches (player_b_id);

create function public.matches_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- The recorder is always the signed-in user; it cannot be spoofed.
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if not exists (select 1 from public.players where id = new.player_a_id and active)
       or not exists (select 1 from public.players where id = new.player_b_id and active) then
      raise exception 'Both players must be active players.' using errcode = 'P0001';
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function public.matches_before_write();

-- ---------------------------------------------------------------------
-- App settings (single row)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id          integer primary key default 1 check (id = 1),
  league_name text not null default 'Table Tennis League' check (char_length(trim(league_name)) between 1 and 60),
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Statistics view — derived purely from matches.
-- Ranking: wins desc, point difference desc, points scored desc.
-- Players equal on all three share the same rank (shown as tied).
-- Only active players are ranked; inactive players have rank = null.
-- ---------------------------------------------------------------------
create view public.player_stats
with (security_invoker = true)
as
with sides as (
  select player_a_id as player_id, player_a_score as scored, player_b_score as conceded from public.matches
  union all
  select player_b_id, player_b_score, player_a_score from public.matches
),
agg as (
  select
    p.id                                              as player_id,
    p.name,
    p.active,
    p.created_at,
    count(s.player_id)::int                           as games_played,
    count(*) filter (where s.scored > s.conceded)::int as wins,
    count(*) filter (where s.scored < s.conceded)::int as losses,
    coalesce(sum(s.scored), 0)::int                   as points_scored,
    coalesce(sum(s.conceded), 0)::int                 as points_conceded
  from public.players p
  left join sides s on s.player_id = p.id
  group by p.id
)
select
  agg.*,
  (points_scored - points_conceded)::int as point_difference,
  case when active then
    (rank() over (partition by active order by wins desc, points_scored - points_conceded desc, points_scored desc))::int
  end as rank
from agg;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.players      enable row level security;
alter table public.matches      enable row level security;
alter table public.app_settings enable row level security;

-- Nothing is visible to anonymous visitors.
revoke all on public.profiles, public.players, public.matches, public.app_settings, public.player_stats from anon;

-- Profiles: active users can see who is in the league (for "Recorded by").
-- All profile changes go through the security-definer functions below.
create policy "Active users read profiles" on public.profiles
  for select to authenticated using (public.is_active_user() or id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;

-- Players
create policy "Active users read players" on public.players
  for select to authenticated using (public.is_active_user());
create policy "Admins add players" on public.players
  for insert to authenticated with check (public.is_admin());
create policy "Admins update players" on public.players
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- No delete: players are deactivated, never deleted, so history is kept.
revoke delete on public.players from authenticated;

-- Matches
create policy "Active users read matches" on public.matches
  for select to authenticated using (public.is_active_user());
create policy "Active users record matches" on public.matches
  for insert to authenticated with check (public.is_active_user());
create policy "Admins edit matches" on public.matches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete matches" on public.matches
  for delete to authenticated using (public.is_admin());

-- Settings
create policy "Active users read settings" on public.app_settings
  for select to authenticated using (public.is_active_user());
create policy "Admins update settings" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.app_settings from authenticated;

-- ---------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------

-- True while no administrator exists yet (initial setup screen).
create function public.setup_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not exists (select 1 from public.profiles where role = 'admin');
$$;

-- The first signed-in user may claim the administrator role, exactly once.
-- Public sign-up is disabled, so only accounts created by the project
-- owner can ever reach this.
create function public.claim_initial_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  perform pg_advisory_xact_lock(hashtext('claim_initial_admin'));
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  update public.profiles set role = 'admin', status = 'active' where id = auth.uid();
  return found;
end;
$$;

create function public.admin_set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change roles.' using errcode = '42501';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Invalid role.';
  end if;
  perform pg_advisory_xact_lock(hashtext('admin_membership'));
  if new_role = 'user' and not exists (
    select 1 from public.profiles
    where role = 'admin' and status = 'active' and id <> target
  ) then
    raise exception 'The league must keep at least one active administrator.';
  end if;
  update public.profiles set role = new_role where id = target;
  if not found then raise exception 'User not found.'; end if;
end;
$$;

create function public.admin_set_user_status(target uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change account status.' using errcode = '42501';
  end if;
  if new_status not in ('active', 'disabled') then
    raise exception 'Invalid status.';
  end if;
  perform pg_advisory_xact_lock(hashtext('admin_membership'));
  if new_status = 'disabled' and not exists (
    select 1 from public.profiles
    where role = 'admin' and status = 'active' and id <> target
  ) and exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'The league must keep at least one active administrator.';
  end if;
  update public.profiles set status = new_status where id = target;
  if not found then raise exception 'User not found.'; end if;
end;
$$;

create function public.update_my_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  if char_length(btrim(coalesce(new_name, ''))) not between 1 and 60 then
    raise exception 'Display name must be 1–60 characters.';
  end if;
  update public.profiles set display_name = btrim(new_name) where id = auth.uid();
end;
$$;

-- Called after the user has successfully set a new password.
create function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- Function privileges: signed-in users only.
revoke execute on function
  public.is_active_user(), public.is_admin(), public.setup_required(), public.claim_initial_admin(),
  public.admin_set_user_role(uuid, text), public.admin_set_user_status(uuid, text),
  public.update_my_display_name(text), public.clear_must_change_password()
from public, anon;
grant execute on function
  public.is_active_user(), public.is_admin(), public.setup_required(), public.claim_initial_admin(),
  public.admin_set_user_role(uuid, text), public.admin_set_user_status(uuid, text),
  public.update_my_display_name(text), public.clear_must_change_password()
to authenticated;

revoke execute on function public.handle_new_auth_user(), public.handle_auth_user_email_change(),
  public.players_before_write(), public.matches_before_write()
from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: push match/player changes so every open screen refreshes.
-- (RLS still applies to realtime messages.)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.matches, public.players;
