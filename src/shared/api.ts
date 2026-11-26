import type {
  ApiKeyResult,
  AppInfo,
  EditableSettings,
  LibrarySnapshot,
  ResolvedTheme,
  SettingsView,
  SyncOutcome,
  SyncProgress
} from './types'

/** IPC channel names shared by the main process and the preload bridge. */
export const IPC = {
  getSnapshot: 'library:get',
  rescan: 'library:rescan',
  sync: 'library:sync',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  setApiKey: 'apikey:set',
  clearApiKey: 'apikey:clear',
  chooseSteamFolder: 'steam:choose-folder',
  resetSteamFolder: 'steam:reset-folder',
  launchGame: 'game:launch',
  installGame: 'game:install',
  openStorePage: 'game:store',
  openLink: 'link:open',
  clearDownloads: 'data:clear',
  appInfo: 'app:info',
  setTheme: 'window:theme',
  snapshotUpdated: 'event:snapshot',
  syncProgress: 'event:sync-progress'
} as const

export type ExternalLink = 'apikey' | 'privacy'

/** The bridge the preload script exposes as window.api. */
export interface NextUpApi {
  getSnapshot(): Promise<LibrarySnapshot>
  rescan(): Promise<LibrarySnapshot>
  sync(): Promise<SyncOutcome>
  getSettings(): Promise<SettingsView>
  updateSettings(patch: Partial<EditableSettings>): Promise<SettingsView>
  setApiKey(key: string): Promise<ApiKeyResult>
  clearApiKey(): Promise<SettingsView>
  /** Null when the person closes the folder picker. */
  chooseSteamFolder(): Promise<{ ok: boolean; message: string; settings: SettingsView } | null>
  resetSteamFolder(): Promise<SettingsView>
  launchGame(appid: number): Promise<void>
  installGame(appid: number): Promise<void>
  openStorePage(appid: number): Promise<void>
  openLink(link: ExternalLink): Promise<void>
  clearDownloads(): Promise<void>
  appInfo(): Promise<AppInfo>
  setTheme(theme: ResolvedTheme): Promise<void>
  onSnapshot(callback: (snapshot: LibrarySnapshot) => void): () => void
  onSyncProgress(callback: (progress: SyncProgress) => void): () => void
}
