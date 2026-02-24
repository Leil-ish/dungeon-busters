import Phaser from 'phaser'

export class IntroStoryScene extends Phaser.Scene {
  constructor() {
    super('intro-story')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a1020')

    this.add.text(70, 48, 'Dungeon Busters', {
      color: '#f4f7ff',
      fontFamily: 'sans-serif',
      fontSize: '56px',
    })

    this.add.text(70, 122, 'Story Brief', {
      color: '#8ec8ff',
      fontFamily: 'sans-serif',
      fontSize: '30px',
    })

    const lines = [
      'Alarm at HQ. Team deployed: Micralis, Electroman, Inspector Glowman.',
      'Ship destroyed over a hostile world. Bouldereye is trapped.',
      'Clear stages, rescue heroes, gather map pieces, and fight through.',
      'Stage 1: Slippery Slopes  |  Stage 2: Rocky Caverns  |  Stage 3: Bloody Hills',
    ]

    this.add.text(70, 190, lines.join('\n\n'), {
      color: '#d9e7ff',
      fontFamily: 'sans-serif',
      fontSize: '24px',
      wordWrap: { width: 820 },
      lineSpacing: 8,
    })

    this.add.text(70, 490, 'Press Enter to continue to Stage Select', {
      color: '#b8c7e6',
      fontFamily: 'sans-serif',
      fontSize: '22px',
    })

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('stage-select'))
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('stage-select'))
  }
}
