import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Loading } from './components/ui'
import { LiveDataProvider } from './data/LiveData'
import { isConfigured } from './lib/supabase'
import { AdminPage } from './pages/AdminPage'
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage'
import { ChooseNamePage } from './pages/auth/ChooseNamePage'
import { LoginPage } from './pages/auth/LoginPage'
import { DisabledPage, FatalPage, SetupPage } from './pages/auth/StatusPages'
import { DashboardPage } from './pages/DashboardPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { MatchHistoryPage } from './pages/MatchHistoryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlayersPage } from './pages/PlayersPage'
import { RecordMatchPage } from './pages/RecordMatchPage'

function Gate() {
  const { loading, session, profile, setupRequired, error, refresh } = useAuth()

  if (loading && !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-900">
        <div className="text-white">
          <Loading label="Nalaganje lige …" />
        </div>
      </div>
    )
  }
  if (!session) return <LoginPage />
  if (error && !profile) return <FatalPage title="Računa ni bilo mogoče naložiti" message={error} onRetry={refresh} />
  if (!profile) return <FatalPage title="Račun ne obstaja" message="Vaša prijava nima profila v ligi. Za pomoč prosite skrbnika." />
  if (profile.status !== 'active') return <DisabledPage />
  if (profile.must_change_password) return <ChangePasswordPage />
  if (!profile.name_confirmed) return <ChooseNamePage />
  if (setupRequired) return <SetupPage />

  return (
    <LiveDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="record" element={<RecordMatchPage />} />
          <Route path="history" element={<MatchHistoryPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </LiveDataProvider>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <FatalPage
        title="Potrebna je nastavitev"
        message="VITE_SUPABASE_URL in VITE_SUPABASE_ANON_KEY nista nastavljena. Dodajte ju v .env.local (lokalno) ali med okoljske spremenljivke gostovanja in znova zgradite aplikacijo."
      />
    )
  }
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
