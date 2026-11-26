import { motion } from 'motion/react'
import { ArrowRight, CircleCheck, FolderOpen, KeyRound, SquareArrowOutUpRight, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../store'
import { Avatar, LogoMark } from '../components/art'
import { Button, Card, Spinner, Switch, TextInput } from '../components/ui'

export function Welcome() {
  const snapshot = useApp((s) => s.snapshot)
  const settings = useApp((s) => s.settings)
  const sync = useApp((s) => s.sync)
  const online = useApp((s) => s.online)
  const updateSettings = useApp((s) => s.updateSettings)
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const go = useApp((s) => s.go)
  const [key, setKey] = useState('')
  const [keyMessage, setKeyMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  if (!snapshot || !settings) return null
  const excluded = new Set(settings.excludedAccounts)
  const gameCount = snapshot.games.length
  const syncing = sync !== null && sync.phase !== 'done' && sync.phase !== 'error'

  const chooseFolder = async (): Promise<void> => {
    const result = await window.api.chooseSteamFolder()
    if (!result) return
    setSettings(result.settings)
    if (!result.ok) toast(result.message, 'danger')
  }

  const saveKey = async (): Promise<void> => {
    setSaving(true)
    const result = await window.api.setApiKey(key)
    setSaving(false)
    setKeyMessage({ ok: result.ok, text: result.message })
    setSettings(result.settings)
    if (result.ok) setKey('')
  }

  const toggleAccount = (steamId: string, on: boolean): void => {
    const next = on ? settings.excludedAccounts.filter((id) => id !== steamId) : [...settings.excludedAccounts, steamId]
    void updateSettings({ excludedAccounts: next })
  }

  const start = async (): Promise<void> => {
    await updateSettings({ onboarded: true })
    go('home')
  }

  const canStart = snapshot.steamFound && gameCount > 0 && snapshot.accounts.some((a) => !excluded.has(a.steamId))

  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto flex max-w-[620px] flex-col px-8 pt-10 pb-16"
      >
        <LogoMark size={52} />
        <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-tight text-fg">
          Find your next game in under a minute
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
          Next up reads your Steam library on this PC, asks a few quick questions and picks something worth
          playing. It works offline, and your data stays on your computer.
        </p>

        <Card className="mt-8 p-5">
          {snapshot.steamFound ? (
            <>
              <div className="flex items-start gap-3">
                <CircleCheck size={20} className="mt-0.5 shrink-0 text-good" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg">Steam found</div>
                  <div className="mt-0.5 truncate text-xs text-fg-subtle">{snapshot.steamPath}</div>
                </div>
                <Button size="sm" variant="ghost" icon={FolderOpen} onClick={chooseFolder}>
                  Change
                </Button>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-fg-muted">Accounts on this PC</span>
                  <span className="text-xs text-fg-subtle">{gameCount.toLocaleString('en')} games found</span>
                </div>
                <ul className="space-y-1">
                  {snapshot.accounts.map((account) => (
                    <li key={account.steamId} className="flex items-center gap-3 rounded-lg py-2">
                      <Avatar account={account} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">{account.name}</div>
                        <div className="text-xs text-fg-subtle">
                          {account.gameCount.toLocaleString('en')} games{account.mostRecent ? ' · Signed in most recently' : ''}
                        </div>
                      </div>
                      <Switch
                        checked={!excluded.has(account.steamId)}
                        onChange={(on) => toggleAccount(account.steamId, on)}
                        label={`Include ${account.name}`}
                      />
                    </li>
                  ))}
                </ul>
                {snapshot.accounts.length === 0 && (
                  <p className="text-sm text-fg-muted">No accounts yet. Sign in to Steam once, then reopen Next up.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" />
              <div className="flex-1">
                <div className="text-sm font-medium text-fg">Steam wasn’t found</div>
                <p className="mt-1 text-sm text-fg-muted">
                  Choose the folder Steam is installed in. It’s the one that contains a folder called steamapps.
                </p>
                <Button className="mt-4" icon={FolderOpen} onClick={chooseFolder}>
                  Choose Steam folder
                </Button>
              </div>
            </div>
          )}
        </Card>

        {snapshot.steamFound && (
          <Card className="mt-4 p-5">
            <div className="flex items-start gap-3">
              <KeyRound size={20} className="mt-0.5 shrink-0 text-fg-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-fg">
                  Add your full library <span className="text-xs font-normal text-fg-subtle">Optional</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                  Steam only keeps games you’ve played on this PC. A free Steam Web API key adds every game you own.
                  Tags and reviews download automatically whenever you’re online, with or without a key.
                </p>
                {settings.hasApiKey ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-good">
                    <CircleCheck size={16} /> Key saved (ending {settings.apiKeyHint})
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex gap-2">
                      <TextInput
                        value={key}
                        onChange={(e) => {
                          setKey(e.target.value)
                          setKeyMessage(null)
                        }}
                        placeholder="Paste your 32-character key"
                        spellCheck={false}
                        aria-label="Steam Web API key"
                      />
                      <Button onClick={saveKey} loading={saving} disabled={key.trim().length === 0}>
                        Save
                      </Button>
                    </div>
                    {keyMessage && (
                      <p className={`mt-2 text-[13px] ${keyMessage.ok ? 'text-good' : 'text-danger'}`}>{keyMessage.text}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => window.api.openLink('apikey')}
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-text hover:underline"
                    >
                      Get a key from Steam <SquareArrowOutUpRight size={13} />
                    </button>
                    <p className="mt-1 text-xs text-fg-subtle">
                      Sign in, enter any domain name such as localhost, and copy the key it shows.
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        <div className="mt-8 flex items-center gap-4">
          <Button variant="primary" size="lg" onClick={start} disabled={!canStart}>
            Get started <ArrowRight size={18} />
          </Button>
          {syncing ? (
            <span className="flex items-center gap-2 text-[13px] text-fg-muted">
              <Spinner size={14} /> Downloading tags and reviews
            </span>
          ) : !online ? (
            <span className="text-[13px] text-fg-muted">You’re offline. Saved Steam data will be used.</span>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
