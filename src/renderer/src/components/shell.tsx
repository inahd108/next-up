import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CloudOff, House, LayoutGrid, RefreshCw, Settings, Sparkles, TriangleAlert, X } from 'lucide-react'
import { formatSince } from '@shared/format'
import { activeAccountIds } from '@shared/engine'
import { useApp, useEntries, type View } from '../store'
import { Avatar, LogoMark } from './art'
import { cx, IconButton, Spinner } from './ui'

export function TopBar() {
  return (
    <header className="drag flex h-11 shrink-0 items-center px-4">
      <div className="flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[13px] font-semibold tracking-tight text-fg">Next up</span>
      </div>
    </header>
  )
}

const NAV: { view: View; label: string; icon: typeof House }[] = [
  { view: 'home', label: 'Home', icon: House },
  { view: 'quiz', label: 'Find a game', icon: Sparkles },
  { view: 'library', label: 'Library', icon: LayoutGrid },
  { view: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const view = useApp((s) => s.view)
  const go = useApp((s) => s.go)
  const startQuiz = useApp((s) => s.startQuiz)

  return (
    <nav className="flex w-60 shrink-0 flex-col px-3 pt-2 pb-3" aria-label="Main">
      <ul className="space-y-0.5">
        {NAV.map(({ view: target, label, icon: Icon }) => {
          const active = view === target || (target === 'quiz' && view === 'results')
          return (
            <li key={target}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => (target === 'quiz' ? startQuiz() : go(target))}
                className={cx(
                  'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  active ? 'bg-fill-strong text-fg' : 'text-fg-muted hover:bg-fill hover:text-fg'
                )}
              >
                <Icon size={17} className={active ? 'text-accent-text' : undefined} />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto">
        <LibraryStatus />
      </div>
    </nav>
  )
}

function LibraryStatus() {
  const snapshot = useApp((s) => s.snapshot)
  const settings = useApp((s) => s.settings)
  const online = useApp((s) => s.online)
  const sync = useApp((s) => s.sync)
  const runSync = useApp((s) => s.runSync)
  const go = useApp((s) => s.go)
  const entries = useEntries()

  if (!snapshot) return null
  const active = activeAccountIds(snapshot.accounts, settings?.excludedAccounts ?? [])
  const accounts = snapshot.accounts.filter((a) => active.has(a.steamId))
  const syncing = sync !== null && sync.phase !== 'done' && sync.phase !== 'error'
  const percent = sync && sync.total > 0 ? Math.round((sync.done / sync.total) * 100) : null

  let statusIcon = <CircleCheck size={14} className="text-good" />
  let statusText = snapshot.lastSyncAt ? `Synced ${formatSince(snapshot.lastSyncAt)}` : 'Not synced yet'
  if (syncing) {
    statusIcon = <Spinner size={14} className="text-accent-text" />
    statusText = percent !== null && sync?.phase === 'details' ? `Syncing ${percent}%` : `${sync?.message}`
  } else if (!online) {
    statusIcon = <CloudOff size={14} className="text-warn" />
    statusText = 'Offline, using saved data'
  } else if (!snapshot.lastSyncAt) {
    statusIcon = <TriangleAlert size={14} className="text-warn" />
  }

  return (
    <div className="rounded-xl bg-fill p-3">
      <button type="button" onClick={() => go('settings')} className="flex w-full items-center gap-2.5 text-left">
        <div className="flex -space-x-2">
          {accounts.slice(0, 3).map((a) => (
            <Avatar key={a.steamId} account={a} size={26} className="ring-2 ring-bg" />
          ))}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-fg">
            {accounts.length === 1 ? accounts[0].name : `${accounts.length} accounts`}
          </div>
          <div className="text-xs text-fg-subtle">{entries.length.toLocaleString('en')} games</div>
        </div>
      </button>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
        {statusIcon}
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{statusText}</span>
        {online && !syncing && (
          <IconButton icon={RefreshCw} label="Sync now" size="sm" className="-my-1 -mr-1 h-7 w-7" onClick={runSync} />
        )}
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  const tones = {
    neutral: 'bg-raised text-fg',
    good: 'bg-raised text-fg',
    warn: 'bg-raised text-fg',
    danger: 'bg-raised text-fg'
  }
  const dots = { neutral: 'bg-accent', good: 'bg-good', warn: 'bg-warn', danger: 'bg-danger' }
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-[360px] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-card ring-1 ring-line-strong',
              tones[t.tone]
            )}
          >
            <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', dots[t.tone])} />
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <IconButton icon={X} label="Dismiss" size="sm" className="-my-1 -mr-2 h-7 w-7" onClick={() => dismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
