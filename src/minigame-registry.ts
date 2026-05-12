import Phaser from 'phaser'
import { gameProgress } from './progress'

export type MinigameMode = 'meteor' | 'rope' | 'rune' | 'timing' | 'memory' | 'chase' | 'waterfall'
export type EntranceKind = 'house' | 'castle'

export type MinigameDefinition = {
  id: string
  stageKey: string
  title: string
  shortLabel: string
  subtitle: string
  mode: MinigameMode
  kind: EntranceKind
  x: number
  y: number
  rewardParts: number
}

export const MINIGAMES: MinigameDefinition[] = [
  { id: 's1-meteor-house', stageKey: 'stage1', title: 'Meteor Dodge House', shortLabel: 'Meteor House', subtitle: 'Dodge monster meteors and grab platform cores.', mode: 'meteor', kind: 'house', x: 420, y: 788, rewardParts: 4 },
  { id: 's1-rune-house', stageKey: 'stage1', title: 'Water Rune Switch', shortLabel: 'Rune House', subtitle: 'Repeat the monster rune pattern to unlock planks.', mode: 'memory', kind: 'house', x: 760, y: 668, rewardParts: 5 },
  { id: 's1-spring-house', stageKey: 'stage1', title: 'Spring Jump Trial', shortLabel: 'Spring House', subtitle: 'Jump the magic rope to charge spring planks.', mode: 'rope', kind: 'house', x: 1760, y: 668, rewardParts: 6 },
  { id: 's1-waterfall-castle', stageKey: 'stage1', title: 'Waterfall Rush Boss Castle', shortLabel: 'Falls Castle', subtitle: 'Watch the dotted warnings before the giant boss drops waterfalls.', mode: 'waterfall', kind: 'castle', x: 2160, y: 376, rewardParts: 7 },

  { id: 's2-rockfall-house', stageKey: 'rocky-caverns', title: 'Rockfall Dodge House', shortLabel: 'Rockfall House', subtitle: 'Dodge cave rocks and collect brace stones.', mode: 'meteor', kind: 'house', x: 520, y: 790, rewardParts: 4 },
  { id: 's2-crystal-house', stageKey: 'rocky-caverns', title: 'Crystal Lockpick House', shortLabel: 'Crystal House', subtitle: 'Stop the lock needle inside the crystal window.', mode: 'timing', kind: 'house', x: 1060, y: 650, rewardParts: 5 },
  { id: 's2-echo-house', stageKey: 'rocky-caverns', title: 'Echo Rope House', shortLabel: 'Echo House', subtitle: 'Hop the echo line as it speeds up.', mode: 'rope', kind: 'house', x: 1700, y: 610, rewardParts: 6 },
  { id: 's2-giant-castle', stageKey: 'rocky-caverns', title: 'Giant Hand Boss Castle', shortLabel: 'Giant Castle', subtitle: 'Steal keys while a giant hand chases you around.', mode: 'chase', kind: 'castle', x: 2300, y: 392, rewardParts: 8 },

  { id: 's3-blooddrop-house', stageKey: 'bloody-hills', title: 'Blooddrop Dodge House', shortLabel: 'Drop House', subtitle: 'Slip between falling red drops for platform nails.', mode: 'meteor', kind: 'house', x: 540, y: 804, rewardParts: 4 },
  { id: 's3-bone-house', stageKey: 'bloody-hills', title: 'Bone Memory House', shortLabel: 'Bone House', subtitle: 'Repeat the skeleton symbol chant.', mode: 'memory', kind: 'house', x: 980, y: 680, rewardParts: 5 },
  { id: 's3-vein-house', stageKey: 'bloody-hills', title: 'Vein Maze House', shortLabel: 'Vein House', subtitle: 'Steal heart keys while a vein monster hunts you.', mode: 'chase', kind: 'house', x: 1540, y: 620, rewardParts: 6 },
  { id: 's3-skeleton-castle', stageKey: 'bloody-hills', title: 'Skeleton Band Boss Castle', shortLabel: 'Band Castle', subtitle: 'Stop the beat needle inside the cursed rhythm window.', mode: 'timing', kind: 'castle', x: 2360, y: 392, rewardParts: 8 },

  { id: 's4-beam-house', stageKey: 'laser-alley', title: 'Beam Dodge House', shortLabel: 'Beam House', subtitle: 'Dodge falling beams and collect mirror parts.', mode: 'meteor', kind: 'house', x: 600, y: 772, rewardParts: 4 },
  { id: 's4-prism-house', stageKey: 'laser-alley', title: 'Prism Timing House', shortLabel: 'Prism House', subtitle: 'Hit Space when the beam crosses the safe prism.', mode: 'timing', kind: 'house', x: 1320, y: 594, rewardParts: 5 },
  { id: 's4-voltage-house', stageKey: 'laser-alley', title: 'Voltage Rope House', shortLabel: 'Volt House', subtitle: 'Leap over the electric cable.', mode: 'rope', kind: 'house', x: 2140, y: 380, rewardParts: 6 },
  { id: 's4-warden-castle', stageKey: 'laser-alley', title: 'Laser Jump Boss Castle', shortLabel: 'Laser Castle', subtitle: 'Jump the laser ropes launched by the alley boss.', mode: 'rope', kind: 'castle', x: 2860, y: 360, rewardParts: 8 },

  { id: 's5-cinder-house', stageKey: 'lava-bog', title: 'Cinder Dodge House', shortLabel: 'Cinder House', subtitle: 'Dodge cinders and gather heatproof braces.', mode: 'meteor', kind: 'house', x: 560, y: 794, rewardParts: 4 },
  { id: 's5-slime-house', stageKey: 'lava-bog', title: 'Slime Chase House', shortLabel: 'Slime House', subtitle: 'Grab keys while the slime splits after you.', mode: 'chase', kind: 'house', x: 1260, y: 690, rewardParts: 5 },
  { id: 's5-lava-rope-house', stageKey: 'lava-bog', title: 'Lava Rope House', shortLabel: 'Rope House', subtitle: 'Jump a molten rope across the bog.', mode: 'rope', kind: 'house', x: 2060, y: 520, rewardParts: 6 },
  { id: 's5-dragon-castle', stageKey: 'lava-bog', title: 'Dragon Breath Boss Castle', shortLabel: 'Dragon Castle', subtitle: 'Remember the dragon breath pattern.', mode: 'memory', kind: 'castle', x: 3000, y: 338, rewardParts: 9 },

  { id: 's6-forge-house', stageKey: 'forge-of-origins', title: 'Forge Spark House', shortLabel: 'Spark House', subtitle: 'Dodge forge sparks and claim origin plates.', mode: 'meteor', kind: 'house', x: 520, y: 790, rewardParts: 5 },
  { id: 's6-chroma-house', stageKey: 'forge-of-origins', title: 'Chroma Memory House', shortLabel: 'Chroma House', subtitle: 'Repeat the shifting origin pattern.', mode: 'memory', kind: 'house', x: 1200, y: 650, rewardParts: 6 },
  { id: 's6-fusion-house', stageKey: 'forge-of-origins', title: 'Fusion Rope House', shortLabel: 'Fusion House', subtitle: 'Jump the fusion strand before it overloads.', mode: 'rope', kind: 'house', x: 1980, y: 520, rewardParts: 7 },
  { id: 's6-origin-castle', stageKey: 'forge-of-origins', title: 'Origin Boss Castle', shortLabel: 'Origin Castle', subtitle: 'Beat a final chase through the origin vault.', mode: 'chase', kind: 'castle', x: 2920, y: 360, rewardParts: 10 },
]

