import type { Game } from '../types'
import type { LibraryEntry } from './library'
import { SETS } from './signals'

/** Earlier tags carry more weight: Steam lists the most-voted tags first. */
export function tagPositionWeight(index: number): number {
  return index < 3 ? 1 : Math.max(0.35, 1 - (index - 2) * 0.07)
}

export interface TasteProfile {
  /** Lower-case tag to a 0–1 weight, 1 being the tag you've spent the most time on. */
  weights: Map<string, number>
  /** The largest raw weight, used to normalise. */
  max: number
  empty: boolean
}

const hoursWeight = (minutes: number): number => (minutes < 30 ? 0 : Math.log1p(minutes / 60))
const genericFactor = (tag: string): number => (SETS.generic.has(tag) ? 0.3 : 1)

/** Learns which tags you like from where your hours have gone. */
export function buildTasteProfile(entries: LibraryEntry[]): TasteProfile {
  const raw = new Map<string, number>()
  for (const { game, stats } of entries) {
    const hours = hoursWeight(stats.playtime)
    if (hours === 0) continue
    game.tags.slice(0, 12).forEach((tag, i) => {
      const key = tag.toLowerCase()
      raw.set(key, (raw.get(key) ?? 0) + hours * tagPositionWeight(i) * genericFactor(key))
    })
  }
  let max = 0
  for (const value of raw.values()) max = Math.max(max, value)
  const weights = new Map<string, number>()
  if (max > 0) for (const [key, value] of raw) weights.set(key, value / max)
  return { weights, max, empty: max === 0 }
}

/**
 * How closely a game's tags match the profile, 0–1 before normalising across candidates.
 * The game's own hours are left out, so a game you've played a lot doesn't vouch for itself.
 */
export function affinity(game: Game, profile: TasteProfile, ownPlaytime = 0): number {
  if (profile.empty || game.tags.length === 0) return 0
  const own = hoursWeight(ownPlaytime)
  let sum = 0
  let norm = 0
  game.tags.slice(0, 12).forEach((tag, i) => {
    const key = tag.toLowerCase()
    const position = tagPositionWeight(i)
    const self = (own * position * genericFactor(key)) / profile.max
    norm += position
    sum += position * Math.max(0, (profile.weights.get(key) ?? 0) - self)
  })
  return norm > 0 ? sum / norm : 0
}

function keyTags(game: Game, count: number): string[] {
  return game.tags
    .map((t) => t.toLowerCase())
    .filter((t) => !SETS.generic.has(t))
    .slice(0, count)
}

/** Minutes spent on other games that share at least three distinctive tags with this one. */
export function similarPlaytime(target: Game, entries: LibraryEntry[]): number {
  const key = new Set(keyTags(target, 8))
  if (key.size < 3) return 0
  let minutes = 0
  for (const { game, stats } of entries) {
    if (game.appid === target.appid || stats.playtime < 30) continue
    let shared = 0
    for (const tag of keyTags(game, 10)) if (key.has(tag)) shared++
    if (shared >= 3) minutes += stats.playtime
  }
  return minutes
}
