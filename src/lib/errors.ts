interface MaybePgError {
  message?: string
  code?: string
  details?: string
  hint?: string
}

const CONSTRAINT_MESSAGES: Record<string, string> = {
  players_name_unique: 'Igralec s tem imenom že obstaja.',
  matches_different_players: 'Igralec ne more igrati sam proti sebi.',
  matches_score_a_range: 'Rezultat mora biti celo število med 0 in 21.',
  matches_score_b_range: 'Rezultat mora biti celo število med 0 in 21.',
  matches_no_tie: 'Rezultat ne sme biti neodločen — en igralec mora zmagati.',
  matches_date_not_future: 'Datum tekme ne sme biti v prihodnosti.',
  matches_player_a_id_fkey: 'Ta igralec ima vnesene tekme.',
  matches_player_b_id_fkey: 'Ta igralec ima vnesene tekme.',
  invites_pkey: 'Ta e-poštni naslov je že povabljen.',
}

/**
 * Messages the database and Supabase Auth send in English, shown to users
 * in Slovenian. Matched by a distinctive part of the original text.
 */
const SERVER_MESSAGES: [RegExp, string][] = [
  [/both players must be active/i, 'Oba igralca morata biti aktivna.'],
  [/at least one active administrator/i, 'Liga mora imeti vsaj enega aktivnega skrbnika.'],
  [/name is already taken/i, 'To ime že uporablja drug igralec.'],
  [/name must be 2/i, 'Ime mora imeti od 2 do 40 znakov.'],
  [/league name|check constraint "app_settings/i, 'Ime lige mora imeti od 1 do 60 znakov.'],
  [/not been invited/i, 'Ta e-poštni naslov ni povabljen v ligo. Za povabilo prosite skrbnika lige.'],
  [/not signed in|jwt expired|invalid jwt/i, 'Niste prijavljeni. Prijavite se znova.'],
  [/user not found/i, 'Uporabnik ne obstaja.'],
  [/invalid login credentials/i, 'Napačen e-poštni naslov ali geslo.'],
  [/email not confirmed/i, 'E-poštni naslov še ni potrjen.'],
  [/different from the old password/i, 'Novo geslo mora biti drugačno od starega.'],
  [/password should|password is too weak|weak password/i, 'Geslo je prešibko. Uporabite vsaj 10 znakov, velike in male črke ter številko.'],
  [/rate limit|too many requests/i, 'Preveč poskusov. Počakajte trenutek in poskusite znova.'],
  [/provider is not enabled|unsupported provider/i, 'Prijava z Googlom še ni nastavljena. Obrnite se na skrbnika lige.'],
  [/function .*admin-users|failed to send a request/i, 'Strežniška funkcija ni na voljo.'],
]

/** Translates a known server message to Slovenian, or returns null. */
export function translateServerMessage(message: string | null | undefined): string | null {
  if (!message) return null
  for (const [pattern, sl] of SERVER_MESSAGES) if (pattern.test(message)) return sl
  return null
}

/** Turns Supabase/Postgres/network errors into a message a non-technical user can act on. */
export function friendlyError(err: unknown): string {
  if (!err) return 'Prišlo je do napake.'
  const e = err as MaybePgError
  const text = `${e.message ?? ''} ${e.details ?? ''}`
  for (const [name, msg] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(name)) return msg
  }
  const translated = translateServerMessage(text)
  if (translated) return translated
  if (e.code === '42501' || /row-level security|permission denied|only administrators/i.test(text)) {
    return 'Za to nimate dovoljenja.'
  }
  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return 'Strežnik ni dosegljiv. Preverite internetno povezavo in poskusite znova.'
  }
  console.error('Unrecognised error', err)
  return 'Prišlo je do napake. Poskusite znova.'
}
