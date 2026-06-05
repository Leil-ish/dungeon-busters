import Phaser from 'phaser'
import { gameProgress, saveGameProgress } from './progress'
import { getMinigame, isMinigameCleared, markMinigameCleared, type MinigameDefinition } from './minigame-registry'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f6f8ff',
  fontFamily: 'sans-serif',
}

class ChallengeScene extends Phaser.Scene {
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  protected spaceKey!: Phaser.Input.Keyboard.Key
  protected statusText!: Phaser.GameObjects.Text
  protected player!: Phaser.Physics.Arcade.Sprite
  protected health = 3
  protected cleared = false
  protected failed = false
  protected returnScene = 'stage1'
  protected returnX = 140
  protected returnY = 680
  protected returnMessage = 'Returned from minigame.'

  init(data: { returnScene?: string; returnX?: number; returnY?: number; returnMessage?: string }): void {
    this.returnScene = data.returnScene ?? 'stage1'
    this.returnX = data.returnX ?? 140
    this.returnY = data.returnY ?? 680
    this.returnMessage = data.returnMessage ?? 'Returned from minigame.'
  }

  protected getReturnData(): { fromMinigame: boolean; returnX: number; returnY: number; returnMessage: string } {
    return {
      fromMinigame: true,
      returnX: this.returnX,
      returnY: this.returnY,
      returnMessage: this.returnMessage,
    }
  }

  protected getRestartData(): object {
    return {
      returnScene: this.returnScene,
      returnX: this.returnX,
      returnY: this.returnY,
      returnMessage: this.returnMessage,
    }
  }

  protected resetChallengeRun(health: number): void {
    this.health = health
    this.cleared = false
    this.failed = false
    this.physics.resume()
  }

  protected createPixelTexture(key: string, color: number, width: number, height: number): void {
    if (this.textures.exists(key)) {
      return
    }
    const gfx = this.add.graphics()
    gfx.fillStyle(color, 1)
    gfx.fillRect(0, 0, width, height)
    gfx.generateTexture(key, width, height)
    gfx.destroy()
  }

  protected drawHeader(title: string, subtitle: string, accent: number): void {
    this.cameras.main.setBackgroundColor('#101522')
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x162238, 0x162238, 0x090d16, 0x090d16, 1)
    bg.fillRect(0, 0, this.scale.width, this.scale.height)
    bg.fillStyle(0x1d2d46, 0.8)
    bg.fillRect(0, 0, this.scale.width, 92)
    bg.lineStyle(2, accent, 0.75)
    bg.lineBetween(0, 92, this.scale.width, 92)

    this.add.text(34, 24, title, {
      ...TEXT_STYLE,
      color: '#fff4d1',
      fontSize: '32px',
      fontStyle: 'bold',
    })
    this.add.text(36, 61, subtitle, {
      ...TEXT_STYLE,
      color: '#b8d7ff',
      fontSize: '14px',
    })
    this.statusText = this.add.text(34, 502, '', {
      ...TEXT_STYLE,
      color: '#ffdca8',
      fontSize: '15px',
      fixedWidth: 890,
      wordWrap: { width: 890 },
    })
  }

  protected createPlayer(x: number, y: number): void {
    this.createPixelTexture('minigame-player', 0x7be7ff, 34, 46)
    this.player = this.physics.add.sprite(x, y, 'minigame-player')
    this.player.setCollideWorldBounds(true)
  }

  protected finishSuccess(message: string, next: () => void): void {
    if (this.cleared || this.failed) {
      return
    }
    this.cleared = true
    this.physics.pause()
    next()
    saveGameProgress()
    this.statusText.setText(`${message}  Returning to the dungeon...`)
    this.time.delayedCall(900, () => this.scene.start(this.returnScene, this.getReturnData()))
  }

  protected finishFailure(message: string): void {
    if (this.cleared || this.failed) {
      return
    }
    this.failed = true
    this.physics.pause()
    this.statusText.setText(`${message}  Press Enter to try again or Backspace to return.`)
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.restart(this.getRestartData()))
    this.input.keyboard?.once('keydown-BACKSPACE', () => this.scene.start(this.returnScene, this.getReturnData()))
  }

  protected damagePlayer(message: string): void {
    if (this.cleared || this.failed || this.player.getData('hurt')) {
      return
    }
    this.health -= 1
    this.player.setData('hurt', true)
    this.player.setTint(0xff8585)
    this.time.delayedCall(520, () => {
      this.player.setData('hurt', false)
      this.player.clearTint()
    })
    if (this.health <= 0) {
      this.finishFailure(message)
    }
  }
}

