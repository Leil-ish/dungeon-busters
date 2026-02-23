import Phaser from 'phaser'
import { gameProgress } from './progress'

type RockSpawnPoint = {
  x: number
  y: number
}

export class RockyCavernsScene extends Phaser.Scene {
  private readonly LEVEL_W = 2600
  private readonly LEVEL_H = 900

  private player!: Phaser.Physics.Arcade.Sprite
  private enemy1!: Phaser.Physics.Arcade.Sprite
  private enemy2!: Phaser.Physics.Arcade.Sprite
  private shots!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private uiText!: Phaser.GameObjects.Text
  private cavernBackdrop!: Phaser.GameObjects.TileSprite
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []

  private rocks!: Phaser.Physics.Arcade.Group
  private readonly maxRocks = 10
  private readonly rockSpawnPoints: RockSpawnPoint[] = [
    { x: 600, y: 80 },
    { x: 980, y: 80 },
    { x: 1240, y: 80 },
    { x: 1500, y: 80 },
    { x: 1840, y: 80 },
    { x: 2180, y: 80 },
  ]

  private stalactite!: Phaser.GameObjects.Rectangle
  private volcanoMan!: Phaser.Physics.Arcade.Sprite
  private rescueTrigger!: Phaser.GameObjects.Zone
  private exitDoor!: Phaser.GameObjects.Rectangle

  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneLineIndex = 0
  private cutsceneActive = true
  private inRescueSequence = false
  private spaceKey!: Phaser.Input.Keyboard.Key

  private readonly moveAcceleration = 900
  private readonly normalDragX = 900
  private readonly normalMaxVelocityX = 260
  private readonly playerSpawnX = 140
  private readonly playerSpawnY = 690
  private readonly hitInvulnerabilityMs = 900
  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private readonly enemy1PatrolMinX = 1120
  private readonly enemy1PatrolMaxX = 1340
  private readonly enemy2PatrolMinX = 1890
  private readonly enemy2PatrolMaxX = 2130
  private readonly enemyPatrolSpeed = 80
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0

  private statusMessage = 'Reach the stalactite chamber.'
  private readonly stageName = 'Stage 2: Rocky Caverns'
  private readonly heroName = 'Electroman'
  private rescueDone = false
  private stageClearTriggered = false
  private nextRockTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('rocky-caverns')
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#0c0d12')

    this.createTextures()

    this.cavernBackdrop = this.add.tileSprite(480, 270, 960, 540, 'cavern-stripes')
    this.cavernBackdrop.setDepth(-20)
    this.cavernBackdrop.setScrollFactor(0)

