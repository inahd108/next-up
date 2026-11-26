import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import tagNamesJson from '../shared/data/steam-tags.json'
import { CATEGORY, GENRE_NAMES, STORE_TYPE_GAME } from '../shared/steam-ids'
import type { AccountStats, Game, LibrarySnapshot } from '../shared/types'
import type { CacheData } from './data/cache'
import { readAccounts, type LocalAccount } from './steam/accounts'
import { extractMeta, parseAppInfo, type AppMeta } from './steam/appinfo'
import { readInstalledApps, type InstalledApp } from './steam/installed'

const TAG_NAMES = tagNamesJson as Record<string, string>
const TOOL_NAME = /^(proton|steam linux runtime|steamworks|steamvr|steam audio|source sdk|.*dedicated server)/i

/** Everything read from the Steam folder on this PC. */
export interface LocalData {
  steamPath: string | null
  accounts: LocalAccount[]
  installed: Map<number, InstalledApp>
  appinfo: Map<number, AppMeta>
  /** App ids that have an artwork folder in Steam's library cache. */
  libraryCacheIds: Set<number>
  warnings: string[]
}

export function emptyLocalData(): LocalData {
  return {
    steamPath: null,
    accounts: [],
    installed: new Map(),
    appinfo: new Map(),
    libraryCacheIds: new Set(),
    warnings: []
  }
}

export async function readLocalData(steamPath: string | null): Promise<LocalData> {
  const data = emptyLocalData()
  data.steamPath = steamPath
  if (!steamPath) return data

  try {
    data.accounts = await readAccounts(steamPath)
  } catch {
    data.warnings.push("Your Steam accounts couldn't be read.")
  }
  try {
    data.installed = await readInstalledApps(steamPath)
  } catch {
    data.warnings.push("Your installed games couldn't be read.")
  }
  try {
    const file = parseAppInfo(await readFile(join(steamPath, 'appcache', 'appinfo.vdf')))
    for (const [appid, info] of file.apps) data.appinfo.set(appid, extractMeta(appid, info))
  } catch {
    data.warnings.push("Steam's game info cache couldn't be read, so tags will come from the next online sync.")
  }
  try {
    for (const entry of await readdir(join(steamPath, 'appcache', 'librarycache'), { withFileTypes: true })) {
      const id = Number(entry.name)
      if (entry.isDirectory() && Number.isInteger(id) && id > 0) data.libraryCacheIds.add(id)
    }
  } catch {
    // No artwork cache yet.
  }
  return data
}

interface Draft {
  stats: Record<string, AccountStats>
  ownedName: string | null
  fromOwnedList: boolean
}

function collectDrafts(local: LocalData, cache: CacheData): Map<number, Draft> {
  const accountIds = new Set(local.accounts.map((a) => a.steamId))
  const drafts = new Map<number, Draft>()
  const draft = (appid: number): Draft => {
    let d = drafts.get(appid)
    if (!d) {
      d = { stats: {}, ownedName: null, fromOwnedList: false }
      drafts.set(appid, d)
    }
    return d
  }
  const merge = (d: Draft, steamId: string, s: AccountStats): void => {
    const current = d.stats[steamId]
    d.stats[steamId] = current
      ? {
          playtime: Math.max(current.playtime, s.playtime),
          playtime2w: Math.max(current.playtime2w, s.playtime2w),
          lastPlayed: Math.max(current.lastPlayed, s.lastPlayed)
        }
      : { ...s }
  }

  for (const account of local.accounts) {
    for (const [appid, s] of account.apps) merge(draft(appid), account.steamId, s)
  }
  for (const [steamId, list] of Object.entries(cache.owned)) {
    if (!accountIds.has(steamId)) continue
    for (const g of list.games) {
      const d = draft(g.appid)
      d.fromOwnedList = true
      d.ownedName ??= g.name || null
      merge(d, steamId, { playtime: g.playtime, playtime2w: g.playtime2w, lastPlayed: g.lastPlayed })
    }
  }
  for (const app of local.installed.values()) {
    const d = draft(app.appid)
    if (app.lastOwner && accountIds.has(app.lastOwner)) {
      merge(d, app.lastOwner, { playtime: 0, playtime2w: 0, lastPlayed: app.lastPlayed })
    }
  }
  // Games Steam shows in its library on this PC but that no account's files mention,
  // such as games shared through Steam Families.
  for (const appid of local.libraryCacheIds) {
    if (local.appinfo.get(appid)?.type === 'game') draft(appid)
  }
  return drafts
}

