import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export type ArtKind = 'header' | 'cover' | 'hero' | 'logo'

export const ART_KINDS: readonly ArtKind[] = ['header', 'cover', 'hero', 'logo']

/** File names Steam uses in appcache/librarycache, best match first. */
const LOCAL_NAMES: Record<ArtKind, string[]> = {
  header: ['header.jpg', 'library_header.jpg'],
  cover: ['library_600x900.jpg', 'library_capsule.jpg', 'library_600x900_2x.jpg'],
  hero: ['library_hero.jpg'],
  logo: ['logo.png']
}

/** Old flat layout: librarycache/<appid>_<name>. */
const LEGACY_NAMES: Record<ArtKind, string[]> = {
  header: ['header.jpg'],
  cover: ['library_600x900.jpg'],
  hero: ['library_hero.jpg'],
  logo: ['logo.png']
}

/** Finds artwork that Steam has already saved on this PC. */
export class LocalArtIndex {
  private folderListing = new Map<number, Promise<Map<string, string>>>()
  private legacyFiles: Promise<Set<string>> | null = null

  constructor(private steamPath: string | null) {}

  private get root(): string | null {
    return this.steamPath ? join(this.steamPath, 'appcache', 'librarycache') : null
  }

  /** File name to full path for an app's artwork folder, including one level of hashed subfolders. */
  private listFolder(appid: number): Promise<Map<string, string>> {
    let listing = this.folderListing.get(appid)
    if (!listing) {
      listing = (async () => {
        const files = new Map<string, string>()
        if (!this.root) return files
        const dir = join(this.root, String(appid))
        try {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
            if (entry.isFile()) {
              files.set(entry.name.toLowerCase(), join(dir, entry.name))
            } else if (entry.isDirectory()) {
              for (const inner of await readdir(join(dir, entry.name), { withFileTypes: true })) {
                const key = inner.name.toLowerCase()
                if (inner.isFile() && !files.has(key)) files.set(key, join(dir, entry.name, inner.name))
              }
            }
          }
        } catch {
          // No artwork folder for this app.
        }
        return files
      })()
      this.folderListing.set(appid, listing)
    }
    return listing
  }

  private listLegacy(): Promise<Set<string>> {
    this.legacyFiles ??= (async () => {
      if (!this.root) return new Set<string>()
      try {
        const entries = await readdir(this.root, { withFileTypes: true })
        return new Set(entries.filter((e) => e.isFile()).map((e) => e.name.toLowerCase()))
      } catch {
        return new Set<string>()
      }
    })()
    return this.legacyFiles
  }

  async find(appid: number, kind: ArtKind): Promise<string | null> {
    const files = await this.listFolder(appid)
    for (const name of LOCAL_NAMES[kind]) {
      const path = files.get(name)
      if (path) return path
    }
    if (this.root) {
      const legacy = await this.listLegacy()
      for (const name of LEGACY_NAMES[kind]) {
        const file = `${appid}_${name}`
        if (legacy.has(file)) return join(this.root, file)
      }
    }
    return null
  }
}
