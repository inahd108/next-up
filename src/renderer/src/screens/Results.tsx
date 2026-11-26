import { AnimatePresence, motion } from 'motion/react'
import { Dices, EyeOff, Info, RefreshCw, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { answerLabel, isSurprise, QUESTIONS, type Recommendation } from '@shared/engine'
import { formatBytes } from '@shared/format'
import { REASON_ICONS } from '../icons'
import { useApp } from '../store'
import { artUrl, GameArt } from '../components/art'
import { playSummary, WideCard } from '../components/cards'
import { PlayButton } from '../components/GameDrawer'
import { Button, Chip, EmptyState, SectionTitle } from '../components/ui'

function Hero({ pick }: { pick: Recommendation }) {
  const { game } = pick.entry
  const [heroKind, setHeroKind] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <div className="relative h-[300px] overflow-hidden">
      <GameArt
        appid={game.appid}
        name={game.name}
        kind="hero"
        className="absolute inset-0 h-full w-full"
        onResolved={setHeroKind}
      />
      <div className="absolute inset-0 bg-linear-to-t from-raised via-raised/25 to-transparent" />
      {heroKind === 'hero' && !logoFailed && (
        <img
          src={artUrl(game.appid, 'logo')}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setLogoFailed(true)}
          className="absolute bottom-8 left-8 max-h-[110px] max-w-[380px] object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        />
      )}
      <div className="absolute top-5 right-5 rounded-2xl bg-black/55 px-4 py-2.5 text-right text-white ring-1 ring-white/10 backdrop-blur-md">
        <div className="text-[26px] leading-none font-semibold tabular-nums">{pick.match}%</div>
        <div className="mt-1 text-[11px] font-medium tracking-wider text-white/70 uppercase">match</div>
      </div>
    </div>
  )
}

export function Results() {
  const results = useApp((s) => s.results)
  const answers = useApp((s) => s.answers)
  const editAnswers = useApp((s) => s.editAnswers)
  const startQuiz = useApp((s) => s.startQuiz)
  const surpriseMe = useApp((s) => s.surpriseMe)
  const notTonight = useApp((s) => s.notTonight)
  const promote = useApp((s) => s.promote)
  const neverSuggest = useApp((s) => s.neverSuggest)
  const openGame = useApp((s) => s.openGame)

  const [pick, ...others] = results
  const surprise = isSurprise(answers)
  const chips = QUESTIONS.map((q) => (answers[q.id] ? answerLabel(q.id, answers[q.id]!) : null)).filter(
    (c): c is string => c !== null
  )

  if (!pick) {
    return (
      <div className="mx-auto max-w-[1120px] px-10 py-9">
        <EmptyState
          icon={SearchX}
          title="Nothing fits those answers"
          body={
            answers.ready === 'installed'
              ? 'None of your installed games match. Try allowing games you’d need to download.'
              : 'Every game that fits has been skipped or hidden. Try changing an answer or two.'
          }
        >
          <Button icon={SlidersHorizontal} onClick={editAnswers}>
            Change answers
          </Button>
          <Button variant="ghost" icon={Dices} onClick={surpriseMe}>
            Surprise me
          </Button>
        </EmptyState>
      </div>
    )
  }

  const { game, stats } = pick.entry
  const meta = [
    game.developer,
    game.releaseYear,
    playSummary(pick.entry),
    game.installed ? `Installed · ${formatBytes(game.sizeOnDisk)}` : 'Not installed'
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-[1120px] px-10 pt-8 pb-14">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">Your pick</h1>
          {chips.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Chip key={chip}>{chip}</Chip>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">
              {surprise ? 'A surprise from your library, based on what you play most.' : 'Based on your answers.'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" icon={SlidersHorizontal} onClick={editAnswers}>
            Change answers
          </Button>
          <Button icon={RotateCcw} onClick={startQuiz}>
            Start over
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={game.appid}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-6 overflow-hidden rounded-3xl bg-raised ring-1 ring-line"
        >
          <Hero pick={pick} />
          <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-10 px-8 pt-1 pb-8">
            <div className="min-w-0">
              <h2 className="text-[28px] leading-tight font-semibold tracking-tight text-fg">{game.name}</h2>
              <p className="mt-1.5 text-sm text-fg-muted">{meta.join(' · ')}</p>

              <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
                {pick.reasons.map((reason) => {
                  const Icon = REASON_ICONS[reason.kind]
                  return (
                    <li key={reason.text} className="flex items-center gap-3 text-sm text-fg">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">{reason.text}</span>
                    </li>
                  )
                })}
              </ul>

              {game.description && (
                <p className="mt-6 line-clamp-3 max-w-[640px] text-sm leading-relaxed text-fg-muted">
                  {game.description}
                </p>
              )}
              {game.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {game.tags.slice(0, 6).map((tag) => (
                    <Chip key={tag}>{tag}</Chip>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-3">
              <PlayButton entry={pick.entry} size="lg" className="w-full" />
              <Button size="lg" icon={RefreshCw} onClick={() => notTonight(game.appid)}>
                Not tonight
              </Button>
              <div className="mt-1 flex items-center justify-between">
                <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => neverSuggest(game.appid)}>
                  Never suggest
                </Button>
                <Button variant="ghost" size="sm" icon={Info} onClick={() => openGame(game.appid)}>
                  Details
                </Button>
              </div>
              {!game.installed && (
                <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
                  Install opens Steam to download it{stats.playtime > 0 ? ' again' : ''}.
                </p>
              )}
            </div>
          </div>
        </motion.article>
      </AnimatePresence>

      {others.length > 0 && (
        <section className="mt-10">
          <SectionTitle title="Also worth a look" />
          <div className="grid grid-cols-3 gap-4">
            {others.map((rec) => {
              const Icon = REASON_ICONS[rec.reasons[0].kind]
              return (
                <WideCard
                  key={rec.entry.game.appid}
                  entry={rec.entry}
                  onClick={() => promote(rec.entry.game.appid)}
                  meta={`${rec.match}% match · ${playSummary(rec.entry)}`}
                  footer={
                    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                      <Icon size={13} className="text-accent-text" />
                      {rec.reasons[0].text}
                    </span>
                  }
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
