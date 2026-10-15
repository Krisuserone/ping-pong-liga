import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MatchFields } from '../components/MatchFields'
import { useToast } from '../components/Toast'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '../components/ui'
import { useLeagueQuery, useLiveData } from '../data/LiveData'
import { fetchPlayers } from '../data/queries'
import { todayIso } from '../lib/dates'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { validateMatch, type MatchErrors, type MatchFormInput } from '../lib/validation'

interface Saved {
  a: string
  b: string
  scoreA: number
  scoreB: number
}

export function RecordMatchPage() {
  const toast = useToast()
  const { bump } = useLiveData()
  const players = useLeagueQuery(fetchPlayers, [])
  const active = (players.data ?? []).filter((p) => p.active)
  const today = todayIso()
  const [form, setForm] = useState<MatchFormInput>({ playerAId: '', playerBId: '', scoreA: '', scoreB: '', matchDate: today })
  const [errors, setErrors] = useState<MatchErrors>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const nameOf = (id: string) => active.find((p) => p.id === id)?.name ?? ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    const { errors, value } = validateMatch(form, today)
    setErrors(errors)
    if (!value) return
    setSaving(true)
    const { error } = await supabase.from('matches').insert(value)
    setSaving(false)
    if (error) return setServerError(friendlyError(error))
    setSaved({ a: nameOf(value.player_a_id), b: nameOf(value.player_b_id), scoreA: value.player_a_score, scoreB: value.player_b_score })
    toast('success', 'Tekma shranjena')
    bump()
    // Keep players and date for quick re-matches; clear the scores.
    setForm((f) => ({ ...f, scoreA: '', scoreB: '' }))
    setErrors({})
  }

  const swap = () => setForm((f) => ({ ...f, playerAId: f.playerBId, playerBId: f.playerAId, scoreA: f.scoreB, scoreB: f.scoreA }))

  const a = Number(form.scoreA)
  const b = Number(form.scoreB)
  const preview =
    form.playerAId && form.playerBId && form.scoreA !== '' && form.scoreB !== '' && a !== b && a <= 21 && b <= 21
      ? `${nameOf(a > b ? form.playerAId : form.playerBId)} zmaga ${Math.max(a, b)}–${Math.min(a, b)}`
      : null

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Vnos tekme" subtitle="Ena igra do 21. Rezultat je celo število od 0 do 21, brez neodločenega izida." />

      {saved && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-600 p-4 text-white shadow-md" role="status">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">✓</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Rezultat je shranjen!</p>
            <p className="truncate text-sm text-green-50">
              {saved.a} {saved.scoreA} – {saved.scoreB} {saved.b} · Lestvica posodobljena
            </p>
          </div>
          <button onClick={() => setSaved(null)} className="text-sm font-semibold text-white/80 hover:text-white">
            Zapri
          </button>
        </div>
      )}

      <Card className="p-4 sm:p-6">
        {players.error && <Alert onRetry={players.reload}>{players.error}</Alert>}
        {!players.data ? (
          players.loading && <Loading label="Nalaganje igralcev …" />
        ) : active.length < 2 ? (
          <EmptyState title="Potrebna sta vsaj dva aktivna igralca">
            Skrbnik lahko doda igralce na zavihku{' '}
            <Link className="font-semibold text-green-700 underline" to="/players">
              Igralci
            </Link>
            .
          </EmptyState>
        ) : (
          <form ref={formRef} onSubmit={submit} noValidate className="space-y-5">
            <MatchFields value={form} onChange={setForm} errors={errors} players={active} idPrefix="rec" todayMax={today} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={swap} className="-my-2 rounded-lg py-2 pr-2 text-sm font-semibold text-navy-700 hover:underline">
                ⇄ Zamenjaj strani
              </button>
              {preview && <p className="text-sm font-semibold text-green-700">🏆 {preview}</p>}
            </div>
            {(errors.form || serverError) && <Alert>{errors.form ?? serverError}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              Shrani tekmo
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
