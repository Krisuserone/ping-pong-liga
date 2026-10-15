import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { PasswordForm } from '../pages/auth/ChangePasswordPage'
import { useToast } from './Toast'
import { Alert, Badge, Button, Field, inputClass, Modal } from './ui'

export function AccountModal({ open, onClose, onSignOut }: { open: boolean; onClose: () => void; onSignOut: () => void }) {
  const { profile, isAdmin, refresh, session } = useAuth()
  const usesPassword = (session?.user.app_metadata.providers as string[] | undefined)?.includes('email') ?? session?.user.app_metadata.provider === 'email'
  const toast = useToast()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('update_my_display_name', { new_name: name })
    setSaving(false)
    if (error) return setError(friendlyError(error))
    toast('success', 'Ime je posodobljeno')
    refresh()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Moj račun"
      footer={
        <Button variant="secondary" onClick={onSignOut}>
          Odjava
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{profile?.email}</span>
          <Badge color={isAdmin ? 'green' : 'blue'}>{isAdmin ? 'Skrbnik' : 'Igralec'}</Badge>
        </div>
        <form onSubmit={saveName} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Prikazno ime" htmlFor="acct-name" hint="Prikazano pri tekmah, ki jih vnesete.">
              <input id="acct-name" className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="navy" loading={saving} className="mb-[1.375rem]">
            Shrani
          </Button>
        </form>
        {error && <Alert>{error}</Alert>}
        <div className="border-t border-slate-100 pt-4">
          {!usesPassword ? (
            <p className="text-sm text-slate-500">Prijavljate se z Googlom — za to aplikacijo nimate posebnega gesla.</p>
          ) : showPassword ? (
            <PasswordForm
              onDone={() => {
                setShowPassword(false)
                toast('success', 'Geslo je spremenjeno')
              }}
            />
          ) : (
            <Button variant="secondary" onClick={() => setShowPassword(true)}>
              Spremeni geslo
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
