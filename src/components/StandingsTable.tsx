import { rankLabel, tiedRanks, type SortKey } from '../lib/stats'
import type { PlayerStats } from '../lib/types'

const COLUMNS: { key: SortKey; label: string; short: string; title?: string; hideOnMobile?: boolean }[] = [
  { key: 'rank', label: 'Mesto', short: '#' },
  { key: 'name', label: 'Igralec', short: 'Igralec' },
  { key: 'games_played', label: 'Tekme', short: 'T', title: 'Odigrane tekme' },
  { key: 'wins', label: 'Zmage', short: 'Z', title: 'Zmage' },
  { key: 'losses', label: 'Porazi', short: 'P', title: 'Porazi' },
  { key: 'points_scored', label: 'Dosežene', short: 'DT', title: 'Dosežene točke', hideOnMobile: true },
  { key: 'points_conceded', label: 'Prejete', short: 'PT', title: 'Prejete točke', hideOnMobile: true },
  { key: 'point_difference', label: 'Razlika', short: '+/-', title: 'Razlika v točkah' },
]

const MEDAL = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950']

/**
 * The leaderboard table. `rows` are already sorted for display; the rank
 * shown always comes from the database (official ranking rules).
 */
export function StandingsTable({
  rows,
  allStats,
  sort,
  onSort,
  compact,
}: {
  rows: PlayerStats[]
  allStats: PlayerStats[]
  sort?: { key: SortKey; dir: 'asc' | 'desc' }
  onSort?: (key: SortKey) => void
  compact?: boolean
}) {
  const tied = tiedRanks(allStats)
  const cell = compact ? 'px-2 py-2' : 'px-1 py-3 text-[13px] min-[360px]:px-1.5 sm:px-3 sm:text-sm'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            {COLUMNS.map((c) => {
              const active = sort?.key === c.key
              const align = c.key === 'name' ? 'text-left' : 'text-center'
              return (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`${cell} ${align} font-semibold ${c.hideOnMobile && compact ? 'hidden' : ''} ${c.key === 'rank' ? 'w-10 pl-3 sm:w-12 sm:pl-4' : ''}`}
                >
                  {onSort ? (
                    <button onClick={() => onSort(c.key)} className={`-my-2 inline-flex items-center gap-0.5 py-2 uppercase hover:text-navy-900 ${active ? 'text-navy-900' : ''}`}>
                      <span className="hidden md:inline">{c.label}</span>
                      <span className="md:hidden">{c.short}</span>
                      {active && <span aria-hidden="true">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  ) : (
                    c.short
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((s) => {
            const top = s.rank != null && s.rank <= 3
            return (
              <tr key={s.player_id} className={`${top ? 'bg-green-50/60' : ''} ${!s.active ? 'text-slate-400' : ''}`}>
                <td className={`${cell} pl-3 text-center sm:pl-4`}>
                  <span
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-bold ${
                      top ? MEDAL[s.rank! - 1] : 'bg-slate-100 text-slate-600'
                    }`}
                    title={tied.has(s.rank ?? -1) ? 'Deljeno mesto' : undefined}
                  >
                    {rankLabel(s.rank, tied)}
                  </span>
                </td>
                <td className={`${cell} max-w-[7.5rem] truncate font-semibold sm:max-w-[12rem] ${s.active ? 'text-navy-900' : ''}`}>
                  {s.name}
                  {!s.active && <span className="ml-1 text-xs font-normal">(neaktiven)</span>}
                </td>
                <td className={`${cell} text-center tabular-nums`}>{s.games_played}</td>
                <td className={`${cell} text-center font-bold tabular-nums ${s.active ? 'text-green-700' : ''}`}>{s.wins}</td>
                <td className={`${cell} text-center tabular-nums`}>{s.losses}</td>
                <td className={`${cell} text-center tabular-nums ${compact ? 'hidden' : ''}`}>{s.points_scored}</td>
                <td className={`${cell} text-center tabular-nums ${compact ? 'hidden' : ''}`}>{s.points_conceded}</td>
                <td
                  className={`${cell} text-center font-semibold tabular-nums ${
                    s.point_difference > 0 ? 'text-green-700' : s.point_difference < 0 ? 'text-red-600' : 'text-slate-500'
                  }`}
                >
                  {s.point_difference > 0 ? `+${s.point_difference}` : s.point_difference}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
