import { Search, SearchX } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import type { LibraryEntry } from '@shared/engine'
import { useApp, useEntries } from '../store'
import { CoverCard } from '../components/cards'
import { EmptyState, Segmented } from '../components/ui'

type Filter = 'all' | 'installed' | 'unplayed' | 'played'
type Sort = 'recent' | 'playtime' | 'name' | 'reviews'

const SORTERS: Record<Sort, (a: LibraryEntry, b: LibraryEntry) => number> = {
  recent: (a, b) => b.stats.lastPlayed - a.stats.lastPlayed || a.game.name.localeCompare(b.game.name),
  playtime: (a, b) => b.stats.playtime - a.stats.playtime || a.game.name.localeCompare(b.game.name),
  name: (a, b) => a.game.name.localeCompare(b.game.name, 'en', { sensitivity: 'base' }),
  reviews: (a, b) => (b.game.reviewPercent ?? -1) - (a.game.reviewPercent ?? -1)
}

export function Library() {
  const entries = useEntries()
  const settings = useApp((s) => s.settings)
  const openGame = useApp((s) => s.openGame)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const search = useDeferredValue(query.trim().toLowerCase())
  const hidden = useMemo(() => new Set(settings?.hiddenGames ?? []), [settings?.hiddenGames])

  const shown = useMemo(() => {
    const list = entries.filter((e) => {
      if (filter === 'installed' && !e.game.installed) return false
      if (filter === 'unplayed' && e.stats.playtime > 0) return false
      if (filter === 'played' && e.stats.playtime === 0) return false
      return !search || e.game.name.toLowerCase().includes(search)
    })
    return list.sort(SORTERS[sort])
  }, [entries, filter, sort, search])

  return (
    <div className="mx-auto max-w-[1180px] px-10 pt-9 pb-14">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">Library</h1>
        <span className="text-sm text-fg-subtle tabular-nums">{entries.length.toLocaleString('en')} games</span>
      </div>

      <div className="sticky top-0 z-10 -mx-10 mt-5 flex items-center gap-3 bg-panel/90 px-10 py-3 backdrop-blur">
        <label className="relative w-72">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="h-9 w-full rounded-lg bg-fill pr-3 pl-9 text-sm text-fg ring-1 ring-line-strong outline-none ring-inset placeholder:text-fg-subtle focus:ring-2 focus:ring-accent"
          />
        </label>
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'installed', label: 'Installed' },
            { value: 'unplayed', label: 'Unplayed' },
            { value: 'played', label: 'Played' }
          ]}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort by"
          className="ml-auto h-9 rounded-lg bg-fill px-3 text-[13px] font-medium text-fg ring-1 ring-line-strong outline-none ring-inset focus:ring-2 focus:ring-accent"
        >
          <option value="recent">Recently played</option>
          <option value="playtime">Most played</option>
          <option value="name">Name</option>
          <option value="reviews">Best reviewed</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="No games match" body="Try a different search or filter." />
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-7">
          {shown.map((entry) => (
            <CoverCard
              key={entry.game.appid}
              entry={entry}
              hidden={hidden.has(entry.game.appid)}
              onClick={() => openGame(entry.game.appid)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
