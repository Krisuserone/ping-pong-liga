import { supabase } from '../lib/supabase'
import { MATCH_SELECT, type Match, type Player, type PlayerStats } from '../lib/types'
import { unwrap } from './LiveData'

export async function fetchPlayers(): Promise<Player[]> {
  return unwrap(await supabase.from('players').select('id, name, active, created_at').order('name'))
}

export async function fetchStats(): Promise<PlayerStats[]> {
  return unwrap(await supabase.from('player_stats').select('*').order('rank', { ascending: true, nullsFirst: false }).order('name'))
}

export interface MatchFilters {
  from?: string
  to?: string
  playerId?: string
  /** Matches must involve at least one of these players (name search). */
  anyOfPlayerIds?: string[]
  limit: number
}

export async function fetchMatches(f: MatchFilters): Promise<{ matches: Match[]; total: number }> {
  let q = supabase.from('matches').select(MATCH_SELECT, { count: 'exact' })
  if (f.from) q = q.gte('match_date', f.from)
  if (f.to) q = q.lte('match_date', f.to)
  if (f.playerId) q = q.or(`player_a_id.eq.${f.playerId},player_b_id.eq.${f.playerId}`)
  if (f.anyOfPlayerIds) {
    if (f.anyOfPlayerIds.length === 0) return { matches: [], total: 0 }
    const ids = f.anyOfPlayerIds.join(',')
    q = q.or(`player_a_id.in.(${ids}),player_b_id.in.(${ids})`)
  }
  const res = await q
    .order('match_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, f.limit - 1)
  if (res.error) throw res.error
  return { matches: (res.data ?? []) as unknown as Match[], total: res.count ?? 0 }
}

export async function fetchRecentMatches(limit: number): Promise<Match[]> {
  return (await fetchMatches({ limit })).matches
}

export async function countMatches(): Promise<number> {
  const res = await supabase.from('matches').select('id', { count: 'exact', head: true })
  if (res.error) throw res.error
  return res.count ?? 0
}

export async function fetchMatchDays(): Promise<{ match_date: string; games: number }[]> {
  return unwrap(await supabase.rpc('match_days'))
}

export async function fetchMatchDayStandings(day: string): Promise<PlayerStats[]> {
  return unwrap(await supabase.rpc('match_day_standings', { p_day: day }))
}
