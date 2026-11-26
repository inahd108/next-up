import { safeStorage } from 'electron'
import { join } from 'node:path'
import type { EditableSettings, SettingsView, ThemeSetting } from '../../shared/types'
import { readJson, writeJson } from './json-file'

interface StoredSettings {
  onboarded: boolean
  theme: ThemeSetting
  steamPathOverride: string | null
  /** API key, encrypted with the operating system's key store when it's available. */
  apiKey: { value: string; encrypted: boolean } | null
  excludedAccounts: string[]
  hiddenGames: number[]
  autoSync: boolean
}

const DEFAULTS: StoredSettings = {
  onboarded: false,
  theme: 'dark',
  steamPathOverride: null,
  apiKey: null,
  excludedAccounts: [],
  hiddenGames: [],
  autoSync: true
}

export class SettingsStore {
  private data: StoredSettings = { ...DEFAULTS }

  constructor(private dir: string) {}

  private get file(): string {
    return join(this.dir, 'settings.json')
  }

  async load(): Promise<void> {
    this.data = { ...DEFAULTS, ...(await readJson<Partial<StoredSettings>>(this.file, {})) }
  }

  private save(): Promise<void> {
    return writeJson(this.file, this.data)
  }

  get view(): SettingsView {
    const key = this.getApiKey()
    return {
      onboarded: this.data.onboarded,
      theme: this.data.theme,
      steamPathOverride: this.data.steamPathOverride,
      hasApiKey: key !== null,
      apiKeyHint: key ? key.slice(-4) : null,
      excludedAccounts: [...this.data.excludedAccounts],
      hiddenGames: [...this.data.hiddenGames],
      autoSync: this.data.autoSync
    }
  }

  get raw(): Readonly<StoredSettings> {
    return this.data
  }

  async update(patch: Partial<EditableSettings>): Promise<SettingsView> {
    const next = { ...this.data }
    if (typeof patch.onboarded === 'boolean') next.onboarded = patch.onboarded
    if (patch.theme === 'system' || patch.theme === 'dark' || patch.theme === 'light') next.theme = patch.theme
    if (typeof patch.autoSync === 'boolean') next.autoSync = patch.autoSync
    if (Array.isArray(patch.excludedAccounts)) {
      next.excludedAccounts = patch.excludedAccounts.filter((id) => /^\d{17}$/.test(String(id))).map(String)
    }
    if (Array.isArray(patch.hiddenGames)) {
      next.hiddenGames = [...new Set(patch.hiddenGames.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    }
    this.data = next
    await this.save()
    return this.view
  }

  async setSteamPath(path: string | null): Promise<void> {
    this.data.steamPathOverride = path
    await this.save()
  }

  getApiKey(): string | null {
    const stored = this.data.apiKey
    if (!stored) return null
    if (!stored.encrypted) return stored.value
    try {
      return safeStorage.decryptString(Buffer.from(stored.value, 'base64'))
    } catch {
      return null
    }
  }

  async setApiKey(key: string | null): Promise<void> {
    if (!key) {
      this.data.apiKey = null
    } else if (safeStorage.isEncryptionAvailable()) {
      this.data.apiKey = { value: safeStorage.encryptString(key).toString('base64'), encrypted: true }
    } else {
      this.data.apiKey = { value: key, encrypted: false }
    }
    await this.save()
  }
}
