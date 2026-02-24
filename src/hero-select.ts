import Phaser from 'phaser'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type StageId,
  type HeroDefinition,
  type HeroId,
  type RuntimePlayerStats,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress } from './progress'

const BASE_STATS: RuntimePlayerStats = {
  moveAcceleration: 900,
  maxVelocityX: 260,
  jumpVelocity: 520,
  shotCooldownMs: 220,
  shotSpeed: 520,
  damage: 1,
  defense: 1,
}

export class HeroSelectScene extends Phaser.Scene {
  private heroIds: HeroId[] = []
  private selectedIndex = 0

  private listText!: Phaser.GameObjects.Text
  private detailText!: Phaser.GameObjects.Text
  private iconRect!: Phaser.GameObjects.Rectangle

  constructor() {
    super('hero-select')
  }

  create(): void {
    const pendingStageId = gameProgress.pendingStageId
    const pendingScene = gameProgress.pendingStageSceneKey

    if (!pendingStageId || !pendingScene) {
      this.scene.start('stage-select')
      return
    }

    this.heroIds = this.getUnlockedHeroIds()

    const savedIndex = this.heroIds.indexOf(gameProgress.selectedHeroId)
    this.selectedIndex = savedIndex >= 0 ? savedIndex : this.heroIds.indexOf(DEFAULT_HERO_ID)
    if (this.selectedIndex < 0) {
      this.selectedIndex = 0
    }

    this.cameras.main.setBackgroundColor('#10121b')

    this.add.text(56, 44, 'Hero Select', {
      color: '#f3f7ff',
      fontFamily: 'sans-serif',
      fontSize: '52px',
    })

    this.add.text(58, 110, `Stage: ${this.friendlyStageName(pendingStageId)}`, {
      color: '#9ec9ff',
      fontFamily: 'sans-serif',
      fontSize: '24px',
    })

    this.listText = this.add.text(56, 170, '', {
      color: '#dce7ff',
      fontFamily: 'sans-serif',
      fontSize: '22px',
      lineSpacing: 8,
    })

    this.iconRect = this.add.rectangle(590, 204, 96, 96, 0xffffff, 1)

    this.detailText = this.add.text(500, 280, '', {
      color: '#f2f6ff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      lineSpacing: 8,
      wordWrap: { width: 390 },
    })

    this.add.text(
      56,
      500,
      'Up/Down: Select  Enter: Start  Backspace: Back',
      {
        color: '#b8c7e6',
        fontFamily: 'sans-serif',
        fontSize: '20px',
      },
    )

    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.heroIds.length) % this.heroIds.length
      this.renderSelection()
    })
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.heroIds.length
      this.renderSelection()
    })
    this.input.keyboard?.on('keydown-ENTER', () => this.startLevel())
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.scene.start('stage-select'))

    this.renderSelection()
  }

  private renderSelection(): void {
    const stageId = gameProgress.pendingStageId
    if (!stageId) {
      return
    }

    const lines = this.heroIds.map((heroId, index) => {
      const hero = HEROES[heroId]
      const prefix = index === this.selectedIndex ? '> ' : '  '
      return `${prefix}${hero.displayName}  (${this.getAffinityLabel(hero, stageId)})`
    })
    this.listText.setText(lines.join('\n'))

    const selectedHero = HEROES[this.heroIds[this.selectedIndex]]
    const effective = computeEffectivePlayerStats(selectedHero.id, stageId, BASE_STATS)
    const affinity = selectedHero.affinity[stageId]

    this.iconRect.setFillStyle(this.heroColor(selectedHero.id), 1)

    this.detailText.setText(
      [
        `${selectedHero.displayName}`,
        `Special: ${selectedHero.moves.special.name}`,
        'Ability: Ready',
        `Affinity: speed ${affinity.speedMul.toFixed(2)}x | damage ${affinity.damageMul.toFixed(2)}x | defense ${affinity.defenseMul.toFixed(2)}x`,
        '',
        'Stats on this stage:',
        `Speed: ${BASE_STATS.maxVelocityX.toFixed(0)} -> ${effective.maxVelocityX.toFixed(0)}`,
        `Jump: ${BASE_STATS.jumpVelocity.toFixed(0)} -> ${effective.jumpVelocity.toFixed(0)}`,
        `Damage: ${BASE_STATS.damage.toFixed(2)} -> ${effective.damage.toFixed(2)}`,
        `Defense: ${BASE_STATS.defense.toFixed(2)} -> ${effective.defense.toFixed(2)}`,
      ].join('\n'),
    )
  }

  private startLevel(): void {
    const stageSceneKey = gameProgress.pendingStageSceneKey
    if (!stageSceneKey) {
      this.scene.start('stage-select')
      return
    }

    const heroId = this.heroIds[this.selectedIndex]
    gameProgress.selectedHeroId = heroId
    gameProgress.pendingStageId = null
    gameProgress.pendingStageSceneKey = null
    this.scene.start(stageSceneKey)
  }

  private getAffinityLabel(hero: HeroDefinition, stageId: NonNullable<typeof gameProgress.pendingStageId>): string {
    const a = hero.affinity[stageId]
    const score = (a.speedMul + a.damageMul + a.defenseMul + (a.jumpMul ?? 1)) / 4
    if (score >= 1.05) {
      return 'Strong here'
    }
    if (score <= 0.95) {
      return 'Weak here'
    }
    return 'Neutral'
  }

  private heroColor(heroId: HeroId): number {
    const map: Record<HeroId, number> = {
      MICRALIS: 0x8ec5ff,
      ELECTROMAN: 0xf4d35e,
      INSPECTOR_GLOWMAN: 0xe2f3ff,
      ICEMECKEL: 0x9edfff,
      VOLCANO_MAN: 0xd86539,
      SWIRL_EXANIMO: 0xd5a9ff,
      ILLISLIM: 0x8ed8a6,
      HURRICANO_MAN: 0x79f0ff,
    }

    return map[heroId]
  }

  private friendlyStageName(stageId: StageId): string {
    const map: Record<StageId, string> = {
      SLIPPERY_HILLS: 'Slippery Slopes',
      ROCKY_CAVERNS: 'Rocky Caverns',
      LASER_HILLS: 'Laser Hills',
      ZOMBIE_MOUNTAINS: 'Zombie Mountains',
      LAVA_BOG: 'Lava Bog',
      BLOODY_HILLS: 'Bloody Hills',
    }
    return map[stageId]
  }

  private getUnlockedHeroIds(): HeroId[] {
    const unlocked = new Set<HeroId>(['MICRALIS', 'ELECTROMAN', 'INSPECTOR_GLOWMAN'])
    if (gameProgress.volcanoManRescued) {
      unlocked.add('VOLCANO_MAN')
    }
    if (gameProgress.icemeckelRescued) {
      unlocked.add('ICEMECKEL')
    }
    if (gameProgress.bloodyMapPiece) {
      unlocked.add('HURRICANO_MAN')
    }
    return (Object.keys(HEROES) as HeroId[]).filter((heroId) => unlocked.has(heroId))
  }
}
