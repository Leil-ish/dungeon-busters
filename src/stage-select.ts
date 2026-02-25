import Phaser from 'phaser'
import type { StageId } from './heroes'
import { gameProgress, saveGameProgress } from './progress'

export class StageSelectScene extends Phaser.Scene {
  private leftColumnText!: Phaser.GameObjects.Text
  private rightColumnText!: Phaser.GameObjects.Text
  private controlsText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text

  constructor() {
    super('stage-select')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0f1624')

    this.add.text(80, 80, 'Dungeon Busters', {
      color: '#f4f7ff',
      fontFamily: 'sans-serif',
      fontSize: '56px',
    })

    this.add.text(80, 150, 'Stage Select', {
      color: '#8ec8ff',
      fontFamily: 'sans-serif',
      fontSize: '28px',
    })

    this.leftColumnText = this.add.text(80, 206, '', {
      color: '#e7eeff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      lineSpacing: 8,
    })

    this.rightColumnText = this.add.text(520, 206, '', {
      color: '#dbe6ff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      lineSpacing: 8,
    })

    this.controlsText = this.add.text(80, 392, '', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    })
    this.controlsText.setText(
      [
        'Press 1 for Slippery Slopes',
        'Press 2 for Rocky Caverns',
        'Press 3 for Bloody Hills',
        'Press 4 for Laser Alley',
        'Press 5 for Lava Bog',
        'Press L for Game Log',
      ].join('\n'),
    )

    this.statusText = this.add.text(80, 502, '', {
      color: '#ffdca8',
      fontFamily: 'sans-serif',
      fontSize: '16px',
    })

    this.add.text(80, 522, 'Micralis is always available. Other heroes unlock by rescue progress.', {
      color: '#ffdca8',
      fontFamily: 'sans-serif',
      fontSize: '14px',
    })

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
    this.input.keyboard?.on('keydown-L', () => this.scene.start('game-log'))

    this.refreshProgressText()
  }

  private refreshProgressText(): void {
    this.leftColumnText.setText(
      [
        '1. Stage 1: Slippery Slopes',
        '2. Stage 2: Rocky Caverns',
        '3. Stage 3: Bloody Hills',
        '4. Stage 4: Laser Alley',
        '5. Stage 5: Lava Bog',
      ].join('\n'),
    )
    this.rightColumnText.setText(
      [
        `Torrent Key Piece: ${gameProgress.torrentKeyPiece ? 'Yes' : 'No'}`,
        `Volcano Man: ${gameProgress.volcanoManRescued ? 'Rescued' : 'Missing'} | Cavern Map: ${gameProgress.cavernMapPiece ? 'Yes' : 'No'}`,
        `Icemeckel: ${gameProgress.icemeckelRescued ? 'Rescued' : 'Missing'} | Bloody Map: ${gameProgress.bloodyMapPiece ? 'Yes' : 'No'}`,
        `Swirl Exanimo: ${gameProgress.swirlExanimoRescued ? 'Rescued' : 'Missing'} | Lava Map: ${gameProgress.lavaBogMap ? 'Yes' : 'No'}`,
        `Bouldereye: ${gameProgress.bouldereyeRescued ? 'Rescued' : 'Trapped'} | Clear: ${gameProgress.lavaBogCleared ? 'Yes' : 'No'}`,
      ].join('\n'),
    )
    this.statusText.setText('')
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