export class MeteorDodgeScene extends ChallengeScene {
  private meteors!: Phaser.Physics.Arcade.Group
  private crystals!: Phaser.Physics.Arcade.Group
  private timerText!: Phaser.GameObjects.Text
  private partsText!: Phaser.GameObjects.Text
  private secondsLeft = 24
  private partsCollected = 0

  constructor() {
    super('meteor-dodge')
  }

  create(): void {
    this.resetChallengeRun(3)
    this.partsCollected = 0
    this.secondsLeft = 24
    this.drawHeader('Meteor Dodge House', 'Dodge monster meteors and grab 4 platform cores.', 0xff5757)
    this.createPixelTexture('meteor', 0xff7448, 30, 30)
    this.createPixelTexture('platform-core', 0x55c6ff, 24, 24)
    this.createPlayer(480, 438)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.cursors = this.input.keyboard!.createCursorKeys()

    const floor = this.add.rectangle(480, 476, 880, 22, 0x24455a, 1)
    this.physics.add.existing(floor, true)

    this.meteors = this.physics.add.group({ allowGravity: false })
    this.crystals = this.physics.add.group({ allowGravity: false })
    this.physics.add.overlap(this.player, this.meteors, (_player, meteor) => {
      ;(meteor as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.damagePlayer('Meteor crash! The house challenge resets.')
      this.refreshHud()
    })
    this.physics.add.overlap(this.player, this.crystals, (_player, crystal) => {
      ;(crystal as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.partsCollected += 1
      this.refreshHud()
      if (this.partsCollected >= 4) {
        this.finishSuccess('Meteor Dodge cleared. Platform parts added.', () => {
          gameProgress.meteorDodgeCleared = true
          gameProgress.platformParts = Math.max(gameProgress.platformParts, 4)
        })
      }
    })

    this.timerText = this.add.text(34, 112, '', { ...TEXT_STYLE, fontSize: '18px' })
    this.partsText = this.add.text(690, 112, '', { ...TEXT_STYLE, fontSize: '18px', fixedWidth: 230, align: 'right' })
    this.statusText.setText('Move with Left/Right. Collect blue cores. Avoid falling meteors.')
    this.refreshHud()

    this.time.addEvent({ delay: 430, loop: true, callback: () => this.dropMeteor() })
    this.time.addEvent({ delay: 1350, loop: true, callback: () => this.dropCrystal() })
    this.time.addEvent({
      delay: 1000,
      repeat: this.secondsLeft - 1,
      callback: () => {
        this.secondsLeft -= 1
        this.refreshHud()
        if (this.secondsLeft <= 0 && this.partsCollected < 4) {
          this.finishFailure('Time ran out before you gathered enough platform cores.')
        }
      },
    })
  }

  update(): void {
    if (this.cleared || this.failed) {
      return
    }
    const speed = 310
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed)
    } else {
      this.player.setVelocityX(0)
    }

    this.meteors.children.each((child) => {
      const meteor = child as Phaser.Physics.Arcade.Image
      if (meteor.y > 530) {
        meteor.disableBody(true, true)
      }
      return true
    })
    this.crystals.children.each((child) => {
      const crystal = child as Phaser.Physics.Arcade.Image
      if (crystal.y > 530) {
        crystal.disableBody(true, true)
      }
      return true
    })
  }

  private dropMeteor(): void {
    const meteor = this.meteors.get(Phaser.Math.Between(70, 890), -20, 'meteor') as Phaser.Physics.Arcade.Image
    if (!meteor) {
      return
    }
    meteor.enableBody(true, meteor.x, meteor.y, true, true)
    meteor.setVelocityY(Phaser.Math.Between(210, 330))
    meteor.setAngularVelocity(Phaser.Math.Between(-160, 160))
  }

  private dropCrystal(): void {
    const crystal = this.crystals.get(Phaser.Math.Between(80, 880), -20, 'platform-core') as Phaser.Physics.Arcade.Image
    if (!crystal) {
      return
    }
    crystal.enableBody(true, crystal.x, crystal.y, true, true)
    crystal.setVelocityY(175)
  }

