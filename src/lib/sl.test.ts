import { describe, expect, it } from 'vitest'
import { games, losses, plural, wins } from './sl'

describe('Slovenian plurals', () => {
  it('uses ednina, dvojina, množina and rodilnik', () => {
    expect([0, 1, 2, 3, 4, 5, 11].map(games)).toEqual(['0 tekem', '1 tekma', '2 tekmi', '3 tekme', '4 tekme', '5 tekem', '11 tekem'])
    expect([1, 2, 3, 5].map(wins)).toEqual(['1 zmaga', '2 zmagi', '3 zmage', '5 zmag'])
    expect([1, 2, 4, 7].map(losses)).toEqual(['1 poraz', '2 poraza', '4 porazi', '7 porazov'])
  })

  it('follows the last two digits, like Slovenian grammar', () => {
    const f = (n: number) => plural(n, 'one', 'two', 'few', 'many')
    expect([101, 102, 103, 105, 111, 112, 114, 121].map(f)).toEqual(['one', 'two', 'few', 'many', 'many', 'many', 'many', 'many'])
  })

  it('handles negative numbers (point difference)', () => {
    expect(plural(-2, 'one', 'two', 'few', 'many')).toBe('two')
  })
})
