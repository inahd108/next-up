import { readdir, readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { parseVdf, vget, vnum, vobj, vstr } from './vdf'

export interface InstalledApp {
  appid: number
  name: string | null
  installed: boolean
  sizeOnDisk: number
  /** SteamID64 of the account that installed or last used it. */
  lastOwner: string | null
  lastPlayed: number
}

/** All Steam library folders, including the main install. */
export async function readLibraryFolders(steamPath: string): Promise<string[]> {
  const folders = new Map<string, string>()
  const add = (path: string): void => {
    const clean = normalize(path)
    folders.set(clean.toLowerCase(), clean)
  }
  add(steamPath)
  try {
    const text = await readFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    const root = vobj(vget(parseVdf(text), 'libraryfolders'))
    for (const value of Object.values(root ?? {})) {
      const path = vstr(vget(value, 'path'))
      if (path) add(path)
    }
  } catch {
    // Only the main library exists.
  }
  return [...folders.values()]
}

export function parseAppManifest(text: string): InstalledApp | null {
  const state = vobj(vget(parseVdf(text), 'AppState'))
  const appid = vnum(vget(state, 'appid'))
  if (!state || !appid) return null
  const flags = vnum(vget(state, 'StateFlags')) ?? 0
  const owner = vstr(vget(state, 'LastOwner'))
  return {
    appid,
    name: vstr(vget(state, 'name')) ?? null,
    // Bit 2 (value 4) means fully installed.
    installed: (flags & 4) !== 0,
    sizeOnDisk: vnum(vget(state, 'SizeOnDisk')) ?? 0,
    lastOwner: owner && /^\d{17}$/.test(owner) && owner !== '0' ? owner : null,
    lastPlayed: vnum(vget(state, 'LastPlayed')) ?? 0
  }
}

/** Reads every app manifest across all library folders. */
export async function readInstalledApps(steamPath: string): Promise<Map<number, InstalledApp>> {
  const apps = new Map<number, InstalledApp>()
  for (const library of await readLibraryFolders(steamPath)) {
    const dir = join(library, 'steamapps')
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(file)) continue
      try {
        const app = parseAppManifest(await readFile(join(dir, file), 'utf8'))
        if (app && (!apps.has(app.appid) || app.installed)) apps.set(app.appid, app)
      } catch {
        // Skip unreadable manifests.
      }
    }
  }
  return apps
}
