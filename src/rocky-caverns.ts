import Phaser from 'phaser'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type HeroDefinition,
  type HeroId,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress, saveGameProgress } from './progress'
import { preloadSpriteAssets } from './sprite-assets'

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
  private readonly maxRocks = 8
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
  private abilityKey!: Phaser.Input.Keyboard.Key
  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'ROCKY_CAVERNS', {
    moveAcceleration: 900,
    maxVelocityX: 260,
    jumpVelocity: 520,
    shotCooldownMs: 220,
    shotSpeed: 520,
    damage: 1,
    defense: 1,
  })

  private readonly moveAcceleration = 900
  private readonly normalDragX = 900
  private readonly normalMaxVelocityX = 260
  private readonly playerSpawnX = 140
  private readonly playerSpawnY = 690
  private readonly hitInvulnerabilityMs = 1300
  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private readonly enemy1PatrolMinX = 1120
  private readonly enemy1PatrolMaxX = 1340
  private readonly enemy2PatrolMinX = 1890
  private readonly enemy2PatrolMaxX = 2130
  private readonly enemyPatrolSpeed = 58
  private readonly abilityCooldownMs = 1300
  private abilityCooldownScale = 1
  private shotCooldownScale = 1
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0
  private lastAbilityAt = 0
  private playerMaxHealth = 7
  private playerHealth = 7
  private checkpointX = 140
  private checkpointY = 690
  private healthPickup: Phaser.GameObjects.Rectangle | null = null
  private powerPickup: Phaser.GameObjects.Rectangle | null = null
  private damageReductionMul = 1
  private speedBoostActive = false

  private statusMessage = 'Reach the stalactite chamber.'
  private readonly stageName = 'Stage 2: Rocky Caverns'
  private rescueDone = false
  private stageClearTriggered = false
  private nextRockTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('rocky-caverns')
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#0c0d12')
    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'ROCKY_CAVERNS', {
      moveAcceleration: this.moveAcceleration,
      maxVelocityX: this.normalMaxVelocityX,
      jumpVelocity: 520,
      shotCooldownMs: this.shotCooldownMs,
      shotSpeed: this.shotSpeed,
      damage: 1,
      defense: 1,
    })

    this.createTextures()

    this.cavernBackdrop = this.add.tileSprite(480, 270, 960, 540, 'cavern-stripes')
    this.cavernBackdrop.setDepth(-20)
    this.cavernBackdrop.setScrollFactor(0)

    this.buildLevelGeometry()

    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'player-block'
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)

    this.createEnemiesAndWeaponSystem()
    this.createFallingRocksHazard()
    this.createRescueObjects()
    this.createCheckpointsAndItems()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

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
      gameProgress.cavernMapPiece = true
      saveGameProgress()
      this.statusMessage = 'STAGE CLEAR! Returning to stage select...'
      this.updateUiText()
      this.time.delayedCall(1200, () => this.scene.start('stage-select'))
    }

    this.updateEnemyPatrols()
    this.updateRescuedFollower()
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

    if (!this.textures.exists('hero-volcano-man')) {
      gfx.fillStyle(0x7a4b2a, 1)
      gfx.fillRect(0, 0, 26, 46)
      gfx.fillStyle(0xb8302c, 1)
      gfx.fillRect(26, 0, 26, 46)
      gfx.generateTexture('hero-volcano-man', 52, 46)
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
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'enemy-block'
    this.enemy1 = this.physics.add.sprite(this.enemy1PatrolMaxX, 598, enemyTexture)
    this.enemy1.setCollideWorldBounds(true)
    this.enemy1.setImmovable(true)
    ;(this.enemy1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy1.setData('hp', 3)
    this.enemy1.setData('maxHp', 3)
    this.enemy1.setData('lastHitAt', 0)
    this.enemy1.setVelocityX(-this.enemyPatrolSpeed)
    this.physics.add.collider(this.enemy1, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy1, () => this.handleEnemyHit())

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 338, enemyTexture)
    this.enemy2.setCollideWorldBounds(true)
    this.enemy2.setImmovable(true)
    ;(this.enemy2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy2.setData('hp', 3)
    this.enemy2.setData('maxHp', 3)
    this.enemy2.setData('lastHitAt', 0)
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
    const delay = Phaser.Math.Between(1700, 3000)
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
      rock.setGravityY(980)
      rock.setVelocity(Phaser.Math.Between(-14, 14), Phaser.Math.Between(80, 120))
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

  private createCheckpointsAndItems(): void {
    const defs: Array<[number, number]> = [
      [1160, 610],
      [2020, 350],
    ]
    defs.forEach(([x, y]) => {
      const cp = this.add.rectangle(x, y, 20, 72, 0xffc76b, 0.9)
      this.physics.add.existing(cp, true)
      this.physics.add.overlap(this.player, cp, () => this.activateCheckpoint(cp, x, y))
    })

    this.healthPickup = this.add.rectangle(1460, 520, 24, 24, 0x7aff7a, 0.95)
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

    this.powerPickup = this.add.rectangle(1860, 330, 22, 22, 0x82e8ff, 0.95)
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
    this.stalactite = this.add.rectangle(2210, 150, 90, 160, 0x6c6f78)

    const volcanoTexture = this.textures.exists('hero-volcano-man') ? 'hero-volcano-man' : 'player-block'
    this.volcanoMan = this.physics.add.sprite(2210, 155, volcanoTexture)
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
      saveGameProgress()
      this.statusMessage = 'Volcano Man rescued.'
      this.exitDoor.setAlpha(1)
      this.updateUiText()
    })
  }

  private handleRockHit(): void {
    this.applyDamage(1, 'Rock hit! Watch the ceiling.')
  }

  private handleEnemyHit(): void {
    this.applyDamage(1, 'Enemy hit! Try again.')
  }

  private applyDamage(amount: number, message: string): void {
    if (this.isPlayerInvulnerable || this.cutsceneActive) {
      return
    }

    this.playerHealth = Math.max(0, this.playerHealth - amount * this.damageReductionMul)
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
    const now = this.time.now
    const lastHitAt = Number(enemy.getData('lastHitAt') ?? 0)
    if (now - lastHitAt < 220) {
      return
    }
    enemy.setData('lastHitAt', now)
    const hp = Math.max(0, Number(enemy.getData('hp') ?? 1) - 1)
    enemy.setData('hp', hp)
    if (hp <= 0) {
      enemy.disableBody(true, true)
      this.statusMessage = 'Enemy down!'
    } else {
      this.statusMessage = `Enemy HP: ${hp}`
    }
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
        const hitEnemy = (enemy: Phaser.Physics.Arcade.Sprite): void => {
          if (!enemy.active) {
            return
          }
          const now = this.time.now
          const lastHitAt = Number(enemy.getData('lastHitAt') ?? 0)
          if (now - lastHitAt < 260) {
            return
          }
          enemy.setData('lastHitAt', now)
          const hp = Math.max(0, Number(enemy.getData('hp') ?? 1) - 1)
          enemy.setData('hp', hp)
          if (hp <= 0) {
            enemy.disableBody(true, true)
          }
        }
        this.physics.add.overlap(trail, this.enemy1, () => hitEnemy(this.enemy1))
        this.physics.add.overlap(trail, this.enemy2, () => hitEnemy(this.enemy2))
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
    if (!this.rescueDone || !this.volcanoMan.active) {
      return
    }

    const targetX = this.player.x - this.facingDir * 60
    const targetY = this.player.y
    const followLerp = 0.08
    this.volcanoMan.x = Phaser.Math.Linear(this.volcanoMan.x, targetX, followLerp)
    this.volcanoMan.y = Phaser.Math.Linear(this.volcanoMan.y, targetY, followLerp)
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
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.selectedHero?.displayName ?? 'Micralis'}`,
        `HP: ${hp}`,
        `Volcano Man: ${this.rescueDone ? 'Rescued' : 'Missing'}`,
        `Cavern Map Piece: ${gameProgress.cavernMapPiece ? 'Yes' : 'No'}`,
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
    this.nextRockTimer?.remove(false)
  }
}
