import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StandingsTable } from '../components/StandingsTable'
import { Alert, Card, EmptyState, inputClass, Loading, PageHeader } from '../components/ui'
import { useLeagueQuery } from '../data/LiveData'
import { fetchMatchDays, fetchMatchDayStandings, fetchStats } from '../data/queries'
import { dayLabel, formatDate, todayIso } from '../lib/dates'
import { dayWinners, sortStats, stepMatchDay, type SortKey } from '../lib/stats'
import type { PlayerStats } from '../lib/types'
import { games, losses, points, wins } from '../lib/sl'

type View = 'overall' | 'day'

export function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'day' ? 'day' : 'overall'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'rank', dir: 'asc' })
  const [search, setSearch] = useState('')

  const setView = (v: View) => {
    setParams(v === 'day' ? { view: 'day' } : {}, { replace: true })
    setSort({ key: 'rank', dir: 'asc' })
  }

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'rank' || key === 'name' || key === 'losses' || key === 'points_conceded' ? 'asc' : 'desc' }))

  return (
    <div>
      <PageHeader title="Lestvica" subtitle="Samodejno se posodobi ob vsakem vnosu, popravku ali izbrisu tekme." />

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:inline-grid sm:w-80" role="tablist" aria-label="Pogled lestvice">
        {(
          [
            ['overall', 'Skupno'],
            ['day', 'Igralni dan'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${view === v ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'overall' ? (
        <OverallView sort={sort} onSort={onSort} search={search} setSearch={setSearch} />
      ) : (
        <MatchDayView sort={sort} onSort={onSort} search={search} setSearch={setSearch} />
      )}

      <div className="mt-4 rounded-xl bg-navy-50 p-4 text-sm text-navy-800 ring-1 ring-navy-100">
        <p className="font-bold">Kako se določa vrstni red</p>
        <ol className="mt-1 list-inside list-decimal space-y-0.5 text-navy-800/90">
          <li>Največ zmag</li>
          <li>Nato najboljša razlika v točkah (dosežene − prejete točke)</li>
          <li>Nato največ doseženih točk</li>
        </ol>
        <p className="mt-2 text-navy-800/80">
          {view === 'day'
            ? 'Lestvica igralnega dne uporablja enaka pravila, upošteva pa samo tekme tistega dne — tako vidite, kdo je zmagal dan. Igralci, izenačeni po vseh treh merilih, si delijo mesto (oznaka »=«).'
            : 'Igralci, izenačeni po vseh treh merilih, si delijo mesto (oznaka »=«). Razvrščanje po stolpcu spremeni le prikaz — mesta ostanejo enaka. Neaktivni igralci niso uvrščeni.'}
        </p>
      </div>
    </div>
  )
}

interface ViewProps {
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (key: SortKey) => void
  search: string
  setSearch: (s: string) => void
}

function filterAndSort(rows: PlayerStats[], search: string, sort: ViewProps['sort']) {
  const term = search.trim().toLowerCase()
  return sortStats(
    rows.filter((s) => !term || s.name.toLowerCase().includes(term)),
    sort.key,
    sort.dir,
  )
}

function SearchBox({ search, setSearch, children }: { search: string; setSearch: (s: string) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
      <div className="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
        <label htmlFor="lb-search" className="sr-only">
          Iskanje igralcev
        </label>
        <input id="lb-search" type="search" placeholder="Iskanje po imenu igralca …" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {children}
    </div>
  )
}

function OverallView({ sort, onSort, search, setSearch }: ViewProps) {
  const stats = useLeagueQuery(fetchStats, [])
  const [showInactive, setShowInactive] = useState(false)
  const all = stats.data ?? []
  const rows = filterAndSort(
    all.filter((s) => showInactive || s.active),
    search,
    sort,
  )

  return (
    <Card className="overflow-hidden">
      <SearchBox search={search} setSearch={setSearch}>
        <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded accent-green-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Prikaži neaktivne igralce
        </label>
      </SearchBox>
      {stats.error && (
        <div className="p-4">
          <Alert onRetry={stats.reload}>{stats.error}</Alert>
        </div>
      )}
      {!stats.data ? (
        stats.loading && <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="Ni igralcev za prikaz" />
      ) : (
        <StandingsTable rows={rows} allStats={all} sort={sort} onSort={onSort} />
      )}
    </Card>
  )
}

function MatchDayView({ sort, onSort, search, setSearch }: ViewProps) {
  const [params, setParams] = useSearchParams()
  const days = useLeagueQuery(fetchMatchDays, [])
  const dayList = (days.data ?? []).map((d) => d.match_date)
  const selected = params.get('date') ?? dayList[0] ?? null
  const standings = useLeagueQuery(() => (selected ? fetchMatchDayStandings(selected) : Promise.resolve([])), [selected])

  const goTo = (date: string | null) => {
    if (!date) return
    setParams({ view: 'day', date }, { replace: true })
  }

  const older = selected ? stepMatchDay(dayList, selected, 'older') : null
  const newer = selected ? stepMatchDay(dayList, selected, 'newer') : null
  const gamesThatDay = days.data?.find((d) => d.match_date === selected)?.games ?? 0
  const all = standings.data ?? []
  const rows = filterAndSort(all, search, sort)
  const winners = dayWinners(all)

  if (days.error) return <Alert onRetry={days.reload}>{days.error}</Alert>
  if (!days.data) return days.loading ? <Loading /> : null
  if (dayList.length === 0) {
    return (
      <Card>
        <EmptyState title="Še ni igralnih dni">Ko bodo tekme vnesene, bosta tukaj lestvica in zmagovalec vsakega dne.</EmptyState>
      </Card>
    )
  }

  const arrow = (dir: 'older' | 'newer', target: string | null) => (
    <button
      onClick={() => goTo(target)}
      disabled={!target}
      aria-label={dir === 'older' ? 'Prejšnji igralni dan' : 'Naslednji igralni dan'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-navy-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-30"
    >
      {dir === 'older' ? '‹' : '›'}
    </button>
  )

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {arrow('older', older)}
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-base font-bold text-navy-900 sm:text-lg">{selected ? dayLabel(selected) : '—'}</p>
            <p className="text-xs text-slate-500">
              {selected && dayLabel(selected) !== formatDate(selected) ? `${formatDate(selected)} · ` : ''}
              {games(gamesThatDay)}
            </p>
          </div>
          {arrow('newer', newer)}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-3">
          <label htmlFor="md-date" className="text-sm text-slate-600">
            Skoči na
          </label>
          <div className="w-44">
            <input id="md-date" type="date" className={inputClass} value={selected ?? ''} max={todayIso()} onChange={(e) => e.target.value && goTo(e.target.value)} />
          </div>
          {selected !== dayList[0] && (
            <button onClick={() => goTo(dayList[0])} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-green-700 hover:bg-green-50">
              Zadnji igralni dan
            </button>
          )}
        </div>
      </Card>

      {standings.error && <Alert onRetry={standings.reload}>{standings.error}</Alert>}

      {!standings.data ? (
        standings.loading && <Loading />
      ) : all.length === 0 ? (
        <Card>
          <EmptyState title="Ta dan ni bilo tekem">S puščicama se premikajte med dnevi s tekmami.</EmptyState>
        </Card>
      ) : (
        <>
          <WinnerBanner winners={winners} />
          <Card className="overflow-hidden">
            <SearchBox search={search} setSearch={setSearch} />
            {rows.length === 0 ? <EmptyState title="Ni ujemajočih se igralcev" /> : <StandingsTable rows={rows} allStats={all} sort={sort} onSort={onSort} />}
          </Card>
        </>
      )}
    </div>
  )
}

function WinnerBanner({ winners }: { winners: PlayerStats[] }) {
  if (winners.length === 0) return null
  const w = winners[0]
  const names = winners.map((x) => x.name)
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} in ${names[names.length - 1]}`
  return (
    <div className="flex items-center gap-4 rounded-xl bg-navy-900 p-4 text-white shadow-md sm:p-5" role="status">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-2xl" aria-hidden="true">
        🏆
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-400">{winners.length > 1 ? 'Sozmagovalci igralnega dne' : 'Zmagovalec igralnega dne'}</p>
        <p className="break-words text-xl font-extrabold leading-tight sm:text-2xl">{joined}</p>
        <p className="mt-0.5 text-sm text-navy-100/80">
          {wins(w.wins)} · {losses(w.losses)} · {w.point_difference > 0 ? '+' : ''}
          {points(w.point_difference)}
        </p>
      </div>
    </div>
  )
}
