import Phaser from 'phaser'
import { gameProgress } from './progress'

type BloodCloud = {
  x: number
  y: number
  width: number
}

export class BloodyHillsScene extends Phaser.Scene {
  private readonly LEVEL_W = 2800
  private readonly LEVEL_H = 900

  private player!: Phaser.Physics.Arcade.Sprite
  private enemy1!: Phaser.Physics.Arcade.Sprite
  private enemy2!: Phaser.Physics.Arcade.Sprite
  private shots!: Phaser.Physics.Arcade.Group
  private bloodDrops!: Phaser.Physics.Arcade.Group

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private spaceKey!: Phaser.Input.Keyboard.Key
  private uiText!: Phaser.GameObjects.Text
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []
  private slipperyZones: Phaser.Geom.Rectangle[] = []
  private bloodClouds: BloodCloud[] = []

  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneLineIndex = 0
  private cutsceneActive = true
  private rescueSequenceActive = false

  private frozenPod!: Phaser.GameObjects.Rectangle
  private icemeckel!: Phaser.Physics.Arcade.Sprite
  private rescueTrigger!: Phaser.GameObjects.Zone
  private exitDoor!: Phaser.GameObjects.Rectangle

  private readonly moveAcceleration = 900
  private readonly normalDragX = 900
  private readonly slipperyDragX = 190
  private readonly normalMaxVelocityX = 260
  private readonly slipperyMaxVelocityX = 320

  private readonly playerSpawnX = 140
  private readonly playerSpawnY = 700
  private readonly hitInvulnerabilityMs = 900
  private isPlayerInvulnerable = false

  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private facingDir = 1
  private lastShotAt = 0

  private readonly enemy1PatrolMinX = 980
  private readonly enemy1PatrolMaxX = 1200
  private readonly enemy2PatrolMinX = 2140
  private readonly enemy2PatrolMaxX = 2380
  private readonly enemyPatrolSpeed = 80

  private stageClearTriggered = false
  private rescueDone = false
  private statusMessage = 'Track the blood trail and find Icemeckel.'
  private readonly stageName = 'Stage 3: Bloody Hills'
  private readonly heroName = 'Electroman'
  private nextBloodCloudTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('bloody-hills')
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#1b0b11')

