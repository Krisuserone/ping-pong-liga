import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MatchDetailModal } from '../components/MatchDetailModal'
import { MatchList } from '../components/MatchList'
import { StandingsTable } from '../components/StandingsTable'
import { Alert, Card, CardHeader, EmptyState, Loading, PageHeader } from '../components/ui'
import { useLeagueQuery } from '../data/LiveData'
import { countMatches, fetchPlayers, fetchRecentMatches, fetchStats } from '../data/queries'
import { tiedRanks } from '../lib/stats'
import { points } from '../lib/sl'
import type { Match } from '../lib/types'

export function DashboardPage() {
  const { profile } = useAuth()
  const [open, setOpen] = useState<Match | null>(null)
  const q = useLeagueQuery(async () => {
    const [stats, players, recent, total] = await Promise.all([fetchStats(), fetchPlayers(), fetchRecentMatches(6), countMatches()])
    return { stats, players, recent, total }
  }, [])

  const firstName = profile?.display_name.split(' ')[0]

  return (
    <div>
      <PageHeader
        title={`Živjo${firstName ? `, ${firstName}` : ''} 👋`}
        subtitle="Tole se dogaja v ligi."
        action={
          <Link
            to="/record"
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-base font-bold text-white shadow-md shadow-green-600/20 hover:bg-green-700"
          >
            <span className="text-xl leading-none">+</span> Vnesi tekmo
          </Link>
        }
      />
      {q.error && (
        <div className="mb-4">
          <Alert onRetry={q.reload}>{q.error}</Alert>
        </div>
      )}
      {!q.data ? (
        q.loading && <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Aktivni igralci" value={q.data.players.filter((p) => p.active).length} />
            <StatCard label="Odigrane tekme" value={q.data.total} />
            <StatCard label="Dosežene točke" value={q.data.stats.reduce((s, p) => s + p.points_scored, 0)} />
            <StatCard
              label="Vodilni"
              value={
                q.data.stats[0]?.rank === 1 && q.data.stats[0].games_played > 0
                  ? tiedRanks(q.data.stats).has(1)
                    ? 'Izenačeno'
                    : q.data.stats[0].name
                  : '—'
              }
              accent
            />
          </div>

          <Podium stats={q.data.stats.filter((s) => s.rank != null && s.rank <= 3 && s.games_played > 0)} />

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="overflow-hidden lg:col-span-3">
              <CardHeader
                title="Zadnje tekme"
                action={
                  <Link to="/history" className="-my-2 -mr-2 rounded-lg px-2 py-2 text-sm font-semibold text-green-700 hover:underline">
                    Vse tekme →
                  </Link>
                }
              />
              {q.data.recent.length === 0 ? (
                <EmptyState title="Še ni tekem">Vnesite prvi rezultat in liga se lahko začne.</EmptyState>
              ) : (
                <MatchList matches={q.data.recent} onOpen={setOpen} cards />
              )}
            </Card>
            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader
                title="Lestvica"
                action={
                  <Link to="/leaderboard" className="-my-2 -mr-2 rounded-lg px-2 py-2 text-sm font-semibold text-green-700 hover:underline">
                    Celotna lestvica →
                  </Link>
                }
              />
              {q.data.stats.filter((s) => s.active).length === 0 ? (
                <EmptyState title="Še ni igralcev">Skrbnik lahko doda igralce na zavihku Igralci.</EmptyState>
              ) : (
                <StandingsTable compact rows={q.data.stats.filter((s) => s.active).slice(0, 8)} allStats={q.data.stats} />
              )}
            </Card>
          </div>
          <MatchDetailModal match={open} players={q.data.players} onClose={() => setOpen(null)} />
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ring-1 sm:p-5 ${accent ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white ring-slate-200/80'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-green-400' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-1 font-extrabold tabular-nums ${accent ? 'break-words text-xl leading-tight sm:text-2xl' : 'truncate text-2xl text-navy-900 sm:text-3xl'}`}>{value}</p>
    </div>
  )
}

function Podium({ stats }: { stats: { player_id: string; name: string; rank: number | null; wins: number; losses: number; point_difference: number }[] }) {
  if (stats.length === 0) return null
  const styles = [
    { ring: 'ring-amber-300', badge: 'bg-amber-400 text-amber-950', label: '1.' },
    { ring: 'ring-slate-300', badge: 'bg-slate-300 text-slate-800', label: '2.' },
    { ring: 'ring-orange-300', badge: 'bg-orange-300 text-orange-950', label: '3.' },
  ]
  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy-700">Najboljši trije</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.slice(0, 3).map((s) => {
          const st = styles[(s.rank ?? 1) - 1]
          return (
            <div key={s.player_id} className={`flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-2 ${st.ring}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${st.badge}`}>{st.label}</span>
              <div className="min-w-0">
                <p className="truncate font-bold text-navy-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.wins} Z · {s.losses} P · {s.point_difference > 0 ? '+' : ''}
                  {points(s.point_difference)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
