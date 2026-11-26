/**
 * How Steam tags relate to each answer. Tag names must match Steam's tag list
 * exactly (a test checks this), compared in lower case.
 */
export interface TagSignal {
  boost: readonly string[]
  penalize: readonly string[]
}

const QUICK = [
  'Arcade', 'Roguelike', 'Roguelite', 'Action Roguelike', 'Roguelike Deckbuilder', 'Puzzle', 'Casual',
  'Short', 'Card Game', 'Deckbuilding', 'Fighting', 'Racing', 'Rhythm', 'Party Game', 'Sports',
  'Score Attack', 'Bullet Hell', "Shoot 'Em Up", 'Platformer', 'Precision Platformer', 'Arena Shooter',
  'Pinball', 'Minigames', 'Board Game', 'Auto Battler', 'Word Game', 'Trivia', 'Typing', 'Match 3',
  'Twin Stick Shooter', 'Local Multiplayer'
]

const LONG = [
  'Open World', 'RPG', 'JRPG', 'CRPG', 'Grand Strategy', '4X', 'MMORPG', 'Massively Multiplayer',
  'Survival', 'Colony Sim', 'City Builder', 'Sandbox', 'Base Building', 'Farming Sim', 'Life Sim',
  'Management', 'Automation', 'Open World Survival Craft', 'Strategy RPG', 'Party-Based RPG',
  'Action RPG', 'Space Sim', 'Looter Shooter', 'Story Rich', 'Exploration'
]

export const TIME_SIGNALS: Record<string, TagSignal> = {
  quick: {
    boost: QUICK,
    penalize: ['Open World', 'RPG', 'JRPG', 'CRPG', 'Grand Strategy', '4X', 'MMORPG', 'City Builder',
      'Colony Sim', 'Story Rich', 'Visual Novel', 'Open World Survival Craft', 'Survival', 'Management']
  },
  hour: {
    boost: ['Action', 'Adventure', 'Shooter', 'FPS', 'Metroidvania', 'Roguelike', 'Roguelite',
      'Action Roguelike', 'Puzzle', 'Souls-like', 'Platformer', 'Hack and Slash', 'Tactical',
      'Immersive Sim', 'Roguelike Deckbuilder', 'Co-op'],
    penalize: ['MMORPG', 'Grand Strategy', '4X', 'Idler']
  },
  evening: {
    boost: ['Story Rich', 'RPG', 'Adventure', 'Open World', 'Strategy', 'Simulation', 'Survival',
      'City Builder', 'Sandbox', 'Exploration', 'Immersive Sim', 'Action RPG', 'Turn-Based Strategy',
      'Atmospheric', 'Base Building'],
    penalize: ['Arcade', 'Short', 'Party Game', 'Minigames', 'Pinball', 'Trivia']
  },
  weeks: {
    boost: LONG,
    penalize: ['Short', 'Arcade', 'Party Game', 'Minigames', 'Pinball', 'Trivia', 'Walking Simulator']
  }
}

export const MOOD_SIGNALS: Record<string, TagSignal> = {
  relax: {
    boost: ['Relaxing', 'Cozy', 'Casual', 'Farming Sim', 'Life Sim', 'Wholesome', 'Cute',
      'Family Friendly', 'Building', 'Walking Simulator', 'Exploration', 'Beautiful', 'Puzzle',
      'Hidden Object', 'Nature', 'Fishing', 'Colorful', 'Idler', 'Cats', 'Atmospheric'],
    penalize: ['Horror', 'Psychological Horror', 'Survival Horror', 'Difficult', 'Souls-like', 'Gore',
      'Violent', 'Competitive', 'PvP', 'Bullet Hell', 'Precision Platformer', 'Fast-Paced', 'Battle Royale']
  },
  think: {
    boost: ['Strategy', 'Tactical', 'Turn-Based Strategy', 'Turn-Based Tactics', 'Turn-Based Combat',
      'Deckbuilding', 'Card Game', 'Roguelike Deckbuilder', 'Puzzle', 'Logic', '4X', 'Grand Strategy',
      'RTS', 'Real Time Tactics', 'Tower Defense', 'Management', 'Automation', 'Programming', 'Chess',
      'Board Game', 'City Builder', 'Colony Sim', 'Resource Management', 'Economy', 'Wargame'],
    penalize: ['Walking Simulator', 'Hack and Slash', 'Beat \'em up', 'Visual Novel', 'Arcade']
  },
  action: {
    boost: ['Action', 'Shooter', 'FPS', 'Third-Person Shooter', 'Hack and Slash', 'Fast-Paced',
      'Bullet Hell', 'Fighting', 'Souls-like', 'Action Roguelike', 'Character Action Game', 'Combat',
      'Arena Shooter', 'Looter Shooter', "Beat 'em up", 'Battle Royale', 'Racing', 'Spectacle fighter',
      'Boomer Shooter', 'Twin Stick Shooter', 'Hero Shooter'],
    penalize: ['Relaxing', 'Walking Simulator', 'Visual Novel', 'Turn-Based Strategy', 'Turn-Based Tactics',
      'Management', 'Cozy', 'Farming Sim', 'Point & Click', 'Hidden Object']
  },
  story: {
    boost: ['Story Rich', 'Choices Matter', 'Visual Novel', 'Adventure', 'RPG', 'JRPG', 'CRPG',
      'Multiple Endings', 'Interactive Fiction', 'Mystery', 'Detective', 'Cinematic', 'Emotional',
      'Lore-Rich', 'Narrative', 'Dialogue Heavy', 'Dark Fantasy', 'Point & Click'],
    penalize: ['Arcade', 'Sports', 'Racing', 'PvP', 'Battle Royale', 'Sandbox', 'Automation',
      'Competitive', 'eSports', 'Party Game', 'Idler']
  },
  create: {
    boost: ['Sandbox', 'Building', 'Crafting', 'City Builder', 'Base Building', 'Automation',
      'Level Editor', 'Design & Illustration', 'Physics', 'Voxel', 'Colony Sim',
      'Open World Survival Craft', 'Programming', 'Management', 'Moddable', 'Farming Sim', 'Life Sim'],
    penalize: ['Linear', 'Visual Novel', 'On-Rails Shooter', 'Arena Shooter', 'Fighting', 'Racing',
      'Shooter', 'FPS', 'Third-Person Shooter', 'Hack and Slash']
  },
  spooky: {
    boost: ['Horror', 'Psychological Horror', 'Survival Horror', 'Dark', 'Thriller', 'Zombies',
      'Lovecraftian', 'Gothic', 'Mystery', 'Supernatural', 'Dark Fantasy', 'Psychological', 'Demons',
      'Atmospheric', 'Vampires'],
    penalize: ['Cute', 'Family Friendly', 'Wholesome', 'Cozy', 'Relaxing', 'Colorful', 'Sports',
      'Racing', 'Farming Sim', 'Funny']
  }
}

