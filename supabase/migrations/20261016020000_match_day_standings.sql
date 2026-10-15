-- =====================================================================
-- Match-day standings: the leaderboard for a single day's games.
-- Same ranking rules as the overall table (wins, then point difference,
-- then points scored); only players who played that day are listed.
-- Both functions run with the caller's rights, so RLS still applies.
-- =====================================================================

create function public.match_day_standings(p_day date)
returns table (
  player_id        uuid,
  name             text,
  active           boolean,
  created_at       timestamptz,
  games_played     integer,
  wins             integer,
  losses           integer,
  points_scored    integer,
  points_conceded  integer,
  point_difference integer,
  rank             integer
)
language sql
stable
set search_path = ''
as $$
  with sides as (
    select player_a_id as pid, player_a_score as scored, player_b_score as conceded from public.matches where match_date = p_day
    union all
    select player_b_id, player_b_score, player_a_score from public.matches where match_date = p_day
  ),
  agg as (
    select
      p.id, p.name, p.active, p.created_at,
      count(*)::int                                    as gp,
      count(*) filter (where s.scored > s.conceded)::int as w,
      count(*) filter (where s.scored < s.conceded)::int as l,
      sum(s.scored)::int                               as ps,
      sum(s.conceded)::int                             as pc
    from sides s
    join public.players p on p.id = s.pid
    group by p.id
  )
  select id, name, active, created_at, gp, w, l, ps, pc, ps - pc,
         (rank() over (order by w desc, ps - pc desc, ps desc))::int as rnk
  from agg
  order by rnk, name;
$$;

-- Every date that has at least one game, newest first.
create function public.match_days()
returns table (match_date date, games integer)
language sql
stable
set search_path = ''
as $$
  select m.match_date, count(*)::int
  from public.matches m
  group by m.match_date
  order by m.match_date desc;
$$;

revoke execute on function public.match_day_standings(date), public.match_days() from public, anon;
grant execute on function public.match_day_standings(date), public.match_days() to authenticated;
