// Invites an email as league administrator, directly in the database.
// Used once at deployment to create the first admin (the app's own invite
// form needs an admin to already exist). If the account already exists,
// it is promoted to admin.
//
// Usage:
//   npm run invite-admin -- someone@gmail.com           (linked live project)
//   npm run invite-admin -- someone@gmail.com --local   (local Docker stack)
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const email = (args.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase()
const target = args.includes('--local') ? '--local' : '--linked'

// Strict check: the address is placed into SQL, so allow only plain email characters.
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
  console.error('Usage: npm run invite-admin -- someone@gmail.com [--local]')
  process.exit(1)
}

// One statement (the CLI runs queries as a single prepared statement).
const sql = `
  with invited as (
    insert into public.invites (email, role) values ('${email}', 'admin')
    on conflict (email) do update set role = 'admin'
    returning email, role
  ), promoted as (
    update public.profiles set role = 'admin', status = 'active'
    where lower(email) = '${email}'
    returning id
  )
  select email, role, (select count(*) from promoted) as existing_account_promoted from invited
`

// Prefer the CLI binary bundled in node_modules; fall back to npx.
const binDir = join(import.meta.dirname, '..', 'node_modules', '@supabase')
const local = ['cli-windows-x64', 'cli-windows-arm64', 'cli-darwin-arm64', 'cli-darwin-x64', 'cli-linux-x64', 'cli-linux-arm64']
  .map((p) => join(binDir, p, 'bin', process.platform === 'win32' ? 'supabase.exe' : 'supabase'))
  .find(existsSync)
const [cmd, pre] = local ? [local, []] : ['npx', ['supabase']]

const result = spawnSync(cmd, [...pre, 'db', 'query', target, sql], { stdio: 'inherit', shell: !local })
if (result.status === 0) console.log(`\n${email} is invited as administrator (${target === '--local' ? 'local' : 'live'} database).`)
process.exit(result.status ?? 1)
