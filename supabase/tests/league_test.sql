-- Database tests: run with `supabase test db` against a local stack.
-- Covers validation, permissions (RLS), statistics and ranking.
begin;
create extension if not exists pgtap with schema extensions;
select plan(58);

-- Start from an empty league. Everything runs inside this transaction and is
-- rolled back at the end, so existing data in the database is never changed.
delete from public.matches;
delete from public.invites;
delete from public.players;
delete from auth.users;

-- Even the very first sign-in to an empty league needs an invite.
select ok(public.hook_before_user_created('{"user":{"email":"first@gmail.com"}}') ? 'error', 'the first sign-in to an empty league still needs an invite');

-- Test accounts --------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'user@test.local',  '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@test.local', '{}');

select is((select count(*)::int from public.profiles), 3, 'profiles are created automatically for new auth users');
select is((select display_name from public.profiles where email = 'user@test.local'), 'user', 'display name defaults to the email prefix');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Initial administrator setup -----------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select ok(public.setup_required(), 'setup is required while no admin exists');
select ok(public.claim_initial_admin(), 'first user can claim admin');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select ok(not public.claim_initial_admin(), 'a second user cannot claim admin');
select ok(not public.setup_required(), 'setup is no longer required');
select ok(not public.is_admin(), 'regular user is not admin');

-- Regular users cannot escalate privileges ------------------------------
select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$, '42501', null, 'users cannot update profiles directly');
select throws_ok($$ select public.admin_set_user_role('00000000-0000-0000-0000-00000000000b', 'admin') $$, '42501', null, 'users cannot change roles via RPC');
select throws_ok($$ insert into public.players (name) values ('Sneaky') $$, '42501', null, 'regular users cannot add players');

-- Admin manages players -------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.players (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Anna'),
  ('10000000-0000-0000-0000-000000000002', 'Ben'),
  ('10000000-0000-0000-0000-000000000003', 'Cleo'),
  ('10000000-0000-0000-0000-000000000004', '  Dev   Patel ');
select is((select name from public.players where id = '10000000-0000-0000-0000-000000000004'), 'Dev Patel', 'player names are trimmed and normalised');
select throws_ok($$ insert into public.players (name) values ('anna ') $$, '23505', null, 'duplicate player names are rejected (case-insensitive)');

-- Recording matches ------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$
  insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score, created_by)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 21, 15, '00000000-0000-0000-0000-00000000000a')
$$, 'regular user can record a valid match');
select is((select created_by from public.matches limit 1), '00000000-0000-0000-0000-00000000000b'::uuid, 'recorder is always the signed-in user (cannot be spoofed)');
select is((select match_date from public.matches limit 1), current_date, 'match date defaults to today');

select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 21, 3) $$, '23514', null, 'a player cannot play themselves');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 22, 3) $$, '23514', null, 'scores above 21 are rejected');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', -1, 3) $$, '23514', null, 'negative scores are rejected');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 21, 21) $$, '23514', null, 'ties are rejected');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 21, '4.5') $$, '22P02', null, 'fractional scores are rejected');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score, match_date)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 21, 4, current_date + 10) $$, '23514', null, 'future dates are rejected');

insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score) values
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 21, 5),   -- Cleo +16
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 10, 21),  -- Anna +11
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 21, 10);  -- Ben +11

-- Statistics -----------------------------------------------------------
-- Anna: 2W 0L 42-25 (+17); Ben: 1W 1L 36-31 (+5); Cleo: 1W 1L 31-26 (+5); Dev: 0W 2L 15-42
select results_eq(
  $$ select name, games_played, wins, losses, points_scored, points_conceded, point_difference, rank
     from public.player_stats order by rank, name $$,
  $$ values ('Anna'::text, 2, 2, 0, 42, 25, 17, 1),
            ('Ben',        2, 1, 1, 36, 31,  5, 2),
            ('Cleo',       2, 1, 1, 31, 26,  5, 3),
            ('Dev Patel',  2, 0, 2, 15, 42, -27, 4) $$,
  'stats and ranking: wins, then point difference, then points scored'
);

-- Regular users cannot edit/delete matches (RLS filters the rows out).
update public.matches set player_a_score = 0 where player_a_score = 21;
delete from public.matches;
select is((select count(*)::int from public.matches), 4, 'regular users cannot edit or delete matches');
select is((select count(*)::int from public.matches where player_a_score = 0), 0, 'regular user update had no effect');

-- Admin corrects a result: Ben–Dev becomes 5–21 (Dev wins) ---------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.matches set player_a_score = 5, player_b_score = 21
  where player_a_id = '10000000-0000-0000-0000-000000000002' and player_b_id = '10000000-0000-0000-0000-000000000004';
select is((select wins from public.player_stats where name = 'Dev Patel'), 1, 'editing a match recalculates wins');
select is((select rank from public.player_stats where name = 'Ben'), 4, 'editing a match recalculates ranks');
select ok((select updated_by = '00000000-0000-0000-0000-00000000000a'::uuid and created_by = '00000000-0000-0000-0000-00000000000b'::uuid
           from public.matches where player_a_id = '10000000-0000-0000-0000-000000000002'), 'edit keeps the recorder and stores the editor');