/** App ids worth asking the store about: everything not already known to be DLC, a tool and so on. */
export function candidateAppIds(local: LocalData, cache: CacheData): number[] {
  return [...collectDrafts(local, cache).keys()].filter((appid) => {
    const type = local.appinfo.get(appid)?.type
    return !type || type === 'game'
  })
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

/** Merges local files and downloaded data into the library the screens show. */
export function buildSnapshot(local: LocalData, cache: CacheData): LibrarySnapshot {
  const games: Game[] = []

  for (const [appid, draft] of collectDrafts(local, cache)) {
    const details = cache.details[appid]
    const store = details && !details.missing ? details : null
    const meta = local.appinfo.get(appid) ?? null
    const installed = local.installed.get(appid) ?? null

    const name = store?.name || meta?.name || installed?.name || draft.ownedName
    if (!name) continue

    let isGame: boolean
    if (store && store.type !== null) isGame = store.type === STORE_TYPE_GAME
    else if (meta?.type) isGame = meta.type === 'game'
    else if (draft.fromOwnedList) isGame = true
    else isGame = installed !== null && !TOOL_NAME.test(name)
    if (!isGame) continue

    const tagIds = store?.tagIds.length ? store.tagIds : (meta?.tagIds ?? [])
    let tags = unique(tagIds.map((id) => TAG_NAMES[id]).filter(Boolean))
    if (tags.length === 0 && meta?.genreIds.length) {
      tags = unique(meta.genreIds.map((id) => GENRE_NAMES[id]).filter(Boolean))
    }
    const categories = store?.categoryIds.length ? store.categoryIds : (meta?.categoryIds ?? [])
    const controller = categories.includes(CATEGORY.fullController)
      ? 'full'
      : categories.includes(CATEGORY.partialController)
        ? 'partial'
        : (meta?.controller ?? null)
    const release = store?.releaseDate ?? meta?.releaseDate ?? null

    games.push({
      appid,
      name,
      tags,
      categories,
      installed: installed?.installed ?? false,
      sizeOnDisk: installed?.installed ? installed.sizeOnDisk : 0,
      stats: draft.stats,
      reviewPercent: store?.reviewPercent ?? meta?.reviewPercent ?? null,
      reviewCount: store?.reviewCount ?? null,
      reviewLabel: store?.reviewLabel ?? null,
      controller,
      deck: store?.deck || meta?.deck || 0,
      releaseYear: release ? new Date(release * 1000).getUTCFullYear() : null,
      developer: store?.developer ?? meta?.developer ?? null,
      description: store?.description ?? null,
      hasMetadata: tags.length > 0 || categories.length > 0
    })
  }

  games.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

  const accounts = local.accounts.map((a) => {
    const profile = cache.profiles[a.steamId]
    const owned = cache.owned[a.steamId]
    return {
      steamId: a.steamId,
      accountId: a.accountId,
      name: profile?.name || a.personaName || `Steam account ${a.accountId}`,
      avatarUrl: profile?.avatarFile || a.avatarFile ? `nextup://avatar/${a.steamId}` : null,
      mostRecent: a.mostRecent,
      gameCount: games.filter((g) => a.steamId in g.stats).length,
      ownedListSyncedAt: owned?.syncedAt ?? null,
      ownedListPrivate: owned?.private ?? false
    }
  })

  return {
    steamFound: local.steamPath !== null,
    steamPath: local.steamPath,
    accounts,
    games,
    builtAt: Date.now(),
    lastSyncAt: cache.lastSyncAt,
    warnings: local.warnings
  }
}
