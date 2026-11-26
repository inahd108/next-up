import { CircleCheck, FolderOpen, RefreshCw, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { AppInfo, ThemeSetting } from '@shared/types'
import { formatSince } from '@shared/format'
import { useApp } from '../store'
import { Avatar, GameArt } from '../components/art'
import { Button, Card, Segmented, Switch, TextInput } from '../components/ui'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
      <Card className="mt-3 divide-y divide-line px-5">{children}</Card>
    </section>
  )
}

function Row({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

export function Settings() {
  const snapshot = useApp((s) => s.snapshot)
  const settings = useApp((s) => s.settings)
  const online = useApp((s) => s.online)
  const sync = useApp((s) => s.sync)
  const updateSettings = useApp((s) => s.updateSettings)
  const setSettings = useApp((s) => s.setSettings)
  const allowSuggest = useApp((s) => s.allowSuggest)
  const runSync = useApp((s) => s.runSync)
  const toast = useApp((s) => s.toast)

  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState(false)
  const [rescanning, setRescanning] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.api.appInfo().then(setInfo)
  }, [])

  if (!snapshot || !settings) return null
  const excluded = new Set(settings.excludedAccounts)
  const syncing = sync !== null && sync.phase !== 'done' && sync.phase !== 'error'
  const withTags = snapshot.games.filter((g) => g.hasMetadata).length
  const hiddenGames = settings.hiddenGames
    .map((id) => snapshot.games.find((g) => g.appid === id))
    .filter((g) => g !== undefined)

  const saveKey = async (): Promise<void> => {
    setSavingKey(true)
    const result = await window.api.setApiKey(key)
    setSavingKey(false)
    setSettings(result.settings)
    if (result.ok) {
      setKey('')
      setKeyError(null)
      toast(result.message, 'good')
    } else {
      setKeyError(result.message)
    }
  }

  const removeKey = async (): Promise<void> => {
    setSettings(await window.api.clearApiKey())
    toast('API key removed. Game lists already downloaded are kept.')
  }

  const chooseFolder = async (): Promise<void> => {
    const result = await window.api.chooseSteamFolder()
    if (!result) return
    setSettings(result.settings)
    toast(result.message, result.ok ? 'good' : 'danger')
  }

  const resetFolder = async (): Promise<void> => {
    setSettings(await window.api.resetSteamFolder())
  }

  const rescan = async (): Promise<void> => {
    setRescanning(true)
    await window.api.rescan()
    setRescanning(false)
    toast('Steam folder rescanned.', 'good')
  }

  const clearDownloads = async (): Promise<void> => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 4000)
      return
    }
    setConfirmClear(false)
    await window.api.clearDownloads()
    toast('Downloaded data cleared. It will download again on the next sync.')
  }

  const accountStatus = (steamId: string): string => {
    const account = snapshot.accounts.find((a) => a.steamId === steamId)!
    if (account.ownedListPrivate) return 'Game list is private on Steam'
    if (account.ownedListSyncedAt) return `Full library synced ${formatSince(account.ownedListSyncedAt)}`
    return 'Games played on this PC'
  }

  return (
    <div className="mx-auto max-w-[760px] px-10 pt-9 pb-16">
      <h1 className="mb-8 text-[28px] font-semibold tracking-tight text-fg">Settings</h1>

      <Section title="Accounts" description="Recommendations use the games and playtime of the accounts switched on here.">
        {snapshot.accounts.length === 0 && (
          <Row title="No accounts found" description="Sign in to Steam on this PC once, then rescan the Steam folder." />
        )}
        {snapshot.accounts.map((account) => (
          <div key={account.steamId} className="flex items-center gap-3 py-3.5">
            <Avatar account={account} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{account.name}</div>
              <div className="text-[13px] text-fg-muted">
                {account.gameCount.toLocaleString('en')} games · {accountStatus(account.steamId)}
                {account.ownedListPrivate && (
                  <button
                    type="button"
                    onClick={() => window.api.openLink('privacy')}
                    className="ml-1.5 font-medium text-accent-text hover:underline"
                  >
                    Privacy settings
                  </button>
                )}
              </div>
            </div>
            <Switch
              checked={!excluded.has(account.steamId)}
              label={`Include ${account.name}`}
              onChange={(on) =>
                updateSettings({
                  excludedAccounts: on
                    ? settings.excludedAccounts.filter((id) => id !== account.steamId)
                    : [...settings.excludedAccounts, account.steamId]
                })
              }
            />
          </div>
        ))}
      </Section>

      <Section
        title="Online sync"
        description="Online data is saved on this PC, so everything keeps working offline."
      >
        <Row
          title="Steam Web API key"
          description={
            settings.hasApiKey
              ? `Saved, ending ${settings.apiKeyHint}. Used to download every game you own.`
              : 'Optional. Adds games you own but have never played on this PC.'
          }
        >
          {settings.hasApiKey ? (
            <Button variant="danger" size="sm" onClick={removeKey}>
              Remove
            </Button>
          ) : (
            <Button variant="ghost" size="sm" icon={SquareArrowOutUpRight} onClick={() => window.api.openLink('apikey')}>
              Get a key
            </Button>
          )}
        </Row>
        {!settings.hasApiKey && (
          <div className="pb-4">
            <div className="flex gap-2">
              <TextInput
                value={key}
                onChange={(e) => {
                  setKey(e.target.value)
                  setKeyError(null)
                }}
                placeholder="Paste your 32-character key"
                spellCheck={false}
                aria-label="Steam Web API key"
              />
              <Button onClick={saveKey} loading={savingKey} disabled={key.trim().length === 0}>
                Save key
              </Button>
            </div>
            {keyError && <p className="mt-2 text-[13px] text-danger">{keyError}</p>}
          </div>
        )}
        <Row
          title="Sync automatically"
          description="Downloads tags, reviews and artwork in the background when you’re online."
        >
          <Switch checked={settings.autoSync} onChange={(autoSync) => updateSettings({ autoSync })} label="Sync automatically" />
        </Row>
        <Row
          title={snapshot.lastSyncAt ? `Last synced ${formatSince(snapshot.lastSyncAt)}` : 'Not synced yet'}
          description={`Tags and details for ${withTags.toLocaleString('en')} of ${snapshot.games.length.toLocaleString('en')} games.`}
        >
          <Button size="sm" icon={RefreshCw} loading={syncing} disabled={!online} onClick={runSync}>
            {online ? 'Sync now' : 'Offline'}
          </Button>
        </Row>
      </Section>

      <Section title="Steam folder">
        <Row
          title={
            snapshot.steamFound ? (
              <span className="flex items-center gap-2">
                <CircleCheck size={16} className="text-good" /> Steam found
              </span>
            ) : (
              'Steam not found'
            )
          }
          description={snapshot.steamPath ?? 'Choose the folder that contains steamapps.'}
        >
          {settings.steamPathOverride && (
            <Button variant="ghost" size="sm" onClick={resetFolder}>
              Use default
            </Button>
          )}
          <Button size="sm" icon={FolderOpen} onClick={chooseFolder}>
            Change
          </Button>
        </Row>
        <Row title="Rescan" description="Picks up games you’ve installed or played since Next up opened.">
          <Button size="sm" icon={RefreshCw} loading={rescanning} onClick={rescan}>
            Rescan
          </Button>
        </Row>
      </Section>

      <Section title="Appearance">
        <Row title="Theme">
          <Segmented<ThemeSetting>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' }
            ]}
          />
        </Row>
      </Section>

      <Section title="Hidden games" description="Games you’ve asked never to see as suggestions.">
        {hiddenGames.length === 0 ? (
          <Row title="No hidden games" description="Choose Never suggest on a pick to hide it here." />
        ) : (
          hiddenGames.map((game) => (
            <div key={game.appid} className="flex items-center gap-3 py-3">
              <GameArt appid={game.appid} name={game.name} kind="header" className="h-9 w-[77px] rounded-md" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{game.name}</span>
              <Button size="sm" variant="ghost" onClick={() => allowSuggest(game.appid)}>
                Restore
              </Button>
            </div>
          ))
        )}
      </Section>

      <Section title="Data and privacy">
        <Row
          title="Stored on this PC only"
          description="Next up never sends your data anywhere except Steam. Your API key is encrypted with Windows."
        />
        <Row title="Downloaded data" description={info ? info.dataPath : undefined}>
          <Button variant="danger" size="sm" icon={Trash2} onClick={clearDownloads}>
            {confirmClear ? 'Click again to clear' : 'Clear'}
          </Button>
        </Row>
        <Row title="Version" description={info ? `Next up ${info.version}` : undefined} />
      </Section>
    </div>
  )
}
