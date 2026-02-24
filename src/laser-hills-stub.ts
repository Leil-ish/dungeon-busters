import Phaser from 'phaser'

export class LaserHillsStubScene extends Phaser.Scene {
  constructor() {
    super('laser-hills-stub')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#121328')

    this.add.text(64, 72, 'Stage 4: Laser Hills', {
      color: '#f4f7ff',
      fontFamily: 'sans-serif',
      fontSize: '52px',
    })

    this.add.text(64, 152, 'Coming Soon', {
      color: '#8ec8ff',
      fontFamily: 'sans-serif',
      fontSize: '30px',
    })

    this.add.text(
      64,
      220,
      [
        'This stage is visible in V1 but not playable yet.',
        'Planned features:',
        '- Laser hazards and timing routes',
        '- New rescue sequence',
        '- Expanded affinity interactions',
      ].join('\n'),
      {
        color: '#dce7ff',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        lineSpacing: 8,
      },
    )

    this.add.text(64, 500, 'Press Backspace or Enter to return to Stage Select', {
      color: '#b8c7e6',
      fontFamily: 'sans-serif',
      fontSize: '20px',
    })

    this.input.keyboard?.once('keydown-BACKSPACE', () => this.scene.start('stage-select'))
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('stage-select'))
  }
}