    this.createTextures()
    this.createBackdrop()
    this.buildLevelGeometry()

    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, 'player-block')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.normalMaxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)

    this.createEnemiesAndWeaponSystem()
    this.createBloodCloudHazard()
    this.createRescueObjects()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#ffe9f1',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      backgroundColor: '#15070ecc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setDepth(40)
    this.uiText.setScrollFactor(0)
    this.updateUiText()

    this.initializeIntroCutscene()
  }

  update(): void {
    if (this.cutsceneActive) {
      this.player.setAccelerationX(0)
      this.player.setVelocityX(0)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.advanceCutscene()
      }
      return
    }

    const isInSlipperyZone = this.slipperyZones.some((zone) =>
      Phaser.Geom.Rectangle.Contains(zone, this.player.x, this.player.y),
    )
    if (isInSlipperyZone) {
      this.player.setDragX(this.slipperyDragX)
      this.player.setMaxVelocity(this.slipperyMaxVelocityX, 900)
    } else {
      this.player.setDragX(this.normalDragX)
      this.player.setMaxVelocity(this.normalMaxVelocityX, 900)
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
      gameProgress.bloodyMapPiece = true
      this.statusMessage = 'STAGE CLEAR! Returning to stage select...'
      this.updateUiText()
      this.time.delayedCall(1200, () => this.scene.start('stage-select'))
    }

    this.updateEnemyPatrols()
    this.cleanupBloodDrops()
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
      gfx.clear()
    }

    if (!this.textures.exists('blood-drop')) {
      gfx.fillStyle(0xd10f2f, 1)
      gfx.fillRect(0, 0, 8, 18)
      gfx.generateTexture('blood-drop', 8, 18)
      gfx.clear()
    }

    if (!this.textures.exists('icemeckel')) {
      gfx.fillStyle(0x8de6ff, 1)
      gfx.fillRect(0, 0, 22, 46)
      gfx.fillStyle(0xd9fbff, 1)
      gfx.fillRect(22, 0, 22, 46)
      gfx.generateTexture('icemeckel', 44, 46)
      gfx.clear()
    }

    if (!this.textures.exists('bloody-stripes')) {
      gfx.fillStyle(0x2a0f17, 1)
      gfx.fillRect(0, 0, 64, 64)
      gfx.fillStyle(0x6d1a2c, 0.4)
      gfx.fillRect(0, 0, 64, 8)
      gfx.fillRect(0, 20, 64, 6)
      gfx.fillRect(0, 43, 64, 8)
      gfx.generateTexture('bloody-stripes', 64, 64)
    }

    gfx.destroy()
  }

  private createBackdrop(): void {
    const bg = this.add.tileSprite(480, 270, 960, 540, 'bloody-stripes')
    bg.setDepth(-20)
    bg.setScrollFactor(0)
  }

  private buildLevelGeometry(): void {
    const platforms: Array<[number, number, number, number, number]> = [
      [240, 860, 480, 80, 0x5a1e2c],
      [770, 860, 360, 80, 0x5a1e2c],
      [1190, 860, 280, 80, 0x5a1e2c],
      [1540, 860, 220, 80, 0x5a1e2c],
      [1880, 860, 300, 80, 0x5a1e2c],
      [2310, 860, 300, 80, 0x5a1e2c],
      [2610, 860, 220, 80, 0x5a1e2c],
      [1080, 760, 220, 24, 0x763448],
      [1350, 710, 220, 24, 0x763448],
      [1610, 650, 210, 24, 0x763448],
      [1880, 590, 210, 24, 0x763448],
      [2140, 530, 230, 24, 0x763448],
      [2430, 470, 220, 24, 0x763448],
      [1450, 760, 480, 16, 0x3b1821],
    ]

    this.staticPlatforms = platforms.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))

    this.slipperyZones = [
      this.createSlipperyPatch(580, 820, 220, 80),
      this.createSlipperyPatch(1450, 820, 280, 80),
      this.createSlipperyPatch(2120, 340, 230, 70),
    ]
  }

  private createSlipperyPatch(centerX: number, centerY: number, width: number, height: number): Phaser.Geom.Rectangle {
    this.add.rectangle(centerX, centerY, width, height, 0x8f142f, 0.42)
    this.add.rectangle(centerX - width / 4, centerY, 22, 18, 0xe9e0dc, 0.85)
    this.add.rectangle(centerX + width / 5, centerY - 6, 28, 14, 0xd8cdc8, 0.82)
    return new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height)
  }

  private createEnemiesAndWeaponSystem(): void {
    this.enemy1 = this.physics.add.sprite(this.enemy1PatrolMaxX, 726, 'enemy-block')
    this.enemy1.setCollideWorldBounds(true)
    this.enemy1.setImmovable(true)
    ;(this.enemy1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy1.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy1, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy1, () => this.handleEnemyHit())

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 496, 'enemy-block')
    this.enemy2.setCollideWorldBounds(true)
    this.enemy2.setImmovable(true)
    ;(this.enemy2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy2.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy2, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy2, () => this.handleEnemyHit())

    this.shots = this.physics.add.group({
      allowGravity: false,
      maxSize: 12,
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

  private createBloodCloudHazard(): void {
    this.bloodClouds = [
      { x: 980, y: 130, width: 120 },
      { x: 1530, y: 120, width: 140 },
      { x: 2060, y: 110, width: 130 },
    ]

    for (const cloud of this.bloodClouds) {
      this.add.ellipse(cloud.x, cloud.y, cloud.width, 52, 0x5a1c2a, 0.92)
      this.add.ellipse(cloud.x - 24, cloud.y + 6, cloud.width * 0.55, 40, 0x6d2435, 0.9)
      this.add.ellipse(cloud.x + 24, cloud.y + 6, cloud.width * 0.52, 40, 0x6d2435, 0.9)
    }

    this.bloodDrops = this.physics.add.group({
      allowGravity: true,
      maxSize: 20,
    })

    this.physics.add.collider(this.bloodDrops, this.staticPlatforms, (obj1, obj2) => {
      const maybeDrop1 = obj1 as unknown as { texture?: { key?: string } }
      const maybeDrop2 = obj2 as unknown as { texture?: { key?: string } }
      const dropCandidate =
        maybeDrop1.texture?.key === 'blood-drop'
          ? (obj1 as Phaser.GameObjects.GameObject)
          : maybeDrop2.texture?.key === 'blood-drop'
            ? (obj2 as Phaser.GameObjects.GameObject)
            : null

      if (!dropCandidate) {
        return
      }

      const drop = dropCandidate as Phaser.Physics.Arcade.Image
      drop.disableBody(true, true)
    })

    this.physics.add.overlap(this.player, this.bloodDrops, () => this.handleBloodDropHit())

    this.scheduleNextBloodDrop()
  }

  private scheduleNextBloodDrop(): void {
    const delay = Phaser.Math.Between(900, 1700)
    this.nextBloodCloudTimer = this.time.delayedCall(delay, () => {
      if (!this.scene.isActive()) {
        return
      }

      this.dropBloodFromCloud()
      this.scheduleNextBloodDrop()
    })
  }

  private dropBloodFromCloud(): void {
    const cloud = Phaser.Utils.Array.GetRandom(this.bloodClouds)
    const count = Phaser.Math.Between(1, 3)

    for (let i = 0; i < count; i += 1) {
      const x = cloud.x + Phaser.Math.Between(-Math.floor(cloud.width / 3), Math.floor(cloud.width / 3))
      const warn = this.add.rectangle(x, cloud.y + 34, 6, 12, 0xff9aa8, 0.85)
      warn.setDepth(22)
      this.tweens.add({
        targets: warn,
        alpha: 0,
        duration: 250,
        onComplete: () => warn.destroy(),
      })

      this.time.delayedCall(280, () => {
        const drop = this.bloodDrops.get(x, cloud.y + 28, 'blood-drop') as Phaser.Physics.Arcade.Image | null
        if (!drop) {
          return
        }

        drop.setActive(true)
        drop.setVisible(true)
        drop.enableBody(true, x, cloud.y + 28, true, true)
        drop.setGravityY(900)
        drop.setVelocity(Phaser.Math.Between(-20, 20), Phaser.Math.Between(120, 180))
      })
    }
  }

  private cleanupBloodDrops(): void {
    const drops = this.bloodDrops.getChildren() as Phaser.Physics.Arcade.Image[]
    for (const drop of drops) {
      if (!drop.active) {
        continue
      }

      if (drop.y > this.LEVEL_H + 120) {
        drop.disableBody(true, true)
      }
    }
  }

  private createRescueObjects(): void {
    this.frozenPod = this.add.rectangle(2500, 180, 90, 140, 0x8dd3ff, 0.7)
    this.frozenPod.setStrokeStyle(3, 0xd9fbff, 0.95)

    this.icemeckel = this.physics.add.sprite(2500, 180, 'icemeckel')
    this.icemeckel.setVisible(false)
    this.icemeckel.disableBody(true, true)
    this.physics.add.collider(this.icemeckel, this.staticPlatforms)

    this.rescueTrigger = this.add.zone(2480, 500, 260, 320)
    this.physics.add.existing(this.rescueTrigger, true)

    this.exitDoor = this.add.rectangle(this.LEVEL_W - 120, this.LEVEL_H - 150, 54, 140, 0x8ec8ff)
    this.exitDoor.setAlpha(0.3)
    this.physics.add.existing(this.exitDoor, true)
  }

  private startRescueSequence(): void {
    if (this.rescueSequenceActive || this.rescueDone) {
      return
    }

    this.rescueSequenceActive = true
    this.cutsceneActive = true
    this.player.setAccelerationX(0)
    this.player.setVelocity(0, 0)
    this.statusMessage = 'A frozen signal is resonating...'
    this.updateUiText()

    this.time.delayedCall(350, () => {
      this.tweens.add({
        targets: this.frozenPod,
        alpha: 0.15,
        yoyo: true,
        repeat: 3,
        duration: 120,
      })
    })

    this.time.delayedCall(900, () => {
      this.frozenPod.destroy()
      const burst = this.add.circle(2500, 180, 12, 0xd9fbff, 0.9)
      this.tweens.add({
        targets: burst,
        scale: 8,
        alpha: 0,
        duration: 380,
        onComplete: () => burst.destroy(),
      })

      this.icemeckel.enableBody(true, 2500, 170, true, true)
      this.icemeckel.setVisible(true)
      this.icemeckel.setGravityY(850)
      this.icemeckel.setVelocityY(80)
    })

    this.time.delayedCall(1700, () => {
      this.icemeckel.setVelocity(0, 0)
      this.icemeckel.setImmovable(true)
      ;(this.icemeckel.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

      this.cutsceneLines = [
        'Icemeckel: ...You found me in the crimson frost.',
        'Icemeckel: Keep moving. The hills are watching.',
        'Press Space to continue.',
      ]
      this.cutsceneLineIndex = 0
      this.showCutscenePanel(this.cutsceneLines[0])

      this.rescueDone = true
      gameProgress.icemeckelRescued = true
      this.exitDoor.setAlpha(1)
      this.statusMessage = 'Icemeckel rescued. Reach the exit.'
      this.updateUiText()
    })
  }

  private handleEnemyHit(): void {
    this.handleDamage('Enemy hit! Try again.')
  }

  private handleBloodDropHit(): void {
    this.handleDamage('Blood rain hit! Move between drips.')
  }

  private handleDamage(message: string): void {
    if (this.isPlayerInvulnerable || this.cutsceneActive) {
      return
    }

    this.isPlayerInvulnerable = true
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY)
    this.player.setVelocity(0, 0)
    this.player.setAccelerationX(0)
    this.player.setTint(0xffb5b5)
    this.statusMessage = message
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
      'Inspector Glowman: Bloody Hills ahead. Stay focused.',
      'Electroman: These trails are slick with blood and bone.',
      'Mission: Survive the clouds and rescue Icemeckel.',
      'Press Space to start.',
    ]
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true
    this.showCutscenePanel(this.cutsceneLines[0])
  }

  private showCutscenePanel(line: string): void {
    if (!this.cutscenePanel || !this.cutsceneText) {
      this.cutscenePanel = this.add.rectangle(480, 430, 900, 190, 0x180911, 0.84)
      this.cutscenePanel.setStrokeStyle(2, 0xff95ab, 0.95)
      this.cutscenePanel.setDepth(50)
      this.cutscenePanel.setScrollFactor(0)

      this.cutsceneText = this.add.text(66, 360, '', {
        color: '#ffeef3',
        fontSize: '24px',
        fontFamily: 'sans-serif',
        wordWrap: { width: 840 },
        lineSpacing: 8,
      })
      this.cutsceneText.setDepth(51)
      this.cutsceneText.setScrollFactor(0)
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
    this.rescueSequenceActive = false
    this.cutscenePanel.setVisible(false)
    this.cutsceneText.setVisible(false)

    if (!this.rescueDone) {
      this.statusMessage = 'Find Icemeckel in the upper chamber.'
    }
    this.updateUiText()
  }

  private updateUiText(): void {
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.heroName}`,
        `Icemeckel: ${this.rescueDone ? 'Rescued' : 'Missing'}`,
        `Bloody Map Piece: ${gameProgress.bloodyMapPiece ? 'Yes' : 'No'}`,
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
    this.nextBloodCloudTimer?.remove(false)
  }
}
