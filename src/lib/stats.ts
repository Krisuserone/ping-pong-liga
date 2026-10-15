import type { PlayerStats } from './types'

export interface ScoreLine {
  player_a_id: string
  player_b_id: string
  player_a_score: number
  player_b_score: number
}

export function winnerSide(m: Pick<ScoreLine, 'player_a_score' | 'player_b_score'>): 'A' | 'B' {
  return m.player_a_score > m.player_b_score ? 'A' : 'B'
}

/** Ranks that are shared by more than one player (displayed as "=3"). */
export function tiedRanks(stats: PlayerStats[]): Set<number> {
  const counts = new Map<number, number>()
  for (const s of stats) if (s.rank != null) counts.set(s.rank, (counts.get(s.rank) ?? 0) + 1)
  return new Set([...counts].filter(([, c]) => c > 1).map(([r]) => r))
}

export function rankLabel(rank: number | null, tied: Set<number>): string {
  if (rank == null) return '–'
  return tied.has(rank) ? `=${rank}` : String(rank)
}

/** The official ordering: rank first, unranked (inactive) players last, then by name. */
export function compareOfficial(a: PlayerStats, b: PlayerStats): number {
  const ra = a.rank ?? Number.MAX_SAFE_INTEGER
  const rb = b.rank ?? Number.MAX_SAFE_INTEGER
  return ra - rb || a.name.localeCompare(b.name)
}

export type SortKey =
  | 'rank'
  | 'name'
  | 'games_played'
  | 'wins'
  | 'losses'
  | 'points_scored'
  | 'points_conceded'
  | 'point_difference'

/** Display-only sorting; never changes the rank values themselves. */
export function sortStats(stats: PlayerStats[], key: SortKey, dir: 'asc' | 'desc'): PlayerStats[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...stats].sort((a, b) => {
    if (key === 'rank') return sign * compareOfficial(a, b)
    if (key === 'name') return sign * a.name.localeCompare(b.name)
    return sign * (a[key] - b[key]) || compareOfficial(a, b)
  })
}

/**
 * Reference implementation of the leaderboard rules, mirroring the
 * player_stats database view. Used by tests to pin down the rules.
 */
export function computeStandings(players: { id: string; name: string }[], matches: ScoreLine[]) {
  const rows = new Map(
    players.map((p) => [
      p.id,
      { player_id: p.id, name: p.name, games_played: 0, wins: 0, losses: 0, points_scored: 0, points_conceded: 0 },
    ]),
  )
  for (const m of matches) {
    const a = rows.get(m.player_a_id)
    const b = rows.get(m.player_b_id)
    for (const [row, scored, conceded] of [
      [a, m.player_a_score, m.player_b_score],
      [b, m.player_b_score, m.player_a_score],
    ] as const) {
      if (!row) continue
      row.games_played++
      row.points_scored += scored
      row.points_conceded += conceded
      if (scored > conceded) row.wins++
      else if (scored < conceded) row.losses++
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, point_difference: r.points_scored - r.points_conceded }))
  const cmp = (x: (typeof list)[number], y: (typeof list)[number]) =>
    y.wins - x.wins || y.point_difference - x.point_difference || y.points_scored - x.points_scored
  list.sort((x, y) => cmp(x, y) || x.name.localeCompare(y.name))
  return list.map((r) => ({ ...r, rank: list.findIndex((o) => cmp(o, r) === 0) + 1 }))
}

/** Everyone sharing rank 1 (several names means co-winners). */
export function dayWinners(stats: PlayerStats[]): PlayerStats[] {
  return stats.filter((s) => s.rank === 1)
}

/**
 * Steps through match days (sorted newest first). 'older' moves back in
 * time, 'newer' forward. A date that is not a match day steps to the
 * nearest match day in that direction. Returns null at either end.
 */
export function stepMatchDay(days: string[], current: string, dir: 'older' | 'newer'): string | null {
  if (dir === 'older') return days.find((d) => d < current) ?? null
  return [...days].reverse().find((d) => d > current) ?? null
}
