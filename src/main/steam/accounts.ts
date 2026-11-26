import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AccountStats } from '../../shared/types'
import { parseVdf, vget, vnum, vobj, vstr, type VdfObject } from './vdf'

const STEAMID64_BASE = 76561197960265728n

export function toSteamId64(accountId: number): string {
  return (BigInt(accountId) + STEAMID64_BASE).toString()
}

export function toAccountId(steamId64: string): number {
  return Number(BigInt(steamId64) - STEAMID64_BASE)
}

export interface LocalAccount {
  steamId: string
  accountId: number
  personaName: string | null
  mostRecent: boolean
  timestamp: number
  avatarFile: string | null
  /** Per-game stats from this account's localconfig.vdf. */
  apps: Map<number, AccountStats>
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Reads per-game playtime and last-played times from a parsed localconfig.vdf. */
export function parseLocalConfigApps(root: VdfObject): Map<number, AccountStats> {
  const apps = new Map<number, AccountStats>()
  const list = vobj(vget(root, 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps'))
  if (!list) return apps
  for (const [key, value] of Object.entries(list)) {
    const appid = Number(key)
    const entry = vobj(value)
    if (!Number.isInteger(appid) || appid <= 0 || !entry) continue
    apps.set(appid, {
      playtime: vnum(vget(entry, 'Playtime')) ?? 0,
      playtime2w: vnum(vget(entry, 'Playtime2wks')) ?? 0,
      lastPlayed: vnum(vget(entry, 'LastPlayed')) ?? 0
    })
  }
  return apps
}

/**
 * Lists the Steam accounts that have signed in on this PC, with the playtime Steam
 * keeps locally for each of them.
 */
export async function readAccounts(steamPath: string): Promise<LocalAccount[]> {
  const known = new Map<string, { personaName: string | null; mostRecent: boolean; timestamp: number }>()

  const loginText = await readText(join(steamPath, 'config', 'loginusers.vdf'))
  if (loginText) {
    const users = vobj(vget(parseVdf(loginText), 'users'))
    for (const [steamId, value] of Object.entries(users ?? {})) {
      const user = vobj(value)
      if (!/^\d{17}$/.test(steamId) || !user) continue
      known.set(steamId, {
        personaName: vstr(vget(user, 'PersonaName')) ?? null,
        mostRecent: vstr(vget(user, 'MostRecent')) === '1',
        timestamp: vnum(vget(user, 'Timestamp')) ?? 0
      })
    }
  }

  const userdataIds = new Set<number>()
  try {
    for (const entry of await readdir(join(steamPath, 'userdata'), { withFileTypes: true })) {
      const id = Number(entry.name)
      if (entry.isDirectory() && Number.isInteger(id) && id > 0) userdataIds.add(id)
    }
  } catch {
    // No userdata folder yet.
  }

  const steamIds = new Set<string>(known.keys())
  for (const id of userdataIds) steamIds.add(toSteamId64(id))

  const accounts: LocalAccount[] = []
  for (const steamId of steamIds) {
    const accountId = toAccountId(steamId)
    const login = known.get(steamId)
    let apps = new Map<number, AccountStats>()
    let personaName = login?.personaName ?? null

    if (userdataIds.has(accountId)) {
      const configText = await readText(join(steamPath, 'userdata', String(accountId), 'config', 'localconfig.vdf'))
      if (configText) {
        const root = parseVdf(configText)
        apps = parseLocalConfigApps(root)
        personaName ??= vstr(vget(root, 'UserLocalConfigStore', 'friends', 'PersonaName')) ?? null
      }
    }

    // Skip leftover folders with no sign-in record and no games.
    if (!login && apps.size === 0) continue

    const avatarPath = join(steamPath, 'config', 'avatarcache', `${steamId}.png`)
    accounts.push({
      steamId,
      accountId,
      personaName,
      mostRecent: login?.mostRecent ?? false,
      timestamp: login?.timestamp ?? 0,
      avatarFile: (await exists(avatarPath)) ? avatarPath : null,
      apps
    })
  }

  accounts.sort((a, b) => Number(b.mostRecent) - Number(a.mostRecent) || b.timestamp - a.timestamp)
  return accounts
}
