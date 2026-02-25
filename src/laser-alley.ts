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

type TimedLaser = {
  rect: Phaser.GameObjects.Rectangle
  bounds: Phaser.Geom.Rectangle
  onMs: number
  offMs: number
  active: boolean
}

export class LaserAlleyScene extends Phaser.Scene {
  private readonly LEVEL_W = 3000
  private readonly LEVEL_H = 900

  private player!: Phaser.Physics.Arcade.Sprite
  private patrolEnemy!: Phaser.Physics.Arcade.Sprite
  private laserBot!: Phaser.Physics.Arcade.Sprite
  private miniBoss!: Phaser.Physics.Arcade.Sprite
  private miniBossLabel!: Phaser.GameObjects.Text
  private miniBossBaseY = 460
  private swirlExanimo!: Phaser.Physics.Arcade.Sprite
  private prismCell!: Phaser.GameObjects.Rectangle
  private lavaBogMapPickup: Phaser.GameObjects.Rectangle | null = null
  private rescueTrigger!: Phaser.GameObjects.Zone
  private exitDoor!: Phaser.GameObjects.Rectangle

  private shots!: Phaser.Physics.Arcade.Group
  private botShots!: Phaser.Physics.Arcade.Group
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []
  private movingPlatforms: Phaser.Physics.Arcade.Image[] = []
  private timedLasers: TimedLaser[] = []
  private sweepLaser!: Phaser.GameObjects.Rectangle
  private sweepLaserBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  private sweepDir = 1

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private spaceKey!: Phaser.Input.Keyboard.Key
  private abilityKey!: Phaser.Input.Keyboard.Key
  private uiText!: Phaser.GameObjects.Text

  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneLineIndex = 0
  private cutsceneActive = true
  private rescueSequenceActive = false

  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'LASER_HILLS', {
    moveAcceleration: 900,
    maxVelocityX: 260,
    jumpVelocity: 560,
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
  private readonly hitInvulnerabilityMs = 1400
  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private readonly abilityCooldownMs = 1300
  private readonly patrolMinX = 1280
  private readonly patrolMaxX = 1480
  private readonly patrolSpeed = 54

  private stageClearTriggered = false
  private rescueDone = false
  private miniBossDefeated = false
  private miniBossHealth = 6
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0
  private lastAbilityAt = 0
  private shotCooldownScale = 1
  private abilityCooldownScale = 1
  private damageReductionMul = 1
  private speedBoostActive = false

  private playerMaxHealth = 8
  private playerHealth = 8
  private checkpointX = 140
  private checkpointY = 690
  private healthPickup: Phaser.GameObjects.Rectangle | null = null
  private powerPickup: Phaser.GameObjects.Rectangle | null = null

  private statusMessage = 'Navigate Laser Alley and rescue Exemon.'
  private readonly stageName = 'Stage 4: Laser Alley'

  constructor() {
    super('laser-alley')
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#100f22')

    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'LASER_HILLS', {
      moveAcceleration: this.moveAcceleration,
      maxVelocityX: this.normalMaxVelocityX,
      jumpVelocity: 560,
      shotCooldownMs: this.shotCooldownMs,
      shotSpeed: this.shotSpeed,
      damage: 1,
      defense: 1,
    })

    this.createTextures()
    this.createBackdrop()
    this.buildLevelGeometry()

    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'player-block'
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'enemy-block'
    const wardenTexture = this.textures.exists('enemy-laser-warden') ? 'enemy-laser-warden' : enemyTexture
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)
    for (const moving of this.movingPlatforms) {
      this.physics.add.collider(this.player, moving)
    }

