import { EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LibraryEntry } from '@shared/engine'
import { formatPlaytime, formatRelative } from '@shared/format'
import { GameArt } from './art'
import { cx } from './ui'

export function playSummary(entry: LibraryEntry): string {
  const { playtime, lastPlayed } = entry.stats
  if (playtime === 0) return 'Unplayed'
  return lastPlayed ? `${formatPlaytime(playtime)} · ${formatRelative(lastPlayed)}` : formatPlaytime(playtime)
}

/** Portrait card for grids. */
export function CoverCard({
  entry,
  onClick,
  hidden,
  meta
}: {
  entry: LibraryEntry
  onClick: () => void
  hidden?: boolean
  meta?: ReactNode
}) {
  const { game } = entry
  return (
    <button type="button" onClick={onClick} className="group flex min-w-0 flex-col text-left">
      <div className="relative w-full">
        <GameArt
          appid={game.appid}
          name={game.name}
          kind="cover"
          className={cx(
            'aspect-[2/3] w-full rounded-xl ring-1 ring-line transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-card group-hover:ring-line-strong',
            hidden && 'opacity-50'
          )}
        />
        {game.installed && (
          <span
            className="absolute top-2 right-2 h-2 w-2 rounded-full bg-good ring-2 ring-black/30"
            title="Installed"
          />
        )}
        {hidden && (
          <span className="absolute top-2 left-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/60 px-2 text-[11px] font-medium text-white">
            <EyeOff size={12} /> Hidden
          </span>
        )}
      </div>
      <div className="mt-2.5 min-w-0 px-0.5">
        <div className="truncate text-[13px] font-medium text-fg">{game.name}</div>
        <div className="mt-0.5 truncate text-xs text-fg-subtle">{meta ?? playSummary(entry)}</div>
      </div>
    </button>
  )
}

/** Landscape card for rows and runner-up picks. */
export function WideCard({
  entry,
  onClick,
  meta,
  footer
}: {
  entry: LibraryEntry
  onClick: () => void
  meta?: ReactNode
  footer?: ReactNode
}) {
  const { game } = entry
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-raised text-left ring-1 ring-line transition duration-200 hover:-translate-y-0.5 hover:shadow-card hover:ring-line-strong"
    >
      <GameArt appid={game.appid} name={game.name} kind="header" className="aspect-[460/215] w-full" />
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="truncate text-sm font-medium text-fg">{game.name}</div>
        <div className="mt-0.5 truncate text-xs text-fg-subtle">{meta ?? playSummary(entry)}</div>
        {footer && <div className="mt-2.5">{footer}</div>}
      </div>
    </button>
  )
}
