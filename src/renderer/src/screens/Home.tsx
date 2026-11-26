import { Clock, Dices, Gamepad2, HardDrive, Library, RefreshCw, Settings, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { libraryStats, recommend, type LibraryEntry } from '@shared/engine'
import { formatHours } from '@shared/format'
import { useApp, useEntries } from '../store'
import { GameArt } from '../components/art'
import { CoverCard, WideCard } from '../components/cards'
import { Button, Chip, EmptyState, SectionTitle } from '../components/ui'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Up late?'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="rounded-2xl bg-raised p-4 ring-1 ring-line">
      <div className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Icon size={15} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</div>
    </div>
  )
}

function Collage({ entries }: { entries: LibraryEntry[] }) {
  const transforms = [
    'translate-x-[-78px] rotate-[-9deg] translate-y-3',
    'z-10 -translate-y-1',
    'translate-x-[78px] rotate-[9deg] translate-y-3'
  ]
  return (
    <div className="relative hidden h-[196px] w-[300px] items-center justify-center lg:flex" aria-hidden>
      {entries.slice(0, 3).map((entry, i) => (
        <div key={entry.game.appid} className={`absolute ${transforms[i]}`}>
          <GameArt
            appid={entry.game.appid}
            name={entry.game.name}
            kind="cover"
            className="h-[180px] w-[120px] rounded-xl shadow-card ring-1 ring-white/10"
          />
        </div>
      ))}
    </div>
  )
}

export function Home() {
  const entries = useEntries()
  const settings = useApp((s) => s.settings)
  const online = useApp((s) => s.online)
  const startQuiz = useApp((s) => s.startQuiz)
  const surpriseMe = useApp((s) => s.surpriseMe)
  const openGame = useApp((s) => s.openGame)
  const runSync = useApp((s) => s.runSync)
  const go = useApp((s) => s.go)

  const stats = useMemo(() => libraryStats(entries), [entries])

  const recent = useMemo(
    () =>
      entries
        .filter((e) => e.stats.lastPlayed > 0)
        .sort((a, b) => b.stats.lastPlayed - a.stats.lastPlayed)
        .slice(0, 4),
    [entries]
  )

  const backlog = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000)
    return recommend(entries, { freshness: 'new' }, {
      hidden: new Set(settings?.hiddenGames ?? []),
      seed: day,
      limit: 6
    })
      .filter((r) => r.entry.stats.playtime < 60)
      .map((r) => r.entry)
  }, [entries, settings?.hiddenGames])

  const collage = useMemo(() => {
    const byPlaytime = [...entries].sort((a, b) => b.stats.playtime - a.stats.playtime)
    return byPlaytime.slice(0, 3)
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-[1120px] px-10 py-9">
        <EmptyState
          icon={Library}
          title="No games found yet"
          body="Next up couldn’t find any games for the accounts that are switched on. Sync with Steam, or check your accounts and Steam folder in Settings."
        >
          {online && (
            <Button icon={RefreshCw} onClick={runSync}>
              Sync now
            </Button>
          )}
          <Button variant="ghost" icon={Settings} onClick={() => go('settings')}>
            Open settings
          </Button>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1120px] px-10 pt-9 pb-14">
      <p className="text-sm text-fg-muted">{greeting()}</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-fg">What are you playing next?</h1>

      <section className="relative mt-7 flex items-center justify-between gap-8 overflow-hidden rounded-3xl bg-raised p-9 ring-1 ring-line">
        <div className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-32 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative max-w-[440px]">
          <Chip tone="accent" icon={Sparkles}>
            6 quick questions
          </Chip>
          <h2 className="mt-4 text-[26px] leading-tight font-semibold tracking-tight text-fg">
            Let’s find you something to play
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-fg-muted">
            Tell it your mood, how long you’ve got and who you’re playing with. You’ll get one strong pick from your
            library, plus a few backups.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" size="lg" icon={Sparkles} onClick={startQuiz}>
              Find a game
            </Button>
            <Button size="lg" icon={Dices} onClick={surpriseMe}>
              Surprise me
            </Button>
          </div>
        </div>
        <Collage entries={collage} />
      </section>

      <div className="mt-5 grid grid-cols-4 gap-4">
        <StatTile label="Games" value={stats.total.toLocaleString('en')} icon={Library} />
        <StatTile label="Never played" value={stats.unplayed.toLocaleString('en')} icon={Gamepad2} />
        <StatTile label="Hours played" value={formatHours(stats.minutes)} icon={Clock} />
        <StatTile label="Installed" value={stats.installed.toLocaleString('en')} icon={HardDrive} />
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <SectionTitle title="Jump back in" />
          <div className="grid grid-cols-4 gap-4">
            {recent.map((entry) => (
              <WideCard key={entry.game.appid} entry={entry} onClick={() => openGame(entry.game.appid)} />
            ))}
          </div>
        </section>
      )}

      {backlog.length > 0 && (
        <section className="mt-10">
          <SectionTitle
            title="Waiting in your backlog"
            action={
              <Button size="sm" variant="ghost" onClick={() => go('library')}>
                See library
              </Button>
            }
          />
          <div className="grid grid-cols-6 gap-4">
            {backlog.map((entry) => (
              <CoverCard
                key={entry.game.appid}
                entry={entry}
                onClick={() => openGame(entry.game.appid)}
                meta={
                  entry.game.reviewPercent !== null
                    ? `${entry.game.reviewPercent}% positive`
                    : entry.stats.playtime > 0
                      ? 'Barely started'
                      : 'Unplayed'
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
