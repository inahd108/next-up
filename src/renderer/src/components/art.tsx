import { useEffect, useState } from 'react'
import type { Account } from '@shared/types'
import { cx } from './ui'

type ArtKind = 'header' | 'cover' | 'hero'

const CHAINS: Record<ArtKind, ArtKind[]> = {
  header: ['header'],
  cover: ['cover', 'header'],
  hero: ['hero', 'header']
}

export const artUrl = (appid: number, kind: ArtKind | 'logo'): string => `nextup://art/${appid}/${kind}`

/** Game artwork with graceful fallbacks: cover → header → a generated placeholder. */
export function GameArt({
  appid,
  name,
  kind,
  className,
  onResolved
}: {
  appid: number
  name: string
  kind: ArtKind
  className?: string
  onResolved?: (kind: ArtKind | null) => void
}) {
  const chain = CHAINS[kind]
  const id = `${appid}:${kind}`
  // State is tied to the image it belongs to, so a new game starts fresh without a reset
  // effect (which could undo a load that finished first, leaving the image invisible).
  const [failures, setFailures] = useState({ id, count: 0 })
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const index = failures.id === id ? failures.count : 0
  const current = chain[index]
  const src = current ? artUrl(appid, current) : null
  const loaded = src !== null && loadedSrc === src

  useEffect(() => {
    if (!current) onResolved?.(null)
  }, [current, onResolved])

  if (!current || !src) return <ArtPlaceholder appid={appid} name={name} className={className} tall={kind === 'cover'} />

  const markLoaded = (): void => {
    if (loadedSrc === src) return
    setLoadedSrc(src)
    onResolved?.(current)
  }
  const handlers = {
    onLoad: markLoaded,
    onError: () => setFailures({ id, count: index + 1 }),
    // Images served from the cache can finish before React attaches onLoad.
    ref: (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) markLoaded()
    }
  }

  // A landscape header shown in a portrait slot: blur it behind itself instead of cropping the title.
  if (kind === 'cover' && current === 'header') {
    return (
      <div className={cx('relative overflow-hidden bg-sunken', className)}>
        <img
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          className={cx(
            'absolute inset-0 h-full w-full scale-150 object-cover blur-2xl transition-opacity duration-300',
            loaded ? 'opacity-70' : 'opacity-0'
          )}
        />
        <div className="absolute inset-0 bg-black/25" />
        <img
          key={src}
          src={src}
          alt={name}
          draggable={false}
          loading="lazy"
          decoding="async"
          className={cx(
            'absolute inset-x-0 top-1/2 w-full -translate-y-1/2 shadow-lg transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          {...handlers}
        />
      </div>
    )
  }

  return (
    <div className={cx('relative overflow-hidden bg-sunken', className)}>
      <img
        key={src}
        src={src}
        alt={name}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={cx('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        {...handlers}
      />
    </div>
  )
}

export function ArtPlaceholder({
  appid,
  name,
  className,
  tall
}: {
  appid: number
  name: string
  className?: string
  tall?: boolean
}) {
  const hue = (appid * 47) % 360
  return (
    <div
      className={cx('relative flex items-center justify-center overflow-hidden p-4 text-center', className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 38% 28%), hsl(${(hue + 50) % 360} 45% 13%))` }}
    >
      <span
        className={cx(
          'font-semibold tracking-tight text-white/90',
          tall ? 'line-clamp-4 text-base' : 'line-clamp-2 text-sm'
        )}
      >
        {name}
      </span>
    </div>
  )
}

/** The app's mark: a "next" symbol in a rounded square. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs>
        <linearGradient id="nextup-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9284fa" />
          <stop offset="1" stopColor="#5842e6" />
        </linearGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#nextup-mark)" />
      <path d="M168 166 L306 256 L168 346 Z" fill="#fff" stroke="#fff" strokeWidth="28" strokeLinejoin="round" />
      <rect x="322" y="156" width="42" height="200" rx="18" fill="#fff" />
    </svg>
  )
}

export function Avatar({ account, size = 28, className }: { account: Account; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!account.avatarUrl || failed) {
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-text',
          className
        )}
      >
        {account.name.trim().charAt(0).toUpperCase() || '?'}
      </div>
    )
  }
  return (
    <img
      src={account.avatarUrl}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      className={cx('shrink-0 rounded-full object-cover ring-1 ring-line', className)}
    />
  )
}
