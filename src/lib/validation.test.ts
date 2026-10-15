import { describe, expect, it } from 'vitest'
import { validateMatch, validatePlayerName, type MatchFormInput } from './validation'

const TODAY = '2026-10-15'
const base: MatchFormInput = { playerAId: 'a', playerBId: 'b', scoreA: '21', scoreB: '15', matchDate: TODAY }

describe('validateMatch', () => {
  it('accepts a valid match and returns typed values', () => {
    const { errors, value } = validateMatch(base, TODAY)
    expect(errors).toEqual({})
    expect(value).toEqual({ player_a_id: 'a', player_b_id: 'b', player_a_score: 21, player_b_score: 15, match_date: TODAY })
  })

  it('accepts boundary scores 0 and 21', () => {
    expect(validateMatch({ ...base, scoreA: '0', scoreB: '21' }, TODAY).value).toBeDefined()
  })

  it.each([
    ['22', 'Rezultat ne sme biti višji od 21.'],
    ['-1', 'Rezultat mora biti celo število.'],
    ['10.5', 'Rezultat mora biti celo število.'],
    ['abc', 'Rezultat mora biti celo število.'],
    ['', 'Vnesite rezultat.'],
  ])('rejects score %j', (score, message) => {
    const { errors, value } = validateMatch({ ...base, scoreA: score }, TODAY)
    expect(value).toBeUndefined()
    expect(errors.scoreA).toBe(message)
  })

  it('rejects ties', () => {
    const { errors, value } = validateMatch({ ...base, scoreA: '21', scoreB: '21' }, TODAY)
    expect(value).toBeUndefined()
    expect(errors.form).toMatch(/neodločen/)
  })

  it('rejects a player playing themselves', () => {
    const { errors } = validateMatch({ ...base, playerBId: 'a' }, TODAY)
    expect(errors.playerB).toMatch(/sam proti sebi/)
  })

  it('requires both players', () => {
    const { errors } = validateMatch({ ...base, playerAId: '', playerBId: '' }, TODAY)
    expect(errors.playerA).toBeDefined()
    expect(errors.playerB).toBeDefined()
  })

  it('rejects future and invalid dates', () => {
    expect(validateMatch({ ...base, matchDate: '2026-10-16' }, TODAY).errors.matchDate).toMatch(/prihodnosti/)
    expect(validateMatch({ ...base, matchDate: '2026-02-30' }, TODAY).errors.matchDate).toMatch(/veljaven/)
    expect(validateMatch({ ...base, matchDate: '' }, TODAY).errors.matchDate).toBeDefined()
  })
})

describe('validatePlayerName', () => {
  const existing = [{ id: '1', name: 'Anna Berg' }]
  it('rejects case/space-insensitive duplicates', () => {
    expect(validatePlayerName('  anna   berg ', existing)).toMatch(/že obstaja/)
  })
  it('allows keeping your own name when editing', () => {
    expect(validatePlayerName('Anna Berg', existing, '1')).toBeNull()
  })
  it('rejects empty names', () => {
    expect(validatePlayerName('   ', existing)).toBe('Vnesite ime.')
  })
})
