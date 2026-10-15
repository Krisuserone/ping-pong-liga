import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, inputClass, Loading, PageHeader } from '../components/ui'
import { unwrap, useLeagueQuery } from '../data/LiveData'
import { formatDay } from '../lib/dates'
import { waitingInvites } from '../lib/sl'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Invite, Profile } from '../lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AdminPage() {
  const { isAdmin, profile: me, settings, refresh } = useAuth()
  const toast = useToast()
  const users = useLeagueQuery(async () => unwrap(await supabase.from('profiles').select('*').order('created_at')) as Profile[], [])
  const invites = useLeagueQuery(async () => unwrap(await supabase.from('invites').select('*').order('created_at', { ascending: false })) as Invite[], [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [leagueName, setLeagueName] = useState(settings.league_name)
  const [savingName, setSavingName] = useState(false)

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState title="Samo za skrbnike">Do tega dela nimate dostopa.</EmptyState>
      </Card>
    )
  }

  const rpc = async (u: Profile, fn: 'admin_set_user_role' | 'admin_set_user_status', args: Record<string, string>, success: string) => {
    setBusyId(u.id)
    const { error } = await supabase.rpc(fn, { target: u.id, ...args })
    setBusyId(null)
    if (error) return toast('error', friendlyError(error))
    toast('success', success)
    users.reload()
    if (u.id === me?.id) refresh()
  }

  const saveLeagueName = async (e: FormEvent) => {
    e.preventDefault()
    setSavingName(true)
    const { data, error } = await supabase.from('app_settings').update({ league_name: leagueName.trim(), updated_at: new Date().toISOString() }).eq('id', 1).select('id')
    setSavingName(false)
    if (error || !data?.length) return toast('error', error ? friendlyError(error) : 'Nastavitev ni bilo mogoče shraniti.')
    toast('success', 'Ime lige shranjeno')
    refresh()
  }

  const pending = (invites.data ?? []).filter((i) => !i.accepted_at)

  return (
    <div className="space-y-6">
      <PageHeader title="Administracija" subtitle="Vabila igralcev, upravljanje računov in nastavitve lige." />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/players" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-green-400">
          <p className="font-bold text-navy-900">Upravljanje igralcev →</p>
          <p className="text-sm text-slate-500">Dodajanje, preimenovanje, deaktivacija in ponovna aktivacija igralcev.</p>
        </Link>
        <Link to="/history" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-green-400">
          <p className="font-bold text-navy-900">Popravljanje rezultatov →</p>
          <p className="text-sm text-slate-500">V zgodovini odprite tekmo, da jo uredite ali izbrišete.</p>
        </Link>
      </div>

      <InviteCard invites={invites.data} error={invites.error} loading={invites.loading} reload={invites.reload} pendingCount={pending.length} />

      <Card className="overflow-hidden">
        <CardHeader title="Računi" subtitle="Vsi, ki so se prijavili. Onemogočen račun nima dostopa, njegove tekme pa ostanejo." />
        {users.error && (
          <div className="p-4">
            <Alert onRetry={users.reload}>{users.error}</Alert>
          </div>
        )}
        {!users.data ? (
          users.loading && <Loading />
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={u.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                    {u.display_name}
                    {u.id === me?.id && <span className="text-xs font-normal text-slate-500">(vi)</span>}
                    <Badge color={u.role === 'admin' ? 'green' : 'blue'}>{u.role === 'admin' ? 'Skrbnik' : 'Igralec'}</Badge>
                    {u.status === 'disabled' && <Badge color="red">Onemogočen</Badge>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {u.email} · od {formatDay(u.created_at)}
                  </p>
                </div>
                <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === u.id}
                    onClick={() =>
                      rpc(u, 'admin_set_user_role', { new_role: u.role === 'admin' ? 'user' : 'admin' }, `${u.display_name} je zdaj ${u.role === 'admin' ? 'igralec' : 'skrbnik'}`)
                    }
                  >
                    {u.role === 'admin' ? 'Odvzemi skrbništvo' : 'Naredi skrbnika'}
                  </Button>
                  {u.id !== me?.id && (
                    <Button
                      size="sm"
                      variant={u.status === 'active' ? 'ghost' : 'primary'}
                      disabled={busyId === u.id}
                      onClick={() =>
                        rpc(u, 'admin_set_user_status', { new_status: u.status === 'active' ? 'disabled' : 'active' }, `${u.display_name}: račun ${u.status === 'active' ? 'onemogočen' : 'omogočen'}`)
                      }
                    >
                      {u.status === 'active' ? 'Onemogoči' : 'Omogoči'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Nastavitve lige" />
        <form onSubmit={saveLeagueName} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:px-5">
          <div className="flex-1">
            <Field label="Ime lige" htmlFor="league-name">
              <input id="league-name" className={inputClass} maxLength={60} value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="navy" loading={savingName}>
            Shrani
          </Button>
        </form>
        <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-600 sm:px-5">
          <p className="font-semibold text-navy-900">Prijava in varnost</p>
          <p className="mt-1">
            Igralci se prijavljajo z Googlom, zato aplikacija nikoli ne obdeluje njihovih gesel. Račun lahko ustvarijo samo povabljeni e-poštni naslovi — vse
            ostale zavrne že baza, preden račun sploh nastane. Trajanje seje in druge možnosti prijave nastavite v nadzorni plošči Supabase pod{' '}
            <em>Authentication</em>.
          </p>
        </div>
      </Card>
    </div>
  )
}

function InviteCard({
  invites,
  error,
  loading,
  reload,
  pendingCount,
}: {
  invites: Invite[] | undefined
  error: string | null
  loading: boolean
  reload: () => void
  pendingCount: number
}) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) return setFormError('Vnesite veljaven e-poštni naslov.')
    if (invites?.some((i) => i.email === value)) return setFormError('Ta e-poštni naslov je že povabljen.')
    setSaving(true)
    setFormError(null)
    const { error } = await supabase.from('invites').insert({ email: value, role })
    setSaving(false)
    if (error) return setFormError(error.code === '23505' ? 'Ta e-poštni naslov je že povabljen.' : friendlyError(error))
    toast('success', `Povabilo poslano: ${value}`)
    setEmail('')
    setRole('user')
    reload()
  }

  const remove = async (inv: Invite) => {
    setRemoving(inv.email)
    const { error } = await supabase.from('invites').delete().eq('email', inv.email)
    setRemoving(null)
    if (error) return toast('error', friendlyError(error))
    toast('success', `Povabilo za ${inv.email} preklicano`)
    reload()
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Povabi igralce"
        subtitle={`Dodajte igralčev Gmail naslov in mu pošljite povezavo do aplikacije. Prijavi se z »Nadaljuj z Googlom«.${pendingCount ? ` ${waitingInvites(pendingCount)}` : ''}`}
      />
      <form onSubmit={invite} noValidate className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:px-5">
        <div className="flex-1">
          <label htmlFor="invite-email" className="sr-only">
            E-poštni naslov
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="igralec@gmail.com"
            className={inputClass}
            value={email}
            aria-invalid={Boolean(formError)}
            onChange={(e) => {
              setEmail(e.target.value)
              setFormError(null)
            }}
          />
          {formError && <p className="mt-1 text-sm text-red-600">{formError}</p>}
        </div>
        <label htmlFor="invite-role" className="sr-only">
          Vloga
        </label>
        <select id="invite-role" className={`${inputClass} sm:w-40`} value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')}>
          <option value="user">Igralec</option>
          <option value="admin">Skrbnik</option>
        </select>
        <Button type="submit" loading={saving}>
          Povabi
        </Button>
      </form>
      {error && (
        <div className="px-4 pb-4">
          <Alert onRetry={reload}>{error}</Alert>
        </div>
      )}
      {!invites ? (
        loading && <Loading />
      ) : invites.length === 0 ? (
        <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Še ni povabil.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {invites.map((inv) => (
            <li key={inv.email} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">
                  <span className="truncate">{inv.email}</span>
                  {inv.role === 'admin' && <Badge color="green">Skrbnik</Badge>}
                  {inv.accepted_at ? <Badge color="blue">Pridružen</Badge> : <Badge color="amber">Čaka na prvo prijavo</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  Povabljen {formatDay(inv.created_at)}
                  {inv.accepted_at ? ` · pridružen ${formatDay(inv.accepted_at)}` : ''}
                </p>
              </div>
              {!inv.accepted_at && (
                <Button size="sm" variant="ghost" loading={removing === inv.email} onClick={() => remove(inv)}>
                  Prekliči povabilo
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
