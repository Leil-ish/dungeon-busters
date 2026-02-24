import type { HeroId, StageId } from './heroes'

export type GameProgress = {
  torrentKeyPiece: boolean
  volcanoManRescued: boolean
  cavernMapPiece: boolean
  icemeckelRescued: boolean
  bloodyMapPiece: boolean
  selectedHeroId: HeroId
  pendingStageId: StageId | null
  pendingStageSceneKey: string | null
}

export const gameProgress: GameProgress = {
  torrentKeyPiece: false,
  volcanoManRescued: false,
  cavernMapPiece: false,
  icemeckelRescued: false,
  bloodyMapPiece: false,
  selectedHeroId: 'MICRALIS',
  pendingStageId: null,
  pendingStageSceneKey: null,
}
