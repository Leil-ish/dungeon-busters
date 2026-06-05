import type { HeroId, StageId } from './heroes'

export type GameProgress = {
  torrentKeyPiece: boolean
  volcanoManRescued: boolean
  cavernMapPiece: boolean
  icemeckelRescued: boolean
  bloodyMapPiece: boolean
  swirlExanimoRescued: boolean
  lavaBogMap: boolean
  illislimRescued: boolean
  hurricanoManRescued: boolean
  bouldereyeRescued: boolean
  lavaBogCleared: boolean
  gameCompleted: boolean
  forgeOfOriginsCleared: boolean
  devUnlockForgeOrigins: boolean
  meteorDodgeCleared: boolean
  flameRopeBossCleared: boolean
  clearedMinigames: Record<string, boolean>
  platformParts: number
  coins: number
  stage1ShopHealthBought: boolean
  selectedHeroId: HeroId
  pendingStageId: StageId | null
  pendingStageSceneKey: string | null
  remainingLives: number
}

const STORAGE_KEY = 'dungeon_busters_progress_v1'
export const MAX_LIVES = 5

const defaultProgress: GameProgress = {
  torrentKeyPiece: false,
  volcanoManRescued: false,
  cavernMapPiece: false,
  icemeckelRescued: false,
  bloodyMapPiece: false,
  swirlExanimoRescued: false,
  lavaBogMap: false,
  illislimRescued: false,
  hurricanoManRescued: false,
  bouldereyeRescued: false,
  lavaBogCleared: false,
  gameCompleted: false,
  forgeOfOriginsCleared: false,
  devUnlockForgeOrigins: false,
  meteorDodgeCleared: false,
  flameRopeBossCleared: false,
  clearedMinigames: {},
  platformParts: 0,
  coins: 0,
  stage1ShopHealthBought: false,
  selectedHeroId: 'MICRALIS',
  pendingStageId: null,
  pendingStageSceneKey: null,
  remainingLives: MAX_LIVES,
}

const loadGameProgress = (): GameProgress => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...defaultProgress }
    }
    const parsed = JSON.parse(raw) as Partial<GameProgress>
    return {
      ...defaultProgress,
      ...parsed,
      pendingStageId: null,
      pendingStageSceneKey: null,
    }
  } catch {
    return { ...defaultProgress }
  }
}

export const gameProgress: GameProgress = loadGameProgress()

export const saveGameProgress = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameProgress))
  } catch {
    // no-op for restricted storage environments
  }
}

export const resetLives = (): void => {
  gameProgress.remainingLives = MAX_LIVES
  saveGameProgress()
}

export const loseLife = (): number => {
  gameProgress.remainingLives = Math.max(0, gameProgress.remainingLives - 1)
  saveGameProgress()
  return gameProgress.remainingLives
}

export const getLivesDisplay = (): string => {
  const filled = '♥'.repeat(gameProgress.remainingLives)
  const empty = '♡'.repeat(Math.max(0, MAX_LIVES - gameProgress.remainingLives))
  return `${filled}${empty}`
}
