import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MatchDetailModal } from '../components/MatchDetailModal'
import { MatchList } from '../components/MatchList'
import { Alert, Button, Card, EmptyState, inputClass, Loading, PageHeader } from '../components/ui'
import { useLeagueQuery } from '../data/LiveData'
import { fetchMatches, fetchPlayers } from '../data/queries'
import { addDays, todayIso } from '../lib/dates'
import { matchingGames, olderGames } from '../lib/sl'
import type { Match } from '../lib/types'

const PAGE = 100

type Preset = 'all' | 'today' | '7d' | '30d' | 'custom'

export function MatchHistoryPage() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<Match | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const playerId = params.get('player') ?? ''
  const search = params.get('q') ?? ''

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  const today = todayIso()
  const preset: Preset = !from && !to ? 'all' : from === today && to === today ? 'today' : from === addDays(today, -6) && !to ? '7d' : from === addDays(today, -29) && !to ? '30d' : 'custom'
  const applyPreset = (p: Preset) => {
    if (p === 'all') update({ from: '', to: '' })
    if (p === 'today') update({ from: today, to: today })
    if (p === '7d') update({ from: addDays(today, -6), to: '' })
    if (p === '30d') update({ from: addDays(today, -29), to: '' })
  }

  const players = useLeagueQuery(fetchPlayers, [])
  const searchIds = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term || !players.data) return undefined
    return players.data.filter((p) => p.name.toLowerCase().includes(term)).map((p) => p.id)
  }, [search, players.data])

  const waitingForPlayers = Boolean(search.trim()) && !players.data
  const matches = useLeagueQuery(
    () => (waitingForPlayers ? Promise.resolve({ matches: [], total: 0 }) : fetchMatches({ from, to, playerId, anyOfPlayerIds: searchIds, limit })),
    [from, to, playerId, searchIds?.join(','), limit, waitingForPlayers],
  )

  const filtersActive = Boolean(from || to || playerId || search)

  return (
    <div>
      <PageHeader title="Zgodovina tekem" subtitle="Vse vnesene tekme, najnovejše najprej. Tapnite tekmo za podrobnosti." />

      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Vse'],
              ['today', 'Danes'],
              ['7d', 'Zadnjih 7 dni'],
              ['30d', 'Zadnjih 30 dni'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-full px-3 py-2 text-sm font-medium ring-1 ring-inset sm:py-1 ${
                preset === p ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-800 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4">
          <div>
            <label htmlFor="h-from" className="mb-1 block text-xs font-semibold text-slate-600">
              Od
            </label>
            <input id="h-from" type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="h-to" className="mb-1 block text-xs font-semibold text-slate-600">
              Do
            </label>
            <input id="h-to" type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </div>
          <div>
            <label htmlFor="h-player" className="mb-1 block text-xs font-semibold text-slate-600">
              Igralec
            </label>
            <select id="h-player" className={inputClass} value={playerId} onChange={(e) => update({ player: e.target.value })}>
              <option value="">Vsi igralci</option>
              {(players.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.active ? ' (neaktiven)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="h-search" className="mb-1 block text-xs font-semibold text-slate-600">
              Iskanje po imenu
            </label>
            <input id="h-search" type="search" placeholder="npr. Ana" className={inputClass} value={search} onChange={(e) => update({ q: e.target.value })} />
          </div>
        </div>
        {filtersActive && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {matches.data ? matchingGames(matches.data.total) : ' '}
            </span>
            <button onClick={() => update({ from: '', to: '', player: '', q: '' })} className="font-semibold text-green-700 hover:underline">
              Počisti filtre
            </button>
          </div>
        )}
      </Card>

      {matches.error && (
        <div className="mb-4">
          <Alert onRetry={matches.reload}>{matches.error}</Alert>
        </div>
      )}

      <Card className="overflow-hidden">
        {!matches.data ? (
          matches.loading && <Loading label="Nalaganje tekem …" />
        ) : matches.data.matches.length === 0 ? (
          <EmptyState title={filtersActive ? 'Ni najdenih tekem' : 'Še ni vnesenih tekem'}>
            {filtersActive ? 'Poskusite z drugim obdobjem ali igralcem.' : 'Tukaj se bodo prikazali vneseni rezultati.'}
          </EmptyState>
        ) : (
          <>
            <MatchList matches={matches.data.matches} onOpen={setOpen} />
            {matches.data.total > matches.data.matches.length && (
              <div className="border-t border-slate-100 p-4 text-center">
                <Button variant="secondary" loading={matches.loading} onClick={() => setLimit((l) => l + PAGE)}>
                  Naloži več ({olderGames(matches.data.total - matches.data.matches.length)})
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <MatchDetailModal match={open} players={players.data ?? []} onClose={() => setOpen(null)} />
    </div>
  )
}