  private refreshHud(): void {
    this.timerText.setText(`Time ${this.secondsLeft}s   Health ${this.health}`)
    this.partsText.setText(`Cores ${this.partsCollected}/4`)
  }
}

export class FlameRopeBossScene extends ChallengeScene {
  private rope!: Phaser.Physics.Arcade.Image
  private floor!: Phaser.GameObjects.Rectangle
  private bossText!: Phaser.GameObjects.Text
  private jumpsCleared = 0
  private ropeActive = false

  constructor() {
    super('flame-rope-boss')
  }

  create(): void {
    this.resetChallengeRun(3)
    this.jumpsCleared = 0
    this.ropeActive = false
    this.drawHeader('Flame Rope Boss Castle', 'Jump the giant flaming rope until the fire giant wears out.', 0xff8b3d)
    this.createPixelTexture('rope-player', 0xffd166, 34, 48)
    this.createPixelTexture('flame-rope', 0xff6536, 124, 16)

    this.player = this.physics.add.sprite(260, 414, 'rope-player')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(900)
    this.floor = this.add.rectangle(480, 472, 880, 28, 0x3e2a35, 1)
    this.physics.add.existing(this.floor, true)
    this.physics.add.collider(this.player, this.floor)

    this.rope = this.physics.add.image(1040, 426, 'flame-rope')
    ;(this.rope.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.rope.setVisible(false)
    this.rope.setActive(false)
    this.physics.add.overlap(this.player, this.rope, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body
      if (!body.blocked.down) {
        return
      }
      this.damagePlayer('The fire giant landed a rope hit. Castle challenge resets.')
      this.refreshHud()
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.bossText = this.add.text(34, 112, '', { ...TEXT_STYLE, fontSize: '18px' })
    this.statusText.setText('Jump with Up or Space. Clear 8 rope swings.')
    this.refreshHud()
    this.time.delayedCall(700, () => this.launchRope())
  }

  update(): void {
    if (this.cleared || this.failed) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.cursors.up.isDown) && body.blocked.down) {
      this.player.setVelocityY(-520)
    }

    if (this.ropeActive && this.rope.x < -80) {
      this.ropeActive = false
      this.rope.disableBody(true, true)
      this.rope.setVisible(false)
      this.jumpsCleared += 1
      this.refreshHud()
      if (this.jumpsCleared >= 8) {
        this.finishSuccess('Flame Rope Boss cleared. Boss castle turns blue.', () => {
          gameProgress.flameRopeBossCleared = true
          gameProgress.platformParts = Math.max(gameProgress.platformParts, 7)
        })
      } else {
        this.time.delayedCall(Math.max(360, 900 - this.jumpsCleared * 55), () => this.launchRope())
      }
    }
  }

  private launchRope(): void {
    if (this.cleared || this.failed) {
      return
    }
    this.ropeActive = true
    this.rope.enableBody(true, 1040, 426, true, true)
    this.rope.setVelocityX(-360 - this.jumpsCleared * 24)
  }

  private refreshHud(): void {
    this.bossText.setText(`Rope jumps ${this.jumpsCleared}/8   Health ${this.health}`)
  }
}

export class DungeonMinigameScene extends ChallengeScene {
  private definition!: MinigameDefinition
  private hazards!: Phaser.Physics.Arcade.Group
  private prizes!: Phaser.Physics.Arcade.Group
  private hudText!: Phaser.GameObjects.Text
  private count = 0
  private goal = 5
  private secondsLeft = 24
  private rope!: Phaser.Physics.Arcade.Image
  private ropeActive = false
  private timingCursor!: Phaser.GameObjects.Rectangle
  private timingZone!: Phaser.GameObjects.Rectangle
  private timingDir = 1
  private timingZoneX = 480
  private memorySequence: string[] = []
  private memoryIndex = 0
  private memoryShowing = true
  private memoryText!: Phaser.GameObjects.Text
  private memoryKeys!: Record<string, Phaser.Input.Keyboard.Key>
  private chaser!: Phaser.Physics.Arcade.Image
  private waterfallWarnings: Phaser.GameObjects.GameObject[] = []
  private waterfallHits: Phaser.GameObjects.Rectangle[] = []
  private waterfallRoundActive = false