    this.patrolEnemy = this.physics.add.sprite(this.patrolMaxX, 648, enemyTexture)
    this.patrolEnemy.setCollideWorldBounds(true)
    this.patrolEnemy.setImmovable(true)
    ;(this.patrolEnemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.patrolEnemy.setVelocityX(-this.patrolSpeed)
    this.physics.add.collider(this.patrolEnemy, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.patrolEnemy, () => this.applyDamage(1, 'Enemy hit! Try again.'))

    this.laserBot = this.physics.add.sprite(2110, 438, enemyTexture)
    this.laserBot.setImmovable(true)
    this.laserBot.setCollideWorldBounds(true)
    ;(this.laserBot.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.physics.add.collider(this.laserBot, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.laserBot, () => this.applyDamage(1, 'Laser Bot contact!'))

    this.miniBoss = this.physics.add.sprite(2870, 430, wardenTexture)
    this.miniBoss.setDisplaySize(124, 124)
    this.miniBoss.setTint(0xff9ab3)
    this.miniBoss.setImmovable(true)
    this.miniBoss.setCollideWorldBounds(true)
    this.miniBossBaseY = 430
    ;(this.miniBoss.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ;(this.miniBoss.body as Phaser.Physics.Arcade.Body).setSize(84, 90, true)
    this.physics.add.collider(this.miniBoss, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.miniBoss, () => this.applyDamage(1, 'Laser Warden hit!'))
    this.miniBossLabel = this.add.text(this.miniBoss.x - 62, this.miniBoss.y - 86, 'LASER WARDEN', {
      color: '#ffd7e4',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      backgroundColor: '#260918cc',
      padding: { x: 6, y: 3 },
    })
    this.miniBossLabel.setDepth(24)

    this.createWeapons()
    this.createLaserHazards()
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
      backgroundColor: '#09071acc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setDepth(50)
    this.uiText.setScrollFactor(0)
    this.updateUiText()

    this.initializeIntroCutscene()
    this.scheduleBotShot()
    this.scheduleMiniBossShot()
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

    if (!this.rescueDone) {
      const inTrigger = this.physics.overlap(this.player, this.rescueTrigger)
      const nearPrism = Phaser.Math.Distance.Between(this.player.x, this.player.y, 2790, 450) < 160
      if (inTrigger || nearPrism) {
        if (!this.miniBossDefeated) {
          this.statusMessage = 'Defeat the Laser Warden first!'
          this.updateUiText()
        } else {
          this.startRescueSequence()
        }
      }
    }

    if (this.rescueDone && this.physics.overlap(this.player, this.exitDoor) && !this.stageClearTriggered) {
      if (!gameProgress.lavaBogMap) {
        this.statusMessage = 'Grab the Map to Lava Bog first!'
        this.updateUiText()
        return
      }
      this.stageClearTriggered = true
      this.statusMessage = 'STAGE CLEAR! Lava Bog map acquired.'
      this.updateUiText()
      this.time.delayedCall(1300, () => this.scene.start('stage-select'))
    }

    this.updatePatrolEnemy()
    this.updateMovingPlatforms()
    this.updateMiniBossMotion()
    this.updateSweepLaser()
    this.checkLaserHazards()
    this.updateRescuedFollower()

    const pBody = this.player.body as Phaser.Physics.Arcade.Body
    if (pBody.blocked.down && this.player.y > this.LEVEL_H - 36) {
      this.applyDamage(1, 'Fell too far!', true)
    }
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

    if (!this.textures.exists('laser-bot-shot')) {
      gfx.fillStyle(0xff627a, 1)
      gfx.fillRect(0, 0, 14, 6)
      gfx.generateTexture('laser-bot-shot', 14, 6)
      gfx.clear()
    }

    if (!this.textures.exists('moving-platform')) {
      gfx.fillStyle(0x53628a, 1)
      gfx.fillRect(0, 0, 140, 18)
      gfx.generateTexture('moving-platform', 140, 18)
    }

    gfx.destroy()
  }

  private createBackdrop(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x130f2b, 1)
    bg.fillRect(0, 0, this.LEVEL_W, this.LEVEL_H)
    for (let x = 0; x < this.LEVEL_W; x += 160) {
      bg.fillStyle(0x2a2353, 0.35)
      bg.fillRect(x, 0, 30, this.LEVEL_H)
    }
    bg.setDepth(-30)
  }

  private buildLevelGeometry(): void {
    const platforms: Array<[number, number, number, number, number]> = [
      [220, 860, 440, 80, 0x34324a],
      [760, 860, 360, 80, 0x34324a],
      [1200, 860, 300, 80, 0x34324a],
      [1590, 860, 220, 80, 0x34324a],
      [1920, 860, 240, 80, 0x34324a],
      [2270, 860, 220, 80, 0x34324a],
      [2600, 860, 300, 80, 0x34324a],

      [1180, 730, 220, 22, 0x5d67a1],
      [1520, 700, 220, 22, 0x5d67a1],

      [1940, 780, 180, 22, 0x5d67a1],
      [2120, 720, 170, 22, 0x5d67a1],
      [2300, 660, 170, 22, 0x5d67a1],
      [2480, 600, 170, 22, 0x5d67a1],
      [2660, 540, 170, 22, 0x5d67a1],
      [2835, 480, 170, 22, 0x5d67a1],
      [2940, 430, 130, 22, 0x5d67a1],
    ]

    this.staticPlatforms = platforms.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))

