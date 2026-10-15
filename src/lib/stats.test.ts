import { describe, expect, it } from 'vitest'
import { groupByDate } from './dates'
import { computeStandings, dayWinners, rankLabel, sortStats, stepMatchDay, tiedRanks, winnerSide } from './stats'
import type { PlayerStats } from './types'

const players = [
  { id: 'a', name: 'Anna' },
  { id: 'b', name: 'Ben' },
  { id: 'c', name: 'Cleo' },
  { id: 'd', name: 'Dev' },
]
const m = (a: string, b: string, sa: number, sb: number) => ({ player_a_id: a, player_b_id: b, player_a_score: sa, player_b_score: sb })

describe('winnerSide', () => {
  it('the higher score wins', () => {
    expect(winnerSide({ player_a_score: 21, player_b_score: 19 })).toBe('A')
    expect(winnerSide({ player_a_score: 3, player_b_score: 21 })).toBe('B')
  })
})

describe('computeStandings', () => {
  it('counts games, wins, losses and points for both players', () => {
    const s = computeStandings(players, [m('a', 'b', 21, 15)])
    const anna = s.find((r) => r.player_id === 'a')!
    const ben = s.find((r) => r.player_id === 'b')!
    expect(anna).toMatchObject({ games_played: 1, wins: 1, losses: 0, points_scored: 21, points_conceded: 15, point_difference: 6 })
    expect(ben).toMatchObject({ games_played: 1, wins: 0, losses: 1, points_scored: 15, points_conceded: 21, point_difference: -6 })
  })

  it('ranks by wins, then point difference, then points scored', () => {
    const s = computeStandings(players, [
      m('a', 'b', 21, 19), // Anna win +2
      m('c', 'd', 21, 5), // Cleo win +16
      m('c', 'a', 10, 21), // Anna win +11, Cleo loss
      m('b', 'd', 21, 10), // Ben win
    ])
    // Anna 2W; Cleo 1W diff +5; Ben 1W diff +9; Dev 0W
    expect(s.map((r) => [r.name, r.rank])).toEqual([
      ['Anna', 1],
      ['Ben', 2],
      ['Cleo', 3],
      ['Dev', 4],
    ])
  })

  it('uses points scored as the third tiebreaker', () => {
    const s = computeStandings(players.slice(0, 4), [m('a', 'c', 21, 11), m('b', 'd', 15, 5)])
    // Both 1W +10 diff; Anna scored 21 vs Ben 15
    expect(s[0].name).toBe('Anna')
    expect(s[1].name).toBe('Ben')
    expect(s[0].rank).toBe(1)
    expect(s[1].rank).toBe(2)
  })

  it('gives fully tied players the same rank', () => {
    const s = computeStandings(players, [m('a', 'c', 21, 11), m('b', 'd', 21, 11)])
    expect(s.find((r) => r.name === 'Anna')!.rank).toBe(1)
    expect(s.find((r) => r.name === 'Ben')!.rank).toBe(1)
    expect(s.find((r) => r.name === 'Cleo')!.rank).toBe(3)
  })

  it('recalculates when a match is removed (stats are derived, never stored)', () => {
    const games = [m('a', 'b', 21, 0), m('b', 'a', 21, 0), m('b', 'a', 21, 0)]
    expect(computeStandings(players, games)[0].name).toBe('Ben')
    expect(computeStandings(players, games.slice(0, 1))[0].name).toBe('Anna')
  })
})

const stat = (name: string, rank: number | null, wins: number, extra: Partial<PlayerStats> = {}): PlayerStats => ({
  player_id: name,
  name,
  active: rank != null,
  created_at: '',
  games_played: 0,
  wins,
  losses: 0,
  points_scored: 0,
  points_conceded: 0,
  point_difference: 0,
  rank,
  ...extra,
})

describe('display helpers', () => {
  const rows = [stat('Anna', 1, 5), stat('Ben', 2, 3), stat('Cleo', 2, 3), stat('Old', null, 9)]

  it('labels tied ranks', () => {
    const tied = tiedRanks(rows)
    expect(rankLabel(1, tied)).toBe('1')
    expect(rankLabel(2, tied)).toBe('=2')
    expect(rankLabel(null, tied)).toBe('–')
  })

  it('sorting changes order but never rank values', () => {
    const byWinsAsc = sortStats(rows, 'wins', 'asc')
    expect(byWinsAsc.map((r) => r.name)).toEqual(['Ben', 'Cleo', 'Anna', 'Old'])
    expect(byWinsAsc.find((r) => r.name === 'Anna')!.rank).toBe(1)
    expect(sortStats(rows, 'rank', 'asc').map((r) => r.name)).toEqual(['Anna', 'Ben', 'Cleo', 'Old'])
  })
})

describe('groupByDate', () => {
  it('groups consecutive items by date, keeping newest-first order', () => {
    const g = groupByDate(
      [
        { d: '2026-10-15', id: 1 },
        { d: '2026-10-15', id: 2 },
        { d: '2026-10-12', id: 3 },
      ],
      (x) => x.d,
    )
    expect(g.map((x) => [x.date, x.items.length])).toEqual([
      ['2026-10-15', 2],
      ['2026-10-12', 1],
    ])
  })
})

describe('match days', () => {
  const days = ['2026-10-16', '2026-10-09', '2026-10-02'] // newest first

  it('steps to older and newer match days', () => {
    expect(stepMatchDay(days, '2026-10-09', 'older')).toBe('2026-10-02')
    expect(stepMatchDay(days, '2026-10-09', 'newer')).toBe('2026-10-16')
  })

  it('returns null at either end', () => {
    expect(stepMatchDay(days, '2026-10-02', 'older')).toBeNull()
    expect(stepMatchDay(days, '2026-10-16', 'newer')).toBeNull()
  })

  it('steps from a date without games to the nearest match day', () => {
    expect(stepMatchDay(days, '2026-10-12', 'older')).toBe('2026-10-09')
    expect(stepMatchDay(days, '2026-10-12', 'newer')).toBe('2026-10-16')
  })

  it('finds the winner, or co-winners when level on every rule', () => {
    expect(dayWinners([stat('Anna', 1, 3), stat('Ben', 2, 1)]).map((s) => s.name)).toEqual(['Anna'])
    expect(dayWinners([stat('Anna', 1, 2), stat('Ben', 1, 2), stat('Cleo', 3, 0)]).map((s) => s.name)).toEqual(['Anna', 'Ben'])
    expect(dayWinners([])).toEqual([])
  })
})
