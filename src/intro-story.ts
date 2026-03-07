import Phaser from 'phaser'

export class IntroStoryScene extends Phaser.Scene {
  constructor() {
    super('intro-story')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a1020')
    const viewportW = this.scale.width
    const viewportH = this.scale.height

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
      'Icemeckel, Volcano Man, Illislim, and Hurricano Man can join the mission.',
      'Final objective: defeat Infix, break the vault chain, and extract the full team.',
      'Open the Game Log from Stage Select for discovered lore after each stage.',
    ]

    const loreText = this.add.text(70, 176, lines.join('\n'), {
      color: '#d9e7ff',
      fontFamily: 'sans-serif',
      fontSize: viewportH < 620 ? '17px' : '19px',
      wordWrap: { width: Math.min(1200, Math.max(680, viewportW - 140)) },
      lineSpacing: viewportH < 620 ? 2 : 4,
    })

    const maxLoreHeight = Math.max(220, viewportH - 250)
    if (loreText.height > maxLoreHeight) {
      loreText.setFontSize(16)
      loreText.setLineSpacing(2)
    }

    const prompt = this.add.text(70, viewportH - 14, 'Press Enter to continue to Stage Select', {
      color: '#b8c7e6',
      fontFamily: 'sans-serif',
      fontSize: viewportH < 620 ? '16px' : '18px',
    })
    prompt.setOrigin(0, 1)

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('stage-select'))
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('stage-select'))
  }
}
