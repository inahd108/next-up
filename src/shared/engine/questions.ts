export type QuestionId = 'time' | 'mood' | 'players' | 'freshness' | 'ready' | 'input'

export type IconName =
  | 'timer'
  | 'clock'
  | 'moon'
  | 'calendar'
  | 'leaf'
  | 'brain'
  | 'zap'
  | 'book'
  | 'hammer'
  | 'ghost'
  | 'user'
  | 'users'
  | 'swords'
  | 'shuffle'
  | 'sparkles'
  | 'history'
  | 'heart'
  | 'dices'
  | 'hardDrive'
  | 'download'
  | 'keyboard'
  | 'gamepad'
  | 'handheld'

export interface QuestionOption {
  id: string
  label: string
  hint: string
  icon: IconName
}

export interface Question {
  id: QuestionId
  title: string
  subtitle: string
  options: QuestionOption[]
}

export type Answers = Partial<Record<QuestionId, string>>

export const QUESTIONS: Question[] = [
  {
    id: 'time',
    title: 'How much time have you got?',
    subtitle: 'The pick will suit the length of your session.',
    options: [
      { id: 'quick', label: 'A quick session', hint: 'Under 30 minutes', icon: 'timer' },
      { id: 'hour', label: 'An hour or two', hint: 'A proper sit-down', icon: 'clock' },
      { id: 'evening', label: 'The whole evening', hint: 'Settle in for a while', icon: 'moon' },
      { id: 'weeks', label: 'Something to sink into', hint: 'A game for the coming weeks', icon: 'calendar' }
    ]
  },
  {
    id: 'mood',
    title: 'What are you in the mood for?',
    subtitle: 'Pick whichever fits right now.',
    options: [
      { id: 'relax', label: 'Chill and relaxing', hint: 'Low stress, good vibes', icon: 'leaf' },
      { id: 'think', label: 'Something to think about', hint: 'Strategy, tactics and puzzles', icon: 'brain' },
      { id: 'action', label: 'Action and adrenaline', hint: 'Fast and intense', icon: 'zap' },
      { id: 'story', label: 'A good story', hint: 'Characters and worlds', icon: 'book' },
      { id: 'create', label: 'Build and create', hint: 'Sandbox, crafting and building', icon: 'hammer' },
      { id: 'spooky', label: 'Something spooky', hint: 'Horror and dark atmosphere', icon: 'ghost' }
    ]
  },
  {
    id: 'players',
    title: 'Playing solo or with others?',
    subtitle: 'Multiplayer picks need friends or matchmaking online.',
    options: [
      { id: 'solo', label: 'Just me', hint: 'Single-player', icon: 'user' },
      { id: 'coop', label: 'With friends', hint: 'Co-op, on the same team', icon: 'users' },
      { id: 'pvp', label: 'Against others', hint: 'Competitive multiplayer', icon: 'swords' },
      { id: 'any', label: 'No preference', hint: 'Anything goes', icon: 'shuffle' }
    ]
  },
  {
    id: 'freshness',
    title: 'Something new or something familiar?',
    subtitle: 'Your playtime decides what counts as new.',
    options: [
      { id: 'new', label: 'Something new', hint: "Games you haven't really played", icon: 'sparkles' },
      { id: 'continue', label: 'Finish what I started', hint: 'Games you got into, then left', icon: 'history' },
      { id: 'favourite', label: 'An old favourite', hint: 'Your most-played games', icon: 'heart' },
      { id: 'any', label: 'Surprise me', hint: 'New or old, whatever fits', icon: 'dices' }
    ]
  },
  {
    id: 'ready',
    title: 'Ready to play right now?',
    subtitle: 'Downloading opens up your whole library.',
    options: [
      { id: 'installed', label: 'Installed games only', hint: 'Play in seconds', icon: 'hardDrive' },
      { id: 'any', label: "I don't mind downloading", hint: 'Include your whole library', icon: 'download' }
    ]
  },
  {
    id: 'input',
    title: 'How are you playing?',
    subtitle: 'Controller and Steam Deck picks favour games that support them.',
    options: [
      { id: 'kbm', label: 'Keyboard and mouse', hint: 'At the desk', icon: 'keyboard' },
      { id: 'controller', label: 'Controller', hint: 'On the couch', icon: 'gamepad' },
      { id: 'deck', label: 'Steam Deck', hint: 'Handheld', icon: 'handheld' },
      { id: 'any', label: 'Whatever works', hint: 'No preference', icon: 'shuffle' }
    ]
  }
]

/** Short label for an answer, for the summary chips on the result screen. */
export function answerLabel(question: QuestionId, optionId: string): string | null {
  const q = QUESTIONS.find((item) => item.id === question)
  const option = q?.options.find((o) => o.id === optionId)
  if (!option || optionId === 'any') return null
  return option.label
}