/** Games you usually play through to an end. */
export const COMPLETABLE = ['Story Rich', 'Adventure', 'RPG', 'JRPG', 'Action-Adventure', 'Metroidvania',
  'Platformer', 'Puzzle', 'Visual Novel', 'Linear', 'Souls-like', 'Immersive Sim', 'Point & Click',
  'Walking Simulator', 'CRPG', 'Action RPG', 'Narrative']

/** Games with no real end, which "finish what I started" shouldn't push. */
export const ENDLESS = ['Massively Multiplayer', 'MMORPG', 'PvP', 'Battle Royale', 'Competitive', 'eSports',
  'Sandbox', 'Open World Survival Craft', 'MOBA', 'Idler', 'Clicker', 'Hero Shooter']

export const COOP_TAGS = ['Co-op', 'Online Co-Op', 'Local Co-Op', 'Co-op Campaign']
export const PVP_TAGS = ['PvP', 'Competitive', 'eSports', 'Battle Royale', 'MOBA', 'Hero Shooter', 'Arena Shooter']
export const SINGLEPLAYER_TAGS = ['Singleplayer']
export const MULTIPLAYER_ONLY_TAGS = ['Massively Multiplayer', 'MMORPG', 'Battle Royale', 'MOBA']

/** Tags too broad to say much about taste. */
export const GENERIC_TAGS = ['Indie', 'Singleplayer', 'Great Soundtrack', 'Multiplayer', 'Free to Play',
  'Early Access', '2D', '3D', 'Colorful', 'Funny', 'Atmospheric', 'Casual', 'Action', 'Adventure',
  'Simulation', 'Strategy', 'Classic', 'Masterpiece', 'Beautiful', 'Stylized', 'Pixel Graphics',
  'Cartoony', 'Realistic', 'First-Person', 'Third Person', 'Controller', 'Steam Achievements',
  'Fantasy', 'Sci-fi', 'Female Protagonist', 'Family Friendly', 'Cute', 'Retro', 'Old School',
  'Difficult', 'Replay Value', 'Hand-drawn', 'Anime', 'Violent', 'Gore', 'Mature']

const lower = (list: readonly string[]): Set<string> => new Set(list.map((t) => t.toLowerCase()))

export const SETS = {
  completable: lower(COMPLETABLE),
  endless: lower(ENDLESS),
  coop: lower(COOP_TAGS),
  pvp: lower(PVP_TAGS),
  singleplayer: lower(SINGLEPLAYER_TAGS),
  multiplayerOnly: lower(MULTIPLAYER_ONLY_TAGS),
  generic: lower(GENERIC_TAGS)
}

export function lowerSignal(signal: TagSignal): { boost: Set<string>; penalize: Set<string> } {
  return { boost: lower(signal.boost), penalize: lower(signal.penalize) }
}

/** Every tag name used above, so a test can check them against Steam's list. */
export function allSignalTags(): string[] {
  const out = new Set<string>()
  for (const group of [TIME_SIGNALS, MOOD_SIGNALS]) {
    for (const signal of Object.values(group)) {
      signal.boost.forEach((t) => out.add(t))
      signal.penalize.forEach((t) => out.add(t))
    }
  }
  for (const list of [COMPLETABLE, ENDLESS, COOP_TAGS, PVP_TAGS, SINGLEPLAYER_TAGS, MULTIPLAYER_ONLY_TAGS]) {
    list.forEach((t) => out.add(t))
  }
  return [...out]
}
