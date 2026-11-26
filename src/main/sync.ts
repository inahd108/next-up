import { net } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SyncOutcome, SyncProgress } from '../shared/types'
import type { CacheStore } from './data/cache'
import type { SettingsStore } from './data/settings'
import { getBinary, HttpError } from './online/http'
import { fetchStoreDetails } from './online/store-api'
import { getOwnedGames, getPlayerSummaries } from './online/web-api'
import type { LocalAccount } from './steam/accounts'

const DAY = 86_400_000
const DETAILS_TTL = 14 * DAY
const MISSING_TTL = 7 * DAY

export interface SyncDeps {
  cache: CacheStore
  settings: SettingsStore
  avatarDir: string
  getAccounts: () => LocalAccount[]
  getCandidateIds: () => number[]
  onProgress: (progress: SyncProgress) => void
}

/** Downloads owned-game lists (with an API key) and store details (no key needed). */
export class SyncService {
  private running: Promise<SyncOutcome> | null = null

  constructor(private deps: SyncDeps) {}

  get isRunning(): boolean {
    return this.running !== null
  }

  /** Ids that have no store details yet, or whose details are out of date. */
  staleIds(): number[] {
    const now = Date.now()
    const { details } = this.deps.cache.data
    return this.deps.getCandidateIds().filter((id) => {
      const d = details[id]
      if (!d) return true
      return now - d.fetchedAt > (d.missing ? MISSING_TTL : DETAILS_TTL)
    })
  }

  run(): Promise<SyncOutcome> {
    this.running ??= this.execute().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async execute(): Promise<SyncOutcome> {
    const { cache, settings, onProgress } = this.deps
    if (!net.isOnline()) {
      return { ok: false, offline: true, message: "You're offline, so your saved library is being used." }
    }

    onProgress({ phase: 'starting', message: 'Connecting to Steam', done: 0, total: 0 })
    const key = settings.getApiKey()
    const accounts = this.deps.getAccounts()
    const notes: string[] = []

    try {
      if (key && accounts.length > 0) {
        onProgress({ phase: 'profiles', message: 'Updating profiles', done: 0, total: accounts.length })
        try {
          for (const player of await getPlayerSummaries(key, accounts.map((a) => a.steamId))) {
            const avatarFile = player.avatarUrl ? await this.saveAvatar(player.steamId, player.avatarUrl) : null
            cache.data.profiles[player.steamId] = {
              name: player.name,
              avatarFile: avatarFile ?? cache.data.profiles[player.steamId]?.avatarFile ?? null,
              updatedAt: Date.now()
            }
          }
        } catch (error) {
          if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
            onProgress({ phase: 'error', message: 'API key rejected', done: 0, total: 0 })
            return { ok: false, offline: false, message: 'Steam rejected your API key. Check it in Settings.' }
          }
          throw error
        }

        let done = 0
        for (const account of accounts) {
          onProgress({ phase: 'owned', message: 'Downloading game lists', done: done++, total: accounts.length })
          const owned = await getOwnedGames(key, account.steamId)
          const previous = cache.data.owned[account.steamId]
          cache.data.owned[account.steamId] = {
            syncedAt: Date.now(),
            private: owned.private,
            // Keep the last good list if the profile has since been made private.
            games: owned.private && previous ? previous.games : owned.games
          }
          if (owned.private) {
            const name = cache.data.profiles[account.steamId]?.name || account.personaName || 'One account'
            notes.push(`${name}'s game list is private on Steam`)
          }
        }
        await cache.save()
      }

      const ids = this.staleIds()
      if (ids.length > 0) {
        onProgress({ phase: 'details', message: 'Downloading tags and reviews', done: 0, total: ids.length })
        await fetchStoreDetails(ids, (batch, done) => {
          for (const details of batch) cache.data.details[details.appid] = details
          onProgress({ phase: 'details', message: 'Downloading tags and reviews', done, total: ids.length })
        })
      }

      cache.data.lastSyncAt = Date.now()
      await cache.save()
      onProgress({ phase: 'done', message: 'Library up to date', done: 1, total: 1 })
      return { ok: true, offline: false, message: notes.length ? `${notes.join('. ')}.` : 'Your library is up to date.' }
    } catch {
      await cache.save()
      onProgress({ phase: 'error', message: "Couldn't reach Steam", done: 0, total: 0 })
      return {
        ok: false,
        offline: !net.isOnline(),
        message: "Couldn't reach Steam. Your saved library is still available."
      }
    }
  }

  private async saveAvatar(steamId: string, url: string): Promise<string | null> {
    const image = await getBinary(url)
    if (!image) return null
    await mkdir(this.deps.avatarDir, { recursive: true })
    const file = join(this.deps.avatarDir, `${steamId}.jpg`)
    await writeFile(file, image.data)
    return file
  }
}