  constructor() {
    super('dungeon-minigame')
  }

  init(data: {
    minigameId?: string
    returnScene?: string
    returnX?: number
    returnY?: number
    returnMessage?: string
  }): void {
    super.init(data)
    this.definition = getMinigame(data.minigameId ?? 's1-meteor-house')
  }

  protected getRestartData(): object {
    return {
      minigameId: this.definition.id,
      returnScene: this.returnScene,
      returnX: this.returnX,
      returnY: this.returnY,
      returnMessage: this.returnMessage,
    }
  }

  create(): void {
    this.resetChallengeRun(this.definition.kind === 'castle' ? 4 : 3)
    this.count = 0
    this.secondsLeft = this.definition.kind === 'castle' ? 30 : 24
    this.goal = this.definition.kind === 'castle' ? 8 : 5
    this.ropeActive = false
    this.timingDir = 1
    this.memorySequence = []
    this.memoryIndex = 0
    this.memoryShowing = true
    this.waterfallWarnings = []
    this.waterfallHits = []
    this.waterfallRoundActive = false
    this.drawHeader(this.definition.title, this.definition.subtitle, this.definition.kind === 'castle' ? 0xff8b3d : 0xff5757)
    this.decorateDungeonRoom()
    this.createPixelTexture('dungeon-prize', 0x55c6ff, 24, 24)
    this.createPixelTexture('dungeon-hazard', 0xff7448, 30, 30)
    this.createPixelTexture('dungeon-rope', 0xff6536, 124, 16)
    this.hudText = this.add.text(34, 112, '', { ...TEXT_STYLE, fontSize: '18px', fixedWidth: 890 })

    if (this.definition.mode === 'rope') {
      this.createRopeChallenge()
    } else if (this.definition.mode === 'timing') {
      this.createTimingChallenge()
    } else if (this.definition.mode === 'memory') {
      this.createMemoryChallenge()
    } else if (this.definition.mode === 'chase') {
      this.createChaseChallenge()
    } else if (this.definition.mode === 'waterfall') {
      this.createWaterfallRushChallenge()
    } else {
      this.createDodgeCollectChallenge()
    }
    this.refreshHud()
  }

  update(): void {
    if (this.cleared || this.failed) {
      return
    }

    if (this.definition.mode === 'rope') {
      this.updateRopeChallenge()
    } else if (this.definition.mode === 'timing') {
      this.updateTimingChallenge()
    } else if (this.definition.mode === 'memory') {
      this.updateMemoryChallenge()
    } else if (this.definition.mode === 'chase') {
      this.updateChaseChallenge()
    } else if (this.definition.mode === 'waterfall') {
      this.updateWaterfallRushChallenge()
    } else {
      this.updateDodgeCollectChallenge()
    }
  }

