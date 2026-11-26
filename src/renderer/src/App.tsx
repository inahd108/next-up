import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import type { ResolvedTheme, ThemeSetting } from '@shared/types'
import { LogoMark } from './components/art'
import { GameDrawer } from './components/GameDrawer'
import { Sidebar, Toasts, TopBar } from './components/shell'
import { Spinner } from './components/ui'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { Quiz } from './screens/Quiz'
import { Results } from './screens/Results'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'
import { useApp, type View } from './store'

function useTheme(setting: ThemeSetting | undefined): void {
  useEffect(() => {
    if (!setting) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const resolved: ResolvedTheme = setting === 'system' ? (media.matches ? 'dark' : 'light') : setting
      document.documentElement.dataset.theme = resolved
      void window.api.setTheme(resolved)
    }
    apply()
    if (setting !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [setting])
}

const SCREENS: Record<Exclude<View, 'loading' | 'welcome'>, () => ReactNode> = {
  home: () => <Home />,
  quiz: () => <Quiz />,
  results: () => <Results />,
  library: () => <Library />,
  settings: () => <Settings />
}

function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <LogoMark size={48} />
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner size={15} /> Reading your Steam library
      </div>
    </div>
  )
}

export function App() {
  const view = useApp((s) => s.view)
  const theme = useApp((s) => s.settings?.theme)
  const init = useApp((s) => s.init)

  useTheme(theme)

  useEffect(() => {
    void init()
  }, [init])

  if (view === 'loading' || view === 'welcome') {
    return (
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="min-h-0 flex-1">{view === 'loading' ? <Loading /> : <Welcome />}</div>
        <Toasts />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-2xl border-t border-l border-line bg-panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="h-full overflow-y-auto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {SCREENS[view]()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <GameDrawer />
      <Toasts />
    </div>
  )
}
