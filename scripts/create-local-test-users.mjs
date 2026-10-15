// LOCAL DEVELOPMENT ONLY. Creates two test accounts on the local Supabase
// stack (`supabase start`) and writes their credentials to .env.test.local
// (git-ignored). Refuses to run against anything but localhost.
//
// Usage: node scripts/create-local-test-users.mjs <api-url> <service-role-key>
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [url, serviceKey] = process.argv.slice(2)
if (!url || !serviceKey) throw new Error('Usage: node scripts/create-local-test-users.mjs <api-url> <service-role-key>')
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) throw new Error('Refusing to run against a non-local URL.')

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const password = () => `Tt${randomBytes(9).toString('base64url')}9`

const accounts = [
  { key: 'ADMIN', email: 'admin@league.test', display_name: 'Ada Admin' },
  { key: 'USER', email: 'player@league.test', display_name: 'Pat Player' },
]
const lines = ['# Local test accounts (generated; local Supabase stack only)']
for (const a of accounts) {
  const pw = password()
  const { error } = await admin.auth.admin.createUser({
    email: a.email,
    password: pw,
    email_confirm: true,
    user_metadata: { display_name: a.display_name },
  })
  if (error) throw error
  lines.push(`TEST_${a.key}_EMAIL=${a.email}`, `TEST_${a.key}_PASSWORD=${pw}`)
  console.log(`created ${a.email}`)
}
writeFileSync(join(import.meta.dirname, '..', '.env.test.local'), lines.join('\n') + '\n')
console.log('credentials written to .env.test.local')
