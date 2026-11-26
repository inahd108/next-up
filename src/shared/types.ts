/** Play statistics for one game on one Steam account. */
export interface AccountStats {
  /** Total minutes played. */
  playtime: number
  /** Minutes played in the last two weeks. */
  playtime2w: number
  /** Unix seconds of the last session, 0 when never played. */
  lastPlayed: number
}

export interface Account {
  /** SteamID64 as a string. */
  steamId: string
  /** 32-bit account id, also the name of the userdata folder. */
  accountId: number
  name: string
  /** nextup:// URL when an avatar image is available. */
  avatarUrl: string | null
  mostRecent: boolean
  gameCount: number
  /** When the full owned-games list was last downloaded, unix ms. */
  ownedListSyncedAt: number | null
  /** True when Steam reported the profile's game list as private. */
  ownedListPrivate: boolean
}

/** Steam Deck compatibility: 0 unknown, 1 unsupported, 2 playable, 3 verified. */
export type DeckCompat = 0 | 1 | 2 | 3

export interface Game {
  appid: number
  name: string
  /** Steam user tags, most relevant first. */
  tags: string[]
  /** Steam store category ids (single-player, co-op, controller support and so on). */
  categories: number[]
  installed: boolean
  sizeOnDisk: number
  /** Play statistics keyed by SteamID64. A game with no keys is installed but not linked to an account. */
  stats: Record<string, AccountStats>
  reviewPercent: number | null
  reviewCount: number | null
  reviewLabel: string | null
  controller: 'full' | 'partial' | null
  deck: DeckCompat
  releaseYear: number | null
  developer: string | null
  description: string | null
  /** True when tags or categories are known for this game. */
  hasMetadata: boolean
}

export interface LibrarySnapshot {
  steamFound: boolean
  steamPath: string | null
  accounts: Account[]
  games: Game[]
  /** Unix ms. */
  builtAt: number
  /** Unix ms of the last completed online sync. */
  lastSyncAt: number | null
  warnings: string[]
}

export type ThemeSetting = 'system' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'

/** Settings as the screens see them. The API key itself never leaves the main process. */
export interface SettingsView {
  onboarded: boolean
  theme: ThemeSetting
  steamPathOverride: string | null
  hasApiKey: boolean
  apiKeyHint: string | null
  excludedAccounts: string[]
  hiddenGames: number[]
  autoSync: boolean
}

export type EditableSettings = Pick<
  SettingsView,
  'onboarded' | 'theme' | 'excludedAccounts' | 'hiddenGames' | 'autoSync'
>

export type SyncPhase = 'starting' | 'profiles' | 'owned' | 'details' | 'done' | 'error'

export interface SyncProgress {
  phase: SyncPhase
  message: string
  done: number
  total: number
}

export interface SyncOutcome {
  ok: boolean
  offline: boolean
  message: string
}

export interface ApiKeyResult {
  ok: boolean
  message: string
  settings: SettingsView
}

export interface AppInfo {
  version: string
  dataPath: string
}
