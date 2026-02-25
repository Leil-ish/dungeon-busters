import Phaser from 'phaser'
import { gameProgress } from './progress'

type LogEntry = {
  id: string
  title: string
  unlocked: boolean
  body: string
}

export class GameLogScene extends Phaser.Scene {
  private entries: LogEntry[] = []
  private selectedIndex = 0

  private listText!: Phaser.GameObjects.Text
  private detailText!: Phaser.GameObjects.Text

  constructor() {
    super('game-log')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1222')

    this.add.text(56, 44, 'Dungeon Busters', {
      color: '#f3f7ff',
      fontFamily: 'sans-serif',
      fontSize: '52px',
    })

    this.add.text(58, 108, 'Game Log', {
      color: '#9ec9ff',
      fontFamily: 'sans-serif',
      fontSize: '28px',
    })

    this.entries = this.buildEntries()

    this.listText = this.add.text(56, 164, '', {
      color: '#dce7ff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      lineSpacing: 6,
    })

    this.detailText = this.add.text(430, 164, '', {
      color: '#eef4ff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      lineSpacing: 8,
      wordWrap: { width: 490 },
    })

    this.add.text(56, 510, 'Up/Down: Select   Enter/Backspace: Return to Stage Select', {
      color: '#b8c7e6',
      fontFamily: 'sans-serif',
      fontSize: '16px',
    })

    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.entries.length) % this.entries.length
      this.render()
    })
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.entries.length
      this.render()
    })
    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('stage-select'))
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.scene.start('stage-select'))

    this.render()
  }

  private buildEntries(): LogEntry[] {
    return [
      {
        id: 'core',
        title: 'The Alarm',
        unlocked: true,
        body:
          'At Dungeon Bust HQ, the alarm triggered an emergency launch. The ship was destroyed over a hostile world, and Bouldereye was captured in a vault prison. Mission: rescue the team, recover map pieces, and break the lock chain.',
      },
      {
        id: 's1',
        title: 'Slippery Slopes',
        unlocked: gameProgress.torrentKeyPiece,
        body:
          'Waterfall currents and ice lanes hid the first objective. The Torrent Key Piece was secured, proving the team could survive the planet surface and begin the rescue chain.',
      },
      {
        id: 's2',
        title: 'Rocky Caverns',
        unlocked: gameProgress.volcanoManRescued,
        body:
          'In collapsing caverns, Volcano Man was freed from a stone prison. The Cavern Map Piece revealed deeper routes and confirmed this world was engineered as a layered trap.',
      },
      {
        id: 's3',
        title: 'Bloody Hills',
        unlocked: gameProgress.icemeckelRescued,
        body:
          'Icemeckel was discovered and rescued in the red hills. Blood cloud hazards and bone fields guarded the Bloody Map Piece needed to unlock later sectors.',
      },
      {
        id: 's4',
        title: 'Laser Alley',
        unlocked: gameProgress.swirlExanimoRescued,
        body:
          'Timed beams and moving traps protected the prism chamber. Exemon joined the team, and the Map to Lava Bog was recovered for the final push.',
      },
      {
        id: 'allies',
        title: 'Lava Bog Allies',
        unlocked: gameProgress.illislimRescued || gameProgress.hurricanoManRescued,
        body:
          'Illislim and Hurricano Man regrouped with the team inside Lava Bog, reinforcing the assault with support fire and flank control during the Infix encounter.',
      },
      {
        id: 'finale',
        title: 'Vault Break',
        unlocked: gameProgress.bouldereyeRescued || gameProgress.lavaBogCleared,
        body:
          'Infix defended the vault chamber with lava hazards and minions. After breaking the defense cycle, Bouldereye was rescued and extraction was confirmed.',
      },
    ]
  }

  private render(): void {
    const lines = this.entries.map((entry, i) => {
      const marker = i === this.selectedIndex ? '> ' : '  '
      const suffix = entry.unlocked ? '' : ' (Locked)'
      return `${marker}${entry.title}${suffix}`
    })
    this.listText.setText(lines.join('\n'))

    const selected = this.entries[this.selectedIndex]
    this.detailText.setText(
      selected.unlocked
        ? `${selected.title}\n\n${selected.body}`
        : `${selected.title}\n\nEntry locked. Clear more stages and rescue more heroes to unlock this log.`,
    )
  }
}
