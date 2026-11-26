import { describe, expect, it } from 'vitest'
import tagNames from '../src/shared/data/steam-tags.json'
import { buildEntries, libraryStats, type LibraryEntry } from '../src/shared/engine/library'
import { buildTasteProfile, similarPlaytime } from '../src/shared/engine/profile'
import { QUESTIONS } from '../src/shared/engine/questions'
import { fitPlayers, isSurprise, recommend } from '../src/shared/engine/recommend'
import { allSignalTags } from '../src/shared/engine/signals'
import type { AccountStats, Game } from '../src/shared/types'

const NOW = 1_800_000_000
const DAY = 86400
const ME = '76561197960287930'

function stats(playtime = 0, daysAgo: number | null = null): AccountStats {
  return { playtime, playtime2w: 0, lastPlayed: daysAgo === null ? 0 : NOW - daysAgo * DAY }
}

function game(appid: number, name: string, tags: string[], extra: Partial<Game> = {}): Game {
  return {
    appid,
    name,
    tags,
    categories: [2],
    installed: false,
    sizeOnDisk: 0,
    stats: { [ME]: stats() },
    reviewPercent: 88,
    reviewCount: 5000,
    reviewLabel: 'Very Positive',
    controller: null,
    deck: 0,
    releaseYear: 2020,
    developer: null,
    description: null,
    hasMetadata: true,
    ...extra
  }
}

const library: Game[] = [
  game(1, 'Farm Days', ['Farming Sim', 'Relaxing', 'Cozy', 'Life Sim', 'Pixel Graphics'], {
    stats: { [ME]: stats(4200, 3) }
  }),
  game(2, 'Night Halls', ['Horror', 'Psychological Horror', 'Atmospheric', 'Story Rich', 'First-Person']),
  game(3, 'Deck Climb', ['Roguelike Deckbuilder', 'Card Game', 'Strategy', 'Roguelike', 'Turn-Based'], {
    installed: true,
    controller: 'full',
    deck: 3,
    stats: { [ME]: stats(900, 200) }
  }),
  game(4, 'Squad Up', ['Co-op', 'Online Co-Op', 'Shooter', 'Action', 'FPS'], {
    categories: [1, 9, 38],
    deck: 1
  }),
  game(5, 'Arena Kings', ['PvP', 'Competitive', 'MOBA', 'Strategy'], { categories: [1, 36, 49] }),
  game(6, 'Long Road', ['Open World', 'RPG', 'Story Rich', 'Exploration', 'Fantasy'], {
    stats: { [ME]: stats(300, 90) }
  }),
  game(7, 'Tiny Puzzles', ['Puzzle', 'Casual', 'Relaxing', 'Short', 'Logic'], { installed: true })
]

const entries = buildEntries(library, new Set([ME]))
const top = (answers: Parameters<typeof recommend>[1], extra = {}) =>
  recommend(entries, answers, { nowSeconds: NOW, seed: 7, ...extra })

describe('signal tags', () => {
  it('only uses tag names that exist on Steam', () => {
    const known = new Set(Object.values(tagNames as Record<string, string>).map((t) => t.toLowerCase()))
    const unknown = allSignalTags().filter((t) => !known.has(t.toLowerCase()))
    expect(unknown).toEqual([])
  })

  it('gives every question at least two options', () => {
    for (const q of QUESTIONS) expect(q.options.length).toBeGreaterThanOrEqual(2)
  })
})

