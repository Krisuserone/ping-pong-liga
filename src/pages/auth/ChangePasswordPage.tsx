import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Alert, Button, Field, inputClass } from '../../components/ui'
import { AuthShell } from './AuthShell'

export const PASSWORD_HINT = 'Vsaj 10 znakov, z velikimi in malimi črkami ter številko.'

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Uporabite vsaj 10 znakov.'
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'Vključite velike in male črke ter številko.'
  return null
}

export function PasswordForm({ onDone }: { onDone: () => void }) {
  const { refresh } = useAuth()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = passwordProblem(pw)
    if (problem) return setError(problem)
    if (pw !== confirm) return setError('Gesli se ne ujemata.')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setLoading(false)
      return setError(friendlyError(error))
    }
    await supabase.rpc('clear_must_change_password')
    await refresh()
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Novo geslo" htmlFor="new-pw" hint={PASSWORD_HINT}>
        <input id="new-pw" type="password" autoComplete="new-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Ponovite novo geslo" htmlFor="confirm-pw">
        <input id="confirm-pw" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" className="w-full" loading={loading}>
        Shrani novo geslo
      </Button>
    </form>
  )
}

export function ChangePasswordPage() {
  const { signOut } = useAuth()
  return (
    <AuthShell title="Izberite novo geslo" subtitle="Vaš račun ima začasno geslo. Izberite svoje.">
      <PasswordForm onDone={() => {}} />
      <button onClick={signOut} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700">
        Odjava
      </button>
    </AuthShell>
  )
}
