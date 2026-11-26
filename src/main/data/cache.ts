import { join } from 'node:path'
import { readJson, writeJson } from './json-file'

/** Store details for one app, normalised from Steam's store browse API. */
export interface StoreDetails {
  appid: number
  /** True when the store returned nothing for this app (removed, region-locked and so on). */
  missing: boolean
  name: string | null
  type: number | null
  tagIds: number[]
  categoryIds: number[]
  reviewPercent: number | null
  reviewCount: number | null
  reviewLabel: string | null
  description: string | null
  developer: string | null
  releaseDate: number | null
  deck: 0 | 1 | 2 | 3
  assets: Partial<Record<'header' | 'cover' | 'hero', string>>
  fetchedAt: number
}

export interface OwnedGame {
  appid: number
  name: string
  playtime: number
  playtime2w: number
  lastPlayed: number
}

export interface OwnedList {
  syncedAt: number
  private: boolean
  games: OwnedGame[]
}

export interface Profile {
  name: string
  avatarFile: string | null
  updatedAt: number
}

export interface CacheData {
  version: 1
  lastSyncAt: number | null
  owned: Record<string, OwnedList>
  profiles: Record<string, Profile>
  details: Record<string, StoreDetails>
}

const EMPTY: CacheData = { version: 1, lastSyncAt: null, owned: {}, profiles: {}, details: {} }

/** Everything downloaded from Steam, kept on disk so the app works offline. */
export class CacheStore {
  data: CacheData = structuredClone(EMPTY)
  private saving: Promise<void> = Promise.resolve()

  constructor(private dir: string) {}

  get file(): string {
    return join(this.dir, 'library-cache.json')
  }

  async load(): Promise<void> {
    const loaded = await readJson<CacheData>(this.file, structuredClone(EMPTY))
    this.data = loaded?.version === 1 ? { ...structuredClone(EMPTY), ...loaded } : structuredClone(EMPTY)
  }

  save(): Promise<void> {
    this.saving = this.saving.then(() => writeJson(this.file, this.data)).catch(() => undefined)
    return this.saving
  }

  async clear(): Promise<void> {
    this.data = structuredClone(EMPTY)
    await this.save()
  }
}
