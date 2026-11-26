import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check } from 'lucide-react'
import { useEffect } from 'react'
import { QUESTIONS } from '@shared/engine'
import { OPTION_ICONS } from '../icons'
import { useApp } from '../store'
import { Button, cx, Kbd } from '../components/ui'

export function Quiz() {
  const step = useApp((s) => s.step)
  const answers = useApp((s) => s.answers)
  const answer = useApp((s) => s.answer)
  const back = useApp((s) => s.back)
  const skip = useApp((s) => s.skipQuestion)
  const question = QUESTIONS[step]

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return
      const index = Number(event.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < question.options.length) {
        event.preventDefault()
        answer(question.id, question.options[index].id)
      } else if (event.key === 'Backspace' || event.key === 'Escape') {
        event.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, answer, back])

  const columns = question.options.length > 4 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className="mx-auto flex min-h-full max-w-[860px] flex-col px-10 pt-8 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={back} className="-ml-3">
          Back
        </Button>
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {QUESTIONS.map((q, i) => (
            <div key={q.id} className="h-1 flex-1 overflow-hidden rounded-full bg-fill-strong">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          ))}
        </div>
        <span className="w-24 text-right text-[13px] text-fg-subtle tabular-nums">
          {step + 1} of {QUESTIONS.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-14 flex-1"
        >
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-fg">{question.title}</h1>
          <p className="mt-2 text-[15px] text-fg-muted">{question.subtitle}</p>

          <div className={cx('mt-9 grid gap-3', columns)} role="radiogroup" aria-label={question.title}>
            {question.options.map((option, index) => {
              const Icon = OPTION_ICONS[option.icon]
              const selected = answers[question.id] === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => answer(question.id, option.id)}
                  className={cx(
                    'group relative flex flex-col items-start rounded-2xl p-5 text-left ring-1 transition duration-150',
                    selected
                      ? 'bg-accent-soft ring-2 ring-accent'
                      : 'bg-raised ring-line hover:-translate-y-0.5 hover:shadow-card hover:ring-line-strong'
                  )}
                >
                  <div
                    className={cx(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                      selected ? 'bg-accent text-on-accent' : 'bg-fill text-fg-muted group-hover:text-fg'
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="mt-5 text-[15px] font-medium text-fg">{option.label}</div>
                  <div className="mt-0.5 text-[13px] text-fg-muted">{option.hint}</div>
                  <div className="absolute top-4 right-4">
                    {selected ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <Kbd>{index + 1}</Kbd>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between text-[13px] text-fg-subtle">
        <span>
          Press <Kbd>1</Kbd>–<Kbd>{question.options.length}</Kbd> to choose
        </span>
        <Button variant="ghost" size="sm" onClick={skip}>
          Skip question
        </Button>
      </div>
    </div>
  )
}
