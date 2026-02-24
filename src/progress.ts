import type { HeroId, StageId } from './heroes'

export type GameProgress = {
  torrentKeyPiece: boolean
  volcanoManRescued: boolean
  cavernMapPiece: boolean
  icemeckelRescued: boolean
  bloodyMapPiece: boolean
  swirlExanimoRescued: boolean
  lavaBogMap: boolean
  selectedHeroId: HeroId
  pendingStageId: StageId | null
  pendingStageSceneKey: string | null
}

const STORAGE_KEY = 'dungeon_busters_progress_v1'

const defaultProgress: GameProgress = {
  torrentKeyPiece: false,
  volcanoManRescued: false,
  cavernMapPiece: false,
  icemeckelRescued: false,
  bloodyMapPiece: false,
  swirlExanimoRescued: false,
  lavaBogMap: false,
  selectedHeroId: 'MICRALIS',
  pendingStageId: null,
  pendingStageSceneKey: null,
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
