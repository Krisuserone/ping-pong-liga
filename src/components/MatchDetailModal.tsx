import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useLiveData } from '../data/LiveData'
import { formatDate, formatTimestamp, todayIso } from '../lib/dates'
import { friendlyError } from '../lib/errors'
import { winnerSide } from '../lib/stats'
import { supabase } from '../lib/supabase'
import type { Match, Player } from '../lib/types'
import { validateMatch, type MatchErrors, type MatchFormInput } from '../lib/validation'
import { MatchFields } from './MatchFields'
import { playerName } from './MatchList'
import { useToast } from './Toast'
import { Alert, Button, Modal } from './ui'

type Mode = 'view' | 'edit' | 'delete'

export function MatchDetailModal({ match, players, onClose }: { match: Match | null; players: Player[]; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const { bump } = useLiveData()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('view')
  const [form, setForm] = useState<MatchFormInput>({ playerAId: '', playerBId: '', scoreA: '', scoreB: '', matchDate: '' })
  const [errors, setErrors] = useState<MatchErrors>({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    setMode('view')
    setErrors({})
    setServerError(null)
    if (match) {
      setForm({
        playerAId: match.player_a_id,
        playerBId: match.player_b_id,
        scoreA: String(match.player_a_score),
        scoreB: String(match.player_b_score),
        matchDate: match.match_date,
      })
    }
  }, [match])

  if (!match) return null

  const today = todayIso()
  const w = winnerSide(match)

  const save = async () => {
    const { errors, value } = validateMatch(form, today)
    setErrors(errors)
    if (!value) return
    setBusy(true)
    setServerError(null)
    const { data, error } = await supabase.from('matches').update(value).eq('id', match.id).select('id')
    setBusy(false)
    if (error) return setServerError(friendlyError(error))
    if (!data?.length) return setServerError('Tekme ni bilo mogoče posodobiti (morda je bila izbrisana ali nimate dovoljenja).')
    toast('success', 'Tekma posodobljena — lestvica preračunana')
    bump()
    onClose()
  }

  const remove = async () => {
    setBusy(true)
    setServerError(null)
    const { error, count } = await supabase.from('matches').delete({ count: 'exact' }).eq('id', match.id)
    setBusy(false)
    if (error) return setServerError(friendlyError(error))
    if (count === 0) return setServerError('Tekme ni bilo mogoče izbrisati (morda je že izbrisana).')
    toast('success', 'Tekma izbrisana — lestvica preračunana')
    bump()
    onClose()
  }

  const footer =
    mode === 'view' ? (
      <>
        {isAdmin && (
          <>
            <Button variant="danger" onClick={() => setMode('delete')} className="mr-auto">
              Izbriši
            </Button>
            <Button variant="secondary" onClick={() => setMode('edit')}>
              Uredi rezultat
            </Button>
          </>
        )}
        <Button variant="navy" onClick={onClose}>
          Zapri
        </Button>
      </>
    ) : mode === 'edit' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('view')} disabled={busy}>
          Prekliči
        </Button>
        <Button onClick={save} loading={busy}>
          Shrani spremembe
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={() => setMode('view')} disabled={busy}>
          Obdrži tekmo
        </Button>
        <Button variant="danger" onClick={remove} loading={busy}>
          Da, trajno izbriši
        </Button>
      </>
    )

  return (
    <Modal open onClose={onClose} title={mode === 'edit' ? 'Uredi rezultat tekme' : mode === 'delete' ? 'Izbrišem to tekmo?' : 'Podrobnosti tekme'} footer={footer}>
      {mode === 'edit' ? (
        <MatchFields value={form} onChange={setForm} errors={errors} players={players} idPrefix="edit" todayMax={today} stacked />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-navy-900 p-4 text-white">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-navy-100/70">{formatDate(match.match_date)}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-center">
              {(['A', 'B'] as const).map((side, i) => (
                <div key={side} className={i === 1 ? 'order-3' : ''}>
                  <p className={`truncate font-semibold ${w === side ? 'text-white' : 'text-navy-100/70'}`}>{playerName(match, side)}</p>
                  <p className={`font-mono text-4xl font-black tabular-nums ${w === side ? 'text-green-400' : 'text-white/60'}`}>
                    {side === 'A' ? match.player_a_score : match.player_b_score}
                  </p>
                  {w === side && <p className="text-xs font-bold uppercase text-green-400">Zmagovalec</p>}
                </div>
              ))}
              <span className="order-2 self-center text-sm font-black text-white/40">PROTI</span>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Vnos</dt>
            <dd className="font-medium text-navy-900">{match.recorder?.display_name ?? '—'}</dd>
            <dt className="text-slate-500">Čas vnosa</dt>
            <dd className="text-navy-900">{formatTimestamp(match.created_at)}</dd>
            {match.updated_at && Math.abs(new Date(match.updated_at).getTime() - new Date(match.created_at).getTime()) > 2000 && (
              <>
                <dt className="text-slate-500">Zadnja sprememba</dt>
                <dd className="text-navy-900">
                  {formatTimestamp(match.updated_at)}
                  {match.editor ? ` · ${match.editor.display_name}` : ''}
                </dd>
              </>
            )}
          </dl>
          {mode === 'delete' && (
            <Alert>Tekma bo trajno izbrisana. Statistika igralcev in lestvica bosta preračunani. Tega ni mogoče razveljaviti.</Alert>
          )}
        </div>
      )}
      {(serverError || errors.form) && (
        <div className="mt-4">
          <Alert>{serverError ?? errors.form}</Alert>
        </div>
      )}
    </Modal>
  )
}
