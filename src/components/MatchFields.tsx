import type { Player } from '../lib/types'
import { MAX_SCORE, type MatchErrors, type MatchFormInput } from '../lib/validation'
import { Field, inputClass } from './ui'

/**
 * The player/score/date inputs shared by "Record Match" and the admin edit dialog.
 * Laid out as two "sides of the table" so it reads like a scoreboard.
 */
export function MatchFields({
  value,
  onChange,
  errors,
  players,
  idPrefix,
  todayMax,
  stacked,
}: {
  /** Always place Player B under Player A (for narrow containers like dialogs). */
  stacked?: boolean
  value: MatchFormInput
  onChange: (v: MatchFormInput) => void
  errors: MatchErrors
  players: Player[]
  idPrefix: string
  todayMax: string
}) {
  const set = (patch: Partial<MatchFormInput>) => onChange({ ...value, ...patch })
  const side = (which: 'A' | 'B') => {
    const playerKey = which === 'A' ? 'playerAId' : 'playerBId'
    const scoreKey = which === 'A' ? 'scoreA' : 'scoreB'
    const otherId = which === 'A' ? value.playerBId : value.playerAId
    const pErr = which === 'A' ? errors.playerA : errors.playerB
    const sErr = which === 'A' ? errors.scoreA : errors.scoreB
    return (
      <div className="flex-1 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4">
        <p className={`mb-2 text-xs font-bold uppercase tracking-wider ${which === 'A' ? 'text-navy-700' : 'text-green-700'}`}>Igralec {which}</p>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${idPrefix}-p${which}`} className="sr-only">
              Igralec {which}
            </label>
            <select
              id={`${idPrefix}-p${which}`}
              className={inputClass}
              value={value[playerKey]}
              aria-invalid={Boolean(pErr)}
              onChange={(e) => set({ [playerKey]: e.target.value })}
            >
              <option value="">Izberite igralca …</option>
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === otherId}>
                  {p.name}
                  {!p.active ? ' (neaktiven)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="w-20 shrink-0">
            <label htmlFor={`${idPrefix}-s${which}`} className="sr-only">
              Rezultat igralca {which}
            </label>
            <input
              id={`${idPrefix}-s${which}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SCORE}
              step={1}
              placeholder="0"
              className={`${inputClass} text-center text-lg font-bold tabular-nums`}
              value={value[scoreKey]}
              aria-invalid={Boolean(sErr)}
              onChange={(e) => set({ [scoreKey]: e.target.value })}
            />
          </div>
        </div>
        {(pErr || sErr) && <p className="mt-1 text-sm text-red-600">{pErr ?? sErr}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-col items-stretch gap-2 ${stacked ? '' : 'sm:flex-row sm:items-center'}`}>
        {side('A')}
        <div className="flex items-center justify-center">
          <span className="rounded-full bg-navy-900 px-2.5 py-1 text-xs font-black text-white">PROTI</span>
        </div>
        {side('B')}
      </div>
      <div className="max-w-xs">
        <Field label="Datum tekme" htmlFor={`${idPrefix}-date`} error={errors.matchDate}>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className={inputClass}
            max={todayMax}
            value={value.matchDate}
            aria-invalid={Boolean(errors.matchDate)}
            onChange={(e) => set({ matchDate: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