    this.buildLevelGeometry()

    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, 'player-block')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.normalMaxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)

    this.createEnemiesAndWeaponSystem()
    this.createFallingRocksHazard()
    this.createRescueObjects()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#f3f6ff',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      backgroundColor: '#05060ecc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setDepth(30)
    this.uiText.setScrollFactor(0)
    this.updateUiText()

    this.initializeIntroCutscene()
  }

  update(): void {
    this.cavernBackdrop.tilePositionY += 0.2

    if (this.cutsceneActive) {
      this.player.setAccelerationX(0)
      this.player.setVelocityX(0)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.advanceCutscene()
      }
      return
    }

    if (this.cursors.left.isDown) {
      this.player.setAccelerationX(-this.moveAcceleration)
      this.facingDir = -1
    } else if (this.cursors.right.isDown) {
      this.player.setAccelerationX(this.moveAcceleration)
      this.facingDir = 1
    } else {
      this.player.setAccelerationX(0)
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.fireShot()
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.cursors.up.isDown && body.blocked.down) {
      this.player.setVelocityY(-520)
    }

    if (!this.rescueDone && this.physics.overlap(this.player, this.rescueTrigger)) {
      this.startRescueSequence()
    }

    if (this.rescueDone && this.physics.overlap(this.player, this.exitDoor) && !this.stageClearTriggered) {
      this.stageClearTriggered = true
      gameProgress.cavernMapPiece = true
      this.statusMessage = 'STAGE CLEAR! Returning to stage select...'
      this.updateUiText()
      this.time.delayedCall(1200, () => this.scene.start('stage-select'))
    }

    this.updateEnemyPatrols()
    this.cleanupRocks()
  }

  private createTextures(): void {
    const gfx = this.add.graphics({ x: 0, y: 0 })
    gfx.setVisible(false)

    if (!this.textures.exists('player-block')) {
      gfx.fillStyle(0xf2ca52, 1)
      gfx.fillRect(0, 0, 40, 60)
      gfx.generateTexture('player-block', 40, 60)
      gfx.clear()
    }

    if (!this.textures.exists('cavern-stripes')) {
      gfx.fillStyle(0x1a1d28, 1)
      gfx.fillRect(0, 0, 64, 64)
      gfx.fillStyle(0x2f364a, 0.5)
      gfx.fillRect(0, 0, 64, 10)
      gfx.fillRect(0, 24, 64, 8)
      gfx.fillRect(0, 46, 64, 6)
      gfx.generateTexture('cavern-stripes', 64, 64)
      gfx.clear()
    }

    if (!this.textures.exists('rock-hazard')) {
      gfx.fillStyle(0x6a5a46, 1)
      gfx.fillCircle(12, 12, 12)
      gfx.generateTexture('rock-hazard', 24, 24)
      gfx.clear()
    }

    if (!this.textures.exists('volcano-man')) {
      gfx.fillStyle(0x7a4b2a, 1)
      gfx.fillRect(0, 0, 26, 46)
      gfx.fillStyle(0xb8302c, 1)
      gfx.fillRect(26, 0, 26, 46)
      gfx.generateTexture('volcano-man', 52, 46)
      gfx.clear()
    }

    if (!this.textures.exists('enemy-block')) {
      gfx.fillStyle(0xff6a6a, 1)
      gfx.fillRect(0, 0, 44, 44)
      gfx.generateTexture('enemy-block', 44, 44)
      gfx.clear()
    }

    if (!this.textures.exists('electro-shot')) {
      gfx.fillStyle(0x7bf4ff, 1)
      gfx.fillRect(0, 0, 16, 8)
      gfx.generateTexture('electro-shot', 16, 8)
    }

    gfx.destroy()
  }

  private buildLevelGeometry(): void {
    const platforms: Array<[number, number, number, number, number]> = [
      [250, 860, 500, 80, 0x3f3a34],
      [790, 860, 340, 80, 0x3f3a34],
      [1200, 860, 260, 80, 0x3f3a34],
      [1550, 860, 280, 80, 0x3f3a34],
      [1910, 860, 230, 80, 0x3f3a34],
      [2330, 860, 360, 80, 0x3f3a34],
      [980, 730, 220, 24, 0x595047],
      [1230, 640, 220, 24, 0x595047],
      [1490, 560, 200, 24, 0x595047],
      [1740, 470, 200, 24, 0x595047],
      [2010, 380, 240, 24, 0x595047],
      [2220, 360, 220, 24, 0x595047],
      [1330, 590, 360, 20, 0x2b2f3a],
    ]

    this.staticPlatforms = platforms.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))
  }

  private createFallingRocksHazard(): void {
    this.rocks = this.physics.add.group({
      maxSize: this.maxRocks,
      allowGravity: true,
    })

    this.physics.add.collider(this.rocks, this.staticPlatforms, (obj1, obj2) => {
      const maybeRock1 = obj1 as unknown as { texture?: { key?: string } }
      const maybeRock2 = obj2 as unknown as { texture?: { key?: string } }
      const rockCandidate =
        maybeRock1.texture?.key === 'rock-hazard'
          ? (obj1 as Phaser.GameObjects.GameObject)
          : maybeRock2.texture?.key === 'rock-hazard'
            ? (obj2 as Phaser.GameObjects.GameObject)
            : null

      if (!rockCandidate) {
        return
      }

      const rock = rockCandidate as Phaser.Physics.Arcade.Image
      const rockBody = rock.body as Phaser.Physics.Arcade.Body | null
      if (!rockBody) {
        return
      }

      rockBody.setVelocity(0, 0)
      rockBody.setAngularVelocity(0)

      this.time.delayedCall(600, () => {
        if (rock.active) {
          rock.disableBody(true, true)
        }
      })
    })

    this.physics.add.overlap(this.player, this.rocks, () => this.handleRockHit())

    this.scheduleNextRockDrop()
  }

  private createEnemiesAndWeaponSystem(): void {
    this.enemy1 = this.physics.add.sprite(this.enemy1PatrolMaxX, 598, 'enemy-block')
    this.enemy1.setCollideWorldBounds(true)
    this.enemy1.setImmovable(true)
    ;(this.enemy1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy1.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy1, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy1, () => this.handleEnemyHit())

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 338, 'enemy-block')
    this.enemy2.setCollideWorldBounds(true)
    this.enemy2.setImmovable(true)
    ;(this.enemy2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy2.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy2, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy2, () => this.handleEnemyHit())

    this.shots = this.physics.add.group({
      allowGravity: false,
      maxSize: 10,
    })

    this.physics.add.collider(this.shots, this.staticPlatforms, (obj1, obj2) => {
      const maybeShot1 = obj1 as unknown as { texture?: { key?: string } }
      const maybeShot2 = obj2 as unknown as { texture?: { key?: string } }
      const shotCandidate =
        maybeShot1.texture?.key === 'electro-shot'
          ? (obj1 as Phaser.GameObjects.GameObject)
          : maybeShot2.texture?.key === 'electro-shot'
            ? (obj2 as Phaser.GameObjects.GameObject)
            : null

      if (!shotCandidate) {
        return
      }

      const shot = shotCandidate as Phaser.Physics.Arcade.Image
      shot.disableBody(true, true)
    })
    this.physics.add.overlap(this.shots, this.enemy1, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.enemy2, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
  }

  private scheduleNextRockDrop(): void {
    const delay = Phaser.Math.Between(1200, 2400)
    this.nextRockTimer = this.time.delayedCall(delay, () => {
      if (!this.scene.isActive()) {
        return
      }

      this.dropRockWave()
      this.scheduleNextRockDrop()
    })
  }

  private dropRockWave(): void {
    const spawn = Phaser.Utils.Array.GetRandom(this.rockSpawnPoints)

    const warn = this.add.circle(spawn.x, spawn.y + 22, 10, 0xffd98f, 0.8)
    warn.setDepth(15)
    this.tweens.add({
      targets: warn,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 280,
      onComplete: () => warn.destroy(),
    })

    this.time.delayedCall(300, () => {
      const rock = this.rocks.get(spawn.x, spawn.y, 'rock-hazard') as Phaser.Physics.Arcade.Image | null
      if (!rock) {
        return
      }

      rock.setActive(true)
      rock.setVisible(true)
      rock.enableBody(true, spawn.x, spawn.y, true, true)
      rock.setGravityY(1250)
      rock.setVelocity(Phaser.Math.Between(-20, 20), Phaser.Math.Between(90, 140))
      rock.setBounce(0.05)
      rock.setAngularVelocity(Phaser.Math.Between(-120, 120))
    })
  }

  private cleanupRocks(): void {
    const children = this.rocks.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const rock of children) {
      if (!rock.active) {
        continue
      }

      if (rock.y > this.LEVEL_H + 180) {
        rock.disableBody(true, true)
      }
    }
  }

  private createRescueObjects(): void {
    this.stalactite = this.add.rectangle(2210, 150, 90, 160, 0x6c6f78)

    this.volcanoMan = this.physics.add.sprite(2210, 155, 'volcano-man')
    this.volcanoMan.setVisible(false)
    this.volcanoMan.disableBody(true, true)

    this.physics.add.collider(this.volcanoMan, this.staticPlatforms)

    this.rescueTrigger = this.add.zone(2190, 360, 220, 260)
    this.physics.add.existing(this.rescueTrigger, true)

    this.exitDoor = this.add.rectangle(this.LEVEL_W - 120, this.LEVEL_H - 150, 54, 140, 0x6d90ff)
    this.exitDoor.setAlpha(0.35)
    this.physics.add.existing(this.exitDoor, true)
  }

  private startRescueSequence(): void {
    if (this.inRescueSequence || this.rescueDone) {
      return
    }

    this.inRescueSequence = true
    this.cutsceneActive = true
    this.player.setAccelerationX(0)
    this.player.setVelocity(0, 0)

    this.stalactite.setFillStyle(0x9b6a65)
    this.statusMessage = 'The stalactite is cracking...'
    this.updateUiText()

    this.time.delayedCall(400, () => {
      this.tweens.add({
        targets: this.stalactite,
        angle: 8,
        yoyo: true,
        repeat: 2,
        duration: 110,
      })
    })

    this.time.delayedCall(820, () => {
      this.stalactite.destroy()
      this.volcanoMan.enableBody(true, 2210, 160, true, true)
      this.volcanoMan.setVisible(true)
      this.volcanoMan.setGravityY(900)
      this.volcanoMan.setVelocityY(80)
    })

    this.time.delayedCall(1700, () => {
      this.volcanoMan.setVelocity(0, 0)
      this.volcanoMan.setImmovable(true)
      ;(this.volcanoMan.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

      this.cutsceneLines = [
        "Volcano Man: Finally! Let's melt something.",
        'Exit route unlocked. Move out!',
        'Press Space to continue.',
      ]
      this.cutsceneLineIndex = 0
      this.showCutscenePanel(this.cutsceneLines[0])

      this.rescueDone = true
      gameProgress.volcanoManRescued = true
      this.statusMessage = 'Volcano Man rescued.'
      this.exitDoor.setAlpha(1)
      this.updateUiText()
    })
  }

  private handleRockHit(): void {
    if (this.isPlayerInvulnerable || this.cutsceneActive) {
      return
    }

    this.isPlayerInvulnerable = true
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY)
    this.player.setVelocity(0, 0)
    this.player.setAccelerationX(0)
    this.player.setTint(0xffb5b5)
    this.statusMessage = 'Rock hit! Watch the ceiling.'
    this.updateUiText()

    this.time.delayedCall(this.hitInvulnerabilityMs, () => {
      this.isPlayerInvulnerable = false
      this.player.clearTint()
    })
  }

  private handleEnemyHit(): void {
    if (this.isPlayerInvulnerable || this.cutsceneActive) {
      return
    }

    this.isPlayerInvulnerable = true
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY)
    this.player.setVelocity(0, 0)
    this.player.setAccelerationX(0)
    this.player.setTint(0xffb5b5)
    this.statusMessage = 'Enemy hit! Try again.'
    this.updateUiText()

    this.time.delayedCall(this.hitInvulnerabilityMs, () => {
      this.isPlayerInvulnerable = false
      this.player.clearTint()
    })
  }

  private fireShot(): void {
    const now = this.time.now
    if (now - this.lastShotAt < this.shotCooldownMs) {
      return
    }

    const shot = this.shots.get(this.player.x + this.facingDir * 30, this.player.y - 8, 'electro-shot') as
      | Phaser.Physics.Arcade.Image
      | null
    if (!shot) {
      return
    }

    this.lastShotAt = now
    shot.setActive(true)
    shot.setVisible(true)
    shot.enableBody(true, shot.x, shot.y, true, true)
    shot.setVelocityX(this.facingDir * this.shotSpeed)
    this.time.delayedCall(900, () => shot.disableBody(true, true))
  }

  private handleEnemyShot(shot: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active) {
      return
    }

    shot.disableBody(true, true)
    enemy.disableBody(true, true)
    this.statusMessage = 'Enemy down!'
    this.updateUiText()
  }

  private updateEnemyPatrols(): void {
    if (this.enemy1.active) {
      if (this.enemy1.x <= this.enemy1PatrolMinX) {
        this.enemy1.setVelocityX(this.enemyPatrolSpeed)
      } else if (this.enemy1.x >= this.enemy1PatrolMaxX) {
        this.enemy1.setVelocityX(-this.enemyPatrolSpeed)
      }
    }

    if (this.enemy2.active) {
      if (this.enemy2.x <= this.enemy2PatrolMinX) {
        this.enemy2.setVelocityX(this.enemyPatrolSpeed)
      } else if (this.enemy2.x >= this.enemy2PatrolMaxX) {
        this.enemy2.setVelocityX(-this.enemyPatrolSpeed)
      }
    }
  }

  private initializeIntroCutscene(): void {
    this.cutsceneLines = [
      'Inspector Glowman: Rocky Caverns ahead. Stay alert.',
      'Electroman: I hear movement above us.',
      'Mission: Rescue Volcano Man and escape with the Cavern Map Piece.',
      'Press Space to start.',
    ]
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true
    this.showCutscenePanel(this.cutsceneLines[0])
  }

  private showCutscenePanel(line: string): void {
    if (!this.cutscenePanel || !this.cutsceneText) {
      this.cutscenePanel = this.add.rectangle(480, 430, 900, 190, 0x050812, 0.82)
      this.cutscenePanel.setStrokeStyle(2, 0x8ab8ff, 0.95)
      this.cutscenePanel.setScrollFactor(0)
      this.cutscenePanel.setDepth(40)

      this.cutsceneText = this.add.text(66, 360, '', {
        color: '#f4f7ff',
        fontSize: '24px',
        fontFamily: 'sans-serif',
        wordWrap: { width: 840 },
        lineSpacing: 8,
      })
      this.cutsceneText.setScrollFactor(0)
      this.cutsceneText.setDepth(41)
    }

    this.cutscenePanel.setVisible(true)
    this.cutsceneText.setVisible(true)
    this.cutsceneText.setText(line)
  }

  private advanceCutscene(): void {
    this.cutsceneLineIndex += 1
    if (this.cutsceneLineIndex >= this.cutsceneLines.length) {
      this.endCutscene()
      return
    }

    this.cutsceneText.setText(this.cutsceneLines[this.cutsceneLineIndex])
  }

  private endCutscene(): void {
    this.cutsceneActive = false
    this.inRescueSequence = false
    this.cutscenePanel.setVisible(false)
    this.cutsceneText.setVisible(false)

    if (!this.rescueDone) {
      this.statusMessage = 'Find Volcano Man.'
    }
    this.updateUiText()
  }

  private updateUiText(): void {
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.heroName}`,
        `Volcano Man: ${this.rescueDone ? 'Rescued' : 'Missing'}`,
        `Cavern Map Piece: ${gameProgress.cavernMapPiece ? 'Yes' : 'No'}`,
        this.statusMessage,
      ].join('\n'),
    )
  }

  private createStaticPlatform(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    color: number,
  ): Phaser.GameObjects.Rectangle {
    const platform = this.add.rectangle(centerX, centerY, width, height, color)
    this.physics.add.existing(platform, true)
    return platform
  }

  shutdown(): void {
    this.nextRockTimer?.remove(false)
  }
}