  private createDodgeCollectChallenge(): void {
    this.createPlayer(480, 438)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.hazards = this.physics.add.group({ allowGravity: false })
    this.prizes = this.physics.add.group({ allowGravity: false })
    this.physics.add.overlap(this.player, this.hazards, (_player, hazard) => {
      ;(hazard as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.damagePlayer(`${this.definition.shortLabel} hit! Try to stay alive.`)
      this.refreshHud()
    })
    this.physics.add.overlap(this.player, this.prizes, (_player, prize) => {
      ;(prize as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.count += 1
      this.refreshHud()
      if (this.count >= this.goal) {
        this.clearChallenge()
      }
    })

    this.statusText.setText('Move with Left/Right. Collect blue cores. Avoid the red hazards.')
    this.time.addEvent({ delay: this.definition.kind === 'castle' ? 340 : 460, loop: true, callback: () => this.dropHazard() })
    this.time.addEvent({ delay: 1200, loop: true, callback: () => this.dropPrize() })
    this.time.addEvent({
      delay: 1000,
      repeat: this.secondsLeft - 1,
      callback: () => {
        this.secondsLeft -= 1
        this.refreshHud()
        if (this.secondsLeft <= 0 && this.count < this.goal) {
          this.finishFailure('Time ran out before you finished the challenge.')
        }
      },
    })
  }

  private decorateDungeonRoom(): void {
    const theme = this.getRoomTheme()
    const g = this.add.graphics()
    g.fillStyle(theme.floor, 1)
    g.fillRect(34, 498, 892, 22)
    g.fillStyle(theme.shadow, 0.88)
    g.fillRect(34, 132, 892, 10)
    g.lineStyle(2, theme.accent, 0.72)
    g.strokeRoundedRect(34, 132, 892, 388, 5)

    if (this.definition.stageKey === 'stage1') {
      g.lineStyle(3, theme.accent, 0.55)
      for (let y = 380; y <= 456; y += 22) {
        g.beginPath()
        g.moveTo(70, y)
        for (let x = 70; x <= 900; x += 48) g.lineTo(x, y + Math.sin(x * 0.04) * 7)
        g.strokePath()
      }
    } else if (this.definition.stageKey === 'rocky-caverns') {
      g.fillStyle(theme.accent, 0.5)
      for (let i = 0; i < 9; i += 1) g.fillCircle(90 + i * 100, 470 - (i % 3) * 14, 14 + (i % 2) * 8)
    } else if (this.definition.stageKey === 'bloody-hills') {
      g.fillStyle(theme.accent, 0.58)
      for (let i = 0; i < 8; i += 1) {
        const x = 92 + i * 112
        g.fillCircle(x, 174 + (i % 3) * 18, 10)
        g.fillTriangle(x - 10, 176 + (i % 3) * 18, x + 10, 176 + (i % 3) * 18, x, 204 + (i % 3) * 18)
      }
      g.lineStyle(4, 0xffe5d0, 0.7)
      for (let i = 0; i < 6; i += 1) {
        const x = 128 + i * 136
        g.beginPath()
        g.moveTo(x, 452)
        g.lineTo(x + 42, 426)
        g.moveTo(x + 8, 426)
        g.lineTo(x + 48, 454)
        g.strokePath()
      }
    } else if (this.definition.stageKey === 'laser-alley') {
      g.lineStyle(3, theme.accent, 0.58)
      for (let i = 0; i < 7; i += 1) {
        g.lineBetween(80 + i * 140, 160, 190 + i * 110, 480)
      }
    } else if (this.definition.stageKey === 'lava-bog') {
      g.fillStyle(theme.accent, 0.7)
      for (let i = 0; i < 6; i += 1) g.fillEllipse(130 + i * 150, 470, 76, 18)
    } else {
      g.lineStyle(3, theme.accent, 0.65)
      for (let i = 0; i < 8; i += 1) g.strokeTriangle(95 + i * 105, 464, 125 + i * 105, 416, 155 + i * 105, 464)
    }

    const modeLabel = this.definition.mode === 'meteor'
      ? 'DODGE'
      : this.definition.mode === 'rope'
        ? 'JUMP'
        : this.definition.mode === 'timing'
          ? 'LOCK'
          : this.definition.mode === 'memory'
            ? 'MEMORY'
            : this.definition.mode === 'waterfall'
              ? 'RUSH'
              : 'CHASE'
    this.add.text(776, 144, modeLabel, {
      ...TEXT_STYLE,
      color: theme.text,
      fontSize: '18px',
      fixedWidth: 130,
      align: 'right',
    })
  }

  private getRoomTheme(): { floor: number; shadow: number; accent: number; text: string } {
    if (this.definition.stageKey === 'rocky-caverns') return { floor: 0x343245, shadow: 0x171824, accent: 0xb7a06a, text: '#f1d68a' }
    if (this.definition.stageKey === 'bloody-hills') return { floor: 0x43212d, shadow: 0x21111a, accent: 0xff4f6e, text: '#ffd4dd' }
    if (this.definition.stageKey === 'laser-alley') return { floor: 0x22384b, shadow: 0x111c2e, accent: 0x52f2ff, text: '#c6fbff' }
    if (this.definition.stageKey === 'lava-bog') return { floor: 0x4a2c25, shadow: 0x24130f, accent: 0xff9b42, text: '#ffd8aa' }
    if (this.definition.stageKey === 'forge-of-origins') return { floor: 0x332a4f, shadow: 0x19142a, accent: 0xa8ff6a, text: '#dfffc8' }
    return { floor: 0x223a4f, shadow: 0x121b2c, accent: 0x55c6ff, text: '#d5f4ff' }
  }

  private updateDodgeCollectChallenge(): void {
    const speed = this.definition.kind === 'castle' ? 335 : 310
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed)
    } else {
      this.player.setVelocityX(0)
    }

    this.hazards.children.each((child) => {
      const hazard = child as Phaser.Physics.Arcade.Image
      if (hazard.y > 530) hazard.disableBody(true, true)
      return true
    })
    this.prizes.children.each((child) => {
      const prize = child as Phaser.Physics.Arcade.Image
      if (prize.y > 530) prize.disableBody(true, true)
      return true
    })
  }

