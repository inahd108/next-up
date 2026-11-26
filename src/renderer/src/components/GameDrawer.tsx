import { AnimatePresence, motion } from 'motion/react'
import { Download, Eye, EyeOff, Play, SquareArrowOutUpRight, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { LibraryEntry } from '@shared/engine'
import { formatBytes, formatPlaytime, formatRelative } from '@shared/format'
import { useApp, useEntries } from '../store'
import { GameArt } from './art'
import { Button, Chip, IconButton } from './ui'

const DECK_LABELS = ['Unknown', 'Unsupported', 'Playable', 'Verified']

/** Play or Install, depending on whether the game is on this PC. */
export function PlayButton({
  entry,
  size = 'md',
  className
}: {
  entry: LibraryEntry
  size?: 'md' | 'lg'
  className?: string
}) {
  const { game } = entry
  return game.installed ? (
    <Button
      variant="primary"
      size={size}
      icon={Play}
      className={className}
      onClick={() => window.api.launchGame(game.appid)}
    >
      Play now
    </Button>
  ) : (
    <Button
      variant="primary"
      size={size}
      icon={Download}
      className={className}
      onClick={() => window.api.installGame(game.appid)}
    >
      Install
    </Button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right text-fg">{children}</dd>
    </div>
  )
}

export function GameDrawer() {
  const drawer = useApp((s) => s.drawer)
  const close = useApp((s) => s.closeGame)
  const entries = useEntries()
  const entry = drawer === null ? null : (entries.find((e) => e.game.appid === drawer) ?? null)

  useEffect(() => {
    if (drawer === null) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, close])

  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={entry.game.name}
            className="fixed top-0 right-0 bottom-0 z-50 flex w-[440px] flex-col overflow-hidden border-l border-line bg-panel shadow-2xl"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <DrawerBody entry={entry} onClose={close} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DrawerBody({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const { game, stats } = entry
  const snapshot = useApp((s) => s.snapshot)
  const settings = useApp((s) => s.settings)
  const neverSuggest = useApp((s) => s.neverSuggest)
  const allowSuggest = useApp((s) => s.allowSuggest)
  const hidden = settings?.hiddenGames.includes(game.appid) ?? false

  const owners = (snapshot?.accounts ?? []).filter((a) => a.steamId in game.stats)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="relative">
        <GameArt appid={game.appid} name={game.name} kind="header" className="aspect-[460/215] w-full" />
        <IconButton
          icon={X}
          label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white"
        />
      </div>
      <div className="flex-1 p-6">
        <h2 className="text-xl font-semibold tracking-tight text-fg">{game.name}</h2>
        <p className="mt-1 text-sm text-fg-muted">
          {[game.developer, game.releaseYear].filter(Boolean).join(' · ') || 'Steam game'}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <PlayButton entry={entry} />
          <Button icon={SquareArrowOutUpRight} onClick={() => window.api.openStorePage(game.appid)}>
            Store page
          </Button>
          <IconButton
            icon={hidden ? Eye : EyeOff}
            label={hidden ? 'Allow in suggestions' : 'Never suggest'}
            onClick={() => (hidden ? allowSuggest(game.appid) : neverSuggest(game.appid))}
          />
        </div>

        {game.description && <p className="mt-6 text-sm leading-relaxed text-fg-muted">{game.description}</p>}

        <dl className="mt-6 divide-y divide-line border-y border-line">
          <Row label="Playtime">{stats.playtime > 0 ? formatPlaytime(stats.playtime) : 'Unplayed'}</Row>
          {stats.lastPlayed > 0 && <Row label="Last played">{formatRelative(stats.lastPlayed)}</Row>}
          <Row label="On this PC">{game.installed ? `Installed · ${formatBytes(game.sizeOnDisk)}` : 'Not installed'}</Row>
          {game.reviewPercent !== null && (
            <Row label="Reviews">
              {game.reviewLabel ? `${game.reviewLabel} · ` : ''}
              {game.reviewPercent}%
            </Row>
          )}
          {game.deck > 0 && <Row label="Steam Deck">{DECK_LABELS[game.deck]}</Row>}
          {game.controller && <Row label="Controller">{game.controller === 'full' ? 'Full support' : 'Partial support'}</Row>}
          {owners.length > 1 && (
            <Row label="Owned by">{owners.map((a) => a.name).join(', ')}</Row>
          )}
          {hidden && <Row label="Suggestions">Hidden</Row>}
        </dl>

        {game.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {game.tags.slice(0, 12).map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
