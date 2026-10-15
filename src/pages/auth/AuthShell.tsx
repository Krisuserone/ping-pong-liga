import type { ReactNode } from 'react'
import { PaddleLogo } from '../../components/ui'

/** Full-screen centred card on a navy "table" background, used by sign-in and setup screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy-900 px-4 py-10">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.07]" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
        <rect x="6" y="10" width="88" height="80" fill="none" stroke="currentColor" strokeWidth=".6" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth=".3" />
        <line x1="6" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <PaddleLogo className="mb-3 h-14 w-14" />
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-navy-100/80">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">{children}</div>
      </div>
    </div>
  )
}