-- Admin deletes a match.
delete from public.matches where player_a_id = '10000000-0000-0000-0000-000000000003' and player_b_id = '10000000-0000-0000-0000-000000000001';
select is((select games_played from public.player_stats where name = 'Anna'), 1, 'deleting a match recalculates games played');

-- Ties in the standings: Anna (1W +6, 21 pts) vs Cleo (1W +16) ...
-- Make two players exactly level: add Cleo–Anna 15–21 → Anna 2W; then compare equal rows.
select pg_temp.logout();
delete from public.matches;
insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score, created_by) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 21, 11, '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 21, 11, '00000000-0000-0000-0000-00000000000a');
select results_eq($$ select rank from public.player_stats order by rank, name $$, $$ values (1), (1), (3), (3) $$, 'fully level players share a rank');

-- Match-day standings -----------------------------------------------------
-- Last week: only Cleo and Anna played (Cleo won). Today: the two games above.
insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score, match_date, created_by) values
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 21, 0, current_date - 7, '00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select match_date, games from public.match_days() $$,
  $$ values (current_date, 2), (current_date - 7, 1) $$,
  'match_days lists each day with games, newest first'
);
select results_eq(
  $$ select name, games_played, wins, rank from public.match_day_standings(current_date - 7) $$,
  $$ values ('Cleo'::text, 1, 1, 1), ('Anna'::text, 1, 0, 2) $$,
  'match-day standings count only that day''s games and players'
);
select results_eq(
  $$ select name, rank from public.match_day_standings(current_date) $$,
  $$ values ('Anna'::text, 1), ('Ben', 1), ('Cleo', 3), ('Dev Patel', 3) $$,
  'match-day standings use the same rules, including shared ranks'
);
select is((select count(*)::int from public.match_day_standings(current_date - 1)), 0, 'a day without games has no standings');
delete from public.matches where match_date = current_date - 7;

-- Deactivating a player keeps history --------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.players set active = false where name = 'Dev Patel';
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.matches where player_b_id = '10000000-0000-0000-0000-000000000004'), 1, 'inactive player history remains visible');
select is((select rank from public.player_stats where name = 'Dev Patel'), null, 'inactive players are not ranked');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 21, 3) $$, 'P0001', null, 'new matches cannot use inactive players');
select throws_ok($$ delete from public.players where name = 'Anna' $$, '42501', null, 'players cannot be deleted by users');

-- Admin safety rails ---------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.admin_set_user_role('00000000-0000-0000-0000-00000000000a', 'user') $$, 'P0001', 'The league must keep at least one active administrator.', 'the last admin cannot be demoted');
select lives_ok($$ select public.admin_set_user_status('00000000-0000-0000-0000-00000000000c', 'disabled') $$, 'admin can disable an account');

-- Invites and the sign-up hook -------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ insert into public.invites (email) values ('sneaky@gmail.com') $$, '42501', null, 'regular users cannot invite');
select throws_ok($$ select public.hook_before_user_created('{}'::jsonb) $$, '42501', null, 'users cannot call the sign-up hook');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.invites (email, role) values ('  New.Player@Gmail.com ', 'admin');
select is((select email from public.invites), 'new.player@gmail.com', 'invite emails are normalised');
select pg_temp.logout();
select ok(public.hook_before_user_created('{"user":{"email":"stranger@gmail.com"}}') ? 'error', 'sign-up hook rejects uninvited emails');
select is(public.hook_before_user_created('{"user":{"email":"NEW.PLAYER@gmail.com"}}'), '{}'::jsonb, 'sign-up hook accepts invited emails in any case');
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-00000000000d', 'new.player@gmail.com', '{"full_name":"Nina Player"}');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000d'), 'Nina Player', 'display name comes from the Google profile');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000000d'), 'admin', 'role comes from the invite');
select ok((select accepted_at is not null from public.invites where email = 'new.player@gmail.com'), 'invite is marked as joined');

-- Choosing a display name on first sign-in ---------------------------------
select is((select name_confirmed from public.profiles where id = '00000000-0000-0000-0000-00000000000d'), false, 'new accounts are asked to choose a name');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.update_my_display_name(' ada   ADMIN ') $$, 'P0001', 'That name is already taken by another player.', 'display names are unique (case-insensitive)');
select throws_ok($$ select public.update_my_display_name('N') $$, 'P0001', 'Name must be 2–40 characters.', 'display names must be 2–40 characters');
select lives_ok($$ select public.update_my_display_name('  Nina   P ') $$, 'players can choose their own name');
select ok((select name_confirmed and display_name = 'Nina P' from public.profiles where id = auth.uid()), 'the chosen name is saved and confirmed');

-- Disabled users and anonymous visitors see nothing --------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.matches), 0, 'disabled users cannot read matches');
select throws_ok($$ insert into public.matches (player_a_id, player_b_id, player_a_score, player_b_score)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 21, 3) $$, '42501', null, 'disabled users cannot record matches');

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.matches $$, '42501', null, 'anonymous visitors cannot read matches');
select throws_ok($$ select * from public.player_stats $$, '42501', null, 'anonymous visitors cannot read the leaderboard');
select throws_ok($$ select * from public.match_day_standings(current_date) $$, '42501', null, 'anonymous visitors cannot read match-day standings');

select * from finish();
rollback;
