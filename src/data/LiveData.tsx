import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

/**
 * A shared "data version" that increases whenever matches or players change —
 * locally after a save, or remotely via Supabase Realtime — so every screen
 * that depends on league data refetches automatically.
 */
const LiveDataContext = createContext<{ version: number; bump: () => void }>({ version: 0, bump: () => {} })

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const debouncedBump = () => {
      clearTimeout(timer)
      timer = setTimeout(bump, 250)
    }
    const channel = supabase
      .channel('league-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, debouncedBump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, debouncedBump)
      .subscribe()
    // Refresh when the user returns to the tab (e.g. phone was locked).
    const onVisible = () => document.visibilityState === 'visible' && debouncedBump()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [bump])

  return <LiveDataContext.Provider value={{ version, bump }}>{children}</LiveDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLiveData() {
  return useContext(LiveDataContext)
}

interface QueryState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

/** Runs `fn` on mount, whenever `deps` change and whenever league data changes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useLeagueQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const { version } = useLiveData()
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fnRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, nonce, ...deps])

  return { data, error, loading, reload: () => setNonce((n) => n + 1) }
}

/** Unwraps a Supabase response, throwing its error. */
// eslint-disable-next-line react-refresh/only-export-components
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
