import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, shell } from 'electron'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import icon from '../../build/icon.png?asset'
import { IPC, type ExternalLink } from '../shared/api'
import type { EditableSettings, LibrarySnapshot, ResolvedTheme } from '../shared/types'
import { createArtHandler, registerScheme, SCHEME } from './art-protocol'
import { CacheStore } from './data/cache'
import { SettingsStore } from './data/settings'
import { getPlayerSummaries } from './online/web-api'
import { HttpError } from './online/http'
import { buildSnapshot, candidateAppIds, emptyLocalData, readLocalData, type LocalData } from './snapshot'
import { LocalArtIndex } from './steam/artwork'
import { isSteamFolder, locateSteam } from './steam/locate'
import { SyncService } from './sync'

registerScheme()

// Lets tests run against a separate data folder without touching the real one.
if (process.env.NEXTUP_USER_DATA) app.setPath('userData', process.env.NEXTUP_USER_DATA)

const THEME_COLORS: Record<ResolvedTheme, { background: string; symbols: string }> = {
  dark: { background: '#0b0d12', symbols: '#a1a8b8' },
  light: { background: '#f4f5f8', symbols: '#4d5567' }
}

const LINKS: Record<ExternalLink, string> = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings'
}

const AUTO_SYNC_AFTER = 6 * 60 * 60 * 1000

let win: BrowserWindow | null = null
let local: LocalData = emptyLocalData()
let artIndex = new LocalArtIndex(null)
let snapshot: LibrarySnapshot | null = null
let ready: Promise<void> = Promise.resolve()

const userData = app.getPath('userData')
const artDir = join(userData, 'artwork')
const avatarDir = join(userData, 'avatars')
const settings = new SettingsStore(userData)
const cache = new CacheStore(userData)

const sync = new SyncService({
  cache,
  settings,
  avatarDir,
  getAccounts: () => local.accounts,
  getCandidateIds: () => candidateAppIds(local, cache.data),
  onProgress: (progress) => win?.webContents.send(IPC.syncProgress, progress)
})

function rebuild(notify: boolean): LibrarySnapshot {
  snapshot = buildSnapshot(local, cache.data)
  if (notify) win?.webContents.send(IPC.snapshotUpdated, snapshot)
  return snapshot
}

async function loadLocal(notify: boolean): Promise<LibrarySnapshot> {
  const steamPath = await locateSteam(settings.raw.steamPathOverride)
  local = await readLocalData(steamPath)
  artIndex = new LocalArtIndex(steamPath)
  return rebuild(notify)
}

async function runSync(): Promise<Awaited<ReturnType<SyncService['run']>>> {
  const outcome = await sync.run()
  rebuild(true)
  return outcome
}

/** Syncs in the background when online and something is missing or out of date. */
function maybeAutoSync(): void {
  if (!settings.raw.autoSync || !net.isOnline() || sync.isRunning) return
  const last = cache.data.lastSyncAt ?? 0
  if (Date.now() - last > AUTO_SYNC_AFTER || sync.staleIds().length > 0) void runSync()
}

function resolvedTheme(): ResolvedTheme {
  const theme = settings.raw.theme
  if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return theme
}

function createWindow(): void {
  const colors = THEME_COLORS[resolvedTheme()]
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    title: 'Next up',
    icon,
    backgroundColor: colors.background,
    titleBarStyle: 'hidden',
    titleBarOverlay:
      process.platform === 'darwin' ? false : { color: colors.background, symbolColor: colors.symbols, height: 44 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // Keep screen transitions finishing even when the window is behind others.
      backgroundThrottling: false
    }
  })

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!win || new URL(url).origin !== new URL(win.webContents.getURL()).origin) event.preventDefault()
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function validAppId(value: unknown): number {
  const appid = Number(value)
  if (!Number.isInteger(appid) || appid <= 0) throw new Error('Invalid app id')
  return appid
}

