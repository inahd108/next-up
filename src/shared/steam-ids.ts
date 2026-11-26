/** Steam store category ids used by the recommendation logic. */
export const CATEGORY = {
  multiPlayer: 1,
  singlePlayer: 2,
  coop: 9,
  partialController: 18,
  mmo: 20,
  sharedSplitScreen: 24,
  crossPlatformMulti: 27,
  fullController: 28,
  onlinePvp: 36,
  sharedSplitScreenPvp: 37,
  onlineCoop: 38,
  sharedSplitScreenCoop: 39,
  remotePlayTogether: 44,
  lanPvp: 47,
  lanCoop: 48,
  pvp: 49,
  vrOnly: 54
} as const

export const COOP_CATEGORIES: readonly number[] = [
  CATEGORY.coop,
  CATEGORY.onlineCoop,
  CATEGORY.sharedSplitScreenCoop,
  CATEGORY.lanCoop
]

export const PVP_CATEGORIES: readonly number[] = [
  CATEGORY.onlinePvp,
  CATEGORY.sharedSplitScreenPvp,
  CATEGORY.lanPvp,
  CATEGORY.pvp
]

export const MULTIPLAYER_CATEGORIES: readonly number[] = [
  CATEGORY.multiPlayer,
  CATEGORY.mmo,
  CATEGORY.sharedSplitScreen,
  CATEGORY.crossPlatformMulti,
  ...COOP_CATEGORIES,
  ...PVP_CATEGORIES
]

/** Steam genre ids, used when a game has genres but no user tags. */
export const GENRE_NAMES: Record<number, string> = {
  1: 'Action',
  2: 'Strategy',
  3: 'RPG',
  4: 'Casual',
  9: 'Racing',
  18: 'Sports',
  23: 'Indie',
  25: 'Adventure',
  28: 'Simulation',
  29: 'Massively Multiplayer',
  37: 'Free to Play',
  70: 'Early Access'
}

/** Steam store app type for games in the store browse API. */
export const STORE_TYPE_GAME = 0
