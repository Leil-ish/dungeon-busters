import Phaser from 'phaser'
import type { StageId } from './heroes'
import { gameProgress } from './progress'

export class StageSelectScene extends Phaser.Scene {
  private selectText!: Phaser.GameObjects.Text

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
      fontSize: '30px',
    })

    this.selectText = this.add.text(80, 220, '', {
      color: '#e7eeff',
      fontFamily: 'sans-serif',
      fontSize: '24px',
      lineSpacing: 10,
    })

    this.add.text(80, 470, 'Press 1 for Slippery Hills, 2 for Rocky Caverns', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '20px',
    })
    this.add.text(80, 500, 'Press 3 for Bloody Hills', {
      color: '#b2c5e9',
      fontFamily: 'sans-serif',
      fontSize: '20px',
    })

    this.input.keyboard?.on('keydown-ONE', () => this.queueHeroSelect('SLIPPERY_HILLS', 'stage1'))
    this.input.keyboard?.on('keydown-TWO', () => this.queueHeroSelect('ROCKY_CAVERNS', 'rocky-caverns'))
    this.input.keyboard?.on('keydown-THREE', () => this.queueHeroSelect('BLOODY_HILLS', 'bloody-hills'))

    this.refreshProgressText()
  }

  private refreshProgressText(): void {
    this.selectText.setText(
      [
        `1. Stage 1: Slippery Hills  [Torrent Key Piece: ${gameProgress.torrentKeyPiece ? 'Yes' : 'No'}]`,
        `2. Stage 2: Rocky Caverns   [Volcano Man: ${gameProgress.volcanoManRescued ? 'Rescued' : 'Missing'}]`,
        `   Cavern Map Piece: ${gameProgress.cavernMapPiece ? 'Collected' : 'Missing'}`,
        `3. Stage 3: Bloody Hills    [Icemeckel: ${gameProgress.icemeckelRescued ? 'Rescued' : 'Missing'}]`,
        `   Bloody Map Piece: ${gameProgress.bloodyMapPiece ? 'Collected' : 'Missing'}`,
      ].join('\n'),
    )
  }

  private queueHeroSelect(stageId: StageId, sceneKey: string): void {
    gameProgress.pendingStageId = stageId
    gameProgress.pendingStageSceneKey = sceneKey
    this.scene.start('hero-select')
  }
}
