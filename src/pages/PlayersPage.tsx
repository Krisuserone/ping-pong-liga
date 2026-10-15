import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, inputClass, Loading, Modal, PageHeader } from '../components/ui'
import { useLeagueQuery, useLiveData } from '../data/LiveData'
import { fetchStats } from '../data/queries'
import { formatDay } from '../lib/dates'
import { activePlayers, games, inactivePlayers } from '../lib/sl'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { PlayerStats } from '../lib/types'
import { normalizeName, validatePlayerName } from '../lib/validation'

export function PlayersPage() {
  const { isAdmin } = useAuth()
  const { bump } = useLiveData()
  const toast = useToast()
  const stats = useLeagueQuery(fetchStats, [])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlayerStats | null>(null)

  const all = (stats.data ?? []).map((s) => ({ id: s.player_id, name: s.name }))
  const term = search.trim().toLowerCase()
  const rows = [...(stats.data ?? [])]
    .filter((s) => (filter === 'all' ? true : filter === 'active' ? s.active : !s.active))
    .filter((s) => !term || s.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
  const counts = { active: stats.data?.filter((s) => s.active).length ?? 0, inactive: stats.data?.filter((s) => !s.active).length ?? 0 }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validatePlayerName(newName, all)
    if (problem) return setAddError(problem)
    setAdding(true)
    setAddError(null)
    const { error } = await supabase.from('players').insert({ name: normalizeName(newName) })
    setAdding(false)
    if (error) return setAddError(friendlyError(error))
    toast('success', `Igralec ${normalizeName(newName)} dodan`)
    setNewName('')
    bump()
  }

  const toggleActive = async (p: PlayerStats) => {
    const { data, error } = await supabase.from('players').update({ active: !p.active }).eq('id', p.player_id).select('id')
    if (error || !data?.length) return toast('error', error ? friendlyError(error) : 'Za to nimate dovoljenja.')
    toast('success', `${p.name}: ${p.active ? 'deaktiviran' : 'ponovno aktiviran'}`)
    bump()
  }

  return (
    <div>
      <PageHeader title="Igralci" subtitle={`${activePlayers(counts.active)}${counts.inactive ? ` · ${inactivePlayers(counts.inactive)}` : ''}`} />

      {isAdmin && (
        <Card className="mb-4">
          <CardHeader
            title="Dodaj igralca"
            subtitle="Vpišite samo ime — igralec ne potrebuje Gmail računa. Rezultate zanj lahko vnese kdorkoli v ligi. Igralec se samodejno prikaže pri vnosu tekme in na lestvici."
          />
          <form onSubmit={add} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:px-5">
            <div className="flex-1">
              <label htmlFor="new-player" className="sr-only">
                Ime igralca
              </label>
              <input
                id="new-player"
                className={inputClass}
                placeholder="Ime igralca"
                maxLength={60}
                value={newName}
                aria-invalid={Boolean(addError)}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError(null)
                }}
              />
              {addError && <p className="mt-1 text-sm text-red-600">{addError}</p>}
            </div>
            <Button type="submit" loading={adding}>
              Dodaj igralca
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
            <label htmlFor="p-search" className="sr-only">
              Iskanje igralcev
            </label>
            <input id="p-search" type="search" placeholder="Iskanje igralcev …" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid w-full grid-cols-3 rounded-lg bg-slate-100 p-0.5 text-sm sm:flex sm:w-auto">
            {([['active', 'Aktivni'], ['inactive', 'Neaktivni'], ['all', 'Vsi']] as const).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-2 font-medium capitalize sm:py-1 ${filter === f ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {stats.error && (
          <div className="p-4">
            <Alert onRetry={stats.reload}>{stats.error}</Alert>
          </div>
        )}
        {!stats.data ? (
          stats.loading && <Loading />
        ) : rows.length === 0 ? (
          <EmptyState title={stats.data.length === 0 ? 'Še ni igralcev' : 'Ni ujemajočih se igralcev'}>
            {stats.data.length === 0 && (isAdmin ? 'Zgoraj dodajte prvega igralca.' : 'Igralce mora dodati skrbnik.')}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li key={p.player_id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    p.active ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-navy-900">
                    <span className="truncate">{p.name}</span>
                    {!p.active && <Badge>Neaktiven</Badge>}
                    {p.rank != null && p.rank <= 3 && p.games_played > 0 && <Badge color="green">#{p.rank}</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {games(p.games_played)} · {p.wins} Z {p.losses} P · od {formatDay(p.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/history?player=${p.player_id}`} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-navy-700 hover:bg-slate-100 sm:min-h-0 sm:px-2.5 sm:py-1.5">
                    Tekme
                  </Link>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                        Uredi
                      </Button>
                      <Button size="sm" variant={p.active ? 'ghost' : 'primary'} onClick={() => toggleActive(p)}>
                        {p.active ? 'Deaktiviraj' : 'Aktiviraj'}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {isAdmin && <EditPlayerModal player={editing} existing={all} onClose={() => setEditing(null)} onSaved={bump} />}
    </div>
  )
}

function EditPlayerModal({
  player,
  existing,
  onClose,
  onSaved,
}: {
  player: PlayerStats | null
  existing: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)
  if (player && player.player_id !== lastId) {
    setLastId(player.player_id)
    setName(player.name)
    setError(null)
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!player) return
    const problem = validatePlayerName(name, existing, player.player_id)
    if (problem) return setError(problem)
    setSaving(true)
    const { data, error } = await supabase.from('players').update({ name: normalizeName(name) }).eq('id', player.player_id).select('id')
    setSaving(false)
    if (error || !data?.length) return setError(error ? friendlyError(error) : 'Za to nimate dovoljenja.')
    toast('success', 'Igralec posodobljen')
    onSaved()
    setLastId(null)
    onClose()
  }

  return (
    <Modal
      open={Boolean(player)}
      onClose={() => {
        setLastId(null)
        onClose()
      }}
      title="Uredi igralca"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Prekliči
          </Button>
          <Button onClick={() => save()} loading={saving}>
            Shrani
          </Button>
        </>
      }
    >
      <form onSubmit={save}>
        <Field label="Ime" htmlFor="edit-player-name" error={error ?? undefined} hint="Ob preimenovanju ostane vsa zgodovina tekem igralca.">
          <input id="edit-player-name" className={inputClass} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