export function getStageMinigames(stageKey: string): MinigameDefinition[] {
  return MINIGAMES.filter((minigame) => minigame.stageKey === stageKey)
}

export function getMinigame(id: string): MinigameDefinition {
  return MINIGAMES.find((minigame) => minigame.id === id) ?? MINIGAMES[0]
}

export function isMinigameCleared(id: string): boolean {
  if (id === 's1-meteor-house') {
    return gameProgress.meteorDodgeCleared || gameProgress.clearedMinigames[id] === true
  }
  if (id === 's1-flame-castle' || id === 's1-waterfall-castle') {
    return gameProgress.flameRopeBossCleared || gameProgress.clearedMinigames[id] === true
  }
  return gameProgress.clearedMinigames[id] === true
}

export function markMinigameCleared(id: string, rewardParts: number): boolean {
  const firstClear = !isMinigameCleared(id)
  gameProgress.clearedMinigames[id] = true
  if (id === 's1-meteor-house') {
    gameProgress.meteorDodgeCleared = true
  }
  if (id === 's1-flame-castle' || id === 's1-waterfall-castle') {
    gameProgress.flameRopeBossCleared = true
  }
  gameProgress.platformParts = Math.max(gameProgress.platformParts, rewardParts)
  return firstClear
}

export function drawMinigameShape(scene: Phaser.Scene, x: number, y: number, kind: EntranceKind, stroke: number): void {
  const g = scene.add.graphics()
  if (kind === 'house') {
    g.fillStyle(0x231b2f, 1)
    g.lineStyle(3, stroke, 1)
    g.fillTriangle(x - 34, y - 12, x, y - 48, x + 34, y - 12)
    g.strokeTriangle(x - 34, y - 12, x, y - 48, x + 34, y - 12)
    g.fillRoundedRect(x - 28, y - 12, 56, 54, 5)
    g.strokeRoundedRect(x - 28, y - 12, 56, 54, 5)
    g.fillStyle(stroke, 1)
    g.fillRect(x - 7, y + 14, 14, 28)
    return
  }

  g.fillStyle(0x1d2438, 1)
  g.lineStyle(3, stroke, 1)
  g.fillRoundedRect(x - 34, y - 42, 68, 82, 5)
  g.strokeRoundedRect(x - 34, y - 42, 68, 82, 5)
  g.fillRect(x - 44, y - 24, 18, 64)
  g.strokeRect(x - 44, y - 24, 18, 64)
  g.fillRect(x + 26, y - 24, 18, 64)
  g.strokeRect(x + 26, y - 24, 18, 64)
  g.fillStyle(stroke, 1)
  g.fillRect(x - 10, y + 4, 20, 36)
}
