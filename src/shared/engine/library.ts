import type { Account, AccountStats, Game } from '../types'

/** A game together with its play stats summed over the accounts in use. */
export interface LibraryEntry {
  game: Game
  stats: AccountStats
}

export function activeAccountIds(accounts: Account[], excluded: string[]): Set<string> {
  const skip = new Set(excluded)
  return new Set(accounts.map((a) => a.steamId).filter((id) => !skip.has(id)))
}

/** Games owned by at least one active account, plus installed games not tied to any account. */
export function buildEntries(games: Game[], active: ReadonlySet<string>): LibraryEntry[] {
  const out: LibraryEntry[] = []
  for (const game of games) {
    const owners = Object.keys(game.stats)
    if (owners.length > 0 && !owners.some((id) => active.has(id))) continue
    let playtime = 0
    let playtime2w = 0
    let lastPlayed = 0
    for (const [id, stats] of Object.entries(game.stats)) {
      if (!active.has(id)) continue
      playtime += stats.playtime
      playtime2w += stats.playtime2w
      lastPlayed = Math.max(lastPlayed, stats.lastPlayed)
    }
    out.push({ game, stats: { playtime, playtime2w, lastPlayed } })
  }
  return out
}

export interface LibraryStats {
  total: number
  played: number
  unplayed: number
  installed: number
  minutes: number
}

export function libraryStats(entries: LibraryEntry[]): LibraryStats {
  let played = 0
  let installed = 0
  let minutes = 0
  for (const { game, stats } of entries) {
    if (stats.playtime > 0) played++
    if (game.installed) installed++
    minutes += stats.playtime
  }
  return { total: entries.length, played, unplayed: entries.length - played, installed, minutes }
}
