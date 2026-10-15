import { useState, type FormEvent } from 'react'
import { friendlyError, translateServerMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Alert, Button, Field, inputClass } from '../../components/ui'
import { AuthShell } from './AuthShell'

/** Supabase sends OAuth failures back as ?error_description=… (or in the #hash). */
function oauthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search || window.location.hash.slice(1))
  const msg = params.get('error_description')
  if (!msg) return null
  window.history.replaceState(null, '', window.location.pathname)
  const text = msg.replace(/\+/g, ' ')
  return translateServerMessage(text) ?? text
}

/**
 * Password sign-in is only for local test accounts. Players use Google, so
 * the live site hides it unless VITE_ENABLE_PASSWORD_LOGIN=true is set.
 */
const PASSWORD_LOGIN = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PASSWORD_LOGIN === 'true'

/** Reads the public auth settings; if they can't be read, let the redirect try anyway. */
async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
    if (!res.ok) return true
    const settings = await res.json()
    return settings?.external?.google !== false
  } catch {
    return true
  }
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5Z" />
    </svg>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(oauthErrorFromUrl)
  const [showEmail, setShowEmail] = useState(false)

  const google = async () => {
    setLoading('google')
    setError(null)
    // Ask Supabase first whether Google sign-in is switched on; otherwise the
    // redirect below would land on a raw JSON error page.
    if (!(await googleEnabled())) {
      setLoading(null)
      return setError('Prijava z Googlom še ni nastavljena. Obrnite se na skrbnika lige.')
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    // On success the browser navigates to Google, so only errors land here.
    if (error) {
      setLoading(null)
      setError(/provider is not enabled|unsupported provider/i.test(error.message) ? 'Prijava z Googlom še ni nastavljena. Obrnite se na skrbnika lige.' : friendlyError(error))
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading('email')
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(null)
    if (error) {
      setError(/invalid login credentials/i.test(error.message) ? 'Napačen e-poštni naslov ali geslo.' : friendlyError(error))
    }
  }

  return (
    <AuthShell title="Ping Pong Liga" subtitle="Prijavite se za vnos tekem in ogled lestvice">
      <div className="space-y-4">
        <button
          type="button"
          onClick={google}
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-base font-semibold text-slate-800 shadow-sm ring-1 ring-slate-300 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <GoogleLogo />
          {loading === 'google' ? 'Odpiranje Googla …' : 'Nadaljuj z Googlom'}
        </button>

        {error && <Alert>{error}</Alert>}

        <p className="text-center text-xs text-slate-500">Liga je zasebna. Uporabite Gmail naslov, ki ga je povabil skrbnik lige.</p>

        {PASSWORD_LOGIN && (
          <div className="border-t border-slate-100 pt-3">
            {showEmail ? (
              <form onSubmit={submit} className="space-y-3">
                <Field label="E-pošta" htmlFor="email">
                  <input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Geslo" htmlFor="password">
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Button type="submit" variant="navy" className="w-full" loading={loading === 'email'}>
                  Prijava z geslom
                </Button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowEmail(true)} className="w-full text-center text-sm text-slate-500 hover:text-navy-800">
                Raje se prijavi z e-pošto in geslom
              </button>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  )
}