  private createRopeChallenge(): void {
    this.createPixelTexture('rope-player-generic', 0xffd166, 34, 48)
    this.player = this.physics.add.sprite(260, 414, 'rope-player-generic')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(900)
    const floor = this.add.rectangle(480, 472, 880, 28, 0x3e2a35, 1)
    this.physics.add.existing(floor, true)
    this.physics.add.collider(this.player, floor)
    const ropeKey = this.definition.stageKey === 'laser-alley' ? 'laser-rope' : 'dungeon-rope'
    if (ropeKey === 'laser-rope') {
      this.createPixelTexture('laser-rope', 0x52f2ff, 132, 14)
    }
    this.rope = this.physics.add.image(1040, 426, ropeKey)
    ;(this.rope.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.rope.setVisible(false)
    this.rope.setActive(false)
    this.physics.add.overlap(this.player, this.rope, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body
      if (!body.blocked.down) return
      this.damagePlayer(this.definition.stageKey === 'laser-alley' ? 'The laser rope clipped you. Time the jump.' : 'The rope clipped you. Keep jumping the rhythm.')
      this.refreshHud()
    })
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.statusText.setText(this.definition.stageKey === 'laser-alley' ? 'Jump with Up or Space. Clear every laser rope.' : 'Jump with Up or Space. Clear every rope swing.')
    this.time.delayedCall(700, () => this.launchRope())
  }

  private createWaterfallRushChallenge(): void {
    this.goal = 7
    this.createPixelTexture('waterfall-player', 0xffd166, 34, 46)
    this.player = this.physics.add.sprite(480, 438, 'waterfall-player')
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.player.setCollideWorldBounds(true)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.statusText.setText('Move with Left/Right. Dotted lines show where waterfalls will crash next.')
    this.time.delayedCall(650, () => this.launchWaterfallRound())
  }

  private createTimingChallenge(): void {
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.timingZoneX = Phaser.Math.Between(390, 570)
    this.add.rectangle(480, 292, 600, 22, 0x2b3346, 1)
    this.timingZone = this.add.rectangle(this.timingZoneX, 292, this.definition.kind === 'castle' ? 58 : 76, 34, 0x55c6ff, 0.62)
    this.timingCursor = this.add.rectangle(190, 292, 14, 72, 0xffd166, 1)
    this.statusText.setText('Press Space when the gold needle is inside the blue lock window.')
  }

  private updateTimingChallenge(): void {
    const speed = this.definition.kind === 'castle' ? 7.4 : 5.8
    this.timingCursor.x += this.timingDir * speed
    if (this.timingCursor.x > 780 || this.timingCursor.x < 180) {
      this.timingDir *= -1
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const halfWidth = this.definition.kind === 'castle' ? 34 : 44
      if (Math.abs(this.timingCursor.x - this.timingZoneX) <= halfWidth) {
        this.count += 1
        this.timingZoneX = Phaser.Math.Between(390, 570)
        this.timingZone.x = this.timingZoneX
      } else {
        this.damagePlayer('Missed the lock window.')
      }
      if (this.count >= this.goal) {
        this.clearChallenge()
      }
      this.refreshHud()
    }
  }

  private createMemoryChallenge(): void {
    const keys = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    this.memorySequence = Array.from({ length: this.definition.kind === 'castle' ? 6 : 4 }, () => keys[Phaser.Math.Between(0, keys.length - 1)])
    this.goal = this.memorySequence.length
    this.memoryIndex = 0
    this.memoryShowing = true
    this.memoryText = this.add.text(480, 260, this.memorySequence.join('  '), {
      ...TEXT_STYLE,
      color: '#fff4d1',
      fontSize: '38px',
      fixedWidth: 820,
      align: 'center',
    })
    this.memoryText.setOrigin(0.5)
    this.statusText.setText('Memorize the monster pattern. Then repeat it with the arrow keys.')
    this.time.delayedCall(this.definition.kind === 'castle' ? 1800 : 2200, () => {
      this.memoryShowing = false
      this.memoryText.setText('Your turn')
    })
    this.memoryKeys = {
      UP: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    }
  }

