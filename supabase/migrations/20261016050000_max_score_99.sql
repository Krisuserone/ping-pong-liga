-- Scores may now go up to 99 points per player (was 21).
-- Existing results (all 0–21) satisfy the new limit, so nothing else changes.
alter table public.matches drop constraint matches_score_a_range;
alter table public.matches drop constraint matches_score_b_range;
alter table public.matches add constraint matches_score_a_range check (player_a_score between 0 and 99);
alter table public.matches add constraint matches_score_b_range check (player_b_score between 0 and 99);
