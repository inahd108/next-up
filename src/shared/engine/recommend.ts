import { formatPlaytime, formatRelative } from '../format'
import { CATEGORY, COOP_CATEGORIES, MULTIPLAYER_CATEGORIES, PVP_CATEGORIES } from '../steam-ids'
import type { Game } from '../types'
import type { LibraryEntry } from './library'
import { affinity, buildTasteProfile, similarPlaytime, tagPositionWeight, type TasteProfile } from './profile'
import type { Answers, QuestionId } from './questions'
import { lowerSignal, MOOD_SIGNALS, SETS, TIME_SIGNALS } from './signals'

export type ReasonKind =
  | 'time'
  | 'mood'
  | 'players'
  | 'fresh'
  | 'progress'
  | 'favourite'
  | 'taste'
  | 'installed'
  | 'deck'
  | 'controller'
  | 'reviews'
  | 'nostalgia'

export interface Reason {
  kind: ReasonKind
  text: string
}

export interface Recommendation {
  entry: LibraryEntry
  /** Internal ranking score. */
  score: number
  /** 0–100, shown as "92% match". Follows the ranking. */
  match: number
  reasons: Reason[]
}

export interface RecommendOptions {
  /** Games the person asked never to see. */
  hidden?: ReadonlySet<number>
  /** Games skipped this session with "Not tonight". */
  exclude?: ReadonlySet<number>
  /** Changes the small random factor between runs. */
  seed?: number
  nowSeconds?: number
  limit?: number
  profile?: TasteProfile
}

const TIME = Object.fromEntries(Object.entries(TIME_SIGNALS).map(([k, v]) => [k, lowerSignal(v)]))
const MOOD = Object.fromEntries(Object.entries(MOOD_SIGNALS).map(([k, v]) => [k, lowerSignal(v)]))

const WEIGHTS: Partial<Record<QuestionId, number>> = {
  time: 1,
  mood: 2,
  players: 1.2,
  freshness: 1,
  input: 0.8
}

const TIME_TEXT: Record<string, string> = {
  quick: 'Works well in a short session',
  hour: 'Good for an hour or two',
  evening: 'Fills an evening nicely',
  weeks: 'Plenty of depth to sink into'
}

const MOOD_TEXT: Record<string, string> = {
  relax: 'Relaxed and low-stress',
  think: 'Rewards careful thinking',
  action: 'Fast and intense',
  story: 'Story-driven',
  create: 'Lets you build and create',
  spooky: 'Dark and atmospheric'
}

