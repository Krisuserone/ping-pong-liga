export const MAX_SCORE = 99

export interface MatchFormInput {
  playerAId: string
  playerBId: string
  scoreA: string
  scoreB: string
  matchDate: string
}

export interface ValidMatch {
  player_a_id: string
  player_b_id: string
  player_a_score: number
  player_b_score: number
  match_date: string
}

export type MatchErrors = Partial<Record<'playerA' | 'playerB' | 'scoreA' | 'scoreB' | 'matchDate' | 'form', string>>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseScore(raw: string): number | string {
  const value = raw.trim()
  if (value === '') return 'Vnesite rezultat.'
  if (!/^\d+$/.test(value)) return 'Rezultat mora biti celo število.'
  const n = Number(value)
  if (n > MAX_SCORE) return `Rezultat ne sme biti višji od ${MAX_SCORE}.`
  return n
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * Validates a match entry. `today` is the local date (YYYY-MM-DD) used to
 * reject matches dated in the future.
 */
export function validateMatch(input: MatchFormInput, today: string): { errors: MatchErrors; value?: ValidMatch } {
  const errors: MatchErrors = {}

  if (!input.playerAId) errors.playerA = 'Izberite igralca A.'
  if (!input.playerBId) errors.playerB = 'Izberite igralca B.'
  if (input.playerAId && input.playerAId === input.playerBId) {
    errors.playerB = 'Igralec ne more igrati sam proti sebi.'
  }

  const a = parseScore(input.scoreA)
  const b = parseScore(input.scoreB)
  if (typeof a === 'string') errors.scoreA = a
  if (typeof b === 'string') errors.scoreB = b
  if (typeof a === 'number' && typeof b === 'number' && a === b) {
    errors.form = 'Rezultat ne sme biti neodločen — en igralec mora zmagati.'
  }

  if (!isValidIsoDate(input.matchDate)) errors.matchDate = 'Izberite veljaven datum.'
  else if (input.matchDate > today) errors.matchDate = 'Datum tekme ne sme biti v prihodnosti.'

  if (Object.keys(errors).length > 0) return { errors }
  return {
    errors,
    value: {
      player_a_id: input.playerAId,
      player_b_id: input.playerBId,
      player_a_score: a as number,
      player_b_score: b as number,
      match_date: input.matchDate,
    },
  }
}

/** Normalises a player name the same way the database does. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validatePlayerName(name: string, existing: { id: string; name: string }[], selfId?: string): string | null {
  const n = normalizeName(name)
  if (!n) return 'Vnesite ime.'
  if (n.length > 60) return 'Ime je lahko dolgo največ 60 znakov.'
  const clash = existing.find((p) => p.id !== selfId && p.name.toLowerCase() === n.toLowerCase())
  if (clash) return `Igralec z imenom »${clash.name}« že obstaja.`
  return null
}
