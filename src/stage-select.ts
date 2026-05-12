import Phaser from 'phaser'
import type { StageId } from './heroes'
import { gameProgress, saveGameProgress } from './progress'
import { getStageMinigames, isMinigameCleared } from './minigame-registry'

type StageCard = {
  number: number
  stageId: StageId
  sceneKey: string
  title: string
  subtitle: string
  unlocked: boolean
  lockMessage: string
  milestone: string
  milestoneCleared: boolean
  rescue: string
  rescueCleared: boolean
  regularChallenge: string
  regularCleared: boolean
  bossChallenge: string
  bossCleared: boolean
}

export class StageSelectScene extends Phaser.Scene {
  private controlsText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private stageCards: StageCard[] = []

  constructor() {
    super('stage-select')
  }

  create(): void {
    this.stageCards = this.buildStageCards()
    this.cameras.main.setBackgroundColor('#111723')

    const viewportW = this.scale.width
    const viewportH = this.scale.height
    this.drawBackground(viewportW, viewportH)

    this.add.text(46, 28, 'Dungeon Busters', {
      color: '#fff4d1',
      fontFamily: 'sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
    })

    this.add.text(49, 75, 'Stage map and challenge castles', {
      color: '#9ed7ff',
      fontFamily: 'sans-serif',
      fontSize: '17px',
    })

    this.add.text(648, 34, 'Minigame key', {
      color: '#ffe0a3',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
    })
    this.add.text(648, 63, 'Red = waiting   Blue = cleared', {
      color: '#cad7ef',
      fontFamily: 'sans-serif',
      fontSize: '14px',
    })
    this.drawLegendHouse(838, 48, false)
    this.drawLegendCastle(895, 48, true)

    this.drawStageCards()

    this.statusText = this.add.text(46, viewportH - 54, '', {
      color: '#ffdca8',
      fontFamily: 'sans-serif',
      fontSize: '15px',
      wordWrap: { width: viewportW - 92 },
      fixedWidth: viewportW - 92,
      fixedHeight: 20,
    })
    this.statusText.setOrigin(0, 1)

    this.controlsText = this.add.text(46, viewportH - 24, 'Keys: 1-6 = Pick stage   L = Game Log', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '16px',
      lineSpacing: 2,
    })
    this.controlsText.setOrigin(0, 1)

    this.input.keyboard?.on('keydown-ONE', () => this.queueHeroSelect('SLIPPERY_HILLS', 'stage1'))
    this.input.keyboard?.on('keydown-TWO', () =>
      this.tryQueueStage(
        gameProgress.torrentKeyPiece,
        'Need Torrent Key Piece first.',
        'ROCKY_CAVERNS',
        'rocky-caverns',
      ),
    )
    this.input.keyboard?.on('keydown-THREE', () =>
      this.tryQueueStage(
        gameProgress.cavernMapPiece,
        'Need Cavern Map Piece first.',
        'BLOODY_HILLS',
        'bloody-hills',
      ),
    )
    this.input.keyboard?.on('keydown-FOUR', () =>
      this.tryQueueStage(
        gameProgress.bloodyMapPiece,
        'Need Bloody Map Piece first.',
        'LASER_HILLS',
        'laser-alley',
      ),
    )
    this.input.keyboard?.on('keydown-FIVE', () =>
      this.tryQueueStage(gameProgress.lavaBogMap, 'Need Map to Lava Bog first.', 'LAVA_BOG', 'lava-bog'),
    )
    this.input.keyboard?.on('keydown-SIX', () =>
      this.tryQueueStage(
        this.isForgeUnlocked(),
        'Finish Lava Bog + all rescues first (or dev unlock).',
        'FORGE_OF_ORIGINS',
        'forge-of-origins',
      ),
    )
    this.input.keyboard?.on('keydown-L', () => this.scene.start('game-log'))

