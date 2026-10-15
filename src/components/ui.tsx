import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'navy'

const variants: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700 focus-visible:outline-green-600 shadow-sm',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-900 shadow-sm',
  secondary: 'bg-white text-navy-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-navy-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 shadow-sm',
  ghost: 'text-navy-800 hover:bg-slate-100 focus-visible:outline-navy-700',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  // Phones get at least 40–44px tall touch targets; desktop keeps the compact sizes.
  const sizes = {
    sm: 'min-h-10 px-3 py-2 text-sm sm:min-h-0 sm:px-2.5 sm:py-1.5',
    md: 'min-h-11 px-4 py-2 text-sm sm:min-h-0',
    lg: 'min-h-12 px-5 py-3 text-base',
  }
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Loading({ label = 'Nalaganje …' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500" role="status">
      <Spinner className="h-5 w-5 text-green-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 ${className}`}>{children}</div>
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h2 className="text-base font-bold text-navy-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Alert({ kind = 'error', children, onRetry }: { kind?: 'error' | 'success' | 'info'; children: ReactNode; onRetry?: () => void }) {
  const styles = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    success: 'bg-green-50 text-green-800 ring-green-200',
    info: 'bg-blue-50 text-navy-800 ring-blue-200',
  }
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ring-1 ${styles[kind]}`}>
      <div>{children}</div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Poskusi znova
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <BallIcon className="mb-3 h-10 w-10 text-slate-300" />
      <p className="font-semibold text-navy-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'green' | 'blue' | 'amber' | 'red' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-navy-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colors[color]}`}>{children}</span>
}

export function Field({ label, error, children, hint, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-navy-900">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-navy-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-green-600 disabled:bg-slate-50 aria-[invalid=true]:ring-red-400'

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      // Phones: a full-width sheet anchored to the bottom of the screen. Larger screens: centred card.
      className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl p-0 shadow-2xl backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-2xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 sm:py-4">
            <h2 className="text-lg font-bold text-navy-900">{title}</h2>
            <button onClick={onClose} className="-mr-2 rounded-md p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Zapri">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 bg-slate-50 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 max-sm:[&>*]:flex-1 sm:pb-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}

export function BallIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="M5 9c3 1.5 11 1.5 14 0" stroke="white" strokeOpacity=".5" strokeWidth="1.2" />
    </svg>
  )
}

export function PaddleLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="26" cy="26" r="20" fill="#22c55e" />
      <circle cx="26" cy="26" r="20" fill="url(#paddle-shine)" />
      <rect x="34" y="38" width="10" height="22" rx="4" transform="rotate(-45 39 49)" fill="#e2e8f0" />
      <circle cx="51" cy="13" r="7" fill="#fff" />
      <defs>
        <radialGradient id="paddle-shine" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}
