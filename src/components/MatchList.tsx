import { dayLabel, formatNumericDate, groupByDate } from '../lib/dates'
import { games } from '../lib/sl'
import { winnerSide } from '../lib/stats'
import type { Match } from '../lib/types'

export function playerName(m: Match, side: 'A' | 'B') {
  return (side === 'A' ? m.player_a?.name : m.player_b?.name) ?? 'Neznan igralec'
}

export function winnerName(m: Match) {
  return playerName(m, winnerSide(m))
}

/** Compact "Anna 21 – 15 Ben" line with the winner in bold green. */
export function ScoreLine({ match }: { match: Match }) {
  const w = winnerSide(match)
  const cls = (side: 'A' | 'B') => (w === side ? 'font-bold text-navy-900' : 'text-slate-600')
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className={`min-w-0 flex-1 truncate text-right ${cls('A')}`}>{playerName(match, 'A')}</span>
      <span className="flex shrink-0 items-center gap-1 rounded-md bg-navy-900 px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-white">
        <span className={w === 'A' ? 'text-green-400' : ''}>{match.player_a_score}</span>
        <span className="text-white/40">–</span>
        <span className={w === 'B' ? 'text-green-400' : ''}>{match.player_b_score}</span>
      </span>
      <span className={`min-w-0 flex-1 truncate ${cls('B')}`}>{playerName(match, 'B')}</span>
    </div>
  )
}

/**
 * Matches grouped by date. Desktop: table with the full column set.
 * Mobile: stacked cards. Rows open the detail dialog.
 */
/** `cards` forces the compact card layout (for narrow containers such as the dashboard). */
export function MatchList({ matches, onOpen, showGroups = true, cards = false }: { matches: Match[]; onOpen: (m: Match) => void; showGroups?: boolean; cards?: boolean }) {
  const groups = showGroups ? groupByDate(matches, (m) => m.match_date) : [{ date: '', items: matches }]
  return (
    <div>
      {groups.map((g) => (
        <section key={g.date || 'all'}>
          {showGroups && (
            <h3 className="flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-navy-700 sm:px-5">
              <span>{dayLabel(g.date)}</span>
              <span className="font-medium normal-case tracking-normal text-slate-500">
                {games(g.items.length)}
              </span>
            </h3>
          )}
          {/* Desktop table */}
          <table className={`hidden w-full table-fixed text-sm ${cards ? '' : 'md:table'}`}>
            <colgroup>
              <col className="w-26" />
              <col />
              <col className="w-9" />
              <col className="w-9" />
              <col />
              <col className="w-36" />
              <col className="w-28" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th>Datum</th>
                <th>Igralec A</th>
                <th>Rezultat igralca A</th>
                <th>Rezultat igralca B</th>
                <th>Igralec B</th>
                <th>Zmagovalec</th>
                <th>Vnos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {g.items.map((m) => {
                const w = winnerSide(m)
                return (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    aria-label={`${playerName(m, 'A')} ${m.player_a_score}–${m.player_b_score} ${playerName(m, 'B')}, odpri podrobnosti`}
                    onClick={() => onOpen(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpen(m)
                      }
                    }}
                    className="cursor-pointer outline-none hover:bg-green-50/50 focus-visible:bg-green-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
                  >
                    <td className="whitespace-nowrap py-3 pl-5 pr-2 text-slate-500 tabular-nums">{formatNumericDate(m.match_date)}</td>
                    <td className={`truncate px-3 py-3 text-right ${w === 'A' ? 'font-semibold text-navy-900' : 'text-slate-600'}`}>{playerName(m, 'A')}</td>
                    <td className="px-1 py-3 text-right font-mono text-base font-bold tabular-nums">
                      <span className={w === 'A' ? 'text-green-600' : 'text-slate-500'}>{m.player_a_score}</span>
                    </td>
                    <td className="px-1 py-3 font-mono text-base font-bold tabular-nums">
                      <span className={w === 'B' ? 'text-green-600' : 'text-slate-500'}>{m.player_b_score}</span>
                    </td>
                    <td className={`truncate px-3 py-3 ${w === 'B' ? 'font-semibold text-navy-900' : 'text-slate-600'}`}>{playerName(m, 'B')}</td>
                    <td className="truncate px-3 py-3">
                      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">🏆 {winnerName(m)}</span>
                    </td>
                    <td className="truncate py-3 pl-2 pr-5 text-right text-xs text-slate-500">{m.recorder?.display_name ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className={`divide-y divide-slate-100 ${cards ? '' : 'md:hidden'}`}>
            {g.items.map((m) => (
              <li key={m.id}>
                <button onClick={() => onOpen(m)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                  <ScoreLine match={m} />
                  <p className="mt-1 text-center text-xs text-slate-500">
                    Zmagovalec: <span className="font-semibold text-green-700">{winnerName(m)}</span> · vnos: {m.recorder?.display_name ?? '—'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