    this.statusText.setText('')
  }

  private drawBackground(viewportW: number, viewportH: number): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x151b2a, 0x151b2a, 0x0c1019, 0x0c1019, 1)
    bg.fillRect(0, 0, viewportW, viewportH)
    bg.fillStyle(0x26324a, 0.45)
    for (let x = 0; x < viewportW; x += 48) {
      bg.fillRect(x, 0, 2, viewportH)
    }
    for (let y = 0; y < viewportH; y += 48) {
      bg.fillRect(0, y, viewportW, 2)
    }
    bg.fillStyle(0x1f2d45, 0.7)
    bg.fillRect(0, 0, viewportW, 112)
    bg.lineStyle(2, 0x5c739a, 0.55)
    bg.lineBetween(0, 112, viewportW, 112)
  }

  private drawStageCards(): void {
    const cardW = 414
    const cardH = 104
    const startX = 46
    const gapX = 40
    const startY = 130
    const gapY = 20

    this.stageCards.forEach((stage, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = startX + col * (cardW + gapX)
      const y = startY + row * (cardH + gapY)
      this.drawStageCard(stage, x, y, cardW, cardH)
    })
  }

  private drawStageCard(stage: StageCard, x: number, y: number, width: number, height: number): void {
    const border = stage.unlocked ? 0x79b8ff : 0x62708a
    const fill = stage.unlocked ? 0x172133 : 0x151923
    const g = this.add.graphics()
    g.fillStyle(fill, 0.96)
    g.fillRoundedRect(x, y, width, height, 8)
    g.lineStyle(2, border, stage.unlocked ? 0.9 : 0.48)
    g.strokeRoundedRect(x, y, width, height, 8)
    g.fillStyle(stage.unlocked ? 0xf1c95a : 0x647086, 1)
    g.fillRoundedRect(x + 12, y + 12, 34, 34, 6)

    this.add
      .text(x + 29, y + 29, `${stage.number}`, {
        color: '#111723',
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        fixedWidth: 34,
        align: 'center',
      })
      .setOrigin(0.5)

    this.add.text(x + 58, y + 10, stage.title, {
      color: stage.unlocked ? '#f6f8ff' : '#aeb9cd',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      fixedWidth: 210,
      fixedHeight: 24,
    })

    this.add.text(x + 58, y + 38, stage.subtitle, {
      color: '#9fb2d3',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fixedWidth: 214,
      fixedHeight: 17,
    })

    this.drawChip(x + 14, y + 62, 150, stage.milestone, stage.milestoneCleared)
    this.drawChip(x + 174, y + 62, 108, stage.rescue, stage.rescueCleared)
    this.drawChallengeMarkers(stage, x + 300, y + 14)
  }

  private drawChip(x: number, y: number, width: number, label: string, cleared: boolean): void {
    const g = this.add.graphics()
    g.fillStyle(cleared ? 0x12374a : 0x35202a, 1)
    g.lineStyle(1, cleared ? 0x55c6ff : 0xff6b6b, 0.9)
    g.fillRoundedRect(x, y, width, 26, 6)
    g.strokeRoundedRect(x, y, width, 26, 6)
    this.add.text(x + 8, y + 6, label, {
      color: cleared ? '#aee8ff' : '#ffb7b7',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fixedWidth: width - 16,
      fixedHeight: 14,
    })
  }

  private drawChallengeMarkers(stage: StageCard, x: number, y: number): void {
    this.drawLegendHouse(x + 18, y + 20, stage.regularCleared)
    this.drawLegendCastle(x + 76, y + 20, stage.bossCleared)
    this.add.text(x - 8, y + 50, stage.regularChallenge, {
      color: '#dce6fb',
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fixedWidth: 64,
      align: 'center',
    })
    this.add.text(x + 52, y + 50, stage.bossChallenge, {
      color: '#dce6fb',
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fixedWidth: 62,
      align: 'center',
    })
  }

  private drawLegendHouse(centerX: number, centerY: number, cleared: boolean): void {
    const g = this.add.graphics()
    const stroke = cleared ? 0x4cc8ff : 0xff5757
    g.fillStyle(0x231b2f, 1)
    g.lineStyle(3, stroke, 1)
    g.fillTriangle(centerX - 18, centerY - 3, centerX, centerY - 20, centerX + 18, centerY - 3)
    g.strokeTriangle(centerX - 18, centerY - 3, centerX, centerY - 20, centerX + 18, centerY - 3)
    g.fillRoundedRect(centerX - 15, centerY - 3, 30, 26, 4)
    g.strokeRoundedRect(centerX - 15, centerY - 3, 30, 26, 4)
    g.fillStyle(stroke, 1)
    g.fillRect(centerX - 4, centerY + 7, 8, 16)
  }

  private drawLegendCastle(centerX: number, centerY: number, cleared: boolean): void {
    const g = this.add.graphics()
    const stroke = cleared ? 0x4cc8ff : 0xff5757
    g.fillStyle(0x1d2438, 1)
    g.lineStyle(3, stroke, 1)
    g.fillRoundedRect(centerX - 20, centerY - 17, 40, 40, 4)
    g.strokeRoundedRect(centerX - 20, centerY - 17, 40, 40, 4)
    g.fillRect(centerX - 24, centerY - 9, 10, 32)
    g.strokeRect(centerX - 24, centerY - 9, 10, 32)
    g.fillRect(centerX + 14, centerY - 9, 10, 32)
    g.strokeRect(centerX + 14, centerY - 9, 10, 32)
    g.fillStyle(stroke, 1)
    g.fillRect(centerX - 6, centerY + 4, 12, 19)
  }

  private buildStageCards(): StageCard[] {
    const challengeProgress = (stageKey: string): { housesLabel: string; housesCleared: boolean; castleCleared: boolean } => {
      const stageMinigames = getStageMinigames(stageKey)
      const houses = stageMinigames.filter((minigame) => minigame.kind === 'house')
      const castle = stageMinigames.find((minigame) => minigame.kind === 'castle')
      const clearedHouses = houses.filter((minigame) => isMinigameCleared(minigame.id)).length
      return {
        housesLabel: `Houses ${clearedHouses}/3`,
        housesCleared: clearedHouses >= 3,
        castleCleared: castle ? isMinigameCleared(castle.id) : false,
      }
    }
    const stage1Challenges = challengeProgress('stage1')
    const stage2Challenges = challengeProgress('rocky-caverns')
    const stage3Challenges = challengeProgress('bloody-hills')
    const stage4Challenges = challengeProgress('laser-alley')
    const stage5Challenges = challengeProgress('lava-bog')
    const stage6Challenges = challengeProgress('forge-of-origins')

    return [
      {
        number: 1,
        stageId: 'SLIPPERY_HILLS',
        sceneKey: 'stage1',
        title: 'Slippery Slopes',
        subtitle: 'Waterfalls, ice lanes, first build spots',
        unlocked: true,
        lockMessage: '',
        milestone: 'Torrent Key',
        milestoneCleared: gameProgress.torrentKeyPiece,
        rescue: 'Scout',
        rescueCleared: true,
        regularChallenge: stage1Challenges.housesLabel,
        regularCleared: stage1Challenges.housesCleared,
        bossChallenge: 'B: Castle',
        bossCleared: stage1Challenges.castleCleared,
      },
      {
        number: 2,
        stageId: 'ROCKY_CAVERNS',
        sceneKey: 'rocky-caverns',
        title: 'Rocky Caverns',
        subtitle: 'Falling stones and rescue routes',
        unlocked: gameProgress.torrentKeyPiece,
        lockMessage: 'Need Torrent Key Piece first.',
        milestone: 'Cavern Map',
        milestoneCleared: gameProgress.cavernMapPiece,
        rescue: 'Volcano',
        rescueCleared: gameProgress.volcanoManRescued,
        regularChallenge: stage2Challenges.housesLabel,
        regularCleared: stage2Challenges.housesCleared,
        bossChallenge: 'Castle',
        bossCleared: stage2Challenges.castleCleared,
      },
      {
        number: 3,
        stageId: 'BLOODY_HILLS',
        sceneKey: 'bloody-hills',
        title: 'Bloody Hills',
        subtitle: 'Storm paths and monster hazards',
        unlocked: gameProgress.cavernMapPiece,
        lockMessage: 'Need Cavern Map Piece first.',
        milestone: 'Bloody Map',
        milestoneCleared: gameProgress.bloodyMapPiece,
        rescue: 'Icemeckel',
        rescueCleared: gameProgress.icemeckelRescued,
        regularChallenge: stage3Challenges.housesLabel,
        regularCleared: stage3Challenges.housesCleared,
        bossChallenge: 'Castle',
        bossCleared: stage3Challenges.castleCleared,
      },
      {
        number: 4,
        stageId: 'LASER_HILLS',
        sceneKey: 'laser-alley',
        title: 'Laser Alley',
        subtitle: 'Timing gates and beam dodges',
        unlocked: gameProgress.bloodyMapPiece,
        lockMessage: 'Need Bloody Map Piece first.',
        milestone: 'Lava Map',
        milestoneCleared: gameProgress.lavaBogMap,
        rescue: 'Swirl',
        rescueCleared: gameProgress.swirlExanimoRescued,
        regularChallenge: stage4Challenges.housesLabel,
        regularCleared: stage4Challenges.housesCleared,
        bossChallenge: 'Castle',
        bossCleared: stage4Challenges.castleCleared,
      },
      {
        number: 5,
        stageId: 'LAVA_BOG',
        sceneKey: 'lava-bog',
        title: 'Lava Bog',
        subtitle: 'Fire jumps, lava drips, boss trials',
        unlocked: gameProgress.lavaBogMap,
        lockMessage: 'Need Map to Lava Bog first.',
        milestone: 'Bog Clear',
        milestoneCleared: gameProgress.lavaBogCleared,
        rescue: 'Boulder',
        rescueCleared: gameProgress.bouldereyeRescued,
        regularChallenge: stage5Challenges.housesLabel,
        regularCleared: stage5Challenges.housesCleared,
        bossChallenge: 'Castle',
        bossCleared: stage5Challenges.castleCleared,
      },
      {
        number: 6,
        stageId: 'FORGE_OF_ORIGINS',
        sceneKey: 'forge-of-origins',
        title: 'Forge of Origins',
        subtitle: 'Final rescue check and origin boss',
        unlocked: this.isForgeUnlocked(),
        lockMessage: 'Finish Lava Bog + all rescues first (or dev unlock).',
        milestone: 'Forge Clear',
        milestoneCleared: gameProgress.forgeOfOriginsCleared,
        rescue: 'Allies',
        rescueCleared: this.isForgeUnlocked(),
        regularChallenge: stage6Challenges.housesLabel,
        regularCleared: stage6Challenges.housesCleared,
        bossChallenge: 'Castle',
        bossCleared: stage6Challenges.castleCleared,
      },
    ]
  }

  private isForgeUnlocked(): boolean {
    return (
      gameProgress.devUnlockForgeOrigins ||
      (gameProgress.lavaBogCleared &&
        gameProgress.volcanoManRescued &&
        gameProgress.icemeckelRescued &&
        gameProgress.illislimRescued &&
        gameProgress.hurricanoManRescued &&
        gameProgress.bouldereyeRescued)
    )
  }

  private queueHeroSelect(stageId: StageId, sceneKey: string): void {
    gameProgress.pendingStageId = stageId
    gameProgress.pendingStageSceneKey = sceneKey
    saveGameProgress()
    this.scene.start('hero-select')
  }

  private tryQueueStage(unlocked: boolean, lockMessage: string, stageId: StageId, sceneKey: string): void {
    if (!unlocked) {
      this.statusText.setText(lockMessage)
      return
    }
    this.statusText.setText('')
    this.queueHeroSelect(stageId, sceneKey)
  }
}
