import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { AppSettings, Profile } from '../lib/types'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  settings: AppSettings
  setupRequired: boolean
  error: string | null
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = { league_name: 'Ping Pong Liga' }

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [setupRequired, setSetupRequired] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession((prev) => (prev?.access_token === next?.access_token ? prev : next))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setSetupRequired(false)
      return
    }
    setProfileLoading(true)
    setError(null)
    try {
      const [profileRes, setupRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.rpc('setup_required'),
        supabase.from('app_settings').select('league_name').maybeSingle(),
      ])
      if (profileRes.error) throw profileRes.error
      setProfile(profileRes.data as Profile | null)
      setSetupRequired(Boolean(setupRes.data))
      if (settingsRes.data) setSettings(settingsRes.data as AppSettings)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setProfileLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value: AuthState = {
    loading: !sessionLoaded || profileLoading,
    session,
    profile,
    settings,
    setupRequired,
    error,
    isAdmin: profile?.role === 'admin' && profile.status === 'active',
    refresh: load,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
