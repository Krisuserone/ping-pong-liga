/**
 * Slovenian plural forms: ednina (1), dvojina (2), množina (3–4) and
 * rodilnik množine (0, 5+). Like Slovenian grammar, uses the last two digits:
 * 101 → ednina, 102 → dvojina, 103/104 → množina, 111–114 → rodilnik.
 */
export function plural(n: number, one: string, two: string, few: string, many: string): string {
  const h = Math.abs(n) % 100
  if (h === 1) return one
  if (h === 2) return two
  if (h === 3 || h === 4) return few
  return many
}

/** "1 tekma", "2 tekmi", "3 tekme", "5 tekem" … */
export const games = (n: number) => `${n} ${plural(n, 'tekma', 'tekmi', 'tekme', 'tekem')}`
export const wins = (n: number) => `${n} ${plural(n, 'zmaga', 'zmagi', 'zmage', 'zmag')}`
export const losses = (n: number) => `${n} ${plural(n, 'poraz', 'poraza', 'porazi', 'porazov')}`
export const points = (n: number) => `${n} ${plural(n, 'točka', 'točki', 'točke', 'točk')}`
export const activePlayers = (n: number) => `${n} ${plural(n, 'aktiven igralec', 'aktivna igralca', 'aktivni igralci', 'aktivnih igralcev')}`
export const inactivePlayers = (n: number) => `${n} ${plural(n, 'neaktiven', 'neaktivna', 'neaktivni', 'neaktivnih')}`
export const olderGames = (n: number) => `${n} ${plural(n, 'starejša', 'starejši', 'starejše', 'starejših')}`
export const matchingGames = (n: number) => `${n} ${plural(n, 'najdena tekma', 'najdeni tekmi', 'najdene tekme', 'najdenih tekem')}`
export const waitingInvites = (n: number) => `${n} ${plural(n, 'povabilo čaka', 'povabili čakata', 'povabila čakajo', 'povabil čaka')} na prvo prijavo.`
