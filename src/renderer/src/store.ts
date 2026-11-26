import { useMemo } from 'react'
import { create } from 'zustand'
import {
  activeAccountIds,
  buildEntries,
  QUESTIONS,
  recommend,
  type Answers,
  type LibraryEntry,
  type QuestionId,
  type Recommendation
} from '@shared/engine'
import type { EditableSettings, LibrarySnapshot, SettingsView, SyncProgress } from '@shared/types'

export type View = 'loading' | 'welcome' | 'home' | 'quiz' | 'results' | 'library' | 'settings'
export type ToastTone = 'neutral' | 'good' | 'warn' | 'danger'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface AppState {
  view: View
  snapshot: LibrarySnapshot | null
  settings: SettingsView | null
  online: boolean
  sync: SyncProgress | null
  answers: Answers
  step: number
  results: Recommendation[]
  /** Games skipped with "Not tonight" during this round of picks. */
  skipped: number[]
  seed: number
  drawer: number | null
  toasts: Toast[]

  init(): Promise<void>
  go(view: View): void
  startQuiz(): void
  editAnswers(): void
  answer(question: QuestionId, option: string): void
  back(): void
  skipQuestion(): void
  surpriseMe(): void
  notTonight(appid: number): void
  promote(appid: number): void
  neverSuggest(appid: number): Promise<void>
  allowSuggest(appid: number): Promise<void>
  openGame(appid: number): void
  closeGame(): void
  updateSettings(patch: Partial<EditableSettings>): Promise<void>
  setSettings(settings: SettingsView): void
  runSync(): Promise<void>
  toast(message: string, tone?: ToastTone): void
  dismissToast(id: number): void
}

const newSeed = (): number => Math.floor(Math.random() * 1_000_000)

/** Library entries for the accounts currently switched on. */
export function selectEntries(snapshot: LibrarySnapshot | null, settings: SettingsView | null): LibraryEntry[] {
  if (!snapshot) return []
  return buildEntries(snapshot.games, activeAccountIds(snapshot.accounts, settings?.excludedAccounts ?? []))
}

export function useEntries(): LibraryEntry[] {
  const snapshot = useApp((s) => s.snapshot)
  const settings = useApp((s) => s.settings)
  return useMemo(() => selectEntries(snapshot, settings), [snapshot, settings])
}

let toastId = 0

export const useApp = create<AppState>((set, get) => {
  const computeResults = (): void => {
    const { snapshot, settings, answers, skipped, seed } = get()
    const results = recommend(selectEntries(snapshot, settings), answers, {
      hidden: new Set(settings?.hiddenGames ?? []),
      exclude: new Set(skipped),
      seed,
      limit: 4
    })
    set({ results })
  }

  const finish = (): void => {
    set({ skipped: [], seed: newSeed() })
    computeResults()
    set({ view: 'results' })
  }

  return {
    view: 'loading',
    snapshot: null,
    settings: null,
    online: navigator.onLine,
    sync: null,
    answers: {},
    step: 0,
    results: [],
    skipped: [],
    seed: newSeed(),
    drawer: null,
    toasts: [],

    async init() {
      window.api.onSnapshot((snapshot) => {
        set({ snapshot })
      })
      window.api.onSyncProgress((sync) => {
        set({ sync })
        if (sync.phase === 'done' || sync.phase === 'error') {
          setTimeout(() => {
            if (get().sync === sync) set({ sync: null })
          }, 1500)
        }
      })
      window.addEventListener('online', () => set({ online: true }))
      window.addEventListener('offline', () => set({ online: false }))

      const [snapshot, settings] = await Promise.all([window.api.getSnapshot(), window.api.getSettings()])
      set({ snapshot, settings, view: settings.onboarded ? 'home' : 'welcome' })
    },

    go(view) {
      set({ view, drawer: null })
    },

    startQuiz() {
      set({ answers: {}, step: 0, view: 'quiz', drawer: null })
    },

    editAnswers() {
      set({ step: 0, view: 'quiz' })
    },

    answer(question, option) {
      const answers = { ...get().answers, [question]: option }
      const step = get().step
      set({ answers })
      if (step < QUESTIONS.length - 1) set({ step: step + 1 })
      else finish()
    },

    back() {
      const step = get().step
      if (step > 0) set({ step: step - 1 })
      else set({ view: 'home' })
    },

    skipQuestion() {
      const { step, answers } = get()
      const id = QUESTIONS[step].id
      const next = { ...answers }
      delete next[id]
      set({ answers: next })
      if (step < QUESTIONS.length - 1) set({ step: step + 1 })
      else finish()
    },

    surpriseMe() {
      set({ answers: {}, drawer: null })
      finish()
    },

    notTonight(appid) {
      set({ skipped: [...get().skipped, appid] })
      computeResults()
    },

    promote(appid) {
      const results = [...get().results]
      const index = results.findIndex((r) => r.entry.game.appid === appid)
      if (index <= 0) return
      const [picked] = results.splice(index, 1)
      set({ results: [picked, ...results] })
    },

    async neverSuggest(appid) {
      const settings = get().settings
      if (!settings) return
      const name = get().snapshot?.games.find((g) => g.appid === appid)?.name ?? 'That game'
      await get().updateSettings({ hiddenGames: [...settings.hiddenGames, appid] })
      if (get().results.some((r) => r.entry.game.appid === appid)) computeResults()
      get().toast(`${name} won't be suggested again. You can undo this in Settings.`)
    },

    async allowSuggest(appid) {
      const settings = get().settings
      if (!settings) return
      await get().updateSettings({ hiddenGames: settings.hiddenGames.filter((id) => id !== appid) })
    },

    openGame(appid) {
      set({ drawer: appid })
    },

    closeGame() {
      set({ drawer: null })
    },

    async updateSettings(patch) {
      const settings = await window.api.updateSettings(patch)
      set({ settings })
    },

    setSettings(settings) {
      set({ settings })
    },

    async runSync() {
      const outcome = await window.api.sync()
      get().toast(outcome.message, outcome.ok ? 'good' : outcome.offline ? 'warn' : 'danger')
    },

    toast(message, tone = 'neutral') {
      const id = ++toastId
      set({ toasts: [...get().toasts, { id, message, tone }] })
      setTimeout(() => get().dismissToast(id), 5000)
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }
  }
})