    const moving1 = this.physics.add.image(1760, 690, 'moving-platform')
    moving1.setImmovable(true)
    ;(moving1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    moving1.setVelocityX(45)
    this.movingPlatforms.push(moving1)

    const moving2 = this.physics.add.image(2460, 640, 'moving-platform')
    moving2.setImmovable(true)
    ;(moving2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    moving2.setVelocityX(-40)
    this.movingPlatforms.push(moving2)
  }

  private createWeapons(): void {
    this.shots = this.physics.add.group({ allowGravity: false, maxSize: 12 })
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
    for (const moving of this.movingPlatforms) {
      this.physics.add.collider(this.shots, moving, (obj1, obj2) => {
        const maybe1 = obj1 as unknown as { texture?: { key?: string } }
        const maybe2 = obj2 as unknown as { texture?: { key?: string } }
        const shotCandidate =
          maybe1.texture?.key === 'electro-shot'
            ? (obj1 as Phaser.GameObjects.GameObject)
            : maybe2.texture?.key === 'electro-shot'
              ? (obj2 as Phaser.GameObjects.GameObject)
              : null
        if (!shotCandidate) {
          return
        }
        ;(shotCandidate as Phaser.Physics.Arcade.Image).disableBody(true, true)
      })
    }
    this.physics.add.overlap(this.shots, this.patrolEnemy, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.laserBot, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.miniBoss, (shotObj, enemyObj) => {
      this.handleMiniBossShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })

    this.botShots = this.physics.add.group({ allowGravity: false, maxSize: 10 })
    this.physics.add.collider(this.botShots, this.staticPlatforms, (obj1, obj2) => {
      const maybe1 = obj1 as unknown as { texture?: { key?: string } }
      const maybe2 = obj2 as unknown as { texture?: { key?: string } }
      const shotCandidate =
        maybe1.texture?.key === 'laser-bot-shot'
          ? (obj1 as Phaser.GameObjects.GameObject)
          : maybe2.texture?.key === 'laser-bot-shot'
            ? (obj2 as Phaser.GameObjects.GameObject)
            : null
      if (!shotCandidate) {
        return
      }
      ;(shotCandidate as Phaser.Physics.Arcade.Image).disableBody(true, true)
    })
    for (const moving of this.movingPlatforms) {
      this.physics.add.collider(this.botShots, moving, (obj1, obj2) => {
        const maybe1 = obj1 as unknown as { texture?: { key?: string } }
        const maybe2 = obj2 as unknown as { texture?: { key?: string } }
        const shotCandidate =
          maybe1.texture?.key === 'laser-bot-shot'
            ? (obj1 as Phaser.GameObjects.GameObject)
            : maybe2.texture?.key === 'laser-bot-shot'
              ? (obj2 as Phaser.GameObjects.GameObject)
              : null
        if (!shotCandidate) {
          return
        }
        ;(shotCandidate as Phaser.Physics.Arcade.Image).disableBody(true, true)
      })
    }
    this.physics.add.overlap(this.player, this.botShots, () => this.applyDamage(3, 'Laser shot hit!'))
  }

  private createLaserHazards(): void {
    this.addTimedLaser(1010, 795, 14, 120, 1300, 1200)
    this.addTimedLaser(1410, 795, 14, 120, 1400, 1200)
    this.addTimedLaser(2210, 520, 14, 140, 900, 800)
    this.addTimedLaser(2490, 470, 14, 140, 900, 800)

    this.sweepLaser = this.add.rectangle(1700, 760, 220, 16, 0xff4c80, 0.75)
    this.sweepLaser.setDepth(12)
    this.updateSweepLaserBounds()
  }

  private addTimedLaser(x: number, y: number, w: number, h: number, onMs: number, offMs: number): void {
    const rect = this.add.rectangle(x, y, w, h, 0xff628e, 0.72)
    rect.setDepth(12)
    const laser: TimedLaser = {
      rect,
      bounds: new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h),
      onMs,
      offMs,
      active: true,
    }
    this.timedLasers.push(laser)

    const toggle = (): void => {
      laser.active = !laser.active
      laser.rect.setVisible(laser.active)
      this.time.delayedCall(laser.active ? laser.onMs : laser.offMs, toggle)
    }
    this.time.delayedCall(laser.onMs, toggle)
  }