describe('recommend', () => {
  it('follows the mood', () => {
    expect(top({ mood: 'relax' })[0].entry.game.name).not.toBe('Night Halls')
    expect(top({ mood: 'spooky' })[0].entry.game.name).toBe('Night Halls')
    expect(['Deck Climb', 'Tiny Puzzles']).toContain(top({ mood: 'think' })[0].entry.game.name)
  })

  it('respects installed only', () => {
    const picks = top({ ready: 'installed' })
    expect(picks.map((p) => p.entry.game.appid).sort()).toEqual([3, 7])
  })

  it('finds co-op and competitive games when asked', () => {
    expect(top({ players: 'coop' })[0].entry.game.name).toBe('Squad Up')
    expect(top({ players: 'pvp' })[0].entry.game.name).toBe('Arena Kings')
  })

  it('prefers unplayed games for something new and big hitters for favourites', () => {
    const fresh = top({ freshness: 'new' })[0]
    expect(fresh.entry.stats.playtime).toBe(0)
    expect(top({ freshness: 'favourite' })[0].entry.game.name).toBe('Farm Days')
  })

  it('pushes unsupported games down for Steam Deck', () => {
    const picks = top({ players: 'coop', input: 'deck' }, { limit: 7 })
    const squad = picks.find((p) => p.entry.game.name === 'Squad Up')
    expect(picks[0].entry.game.name).not.toBe('Squad Up')
    expect(squad?.match ?? 0).toBeLessThan(picks[0].match)
  })

  it('never returns hidden or skipped games', () => {
    const picks = top({}, { hidden: new Set([1, 2]), exclude: new Set([3]), limit: 10 })
    const ids = picks.map((p) => p.entry.game.appid)
    expect(ids).not.toContain(1)
    expect(ids).not.toContain(2)
    expect(ids).not.toContain(3)
  })

  it('keeps the match percentage in ranking order', () => {
    const picks = top({ mood: 'story', time: 'evening' }, { limit: 7 })
    for (let i = 1; i < picks.length; i++) expect(picks[i].match).toBeLessThanOrEqual(picks[i - 1].match)
    for (const p of picks) {
      expect(p.match).toBeGreaterThanOrEqual(0)
      expect(p.match).toBeLessThanOrEqual(99)
    }
  })

  it('explains every pick', () => {
    for (const pick of top({ mood: 'relax', time: 'quick', players: 'solo' })) {
      expect(pick.reasons.length).toBeGreaterThan(0)
      expect(pick.reasons.length).toBeLessThanOrEqual(4)
    }
  })

  it('is repeatable for a seed and varies between seeds in surprise mode', () => {
    const run = (seed: number) => top({}, { seed, limit: 7 }).map((p) => p.entry.game.appid)
    expect(run(3)).toEqual(run(3))
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => run(s).join(',')))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('keeps VR-only games out of the way unless VR gets played', () => {
    const vr = game(50, 'Headset Hero', ['VR', 'Puzzle', 'Strategy', 'Logic'], { categories: [2, 54], installed: true })
    const withVr = buildEntries([...library, vr], new Set([ME]))
    const picks = recommend(withVr, { mood: 'think' }, { nowSeconds: NOW, seed: 7, limit: 8 })
    expect(picks[0].entry.game.name).not.toBe('Headset Hero')

    const played = { ...vr, stats: { [ME]: stats(600, 20) } }
    const otherVr = game(51, 'Headset Hero 2', ['VR', 'Puzzle', 'Strategy', 'Logic', 'Turn-Based Strategy'], {
      categories: [2, 54],
      installed: true
    })
    const vrUser = buildEntries([...library, played, otherVr], new Set([ME]))
    const vrPicks = recommend(vrUser, { mood: 'think', freshness: 'new' }, { nowSeconds: NOW, seed: 7 })
    expect(vrPicks[0].entry.game.name).toBe('Headset Hero 2')
  })

  it('returns nothing rather than failing on an empty library', () => {
    expect(recommend([], { mood: 'relax' })).toEqual([])
  })
})

describe('library helpers', () => {
  it('sums stats only for active accounts and keeps unlinked installed games', () => {
    const other = '76561197960287931'
    const games = [
      game(10, 'Shared', ['Puzzle'], { stats: { [ME]: stats(60, 1), [other]: stats(120, 5) } }),
      game(11, 'Theirs', ['Puzzle'], { stats: { [other]: stats(30, 2) } }),
      game(12, 'Unlinked', ['Puzzle'], { stats: {}, installed: true })
    ]
    const mine = buildEntries(games, new Set([ME]))
    expect(mine.map((e) => e.game.appid)).toEqual([10, 12])
    expect(mine[0].stats.playtime).toBe(60)

    const both: LibraryEntry[] = buildEntries(games, new Set([ME, other]))
    expect(both[0].stats.playtime).toBe(180)
    expect(both[0].stats.lastPlayed).toBe(NOW - DAY)
    expect(libraryStats(both)).toEqual({ total: 3, played: 2, unplayed: 1, installed: 1, minutes: 210 })
  })

  it('learns taste from playtime', () => {
    const profile = buildTasteProfile(entries)
    expect(profile.empty).toBe(false)
    expect(profile.weights.get('farming sim')).toBe(1)
  })

  it('finds hours spent on similar games', () => {
    const lib = buildEntries(
      [
        game(20, 'A', ['Roguelike Deckbuilder', 'Card Game', 'Turn-Based', 'Roguelike']),
        game(21, 'B', ['Card Game', 'Roguelike Deckbuilder', 'Roguelike', 'Strategy'], {
          stats: { [ME]: stats(600, 10) }
        })
      ],
      new Set([ME])
    )
    expect(similarPlaytime(lib[0].game, lib)).toBe(600)
  })

  it('reads player categories', () => {
    expect(fitPlayers(library[3], 'coop')).toBe(1)
    expect(fitPlayers(library[4], 'solo')).toBe(0.05)
    expect(isSurprise({ ready: 'installed' })).toBe(true)
    expect(isSurprise({ mood: 'relax' })).toBe(false)
  })
})
