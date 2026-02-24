import Phaser from 'phaser'
import type { StageId } from './heroes'
import { gameProgress, saveGameProgress } from './progress'

export class StageSelectScene extends Phaser.Scene {
  private selectText!: Phaser.GameObjects.Text
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

    this.selectText = this.add.text(80, 200, '', {
      color: '#e7eeff',
      fontFamily: 'sans-serif',
      fontSize: '21px',
      lineSpacing: 6,
    })

    this.add.text(80, 428, 'Press 1 for Slippery Slopes', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    })
    this.add.text(80, 450, 'Press 2 for Rocky Caverns', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    })
    this.add.text(80, 472, 'Press 3 for Bloody Hills', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    })
    this.add.text(80, 494, 'Press 4 for Laser Alley', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    })

    this.statusText = this.add.text(80, 518, '', {
      color: '#ffdca8',
      fontFamily: 'sans-serif',
      fontSize: '16px',
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

    this.refreshProgressText()
  }

  private refreshProgressText(): void {
    this.selectText.setText(
      [
        `1. Stage 1: Slippery Slopes [Torrent Key Piece: ${gameProgress.torrentKeyPiece ? 'Yes' : 'No'}]`,
        `2. Stage 2: Rocky Caverns   [Volcano Man: ${gameProgress.volcanoManRescued ? 'Rescued' : 'Missing'}]`,
        `   Cavern Map Piece: ${gameProgress.cavernMapPiece ? 'Collected' : 'Missing'}`,
        `3. Stage 3: Bloody Hills    [Icemeckel: ${gameProgress.icemeckelRescued ? 'Rescued' : 'Missing'}]`,
        `   Bloody Map Piece: ${gameProgress.bloodyMapPiece ? 'Collected' : 'Missing'}`,
        `4. Stage 4: Laser Alley    [Swirl Exanimo: ${gameProgress.swirlExanimoRescued ? 'Rescued' : 'Missing'}]`,
        `   Map to Lava Bog: ${gameProgress.lavaBogMap ? 'Collected' : 'Missing'}`,
      ].join('\n'),
    )
    this.statusText.setText('Micralis is always available. Other heroes unlock by rescue progress.')
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
    this.queueHeroSelect(stageId, sceneKey)
  }
}