  private createRescueObjects(): void {
    this.prismCell = this.add.rectangle(2790, 450, 90, 140, 0x8ca4ff, 0.38)
    this.prismCell.setStrokeStyle(3, 0xd8e4ff, 0.9)

    const swirlTexture = this.textures.exists('hero-exemon') ? 'hero-exemon' : 'player-block'
    this.swirlExanimo = this.physics.add.sprite(2790, 450, swirlTexture)
    if (swirlTexture === 'hero-exemon') {
      this.swirlExanimo.setDisplaySize(68, 76)
    }
    this.swirlExanimo.setVisible(false)
    this.swirlExanimo.disableBody(true, true)
    this.physics.add.collider(this.swirlExanimo, this.staticPlatforms)

    this.rescueTrigger = this.add.zone(2790, 450, 300, 320)
    this.physics.add.existing(this.rescueTrigger, true)

    if (!gameProgress.lavaBogMap) {
      this.lavaBogMapPickup = this.add.rectangle(2520, 560, 28, 20, 0xffe08a, 0.95)
      this.lavaBogMapPickup.setStrokeStyle(2, 0x7a5c2b, 1)
      this.physics.add.existing(this.lavaBogMapPickup, true)
      this.physics.add.overlap(this.player, this.lavaBogMapPickup, () => this.collectLavaBogMap())
    }

    this.exitDoor = this.add.rectangle(2960, 340, 54, 140, 0x8ec8ff)
    this.exitDoor.setAlpha(0.3)
    this.physics.add.existing(this.exitDoor, true)
  }

  private createCheckpointsAndItems(): void {
    const defs: Array<[number, number]> = [
      [1280, 640],
      [2300, 430],
    ]
    defs.forEach(([x, y]) => {
      const cp = this.add.rectangle(x, y, 20, 72, 0xffc76b, 0.9)
      this.physics.add.existing(cp, true)
      this.physics.add.overlap(this.player, cp, () => this.activateCheckpoint(cp, x, y))
    })

    this.healthPickup = this.add.rectangle(1720, 790, 24, 24, 0x7aff7a, 0.95)
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

    this.powerPickup = this.add.rectangle(2580, 300, 22, 22, 0x82e8ff, 0.95)
    this.physics.add.existing(this.powerPickup, true)
    this.physics.add.overlap(this.player, this.powerPickup, () => {
      if (!this.powerPickup) {
        return
      }
      this.shotCooldownScale = 0.82
      this.abilityCooldownScale = 0.82
      this.powerPickup.destroy()
      this.powerPickup = null
      this.statusMessage = 'Power core found. Cooldowns reduced.'
      this.playTone(640, 0.1)
      this.updateUiText()
    })
  }