  private updateMemoryChallenge(): void {
    if (this.memoryShowing) {
      return
    }
    const pressed = this.getPressedMemoryKey()
    if (!pressed) {
      return
    }
    this.handleMemoryPress(pressed)
  }

  private getPressedMemoryKey(): string | null {
    if (Phaser.Input.Keyboard.JustDown(this.memoryKeys.UP)) return 'UP'
    if (Phaser.Input.Keyboard.JustDown(this.memoryKeys.DOWN)) return 'DOWN'
    if (Phaser.Input.Keyboard.JustDown(this.memoryKeys.LEFT)) return 'LEFT'
    if (Phaser.Input.Keyboard.JustDown(this.memoryKeys.RIGHT)) return 'RIGHT'
    return null
  }

  private handleMemoryPress(pressed: string): void {
    if (pressed !== this.memorySequence[this.memoryIndex]) {
      this.memoryIndex = 0
      this.count = 0
      this.damagePlayer('Wrong rune. The pattern resets.')
      this.memoryText.setText('Reset')
      this.time.delayedCall(420, () => {
        if (!this.failed) this.memoryText.setText('Try again')
      })
      this.refreshHud()
      return
    }
    this.memoryIndex += 1
    this.count = this.memoryIndex
    this.memoryText.setText(`${this.count}/${this.goal}`)
    this.refreshHud()
    if (this.memoryIndex >= this.memorySequence.length) {
      this.clearChallenge()
    }
  }

