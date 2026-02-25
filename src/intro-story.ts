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

    this.add.text(70, 122, 'Mission Lore Brief', {
      color: '#8ec8ff',
      fontFamily: 'sans-serif',
      fontSize: '30px',
    })

    const lines = [
      'Alarm at HQ. Deployment team: Micralis, Electroman, Inspector Glowman.',
      'During insertion, the ship was crushed over a hostile dungeon planet.',
      'Bouldereye was captured and locked in a vault under Lava Bog.',
      'Each region holds rescue targets, map pieces, and gate locks to the final chamber.',
      'Swirl Exanimo, Icemeckel, Volcano Man, Illislim, and Hurricano Man can join the mission.',
      'Final objective: defeat Infix, break the vault chain, and extract the full team.',
      'Open the Game Log from Stage Select for discovered lore after each stage.',
    ]

    this.add.text(70, 182, lines.join('\n\n'), {
      color: '#d9e7ff',
      fontFamily: 'sans-serif',
      fontSize: '21px',
      wordWrap: { width: 820 },
      lineSpacing: 6,
    })

    this.add.text(70, 500, 'Press Enter to continue to Stage Select', {
      color: '#b8c7e6',
      fontFamily: 'sans-serif',
      fontSize: '20px',
    })

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('stage-select'))
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('stage-select'))
  }
}
