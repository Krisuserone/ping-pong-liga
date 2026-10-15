// Runs supabase/migrations + supabase/tests/*.sql against an in-memory
// Postgres (PGlite), without Docker. A small stub stands in for the parts
// of Supabase the schema relies on (auth schema, auth.uid(), API roles,
// default grants, realtime publication) and a minimal pgTAP shim provides
// the assertion functions the tests use.
//
// With a local Supabase stack (Docker) you can instead run: supabase test db
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', 'supabase')

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
`

const TAP_SHIM = `
create table public._tap (n serial, ok boolean, description text, diag text);
grant all on public._tap to public;
create function public._tap_record(pass boolean, description text, diag text default null)
returns boolean language sql security definer as $$
  insert into public._tap (ok, description, diag) values (coalesce(pass, false), description, diag) returning coalesce(pass, false)
$$;
create function public.plan(int) returns int language sql as 'select $1';
create function public.ok(pass boolean, description text) returns boolean language sql as
  'select public._tap_record($1, $2)';
create function public.is(have anyelement, want anyelement, description text) returns boolean language sql as
  $$ select public._tap_record(have is not distinct from want, description, format('have: %s, want: %s', have, want)) $$;
create function public.lives_ok(code text, description text) returns boolean language plpgsql as $$
begin
  execute code;
  return public._tap_record(true, description);
exception when others then
  return public._tap_record(false, description, sqlstate || ': ' || sqlerrm);
end $$;
create function public.throws_ok(code text, errcode text, errmsg text, description text) returns boolean language plpgsql as $$
begin
  execute code;
  return public._tap_record(false, description, 'no exception thrown');
exception when others then
  return public._tap_record(
    sqlstate = errcode and (errmsg is null or sqlerrm = errmsg), description,
    format('got %s: %s', sqlstate, sqlerrm));
end $$;
create function public.results_eq(have text, want text, description text) returns boolean language plpgsql as $$
declare h text[]; w text[];
begin
  execute format('select array_agg(t::text) from (%s) t', have) into h;
  execute format('select array_agg(t::text) from (%s) t', want) into w;
  return public._tap_record(h is not distinct from w, description, format('have: %s, want: %s', h, w));
end $$;
create function public.finish() returns setof text language sql as 'select null::text where false';
`

const db = new PGlite()
await db.exec(SUPABASE_STUB)

for (const file of readdirSync(join(root, 'migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'))
  console.log(`applied migration ${file}`)
}
await db.exec(TAP_SHIM)

let failed = 0
for (const file of readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.sql'))) {
  const sql = readFileSync(join(root, 'tests', file), 'utf8')
    .replace(/^create extension if not exists pgtap.*$/m, '')
    .replace(/^rollback;\s*$/m, '')
  const planned = Number(/select plan\((\d+)\)/.exec(sql)?.[1] ?? 0)
  await db.exec('truncate public._tap restart identity')
  try {
    await db.exec(sql)
  } catch (e) {
    console.error(`\n${file}: test script aborted: ${e.message}`)
    failed++
  }
  const { rows } = await db.query('select n, ok, description, diag from public._tap order by n')
  await db.exec('rollback')
  console.log(`\n${file}`)
  for (const r of rows) {
    console.log(`${r.ok ? 'ok    ' : 'NOT OK'} ${r.n} - ${r.description}${r.ok ? '' : `  [${r.diag}]`}`)
    if (!r.ok) failed++
  }
  if (rows.length !== planned) {
    console.error(`planned ${planned} tests but ran ${rows.length}`)
    failed++
  }
}

console.log(failed ? `\n${failed} failure(s)` : '\nAll database tests passed')
process.exit(failed ? 1 : 0)