  private createChaseChallenge(): void {
    this.createPixelTexture('chase-player', 0x7be7ff, 30, 38)
    this.createPixelTexture('chase-monster', 0xff5757, 34, 34)
    this.createPixelTexture('chase-key', 0xffd166, 22, 22)
    this.player = this.physics.add.sprite(180, 430, 'chase-player')
    ;(this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.player.setCollideWorldBounds(true)
    this.chaser = this.physics.add.image(760, 180, 'chase-monster')
    ;(this.chaser.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.prizes = this.physics.add.group({ allowGravity: false })
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.physics.add.overlap(this.player, this.chaser, () => {
      this.damagePlayer('The monster caught you.')
      this.player.setPosition(180, 430)
      this.refreshHud()
    })
    this.physics.add.overlap(this.player, this.prizes, (_player, prize) => {
      ;(prize as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.count += 1
      this.refreshHud()
      if (this.count >= this.goal) this.clearChallenge()
    })
    for (let i = 0; i < this.goal; i += 1) {
      const prize = this.prizes.get(Phaser.Math.Between(140, 820), Phaser.Math.Between(160, 440), 'chase-key') as Phaser.Physics.Arcade.Image
      prize.enableBody(true, prize.x, prize.y, true, true)
    }
    this.statusText.setText('Move with arrow keys. Grab keys while the monster chases you.')
  }

  private updateChaseChallenge(): void {
    const speed = 230
    this.player.setVelocity(0, 0)
    if (this.cursors.left.isDown) this.player.setVelocityX(-speed)
    if (this.cursors.right.isDown) this.player.setVelocityX(speed)
    if (this.cursors.up.isDown) this.player.setVelocityY(-speed)
    if (this.cursors.down.isDown) this.player.setVelocityY(speed)

    const chaseSpeed = this.definition.kind === 'castle' ? 118 : 92
    this.physics.moveToObject(this.chaser, this.player, chaseSpeed)
  }

  private updateWaterfallRushChallenge(): void {
    const speed = 315
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed)
    } else {
      this.player.setVelocityX(0)
    }
  }

  private launchWaterfallRound(): void {
    if (this.cleared || this.failed || this.waterfallRoundActive) return
    this.waterfallRoundActive = true
    this.clearWaterfallMarkers()
    const columns = [156, 264, 372, 480, 588, 696, 804]
    const shuffled = Phaser.Utils.Array.Shuffle([...columns])
    const dangerCount = this.count < 3 ? 2 : 3
    const dangerColumns = shuffled.slice(0, dangerCount)
    const warning = this.add.graphics()
    warning.lineStyle(3, 0x9eeaff, 0.9)
    dangerColumns.forEach((x) => {
      for (let y = 150; y <= 468; y += 22) {
        warning.lineBetween(x, y, x, y + 11)
      }
    })
    this.waterfallWarnings.push(warning)
    this.time.delayedCall(850, () => this.dropWaterfalls(dangerColumns))
  }

  private dropWaterfalls(dangerColumns: number[]): void {
    if (this.cleared || this.failed) return
    this.clearWaterfallMarkers()
    dangerColumns.forEach((x) => {
      const hit = this.add.rectangle(x, 312, 76, 336, 0x55c6ff, 0.82)
      this.physics.add.existing(hit, true)
      this.waterfallHits.push(hit)
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body
      if (Math.abs(this.player.x - x) < 55 && playerBody) {
        this.damagePlayer('A boss waterfall crashed down on you.')
      }
    })
    this.count += 1
    this.refreshHud()
    if (this.count >= this.goal) {
      this.time.delayedCall(360, () => this.clearChallenge())
      return
    }
    this.time.delayedCall(420, () => {
      this.clearWaterfallMarkers()
      this.waterfallRoundActive = false
      this.time.delayedCall(430, () => this.launchWaterfallRound())
    })
  }

  private clearWaterfallMarkers(): void {
    this.waterfallWarnings.forEach((marker) => marker.destroy())
    this.waterfallWarnings = []
    this.waterfallHits.forEach((hit) => hit.destroy())
    this.waterfallHits = []
  }

  private updateRopeChallenge(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.cursors.up.isDown) && body.blocked.down) {
      this.player.setVelocityY(-520)
    }
    if (this.ropeActive && this.rope.x < -80) {
      this.ropeActive = false
      this.rope.disableBody(true, true)
      this.rope.setVisible(false)
      this.count += 1
      this.refreshHud()
      if (this.count >= this.goal) {
        this.clearChallenge()
      } else {
        this.time.delayedCall(Math.max(320, 880 - this.count * 55), () => this.launchRope())
      }
    }
  }

  private dropHazard(): void {
    if (this.cleared || this.failed) return
    const hazard = this.hazards.get(Phaser.Math.Between(70, 890), -20, 'dungeon-hazard') as Phaser.Physics.Arcade.Image
    if (!hazard) return
    hazard.enableBody(true, hazard.x, hazard.y, true, true)
    hazard.setVelocityY(Phaser.Math.Between(215, this.definition.kind === 'castle' ? 370 : 320))
    hazard.setAngularVelocity(Phaser.Math.Between(-180, 180))
  }

  private dropPrize(): void {
    if (this.cleared || this.failed) return
    const prize = this.prizes.get(Phaser.Math.Between(80, 880), -20, 'dungeon-prize') as Phaser.Physics.Arcade.Image
    if (!prize) return
    prize.enableBody(true, prize.x, prize.y, true, true)
    prize.setVelocityY(this.definition.mode === 'rune' ? 210 : 175)
    if (this.definition.mode === 'rune') {
      prize.setVelocityX(Phaser.Math.Between(-45, 45))
    }
  }

  private launchRope(): void {
    if (this.cleared || this.failed) return
    this.ropeActive = true
    this.rope.enableBody(true, 1040, 426, true, true)
    this.rope.setVelocityX(-360 - this.count * 24)
  }

  private clearChallenge(): void {
    const wasCleared = isMinigameCleared(this.definition.id)
    const message = wasCleared
      ? `${this.definition.title} replay complete. Nice run.`
      : `${this.definition.title} cleared. Platform parts added.`
    this.finishSuccess(message, () => {
      markMinigameCleared(this.definition.id, this.definition.rewardParts)
    })
  }

  private refreshHud(): void {
    const label = this.definition.mode === 'rope'
      ? 'Clears'
      : this.definition.mode === 'timing'
        ? 'Locks'
        : this.definition.mode === 'memory'
          ? 'Pattern'
          : this.definition.mode === 'chase'
            ? 'Keys'
            : this.definition.mode === 'waterfall'
              ? 'Rushes'
              : 'Cores'
    this.hudText.setText(`${label} ${this.count}/${this.goal}   Health ${this.health}   Reward ${this.definition.rewardParts} parts`)
  }
}
