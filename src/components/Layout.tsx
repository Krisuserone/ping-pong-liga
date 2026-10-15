import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AccountModal } from './AccountModal'
import { Badge, PaddleLogo } from './ui'

interface NavItem {
  to: string
  label: string
  short: string
  icon: ReactNode
  adminOnly?: boolean
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const NAV: NavItem[] = [
  { to: '/', label: 'Pregled', short: 'Domov', icon: icon('M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10') },
  { to: '/players', label: 'Igralci', short: 'Igralci', icon: icon('M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75') },
  { to: '/record', label: 'Vnos tekme', short: 'Vnos', icon: icon('M12 5v14M5 12h14') },
  { to: '/history', label: 'Zgodovina tekem', short: 'Tekme', icon: icon('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2') },
  { to: '/leaderboard', label: 'Lestvica', short: 'Lestvica', icon: icon('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3') },
  { to: '/admin', label: 'Administracija', short: 'Admin', icon: icon('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z'), adminOnly: true },
]

export function Layout() {
  const { profile, isAdmin, settings, signOut } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()
  const items = NAV.filter((n) => !n.adminOnly || isAdmin)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 text-white lg:flex">
        <div className="relative overflow-hidden px-5 pb-6 pt-6">
          <TableLines />
          <div className="relative flex items-center gap-3">
            <PaddleLogo className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Liga</p>
              <p className="truncate text-base font-bold leading-tight">{settings.league_name}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Glavni meni">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-navy-100/80 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-green-400" />}
                  <span className={isActive ? 'text-green-400' : ''}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={() => setAccountOpen(true)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5">
            <Avatar name={profile?.display_name ?? '?'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile?.display_name}</p>
              <p className="truncate text-xs text-navy-100/70">{isAdmin ? 'Skrbnik' : 'Igralec'}</p>
            </div>
          </button>
          <button onClick={handleSignOut} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-navy-100/80 hover:bg-white/5 hover:text-white">
            Odjava
          </button>
        </div>
      </aside>

      {/* Mobile / tablet header */}
      <header className="sticky top-0 z-30 bg-navy-900 pt-[env(safe-area-inset-top)] text-white shadow-md lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <PaddleLogo className="h-8 w-8 shrink-0" />
            <p className="truncate font-bold">{settings.league_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && (
              <span className="max-[359px]:hidden">
                <Badge color="green">Skrbnik</Badge>
              </span>
            )}
            <button onClick={() => setAccountOpen(true)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Moj račun">
              <Avatar name={profile?.display_name ?? '?'} />
            </button>
          </div>
        </div>
      </header>

      {/* Phone / tablet: bottom tab bar, always showing every section within thumb reach */}
      <nav
        aria-label="Glavni meni"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-900 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {items.map((item) => {
            const isRecord = item.to === '/record'
            return (
              <li key={item.to} className="min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                      isActive ? 'text-green-400' : 'text-navy-100/75 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex items-center justify-center rounded-full ${
                          isRecord ? `h-9 w-9 ${isActive ? 'bg-green-400 text-navy-950' : 'bg-green-500 text-navy-950'}` : 'h-7 w-7'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="max-w-full truncate px-0.5">{item.short}</span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} onSignOut={handleSignOut} />
    </div>
  )
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-navy-950">
      {initials || '?'}
    </span>
  )
}

/** Faint table-tennis-table markings behind the sidebar logo. */
function TableLines() {
  return (
    <svg className="absolute inset-0 h-full w-full text-white/[0.06]" preserveAspectRatio="none" viewBox="0 0 100 40" aria-hidden="true">
      <rect x="2" y="2" width="96" height="36" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="50" y1="2" x2="50" y2="38" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="20" x2="98" y2="20" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  )
}