const PLAYERS_TEXT: Record<string, string> = {
  solo: 'Single-player',
  coop: 'Supports co-op',
  pvp: 'Competitive multiplayer'
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

/** Deterministic 0–1 value per game and seed. */
function seededRandom(appid: number, seed: number): number {
  let h = Math.imul(appid, 2654435761) ^ Math.imul(seed, 1597334677)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function tagSignal(game: Game, set: Set<string>): number {
  let total = 0
  const count = Math.min(game.tags.length, 15)
  for (let i = 0; i < count; i++) {
    if (set.has(game.tags[i].toLowerCase())) total += tagPositionWeight(i)
  }
  return Math.min(1, total / 1.6)
}

/**
 * How well a game's tags fit an answer. `base` is the score for a game with no relevant
 * tags: lower for mood, so a game has to actually match the mood to rank well.
 */
function fitTags(game: Game, signal: { boost: Set<string>; penalize: Set<string> }, base: number): number {
  if (game.tags.length === 0) return base
  const lift = 1.05 - base
  return clamp(base + lift * tagSignal(game, signal.boost) - 0.55 * tagSignal(game, signal.penalize))
}

function hasAnyTag(game: Game, set: Set<string>): boolean {
  return game.tags.some((t) => set.has(t.toLowerCase()))
}

export function fitPlayers(game: Game, answer: string): number {
  const cats = new Set(game.categories)
  const known = cats.size > 0 || game.tags.length > 0
  if (!known) return answer === 'solo' ? 0.5 : 0.3

  // Tags say what a game is mostly about; categories only say a mode exists.
  const coopTags = tagSignal(game, SETS.coop)
  const pvpTags = tagSignal(game, SETS.pvp)
  const coopCategory = COOP_CATEGORIES.some((c) => cats.has(c))
  const pvpCategory = PVP_CATEGORIES.some((c) => cats.has(c))
  const multi =
    coopTags > 0 ||
    pvpTags > 0 ||
    MULTIPLAYER_CATEGORIES.some((c) => cats.has(c)) ||
    game.tags.some((t) => t === 'Multiplayer')
  const singleTag = hasAnyTag(game, SETS.singleplayer)
  const singleCategory = cats.has(CATEGORY.singlePlayer)
  const multiOnly =
    hasAnyTag(game, SETS.multiplayerOnly) || (multi && !singleTag && !singleCategory && cats.size > 0)

  switch (answer) {
    case 'solo':
      if (multiOnly) return 0.05
      if (pvpTags >= 0.5 && !singleTag) return 0.25
      if (singleTag) return 1
      return singleCategory ? 0.85 : 0.4
    case 'coop':
      if (coopTags >= 0.3) return 1
      if (coopCategory) return 0.8
      return multi ? 0.4 : 0.05
    case 'pvp':
      if (pvpTags >= 0.3) return 1
      if (pvpCategory) return 0.75
      return multi ? 0.45 : 0.05
    default:
      return 0.5
  }
}

function fitFreshness(entry: LibraryEntry, answer: string, percentile: number, now: number): number {
  const { playtime, lastPlayed } = entry.stats
  const daysSince = lastPlayed ? (now - lastPlayed) / 86400 : Infinity
  switch (answer) {
    case 'new':
      if (playtime === 0) return 1
      if (playtime < 60) return 0.75
      if (playtime < 180) return 0.3
      return 0.05
    case 'continue': {
      if (playtime < 30) return 0.1
      let score = 0.65
      score += 0.3 * tagSignal(entry.game, SETS.completable)
      score -= 0.45 * tagSignal(entry.game, SETS.endless)
      if (daysSince < 2) score -= 0.15
      if (playtime > 6000) score -= 0.1
      return clamp(score)
    }
    case 'favourite': {
      if (playtime < 120) return 0.05
      let score = 0.35 + 0.65 * percentile
      if (daysSince > 60) score += 0.1
      return clamp(score)
    }
    default:
      return 0.5
  }
}

function fitInput(game: Game, answer: string): number | null {
  const cats = new Set(game.categories)
  if (answer === 'controller') {
    if (game.controller === 'full' || cats.has(CATEGORY.fullController)) return 1
    if (game.controller === 'partial' || cats.has(CATEGORY.partialController)) return 0.65
    return game.hasMetadata ? 0.12 : 0.4
  }
  if (answer === 'deck') {
    return [0.4, 0.02, 0.7, 1][game.deck]
  }
  return null
}

function qualityScore(game: Game): number {
  if (game.reviewPercent === null) return 0.5
  const raw = clamp((game.reviewPercent - 55) / 40)
  const confidence = game.reviewCount === null ? 0.7 : clamp(Math.log10(game.reviewCount + 1) / 3)
  return 0.5 + (raw - 0.5) * confidence
}

/** True when the answers don't narrow anything down. */
export function isSurprise(answers: Answers): boolean {
  return !(['time', 'mood', 'players', 'freshness'] as const).some((k) => answers[k] && answers[k] !== 'any')
}

function reviewText(game: Game): string | null {
  const pct = game.reviewPercent
  if (pct === null || pct < 80) return null
  if (game.reviewCount !== null && game.reviewCount < 100) return null
  const label = game.reviewLabel
    ? game.reviewLabel.charAt(0) + game.reviewLabel.slice(1).toLowerCase()
    : 'Highly rated'
  return `${label} reviews (${pct}%)`
}

function buildReasons(
  entry: LibraryEntry,
  answers: Answers,
  fits: Partial<Record<QuestionId, number>>,
  entries: LibraryEntry[],
  now: number
): Reason[] {
  const { game, stats } = entry
  const out: { reason: Reason; priority: number }[] = []
  const add = (kind: ReasonKind, text: string, priority: number): void => {
    out.push({ reason: { kind, text }, priority })
  }
  const daysSince = stats.lastPlayed ? (now - stats.lastPlayed) / 86400 : Infinity

  if (answers.mood && (fits.mood ?? 0) >= 0.72) add('mood', MOOD_TEXT[answers.mood], 90)
  if (answers.players && (fits.players ?? 0) >= 0.9 && PLAYERS_TEXT[answers.players]) {
    add('players', PLAYERS_TEXT[answers.players], 85)
  }
  if (answers.time && (fits.time ?? 0) >= 0.72) add('time', TIME_TEXT[answers.time], 80)

  if (answers.freshness === 'new') {
    if (stats.playtime === 0) add('fresh', 'Unplayed, waiting in your backlog', 76)
    else if (stats.playtime < 60) add('fresh', `Only ${formatPlaytime(stats.playtime)} played so far`, 70)
  } else if (answers.freshness === 'continue' && stats.playtime >= 30) {
    add('progress', `${formatPlaytime(stats.playtime)} in, last played ${formatRelative(stats.lastPlayed, now * 1000)}`, 78)
  } else if (answers.freshness === 'favourite' && stats.playtime >= 120) {
    add('favourite', `One of your most played, at ${formatPlaytime(stats.playtime)}`, 78)
  } else if (stats.playtime >= 600 && daysSince > 180) {
    add('nostalgia', `You haven't played it since ${formatRelative(stats.lastPlayed, now * 1000)}`, 45)
  } else if (stats.playtime === 0) {
    add('fresh', 'Still unplayed in your library', 35)
  }

  const similar = similarPlaytime(game, entries)
  if (similar >= 300) add('taste', `You've played ${Math.round(similar / 60).toLocaleString('en')} h of similar games`, 72)

  if (game.installed) add('installed', 'Installed and ready to play', answers.ready === 'installed' ? 60 : 50)
  if (answers.input === 'deck' && game.deck === 3) add('deck', 'Steam Deck verified', 66)
  if (answers.input === 'deck' && game.deck === 2) add('deck', 'Playable on Steam Deck', 56)
  if (answers.input === 'controller' && (fits.input ?? 0) >= 1) add('controller', 'Full controller support', 64)

  const reviews = reviewText(game)
  if (reviews) add('reviews', reviews, 40 + ((game.reviewPercent ?? 80) - 80))

  out.sort((a, b) => b.priority - a.priority)
  const reasons = out.slice(0, 4).map((r) => r.reason)
  return reasons.length > 0 ? reasons : [{ kind: 'taste', text: 'A good all-round fit for your library' }]
}

/** Ranks the library against the answers and returns the best picks with their reasons. */
export function recommend(entries: LibraryEntry[], answers: Answers, options: RecommendOptions = {}): Recommendation[] {
  const hidden = options.hidden ?? new Set<number>()
  const exclude = options.exclude ?? new Set<number>()
  const seed = options.seed ?? 1
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const limit = options.limit ?? 4
  const profile = options.profile ?? buildTasteProfile(entries)
  const surprise = isSurprise(answers)

  const candidates = entries.filter(
    (e) =>
      !hidden.has(e.game.appid) &&
      !exclude.has(e.game.appid) &&
      (answers.ready !== 'installed' || e.game.installed)
  )
  if (candidates.length === 0) return []

  const playedTimes = entries
    .map((e) => e.stats.playtime)
    .filter((p) => p >= 120)
    .sort((a, b) => a - b)
  const percentileOf = (playtime: number): number => {
    if (playedTimes.length === 0) return 0
    let below = 0
    while (below < playedTimes.length && playedTimes[below] <= playtime) below++
    return below / playedTimes.length
  }

  // For favourites and unfinished games, a game's own hours are the point, so they count.
  const countOwnHours = answers.freshness === 'favourite' || answers.freshness === 'continue'
  const affinities = candidates.map((e) => affinity(e.game, profile, countOwnHours ? 0 : e.stats.playtime))
  const maxAffinity = Math.max(0, ...affinities)

  // VR-only games need a headset. Only suggest them if the playtime shows one gets used.
  const isVrOnly = (game: Game): boolean => game.categories.includes(CATEGORY.vrOnly)
  const usesVr = entries.some((e) => isVrOnly(e.game) && e.stats.playtime >= 60)

  const scored = candidates.map((entry, index) => {
    const { game, stats } = entry
    const fits: Partial<Record<QuestionId, number>> = {}
    if (answers.time && TIME[answers.time]) fits.time = fitTags(game, TIME[answers.time], 0.45)
    if (answers.mood && MOOD[answers.mood]) fits.mood = fitTags(game, MOOD[answers.mood], 0.3)
    if (answers.players && answers.players !== 'any') fits.players = fitPlayers(game, answers.players)
    if (answers.freshness && answers.freshness !== 'any') {
      fits.freshness = fitFreshness(entry, answers.freshness, percentileOf(stats.playtime), now)
    }
    if (answers.input) {
      const input = fitInput(game, answers.input)
      if (input !== null) fits.input = input
    }

    let weighted = 0
    let weightSum = 0
    for (const [key, fit] of Object.entries(fits) as [QuestionId, number][]) {
      const weight = WEIGHTS[key] ?? 1
      weighted += fit * weight
      weightSum += weight
    }
    const answerMatch = weightSum > 0 ? weighted / weightSum : 0.5
    const taste = profile.empty ? 0.5 : maxAffinity > 0 ? affinities[index] / maxAffinity : 0
    const quality = qualityScore(game)
    const random = seededRandom(game.appid, seed)

    let score = surprise
      ? 0.45 * taste + 0.3 * quality + 0.25 * random + (weightSum > 0 ? 0.15 * (answerMatch - 0.5) : 0)
      : 0.56 * answerMatch + 0.22 * taste + 0.12 * quality + 0.06 * random

    // Mood is the main question: a game that doesn't fit it shouldn't win on taste alone.
    if (fits.mood !== undefined) score *= 0.5 + 0.5 * fits.mood

    const daysSince = stats.lastPlayed ? (now - stats.lastPlayed) / 86400 : Infinity
    if (game.installed && answers.ready !== 'installed') score += 0.04
    if (daysSince < 2 && answers.freshness !== 'continue' && answers.freshness !== 'favourite') score -= 0.05
    if ((fits.players ?? 1) <= 0.05) score *= 0.35
    if ((fits.input ?? 1) <= 0.02) score *= 0.3
    if (stats.playtime > 0 && stats.playtime < 60 && daysSince > 30 && answers.freshness !== 'new') score *= 0.85
    if (!game.hasMetadata) score *= 0.85
    if (!usesVr && isVrOnly(game)) score *= 0.15

    return { entry, score, fits }
  })

  scored.sort((a, b) => b.score - a.score || a.entry.game.name.localeCompare(b.entry.game.name))

  return scored.slice(0, limit).map(({ entry, score, fits }) => ({
    entry,
    score,
    match: Math.round(clamp((score - 0.05) / 0.85, 0, 0.99) * 100),
    reasons: buildReasons(entry, answers, fits, entries, now)
  }))
}
