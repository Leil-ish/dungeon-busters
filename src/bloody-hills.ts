import Phaser from 'phaser'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type HeroDefinition,
  type HeroId,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress } from './progress'
import { preloadSpriteAssets } from './sprite-assets'

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
  private abilityKey!: Phaser.Input.Keyboard.Key
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
  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'BLOODY_HILLS', {
    moveAcceleration: 900,
    maxVelocityX: 260,
    jumpVelocity: 520,
    shotCooldownMs: 220,
    shotSpeed: 520,
    damage: 1,
    defense: 1,
  })

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
  private readonly hitInvulnerabilityMs = 1300
  private isPlayerInvulnerable = false

  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private facingDir = 1
  private lastShotAt = 0

  private readonly enemy1PatrolMinX = 980
  private readonly enemy1PatrolMaxX = 1200
  private readonly enemy2PatrolMinX = 2140
  private readonly enemy2PatrolMaxX = 2380
  private readonly enemyPatrolSpeed = 56
  private readonly abilityCooldownMs = 1300
  private abilityCooldownScale = 1
  private shotCooldownScale = 1
  private playerMaxHealth = 7
  private playerHealth = 7
  private checkpointX = 140
  private checkpointY = 700
  private healthPickup: Phaser.GameObjects.Rectangle | null = null
  private powerPickup: Phaser.GameObjects.Rectangle | null = null
  private damageReductionMul = 1
  private speedBoostActive = false

  private stageClearTriggered = false
  private rescueDone = false
  private statusMessage = 'Track the blood trail and find Icemeckel.'
  private readonly stageName = 'Stage 3: Bloody Hills'
  private lastAbilityAt = 0
  private nextBloodCloudTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('bloody-hills')
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#1b0b11')
    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'BLOODY_HILLS', {
      moveAcceleration: this.moveAcceleration,
      maxVelocityX: this.normalMaxVelocityX,
      jumpVelocity: 520,
      shotCooldownMs: this.shotCooldownMs,
      shotSpeed: this.shotSpeed,
      damage: 1,
      defense: 1,
    })

    this.createTextures()
    this.createBackdrop()
    this.buildLevelGeometry()

    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'player-block'
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, heroTexture)
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)

    this.createEnemiesAndWeaponSystem()
    this.createBloodCloudHazard()
    this.createRescueObjects()
    this.createCheckpointsAndItems()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

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
      this.player.setMaxVelocity(
        this.effectiveStats.maxVelocityX * (this.slipperyMaxVelocityX / this.normalMaxVelocityX) + (this.speedBoostActive ? 80 : 0),
        900,
      )
    } else {
      this.player.setDragX(this.normalDragX)
      this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + (this.speedBoostActive ? 80 : 0), 900)
    }

    if (this.cursors.left.isDown) {
      this.player.setAccelerationX(-this.effectiveStats.moveAcceleration)
      this.facingDir = -1
    } else if (this.cursors.right.isDown) {
      this.player.setAccelerationX(this.effectiveStats.moveAcceleration)
      this.facingDir = 1
    } else {
      this.player.setAccelerationX(0)
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.fireShot()
    }
    if (Phaser.Input.Keyboard.JustDown(this.abilityKey)) {
      this.tryUseHeroAbility()
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.cursors.up.isDown && body.blocked.down) {
      this.player.setVelocityY(-this.effectiveStats.jumpVelocity)
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
    this.updateRescuedFollower()
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

    if (!this.textures.exists('hero-hurricano-man')) {
      gfx.fillStyle(0x7bd8ff, 1)
      gfx.fillRect(0, 0, 20, 60)
      gfx.fillStyle(0xffffff, 0.9)
      gfx.fillRect(7, 0, 6, 60)
      gfx.generateTexture('hero-hurricano-man', 20, 60)
      gfx.clear()
    }

    if (!this.textures.exists('blood-drop')) {
      gfx.fillStyle(0xd10f2f, 1)
      gfx.fillRect(0, 0, 8, 18)
      gfx.generateTexture('blood-drop', 8, 18)
      gfx.clear()
    }

    if (!this.textures.exists('hero-icemeckel')) {
      gfx.fillStyle(0x8de6ff, 1)
      gfx.fillRect(0, 0, 22, 46)
      gfx.fillStyle(0xd9fbff, 1)
      gfx.fillRect(22, 0, 22, 46)
      gfx.generateTexture('hero-icemeckel', 44, 46)
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
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'enemy-block'
    this.enemy1 = this.physics.add.sprite(this.enemy1PatrolMaxX, 726, enemyTexture)
    this.enemy1.setCollideWorldBounds(true)
    this.enemy1.setImmovable(true)
    ;(this.enemy1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy1.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy1, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy1, () => this.handleEnemyHit())

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 496, enemyTexture)
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
    const delay = Phaser.Math.Between(1200, 2200)
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
    const count = Phaser.Math.Between(1, 2)

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
        drop.setGravityY(760)
        drop.setVelocity(Phaser.Math.Between(-14, 14), Phaser.Math.Between(100, 150))
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

  private createCheckpointsAndItems(): void {
    const defs: Array<[number, number]> = [
      [1360, 680],
      [2340, 430],
    ]
    defs.forEach(([x, y]) => {
      const cp = this.add.rectangle(x, y, 20, 72, 0xffc76b, 0.9)
      this.physics.add.existing(cp, true)
      this.physics.add.overlap(this.player, cp, () => this.activateCheckpoint(cp, x, y))
    })

    this.healthPickup = this.add.rectangle(1700, 610, 24, 24, 0x7aff7a, 0.95)
    this.physics.add.existing(this.healthPickup, true)
    this.physics.add.overlap(this.player, this.healthPickup, () => {
      if (!this.healthPickup) {
        return
      }
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 3)
      this.healthPickup.destroy()
      this.healthPickup = null
      this.statusMessage = 'Health restored.'
      this.playTone(560, 0.1)
      this.updateUiText()
    })

    this.powerPickup = this.add.rectangle(2250, 450, 22, 22, 0x82e8ff, 0.95)
    this.physics.add.existing(this.powerPickup, true)
    this.physics.add.overlap(this.player, this.powerPickup, () => {
      if (!this.powerPickup) {
        return
      }
      this.shotCooldownScale = 0.85
      this.abilityCooldownScale = 0.85
      this.powerPickup.destroy()
      this.powerPickup = null
      this.statusMessage = 'Power core found. Cooldowns reduced.'
      this.playTone(640, 0.1)
      this.updateUiText()
    })
  }

  private activateCheckpoint(checkpoint: Phaser.GameObjects.Rectangle, x: number, y: number): void {
    if (checkpoint.getData('active')) {
      return
    }

    this.checkpointX = x
    this.checkpointY = y - 24
    checkpoint.setData('active', true)
    checkpoint.setFillStyle(0x8affc1, 1)
    this.statusMessage = 'Checkpoint reached.'
    this.playTone(500, 0.08)
    this.updateUiText()
  }

  private createRescueObjects(): void {
    this.frozenPod = this.add.rectangle(2500, 180, 90, 140, 0x8dd3ff, 0.7)
    this.frozenPod.setStrokeStyle(3, 0xd9fbff, 0.95)

    const icemeckelTexture = this.textures.exists('hero-icemeckel') ? 'hero-icemeckel' : 'player-block'
    this.icemeckel = this.physics.add.sprite(2500, 180, icemeckelTexture)
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

    this.playerHealth = Math.max(0, this.playerHealth - 1 * this.damageReductionMul)
    this.isPlayerInvulnerable = true
    this.player.setTint(0xffb5b5)
    this.statusMessage = message
    this.updateUiText()
    this.playTone(220, 0.09)

    if (this.playerHealth <= 0) {
      this.playerHealth = this.playerMaxHealth
      this.player.setPosition(this.checkpointX, this.checkpointY)
      this.player.setVelocity(0, 0)
      this.player.setAccelerationX(0)
      this.statusMessage = 'Respawned at checkpoint.'
      this.updateUiText()
    }

    const defenseScale = Phaser.Math.Clamp(this.effectiveStats.defense, 0.85, 1.2)
    this.time.delayedCall(this.hitInvulnerabilityMs * defenseScale, () => {
      this.isPlayerInvulnerable = false
      this.player.clearTint()
    })
  }

  private fireShot(): void {
    const now = this.time.now
    if (now - this.lastShotAt < this.effectiveStats.shotCooldownMs * this.shotCooldownScale) {
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
    shot.setVelocityX(this.facingDir * this.effectiveStats.shotSpeed)
    this.playTone(460, 0.05)
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

  private tryUseHeroAbility(): void {
    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs * this.abilityCooldownScale) {
      return
    }

    this.lastAbilityAt = now
    const pushEnemies = (): void => {
      for (const enemy of [this.enemy1, this.enemy2]) {
        if (!enemy.active) {
          continue
        }
        const dx = enemy.x - this.player.x
        const inFront = this.facingDir > 0 ? dx >= 0 : dx <= 0
        if (inFront && Math.abs(dx) < 190) {
          enemy.setVelocityX(this.facingDir * 190)
        }
      }
    }

    switch (this.selectedHero.specialAbility) {
      case 'GUST_DASH':
      case 'PHOTON_DASH':
      case 'THUNDER_SLIDE':
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 260))
        pushEnemies()
        this.statusMessage = `${this.selectedHero.moves.special.name}!`
        this.playTone(680, 0.07)
        break
      case 'RADIANT_BARRIER':
        this.damageReductionMul = 0.45
        this.player.setTint(0xc6f6ff)
        this.time.delayedCall(2200, () => {
          this.damageReductionMul = 1
          this.player.clearTint()
        })
        this.statusMessage = 'Radiant Barrier active.'
        this.playTone(520, 0.1)
        break
      case 'FREEZE_PATCH': {
        const patch = this.add.rectangle(this.player.x, this.player.y + 48, 180, 24, 0xb8f5ff, 0.55)
        const patchRect = new Phaser.Geom.Rectangle(this.player.x - 90, this.player.y + 36, 180, 24)
        const timer = this.time.addEvent({
          delay: 70,
          repeat: 28,
          callback: () => {
            for (const enemy of [this.enemy1, this.enemy2]) {
              const body = enemy.body as Phaser.Physics.Arcade.Body | null
              if (enemy.active && body && Phaser.Geom.Rectangle.Contains(patchRect, enemy.x, enemy.y)) {
                enemy.setVelocityX(body.velocity.x * 0.82)
              }
            }
          },
        })
        this.time.delayedCall(2200, () => {
          timer.remove(false)
          patch.destroy()
        })
        this.statusMessage = 'Freeze Patch deployed.'
        this.playTone(410, 0.1)
        break
      }
      case 'MOLTEN_TRAIL': {
        const trail = this.add.rectangle(this.player.x - this.facingDir * 36, this.player.y + 42, 120, 18, 0xff6b3d, 0.7)
        this.physics.add.existing(trail, true)
        this.physics.add.overlap(trail, this.enemy1, () => this.enemy1.disableBody(true, true))
        this.physics.add.overlap(trail, this.enemy2, () => this.enemy2.disableBody(true, true))
        this.time.delayedCall(2200, () => trail.destroy())
        this.statusMessage = 'Molten Trail ignited.'
        this.playTone(320, 0.09)
        break
      }
      case 'FUSION_WAVE':
        if (!this.speedBoostActive) {
          this.speedBoostActive = true
          this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + 80, 900)
          this.time.delayedCall(2600, () => {
            this.speedBoostActive = false
            this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
          })
        }
        this.statusMessage = 'Fusion Wave boost active.'
        this.playTone(740, 0.1)
        break
      case 'ABSORB':
        this.damageReductionMul = 0.6
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 1)
        this.time.delayedCall(2600, () => {
          this.damageReductionMul = 1
        })
        this.statusMessage = 'Absorb active. Defense boosted.'
        this.playTone(380, 0.1)
        break
      default:
        this.statusMessage = `${this.selectedHero.moves.special.name}: Coming soon`
    }

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

  private updateRescuedFollower(): void {
    if (!this.rescueDone || !this.icemeckel.active) {
      return
    }

    const targetX = this.player.x - this.facingDir * 60
    const targetY = this.player.y
    const followLerp = 0.08
    this.icemeckel.x = Phaser.Math.Linear(this.icemeckel.x, targetX, followLerp)
    this.icemeckel.y = Phaser.Math.Linear(this.icemeckel.y, targetY, followLerp)
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
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.selectedHero?.displayName ?? 'Micralis'}`,
        `HP: ${hp}`,
        `Icemeckel: ${this.rescueDone ? 'Rescued' : 'Missing'}`,
        `Bloody Map Piece: ${gameProgress.bloodyMapPiece ? 'Yes' : 'No'}`,
        this.statusMessage,
      ].join('\n'),
    )
  }

  private playTone(freq: number, durationSec = 0.06): void {
    const ctx = (this.sound as unknown as { context?: AudioContext }).context
    if (!ctx) {
      return
    }
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'square'
    oscillator.frequency.value = freq
    gain.gain.value = 0.025
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + durationSec)
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
