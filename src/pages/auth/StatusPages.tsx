import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Alert, Button } from '../../components/ui'
import { AuthShell } from './AuthShell'

/** Shown once, to the first person who signs in while no administrator exists. */
export function SetupPage() {
  const { refresh, signOut, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claim = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('claim_initial_admin')
    setLoading(false)
    if (error) return setError(friendlyError(error))
    if (!data) setError('Skrbnik je že nastavljen.')
    await refresh()
  }

  return (
    <AuthShell title="Dobrodošli! Nastavimo vašo ligo" subtitle="Liga še nima skrbnika.">
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          Prijavljeni ste kot <strong>{profile?.email}</strong>. Postanite skrbnik lige, da boste lahko dodajali igralce, vabili ostale člane in popravljali
          rezultate.
        </p>
        <p className="text-xs text-slate-500">Ta možnost trajno izgine, ko liga dobi skrbnika.</p>
        {error && <Alert>{error}</Alert>}
        <Button className="w-full" size="lg" loading={loading} onClick={claim}>
          Postani skrbnik
        </Button>
        <button onClick={signOut} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
          Odjava
        </button>
      </div>
    </AuthShell>
  )
}

export function DisabledPage() {
  const { signOut } = useAuth()
  return (
    <AuthShell title="Račun je onemogočen">
      <p className="mb-4 text-sm text-slate-700">Vaš račun je onemogočen. Če menite, da gre za napako, se obrnite na skrbnika lige.</p>
      <Button variant="secondary" className="w-full" onClick={signOut}>
        Odjava
      </Button>
    </AuthShell>
  )
}

export function FatalPage({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <AuthShell title={title}>
      <Alert onRetry={onRetry}>{message}</Alert>
    </AuthShell>
  )
}
