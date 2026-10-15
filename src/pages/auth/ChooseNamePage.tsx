import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Alert, Button, Field, inputClass } from '../../components/ui'
import { AuthShell } from './AuthShell'

/** Shown once, on a player's first sign-in, pre-filled with their Google name. */
export function ChooseNamePage() {
  const { profile, refresh, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2 || clean.length > 40) return setError('Ime mora imeti od 2 do 40 znakov.')
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('update_my_display_name', { new_name: clean })
    if (error) {
      setSaving(false)
      return setError(friendlyError(error))
    }
    await refresh()
  }

  return (
    <AuthShell title="Dobrodošli v ligi!" subtitle="Izberite ime, ki ga bodo videli ostali igralci.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Vaše ime" htmlFor="display-name" hint="Prikazano pri tekmah, ki jih vnesete. Kasneje ga lahko spremenite pod Moj račun.">
          <input
            id="display-name"
            autoFocus
            autoComplete="nickname"
            maxLength={40}
            className={inputClass}
            value={name}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={saving}>
          Nadaljuj
        </Button>
        <p className="text-center text-xs text-slate-500">Prijavljeni kot {profile?.email}</p>
        <button type="button" onClick={signOut} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
          Niste vi? Odjava
        </button>
      </form>
    </AuthShell>
  )
}