function registerIpc(): void {
  ipcMain.handle(IPC.getSnapshot, async () => {
    await ready
    return snapshot ?? rebuild(false)
  })

  ipcMain.handle(IPC.rescan, async () => {
    ready = loadLocal(false).then(() => undefined)
    await ready
    maybeAutoSync()
    return snapshot
  })

  ipcMain.handle(IPC.sync, () => runSync())

  ipcMain.handle(IPC.getSettings, () => settings.view)

  ipcMain.handle(IPC.updateSettings, (_event, patch: Partial<EditableSettings>) => settings.update(patch ?? {}))

  ipcMain.handle(IPC.setApiKey, async (_event, raw: unknown) => {
    const key = String(raw ?? '').trim()
    if (!/^[0-9A-F]{32}$/i.test(key)) {
      return { ok: false, message: 'That doesn’t look like a Steam API key. It should be 32 letters and numbers.', settings: settings.view }
    }
    if (net.isOnline()) {
      try {
        await getPlayerSummaries(key, local.accounts.slice(0, 1).map((a) => a.steamId))
      } catch (error) {
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          return { ok: false, message: 'Steam rejected that key. Check you copied all of it.', settings: settings.view }
        }
      }
    }
    await settings.setApiKey(key)
    void runSync()
    const message = net.isOnline()
      ? 'Key saved. Downloading your full game lists now.'
      : 'Key saved. Your game lists will download next time you’re online.'
    return { ok: true, message, settings: settings.view }
  })

  ipcMain.handle(IPC.clearApiKey, async () => {
    await settings.setApiKey(null)
    return settings.view
  })

  ipcMain.handle(IPC.chooseSteamFolder, async () => {
    const options = { title: 'Choose your Steam folder', properties: ['openDirectory' as const] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return null
    if (!(await isSteamFolder(folder))) {
      return { ok: false, message: 'That folder doesn’t look like a Steam install. Choose the folder that contains steamapps.', settings: settings.view }
    }
    await settings.setSteamPath(folder)
    ready = loadLocal(true).then(() => undefined)
    await ready
    maybeAutoSync()
    return { ok: true, message: 'Steam folder updated.', settings: settings.view }
  })

  ipcMain.handle(IPC.resetSteamFolder, async () => {
    await settings.setSteamPath(null)
    ready = loadLocal(true).then(() => undefined)
    await ready
    return settings.view
  })

  ipcMain.handle(IPC.launchGame, (_event, appid: unknown) => shell.openExternal(`steam://rungameid/${validAppId(appid)}`))
  ipcMain.handle(IPC.installGame, (_event, appid: unknown) => shell.openExternal(`steam://install/${validAppId(appid)}`))
  ipcMain.handle(IPC.openStorePage, (_event, appid: unknown) =>
    shell.openExternal(`https://store.steampowered.com/app/${validAppId(appid)}/`)
  )
  ipcMain.handle(IPC.openLink, (_event, link: ExternalLink) => {
    const url = LINKS[link]
    if (url) return shell.openExternal(url)
    return undefined
  })

  ipcMain.handle(IPC.clearDownloads, async () => {
    await cache.clear()
    await rm(artDir, { recursive: true, force: true })
    await rm(avatarDir, { recursive: true, force: true })
    rebuild(true)
  })

  ipcMain.handle(IPC.appInfo, () => ({ version: app.getVersion(), dataPath: userData }))

  ipcMain.handle(IPC.setTheme, (_event, theme: ResolvedTheme) => {
    const colors = THEME_COLORS[theme === 'light' ? 'light' : 'dark']
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
    if (!win) return
    win.setBackgroundColor(colors.background)
    if (process.platform !== 'darwin') win.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbols })
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.nextup.desktop')
    if (app.isPackaged) Menu.setApplicationMenu(null)

    await Promise.all([settings.load(), cache.load()])

    protocol.handle(
      SCHEME,
      createArtHandler({
        artDir,
        cache,
        getLocalIndex: () => artIndex,
        getAvatarFile: (steamId) => {
          const downloaded = cache.data.profiles[steamId]?.avatarFile
          if (downloaded && existsSync(downloaded)) return downloaded
          return local.accounts.find((a) => a.steamId === steamId)?.avatarFile ?? null
        }
      })
    )

    registerIpc()
    ready = loadLocal(false).then(() => undefined)
    createWindow()
    await ready
    maybeAutoSync()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