  private collectLavaBogMap(): void {
    if (!this.lavaBogMapPickup || gameProgress.lavaBogMap) {
      return
    }
    gameProgress.lavaBogMap = true
    saveGameProgress()
    this.statusMessage = 'Map to Lava Bog collected!'
    this.playTone(720, 0.12)
    const pulse = this.add.circle(this.lavaBogMapPickup.x, this.lavaBogMapPickup.y, 10, 0xfff0b0, 0.8)
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 4,
      duration: 280,
      onComplete: () => pulse.destroy(),
    })
    this.lavaBogMapPickup.destroy()
    this.lavaBogMapPickup = null
    this.updateUiText()
  }

  private activateCheckpoint(cp: Phaser.GameObjects.Rectangle, x: number, y: number): void {
    if (cp.getData('active')) {
      return
    }
    this.checkpointX = x
    this.checkpointY = y - 24
    cp.setData('active', true)
    cp.setFillStyle(0x8affc1, 1)
    this.statusMessage = 'Checkpoint reached.'
    this.playTone(500, 0.08)
    this.updateUiText()
  }

  private scheduleBotShot(): void {
    this.time.addEvent({
      delay: 1900,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive || !this.laserBot.active) {
          return
        }

        const shot = this.botShots.get(this.laserBot.x - 20, this.laserBot.y, 'laser-bot-shot') as
          | Phaser.Physics.Arcade.Image
          | null
        if (!shot) {
          return
        }

        const dirX = this.player.x - this.laserBot.x
        const dirY = this.player.y - this.laserBot.y
        const len = Math.max(1, Math.hypot(dirX, dirY))
        shot.enableBody(true, this.laserBot.x - 20, this.laserBot.y, true, true)
        shot.setActive(true)
        shot.setVisible(true)
        shot.setVelocity((dirX / len) * 220, (dirY / len) * 220)
        this.time.delayedCall(1800, () => shot.disableBody(true, true))
      },
    })
  }

  private scheduleMiniBossShot(): void {
    this.time.addEvent({
      delay: 2200,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive || !this.miniBoss.active || this.miniBossDefeated) {
          return
        }

        const shot = this.botShots.get(this.miniBoss.x - 18, this.miniBoss.y - 12, 'laser-bot-shot') as
          | Phaser.Physics.Arcade.Image
          | null
        if (!shot) {
          return
        }

        const dirX = this.player.x - this.miniBoss.x
        const dirY = this.player.y - this.miniBoss.y
        const len = Math.max(1, Math.hypot(dirX, dirY))
        shot.enableBody(true, this.miniBoss.x - 18, this.miniBoss.y - 12, true, true)
        shot.setActive(true)
        shot.setVisible(true)
        shot.setVelocity((dirX / len) * 240, (dirY / len) * 240)
        this.time.delayedCall(1800, () => shot.disableBody(true, true))
      },
    })
  }

  private updateMiniBossMotion(): void {
    if (!this.miniBoss.active || this.miniBossDefeated) {
      if (this.miniBossLabel) {
        this.miniBossLabel.setVisible(false)
      }
      return
    }
    this.miniBoss.y = this.miniBossBaseY + Math.sin(this.time.now / 280) * 12
    if (this.miniBossLabel) {
      this.miniBossLabel.setVisible(true)
      this.miniBossLabel.setPosition(this.miniBoss.x - 62, this.miniBoss.y - 86)
    }
  }

  private updatePatrolEnemy(): void {
    if (!this.patrolEnemy.active) {
      return
    }
    if (this.patrolEnemy.x <= this.patrolMinX) {
      this.patrolEnemy.setVelocityX(this.patrolSpeed)
    } else if (this.patrolEnemy.x >= this.patrolMaxX) {
      this.patrolEnemy.setVelocityX(-this.patrolSpeed)
    }
  }

  private updateMovingPlatforms(): void {
    const [m1, m2] = this.movingPlatforms
    if (m1) {
      if (m1.x < 1660) m1.setVelocityX(45)
      else if (m1.x > 1860) m1.setVelocityX(-45)
    }
    if (m2) {
      if (m2.x < 2360) m2.setVelocityX(40)
      else if (m2.x > 2580) m2.setVelocityX(-40)
    }
  }

  private updateSweepLaser(): void {
    if (!this.sweepLaser) {
      return
    }
    this.sweepLaser.y += this.sweepDir * 1.1
    if (this.sweepLaser.y < 650) {
      this.sweepDir = 1
    } else if (this.sweepLaser.y > 810) {
      this.sweepDir = -1
    }
    this.updateSweepLaserBounds()
  }

  private updateSweepLaserBounds(): void {
    this.sweepLaserBounds.setTo(
      this.sweepLaser.x - this.sweepLaser.width / 2,
      this.sweepLaser.y - this.sweepLaser.height / 2,
      this.sweepLaser.width,
      this.sweepLaser.height,
    )
  }

  private checkLaserHazards(): void {
    if (this.cutsceneActive) {
      return
    }

    const p = this.player.getBounds()
    for (const laser of this.timedLasers) {
      if (laser.active && Phaser.Geom.Intersects.RectangleToRectangle(p, laser.bounds)) {
        this.applyDamage(3, 'Timed laser hit!')
        return
      }
    }

    if (Phaser.Geom.Intersects.RectangleToRectangle(p, this.sweepLaserBounds)) {
      this.applyDamage(3, 'Sweeper laser hit!')
    }
  }

  private startRescueSequence(): void {
    if (this.rescueSequenceActive || this.rescueDone) {
      return
    }

    this.rescueSequenceActive = true
    this.cutsceneActive = true
    this.player.setAccelerationX(0)
    this.player.setVelocity(0, 0)
    this.statusMessage = 'The prism is destabilizing...'
    this.updateUiText()

    this.time.delayedCall(420, () => {
      this.tweens.add({
        targets: this.prismCell,
        alpha: 0.2,
        yoyo: true,
        repeat: 2,
        duration: 150,
      })
    })

    this.time.delayedCall(980, () => {
      this.prismCell.destroy()
      this.swirlExanimo.enableBody(true, 2790, 390, true, true)
      this.swirlExanimo.setVisible(true)
      this.swirlExanimo.setImmovable(true)
      ;(this.swirlExanimo.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      this.tweens.add({
        targets: this.swirlExanimo,
        y: 460,
        duration: 550,
        ease: 'Sine.Out',
      })
    })

    this.time.delayedCall(1750, () => {
      this.swirlExanimo.setPosition(2790, 460)
      this.swirlExanimo.setVelocity(0, 0)
      this.swirlExanimo.setImmovable(true)
      ;(this.swirlExanimo.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

      this.cutsceneLines = [
        'Exemon: Okay, we are ready.',
        'Exemon: Keep moving. Laser Alley is syncing again.',
        'Press Space to continue.',
      ]
      this.cutsceneLineIndex = 0
      this.showCutscenePanel(this.cutsceneLines[0])

      this.rescueDone = true
      gameProgress.swirlExanimoRescued = true
      saveGameProgress()
      this.exitDoor.setAlpha(1)
      this.statusMessage = 'Exemon rescued. Reach the exit.'
      this.updateUiText()
    })
  }

  private updateRescuedFollower(): void {
    if (!this.rescueDone || !this.swirlExanimo.active) {
      return
    }

    const targetX = this.player.x - this.facingDir * 60
    const targetY = this.player.y
    const followLerp = 0.08
    this.swirlExanimo.x = Phaser.Math.Linear(this.swirlExanimo.x, targetX, followLerp)
    this.swirlExanimo.y = Phaser.Math.Linear(this.swirlExanimo.y, targetY, followLerp)
  }

  private applyDamage(amount: number, message: string, forceRespawn = false): void {
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
    } else if (forceRespawn) {
      this.player.setPosition(this.checkpointX, this.checkpointY)
      this.player.setVelocity(0, 0)
      this.player.setAccelerationX(0)
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

  private handleMiniBossShot(shot: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active || this.miniBossDefeated) {
      return
    }

    shot.disableBody(true, true)
    this.miniBossHealth -= 1
    enemy.setTint(0xff8aa6)
    this.time.delayedCall(100, () => enemy.clearTint())

    if (this.miniBossHealth <= 0) {
      this.miniBossDefeated = true
      enemy.disableBody(true, true)
      if (this.miniBossLabel) {
        this.miniBossLabel.setVisible(false)
      }
      this.statusMessage = 'Laser Warden defeated. Rescue path open.'
      this.playTone(260, 0.12)
    } else {
      this.statusMessage = `Laser Warden HP: ${this.miniBossHealth}`
    }

    this.updateUiText()
  }

  private tryUseHeroAbility(): void {
    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs * this.abilityCooldownScale) {
      return
    }

    this.lastAbilityAt = now
    const enemies = [this.patrolEnemy, this.laserBot]

    const pushEnemies = (): void => {
      for (const enemy of enemies) {
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
            for (const enemy of enemies) {
              const eBody = enemy.body as Phaser.Physics.Arcade.Body | null
              if (enemy.active && eBody && Phaser.Geom.Rectangle.Contains(patchRect, enemy.x, enemy.y)) {
                enemy.setVelocityX(eBody.velocity.x * 0.82)
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
        this.physics.add.overlap(trail, this.patrolEnemy, () => this.patrolEnemy.disableBody(true, true))
        this.physics.add.overlap(trail, this.laserBot, () => this.laserBot.disableBody(true, true))
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

  private initializeIntroCutscene(): void {
    this.cutsceneLines = [
      'Inspector Glowman: Laser Alley ahead. Stay sharp.',
      'Electroman: Patterns are cycling. Move on the off-beats.',
      'Micralis: Vertical climb route is the cleanest path.',
      'Mission: Rescue Exemon and secure the map to Lava Bog.',
      'Press Space to start.',
    ]
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true
    this.showCutscenePanel(this.cutsceneLines[0])
  }

  private showCutscenePanel(line: string): void {
    if (!this.cutscenePanel || !this.cutsceneText) {
      this.cutscenePanel = this.add.rectangle(480, 430, 900, 190, 0x07091b, 0.84)
      this.cutscenePanel.setStrokeStyle(2, 0x8ab8ff, 0.95)
      this.cutscenePanel.setDepth(60)
      this.cutscenePanel.setScrollFactor(0)

      this.cutsceneText = this.add.text(66, 360, '', {
        color: '#f4f7ff',
        fontSize: '24px',
        fontFamily: 'sans-serif',
        wordWrap: { width: 840 },
        lineSpacing: 8,
      })
      this.cutsceneText.setDepth(61)
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
      this.statusMessage = 'Find Exemon in the upper prism chamber.'
    }
    this.updateUiText()
  }

  private updateUiText(): void {
    if (!this.miniBossDefeated && this.miniBoss && !this.miniBoss.active) {
      this.miniBossDefeated = true
    }
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.selectedHero?.displayName ?? 'Micralis'}`,
        `HP: ${hp}`,
        `Laser Warden: ${this.miniBossDefeated ? 'Defeated' : `${this.miniBossHealth} HP`}`,
        `Exemon: ${this.rescueDone ? 'Rescued' : 'Missing'}`,
        `Map to Lava Bog: ${gameProgress.lavaBogMap ? 'Yes' : 'No'}`,
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
}
