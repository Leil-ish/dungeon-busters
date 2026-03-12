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
  active: boolean
  onMs: number
  offMs: number
}

type EnemyUnit = Phaser.Physics.Arcade.Sprite

export class ForgeOfOriginsScene extends Phaser.Scene {
  private readonly LEVEL_W = 4600
  private readonly LEVEL_H = 900

  private player!: Phaser.Physics.Arcade.Sprite
  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'FORGE_OF_ORIGINS', {
    moveAcceleration: 940,
    maxVelocityX: 280,
    jumpVelocity: 600,
    shotCooldownMs: 220,
    shotSpeed: 560,
    damage: 1,
    defense: 1,
  })

  private platforms: Phaser.GameObjects.Rectangle[] = []
  private commonEnemies: EnemyUnit[] = []
  private enemyShots!: Phaser.Physics.Arcade.Group
  private shots!: Phaser.Physics.Arcade.Group
  private rocks!: Phaser.Physics.Arcade.Group
  private bossMinions!: Phaser.Physics.Arcade.Group

  private fusionSentinel!: EnemyUnit
  private corruptedConstruct!: EnemyUnit
  private firstCorruption!: EnemyUnit

  private fusionActive = false
  private constructActive = false
  private finalBossActive = false

  private fusionHp = 48
  private readonly fusionMaxHp = 48
  private constructHp = 60
  private readonly constructMaxHp = 60
  private firstCorruptionHp = 180
  private readonly firstCorruptionMaxHp = 180
  private fusionHitCount = 0
  private constructHitCount = 0
  private firstCorruptionHitCount = 0
  private readonly fusionRequiredHits = 60
  private readonly constructRequiredHits = 78
  private readonly firstCorruptionRequiredHits = 220

  private finalBossDefeated = false
  private finalBossAbsorbActive = false
  private finalBossAbsorbInterrupted = false

  private mini1Defeated = false
  private mini2Defeated = false

  private timedLasers: TimedLaser[] = []
  private slipperyZones: Phaser.Geom.Rectangle[] = []
  private pitZones: Phaser.Geom.Rectangle[] = []
  private section2Triggered = false
  private section3Triggered = false
  private finalTriggered = false
  private finalSpawnQueued = false
  private matterBridgeBuilt = false

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private fireKey!: Phaser.Input.Keyboard.Key
  private abilityKey!: Phaser.Input.Keyboard.Key
  private punchKey!: Phaser.Input.Keyboard.Key
  private kickKey!: Phaser.Input.Keyboard.Key

  private uiText!: Phaser.GameObjects.Text
  private exitPortal: Phaser.GameObjects.Rectangle | null = null
  private exitPortalActive = false
  private lastPortalPromptAt = 0
  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneIndex = 0
  private cutsceneActive = true
  private cutsceneOnEnd: (() => void) | null = null

  private playerHealth = 12
  private readonly playerMaxHealth = 12
  private damageReductionMul = 1
  private checkpointX = 140
  private checkpointY = 680
  private isPlayerInvulnerable = false
  private readonly invulnerabilityMs = 1200

  private statusMessage = 'Traverse the Forge of Origins.'
  private stageClearTriggered = false
  private lastShotAt = 0
  private lastAbilityAt = 0
  private lastMeleeAt = 0
  private meleeComboStep = 0
  private facingDir = 1
  private bossLastActionAt = 0
  private lastFusionHitAt = 0
  private lastConstructHitAt = 0
  private lastFirstCorruptionHitAt = 0
  private fusionDamageLockUntil = 0
  private constructDamageLockUntil = 0
  private finalBossDamageLockUntil = 0
  private lastEncounterRecoveryAt = 0

  private readonly normalDragX = 860
  private readonly slipperyDragX = 180
  private readonly abilityCooldownMs = 1700

  private healthBars = new Map<string, Phaser.GameObjects.Graphics>()
  private minionBars = new Map<EnemyUnit, Phaser.GameObjects.Graphics>()

  constructor() {
    super('forge-of-origins')
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#070a1a')

    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'FORGE_OF_ORIGINS', {
      moveAcceleration: 940,
      maxVelocityX: 280,
      jumpVelocity: 600,
      shotCooldownMs: 220,
      shotSpeed: 560,
      damage: 1,
      defense: 1,
    })

    this.createTextures()
    this.createBackdrop()
    this.buildGeometry()
    this.createPlayerAndEnemies()
    this.createWeapons()
    this.createHazards()
    this.createExitPortal()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.punchKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.kickKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#eef5ff',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      backgroundColor: '#090a1bcc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setDepth(100)
    this.uiText.setScrollFactor(0)
    this.updateUiText()

    this.startIntroCutscene()
    this.scheduleFallingRocks()
    this.events.once('shutdown', () => this.cleanupHealthBars())
  }

  update(): void {
    if (!this.cutsceneActive && this.cutscenePanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
        this.cutscenePanel.setVisible(false)
        this.cutsceneText.setVisible(false)
      }
      this.updateHealthBars()
      return
    }

    if (this.cutsceneActive) {
      this.player.setAccelerationX(0)
      this.player.setVelocityX(0)
      if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
        this.advanceCutscene()
      }
      this.updateHealthBars()
      return
    }

    this.updatePlayerMovement()
    this.handleCombatInputs()

    this.updateCommonEnemies()
    this.updateMiniBosses()
    this.updateFinalBoss()

    this.updateSectionTriggers()
    this.ensureEncounterRecovery()
    this.checkHazards()
    this.updateHealthBars()

    // Fail-safe: if the second mini-boss is defeated, force Exomon spawn even if position triggers were skipped.
    if (this.mini2Defeated && !this.finalBossActive && !this.finalBossDefeated && !this.finalSpawnQueued) {
      this.finalSpawnQueued = true
      this.time.delayedCall(350, () => {
        if (!this.finalBossActive && !this.finalBossDefeated) {
          this.finalTriggered = true
          this.startFinalBossSequence()
        }
      })
    }

    if (this.exitPortal && this.physics.overlap(this.player, this.exitPortal) && !this.stageClearTriggered) {
      if (this.exitPortalActive) {
        this.completeStage()
      } else if (this.time.now - this.lastPortalPromptAt > 900) {
        this.lastPortalPromptAt = this.time.now
        this.tryRecoverFinalEncounterNearExit()
        this.statusMessage = 'Exit locked. Defeat Exomon first.'
        this.updateUiText()
      }
    }

    if (this.finalBossDefeated && !this.stageClearTriggered) {
      this.finishStage()
    }
  }

  private createTextures(): void {
    const gfx = this.add.graphics({ x: 0, y: 0 })
    gfx.setVisible(false)

    if (!this.textures.exists('electro-shot')) {
      gfx.fillStyle(0x8be9ff, 1)
      gfx.fillRect(0, 0, 16, 8)
      gfx.generateTexture('electro-shot', 16, 8)
      gfx.clear()
    }

    if (!this.textures.exists('enemy-shot-forge')) {
      gfx.fillStyle(0xff8ca2, 1)
      gfx.fillRect(0, 0, 14, 7)
      gfx.generateTexture('enemy-shot-forge', 14, 7)
      gfx.clear()
    }

    if (!this.textures.exists('forge-rock')) {
      gfx.fillStyle(0x7f6f6a, 1)
      gfx.fillRect(0, 0, 22, 22)
      gfx.generateTexture('forge-rock', 22, 22)
      gfx.clear()
    }

    if (!this.textures.exists('energy-pulse')) {
      gfx.fillStyle(0xfff7b0, 1)
      gfx.fillCircle(22, 22, 22)
      gfx.generateTexture('energy-pulse', 44, 44)
    }

    if (!this.textures.exists('exomon-boss-block')) {
      gfx.clear()
      gfx.fillStyle(0xb35cff, 1)
      gfx.fillRect(0, 0, 96, 96)
      gfx.fillStyle(0x1b0e2a, 1)
      gfx.fillRect(10, 14, 76, 68)
      gfx.fillStyle(0xffa7de, 1)
      gfx.fillRect(20, 26, 18, 18)
      gfx.fillRect(58, 26, 18, 18)
      gfx.fillRect(32, 56, 32, 10)
      gfx.generateTexture('exomon-boss-block', 96, 96)
    }

    gfx.destroy()
  }

  private createBackdrop(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x080f23, 1)
    bg.fillRect(0, 0, this.LEVEL_W, this.LEVEL_H)

    for (let x = 0; x < this.LEVEL_W; x += 180) {
      bg.fillStyle(0x2a1d4f, 0.25)
      bg.fillRect(x, 0, 28, this.LEVEL_H)
    }

    for (let i = 0; i < 36; i += 1) {
      bg.fillStyle(0x8fd7ff, 0.35)
      bg.fillCircle(120 + i * 126, 80 + (i % 5) * 46, 2 + (i % 3))
    }

    bg.setDepth(-30)
  }

  private buildGeometry(): void {
    const defs: Array<[number, number, number, number, number]> = [
      // Section A: Ground run
      [280, 860, 560, 80, 0x3c3554],
      [880, 860, 560, 80, 0x3c3554],
      [1460, 860, 360, 80, 0x3c3554],

      // Section B: Platform traversal (pit below)
      [1860, 770, 220, 24, 0x6872b5],
      [2120, 710, 220, 24, 0x6872b5],
      [2380, 650, 220, 24, 0x6872b5],
      [2640, 710, 220, 24, 0x6872b5],
      [2900, 770, 220, 24, 0x6872b5],

      // Section C: Ground reset + construct lane
      [3320, 860, 620, 80, 0x3c3554],

      // Section D: Final climb
      [3680, 790, 220, 24, 0x7a5fbf],
      [3920, 730, 220, 24, 0x7a5fbf],
      [4160, 670, 220, 24, 0x7a5fbf],

      // Section E: Boss arena (unblocked shooting lane)
      [4420, 860, 760, 80, 0x3c3554],
    ]

    this.platforms = defs.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))

    // Platform-only sections: falling here causes pit damage + respawn.
    this.pitZones = [this.createPitZone(2380, 872, 1500, 56)]
  }

  private createPitZone(centerX: number, centerY: number, width: number, height: number): Phaser.Geom.Rectangle {
    this.add.rectangle(centerX, centerY, width, height, 0x120000, 0.28)
    return new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height)
  }

  private createPlayerAndEnemies(): void {
    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'hero-micralis'
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'hero-micralis'

    this.player = this.physics.add.sprite(140, 680, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 980)
    this.physics.add.collider(this.player, this.platforms)

    const spawnEnemy = (x: number, y: number, minX: number, maxX: number): EnemyUnit => {
      const enemy = this.physics.add.sprite(x, y, enemyTexture)
      enemy.setImmovable(true)
      enemy.setCollideWorldBounds(true)
      ;(enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      enemy.setData('hp', 16)
      enemy.setData('maxHp', 16)
      enemy.setData('hitCount', 0)
      enemy.setData('requiredHits', 22)
      enemy.setData('lastHitAt', 0)
      enemy.setData('patrolMin', minX)
      enemy.setData('patrolMax', maxX)
      enemy.setData('speed', 60)
      enemy.setVelocityX(-60)
      this.physics.add.collider(enemy, this.platforms)
      this.physics.add.overlap(this.player, enemy, () => this.applyDamage(1, 'Enemy hit!'))
      this.commonEnemies.push(enemy)
      return enemy
    }

    spawnEnemy(980, 798, 860, 1120)
    spawnEnemy(2380, 612, 2280, 2480)
    spawnEnemy(3440, 798, 3320, 3620)

    this.fusionSentinel = this.physics.add.sprite(2240, 612, enemyTexture)
    this.fusionSentinel.setScale(1.2)
    this.fusionSentinel.setTint(0x95f0ff)
    this.fusionSentinel.setImmovable(true)
    this.fusionSentinel.setCollideWorldBounds(true)
    ;(this.fusionSentinel.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.fusionSentinel.setData('hp', this.fusionHp)
    this.fusionSentinel.disableBody(true, true)
    this.physics.add.collider(this.fusionSentinel, this.platforms)
    this.physics.add.overlap(this.player, this.fusionSentinel, () => this.applyDamage(1, 'Fusion Sentinel hit!'))

    this.corruptedConstruct = this.physics.add.sprite(3520, 780, enemyTexture)
    this.corruptedConstruct.setDisplaySize(140, 140)
    this.corruptedConstruct.setTint(0xc3a5ff)
    this.corruptedConstruct.setImmovable(true)
    this.corruptedConstruct.setCollideWorldBounds(true)
    ;(this.corruptedConstruct.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ;(this.corruptedConstruct.body as Phaser.Physics.Arcade.Body).setSize(94, 98, true)
    this.corruptedConstruct.setData('hp', this.constructHp)
    this.corruptedConstruct.disableBody(true, true)
    this.physics.add.collider(this.corruptedConstruct, this.platforms)
    this.physics.add.overlap(this.player, this.corruptedConstruct, () => this.applyDamage(1, 'Corrupted Construct impact!'))

    const finalTexture = this.textures.exists('hero-exemon') ? 'hero-exemon' : 'exomon-boss-block'
    this.firstCorruption = this.physics.add.sprite(4460, 752, finalTexture)
    this.firstCorruption.setDisplaySize(220, 220)
    this.firstCorruption.setImmovable(true)
    this.firstCorruption.setCollideWorldBounds(true)
    ;(this.firstCorruption.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ;(this.firstCorruption.body as Phaser.Physics.Arcade.Body).setSize(132, 168, true)
    this.firstCorruption.setData('hp', this.firstCorruptionHp)
    this.firstCorruption.disableBody(true, true)
    this.physics.add.collider(this.firstCorruption, this.platforms)
    this.physics.add.overlap(this.player, this.firstCorruption, () => this.applyDamage(2, 'Exomon struck!'))
  }

  private createWeapons(): void {
    this.shots = this.physics.add.group({ allowGravity: false, maxSize: 48 })
    this.enemyShots = this.physics.add.group({ allowGravity: false, maxSize: 60 })
    this.rocks = this.physics.add.group({ allowGravity: true, maxSize: 18 })
    this.bossMinions = this.physics.add.group({ allowGravity: false, immovable: true, maxSize: 10 })

    this.physics.add.collider(this.shots, this.platforms, (obj1, obj2) => {
      const s1 = obj1 as Phaser.Physics.Arcade.Image
      const s2 = obj2 as Phaser.Physics.Arcade.Image
      const shot = s1.texture?.key === 'electro-shot' ? s1 : s2.texture?.key === 'electro-shot' ? s2 : null
      if (!shot) {
        return
      }
      shot.disableBody(true, true)
    })

    this.physics.add.collider(this.enemyShots, this.platforms, (obj1, obj2) => {
      const s1 = obj1 as Phaser.Physics.Arcade.Image
      const s2 = obj2 as Phaser.Physics.Arcade.Image
      const shot = s1.texture?.key === 'enemy-shot-forge' ? s1 : s2.texture?.key === 'enemy-shot-forge' ? s2 : null
      if (!shot) {
        return
      }
      shot.disableBody(true, true)
    })

    this.physics.add.collider(this.rocks, this.platforms, (obj1, obj2) => {
      const maybeRock1 = obj1 as Phaser.GameObjects.GameObject & { disableBody?: (disableGameObject?: boolean, hideGameObject?: boolean) => void }
      const maybeRock2 = obj2 as Phaser.GameObjects.GameObject & { disableBody?: (disableGameObject?: boolean, hideGameObject?: boolean) => void }
      const rock = typeof maybeRock1.disableBody === 'function' ? maybeRock1 : typeof maybeRock2.disableBody === 'function' ? maybeRock2 : null
      if (!rock) {
        return
      }
      this.time.delayedCall(280, () => rock.disableBody?.(true, true))
    })

    this.physics.add.overlap(this.player, this.enemyShots, () => this.applyDamage(1, 'Energy hit!'))
    this.physics.add.overlap(this.player, this.rocks, () => this.applyDamage(1, 'Falling rock!'))
    this.physics.add.overlap(this.player, this.bossMinions, () => this.applyDamage(1, 'Drone hit!'))

    this.physics.add.overlap(this.shots, this.bossMinions, (shotObj, minionObj) => {
      const shot = shotObj as Phaser.Physics.Arcade.Image
      const minion = minionObj as EnemyUnit
      if (!minion.active) {
        return
      }
      shot.disableBody(true, true)
      const now = this.time.now
      const lastHitAt = Number(minion.getData('lastHitAt') ?? 0)
      if (now - lastHitAt < 400) {
        return
      }
      minion.setData('lastHitAt', now)
      const hitCount = Number(minion.getData('hitCount') ?? 0) + 1
      const requiredHits = Number(minion.getData('requiredHits') ?? 10)
      minion.setData('hitCount', hitCount)
      const hpMax = Number(minion.getData('maxHp') ?? 1)
      const ratio = Phaser.Math.Clamp(1 - hitCount / requiredHits, 0, 1)
      const hp = hpMax * ratio
      minion.setData('hp', hp)
      if (hitCount >= requiredHits || hp <= 0) {
        minion.disableBody(true, true)
      }
    })

    for (const enemy of this.commonEnemies) {
      this.physics.add.overlap(this.shots, enemy, (shotObj, enemyObj) => {
        const shot = shotObj as Phaser.Physics.Arcade.Image
        const target = enemyObj as EnemyUnit
        if (!target.active) {
          return
        }
        shot.disableBody(true, true)
        const now = this.time.now
        const lastHitAt = Number(target.getData('lastHitAt') ?? 0)
      if (now - lastHitAt < 400) {
        return
      }
        target.setData('lastHitAt', now)
        const hitCount = Number(target.getData('hitCount') ?? 0) + 1
        const requiredHits = Number(target.getData('requiredHits') ?? 10)
        target.setData('hitCount', hitCount)
        const hpMax = Number(target.getData('maxHp') ?? 1)
        const ratio = Phaser.Math.Clamp(1 - hitCount / requiredHits, 0, 1)
        const hp = hpMax * ratio
        target.setData('hp', hp)
        if (hitCount >= requiredHits || hp <= 0) {
          target.disableBody(true, true)
        }
      })
    }

    this.physics.add.overlap(this.shots, this.fusionSentinel, (shotObj) => {
      if (!this.fusionActive || !this.fusionSentinel.active) {
        return
      }
      ;(shotObj as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.damageFusionSentinel(1)
    })

    this.physics.add.overlap(this.shots, this.corruptedConstruct, (shotObj) => {
      if (!this.constructActive || !this.corruptedConstruct.active) {
        return
      }
      ;(shotObj as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.damageCorruptedConstruct(1)
    })

    this.physics.add.overlap(this.shots, this.firstCorruption, (shotObj) => {
      if (!this.finalBossActive || this.finalBossDefeated || !this.firstCorruption.active) {
        return
      }
      ;(shotObj as Phaser.Physics.Arcade.Image).disableBody(true, true)
      this.damageFirstCorruption(1)
    })
  }

  private createHazards(): void {
    this.slipperyZones = [
      this.createSlipperyZone(720, 845, 340, 100),
      this.createSlipperyZone(2310, 845, 360, 100),
    ]

    this.addTimedLaser(1260, 790, 14, 130, 1300, 1100)
    this.addTimedLaser(2460, 730, 14, 140, 1200, 1000)
    this.addTimedLaser(3560, 700, 14, 150, 1100, 1000)

    this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive) {
          return
        }
        const pulse = this.add.circle(
          Phaser.Math.Between(560, this.LEVEL_W - 420),
          Phaser.Math.Between(120, 300),
          Phaser.Math.Between(10, 24),
          Phaser.Display.Color.RandomRGB().color,
          0.35,
        )
        pulse.setDepth(4)
        this.tweens.add({
          targets: pulse,
          alpha: 0,
          scale: 1.8,
          duration: 420,
          onComplete: () => pulse.destroy(),
        })
      },
    })
  }

  private createExitPortal(): void {
    this.exitPortal = this.add.rectangle(this.LEVEL_W - 120, 760, 56, 96, 0xa7e2ff, 0.25)
    this.exitPortal.setStrokeStyle(2, 0xffb0b0, 0.9)
    this.exitPortal.setFillStyle(0xff6a6a, 0.35)
    this.exitPortal.setVisible(true)
    this.exitPortal.setDepth(35)
    this.physics.add.existing(this.exitPortal, true)
  }

  private updatePlayerMovement(): void {
    const inSlippery = this.slipperyZones.some((zone) => Phaser.Geom.Rectangle.Contains(zone, this.player.x, this.player.y))
    if (inSlippery) {
      this.player.setDragX(this.slipperyDragX)
      this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + 70, 980)
    } else {
      this.player.setDragX(this.normalDragX)
      this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 980)
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

    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.cursors.up.isDown && body.blocked.down) {
      this.player.setVelocityY(-this.effectiveStats.jumpVelocity)
    }

    if (body.blocked.down && this.player.y > this.LEVEL_H - 34) {
      this.applyDamage(1, 'Fell into the forge pits!', true)
    }
  }

  private handleCombatInputs(): void {
    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.firePlayerShot()
    }
    if (Phaser.Input.Keyboard.JustDown(this.abilityKey)) {
      this.useSpecialAbility()
    }
    if (Phaser.Input.Keyboard.JustDown(this.punchKey)) {
      this.tryMeleePunch()
    }
    if (Phaser.Input.Keyboard.JustDown(this.kickKey)) {
      this.tryMeleeKick()
    }
  }

  private firePlayerShot(): void {
    const now = this.time.now
    if (now - this.lastShotAt < this.effectiveStats.shotCooldownMs) {
      return
    }

    this.lastShotAt = now
    if (this.selectedHero.id === 'CHROMAFORGE') {
      const angles = [0, -0.16, 0.16]
      for (const angle of angles) {
        const shot = this.shots.get(this.player.x + this.facingDir * 28, this.player.y - 10, 'electro-shot') as
          | Phaser.Physics.Arcade.Image
          | null
        if (!shot) {
          continue
        }
        const vx = Math.cos(angle) * this.effectiveStats.shotSpeed * this.facingDir
        const vy = Math.sin(angle) * this.effectiveStats.shotSpeed
        shot.enableBody(true, shot.x, shot.y, true, true)
        shot.setActive(true)
        shot.setVisible(true)
        shot.setVelocity(vx, vy)
        this.time.delayedCall(950, () => shot.disableBody?.(true, true))
      }
      this.statusMessage = 'Triple Spectrum Shot!'
      this.playTone(620, 0.05)
      this.updateUiText()
      return
    }

    const shot = this.shots.get(this.player.x + this.facingDir * 28, this.player.y - 10, 'electro-shot') as
      | Phaser.Physics.Arcade.Image
      | null
    if (!shot) {
      return
    }

    shot.enableBody(true, shot.x, shot.y, true, true)
    shot.setActive(true)
    shot.setVisible(true)
    shot.setVelocityX(this.facingDir * this.effectiveStats.shotSpeed)
    this.time.delayedCall(950, () => shot.disableBody?.(true, true))
  }

  private useSpecialAbility(): void {
    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs) {
      return
    }
    this.lastAbilityAt = now

    if (this.selectedHero.id === 'CHROMAFORGE') {
      const pulse = this.add.image(this.player.x, this.player.y, 'energy-pulse')
      pulse.setDepth(30)
      this.tweens.add({ targets: pulse, alpha: 0, scale: 3.6, duration: 260, onComplete: () => pulse.destroy() })

      const stunRadius = 240
      const stunUntil = this.time.now + 2300
      for (const enemy of this.commonEnemies) {
        if (enemy.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < stunRadius) {
          enemy.setData('stunUntil', stunUntil)
        }
      }
      if (this.fusionActive && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fusionSentinel.x, this.fusionSentinel.y) < stunRadius) {
        this.fusionSentinel.setData('stunUntil', stunUntil)
      }
      if (this.constructActive && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.corruptedConstruct.x, this.corruptedConstruct.y) < stunRadius) {
        this.corruptedConstruct.setData('stunUntil', stunUntil)
      }
      if (this.finalBossActive && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.firstCorruption.x, this.firstCorruption.y) < stunRadius) {
        this.firstCorruption.setData('stunUntil', stunUntil)
        if (this.finalBossAbsorbActive) {
          this.finalBossAbsorbInterrupted = true
          this.finalBossAbsorbActive = false
          this.statusMessage = 'Solar Bind interrupted absorption!'
          this.playTone(780, 0.1)
          this.updateUiText()
          return
        }
      }

      this.statusMessage = 'Solar Bind cast. Enemies stunned.'
      this.playTone(700, 0.1)
      this.updateUiText()
      return
    }

    const targets: EnemyUnit[] = [...this.commonEnemies]
    if (this.fusionActive && this.fusionSentinel.active) {
      targets.push(this.fusionSentinel)
    }
    if (this.constructActive && this.corruptedConstruct.active) {
      targets.push(this.corruptedConstruct)
    }
    if (this.finalBossActive && this.firstCorruption.active) {
      targets.push(this.firstCorruption)
    }

    const pushTargets = (push = 190): void => {
      for (const enemy of targets) {
        if (!enemy.active) continue
        const dx = enemy.x - this.player.x
        const inFront = this.facingDir > 0 ? dx >= 0 : dx <= 0
        if (inFront && Math.abs(dx) < 220) {
          enemy.setVelocityX(this.facingDir * push)
        }
      }
    }

    switch (this.selectedHero.specialAbility) {
      case 'PHOTON_DASH':
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 220))
        pushTargets(160)
        this.statusMessage = 'Photon Dash: precision burst!'
        this.playTone(700, 0.07)
        break
      case 'THUNDER_SLIDE':
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 280))
        pushTargets(210)
        for (const enemy of targets) {
          if (!enemy.active) continue
          if (Math.abs(enemy.x - this.player.x) < 170 && Math.abs(enemy.y - this.player.y) < 120) {
            enemy.setTint(0xbde9ff)
            enemy.setVelocityX(0)
            enemy.setData('stunUntil', this.time.now + 550)
            this.time.delayedCall(550, () => enemy.active && enemy.clearTint())
          }
        }
        this.statusMessage = 'Thunder Slide: enemy stun!'
        this.playTone(760, 0.08)
        break
      case 'GUST_DASH':
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 320))
        this.player.setVelocityY(Math.min((this.player.body as Phaser.Physics.Arcade.Body).velocity.y, -120))
        pushTargets(260)
        this.statusMessage = 'Gust Dash: high-speed wind burst!'
        this.playTone(640, 0.08)
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
            for (const enemy of targets) {
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
        this.physics.add.overlap(trail, this.fusionSentinel, () => this.fusionActive && this.damageFusionSentinel(1))
        this.physics.add.overlap(trail, this.corruptedConstruct, () => this.constructActive && this.damageCorruptedConstruct(1))
        this.physics.add.overlap(trail, this.firstCorruption, () => this.finalBossActive && this.damageFirstCorruption(1))
        this.time.delayedCall(2200, () => trail.destroy())
        this.statusMessage = 'Molten Trail ignited.'
        this.playTone(320, 0.09)
        break
      }
      case 'FUSION_WAVE':
        this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + 80, 980)
        this.time.delayedCall(2600, () => {
          this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 980)
        })
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

  private tryMeleePunch(): void {
    const now = this.time.now
    if (now - this.lastMeleeAt < 220) {
      return
    }
    this.lastMeleeAt = now
    this.meleeComboStep = (this.meleeComboStep % 3) + 1
    const dmg = 0.8 + this.meleeComboStep * 0.25
    this.applyMeleeHit(72, dmg)
    this.statusMessage = `Punch combo x${this.meleeComboStep}`
    this.updateUiText()
  }

  private tryMeleeKick(): void {
    const now = this.time.now
    if (now - this.lastMeleeAt < 300) {
      return
    }
    this.lastMeleeAt = now
    this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 140))
    this.applyMeleeHit(92, 1.9)
    this.statusMessage = 'Kick lunge!'
    this.updateUiText()
  }

  private applyMeleeHit(range: number, damage: number): void {
    const hitX = this.player.x + this.facingDir * range
    const targets: EnemyUnit[] = [...this.commonEnemies]
    if (this.fusionActive && this.fusionSentinel.active) {
      targets.push(this.fusionSentinel)
    }
    if (this.constructActive && this.corruptedConstruct.active) {
      targets.push(this.corruptedConstruct)
    }
    if (this.finalBossActive && this.firstCorruption.active) {
      targets.push(this.firstCorruption)
    }

    for (const target of targets) {
      if (!target.active) {
        continue
      }
      if (Phaser.Math.Distance.Between(hitX, this.player.y, target.x, target.y) > range) {
        continue
      }
      if (target === this.fusionSentinel) {
        this.damageFusionSentinel(damage)
      } else if (target === this.corruptedConstruct) {
        this.damageCorruptedConstruct(damage)
      } else if (target === this.firstCorruption) {
        this.damageFirstCorruption(damage)
      } else {
        const now = this.time.now
        const lastHitAt = Number(target.getData('lastHitAt') ?? 0)
        if (now - lastHitAt < 400) {
          continue
        }
        target.setData('lastHitAt', now)
        const hitCount = Number(target.getData('hitCount') ?? 0) + 1
        const requiredHits = Number(target.getData('requiredHits') ?? 10)
        target.setData('hitCount', hitCount)
        const hpMax = Number(target.getData('maxHp') ?? 1)
        const ratio = Phaser.Math.Clamp(1 - hitCount / requiredHits, 0, 1)
        const hp = hpMax * ratio
        target.setData('hp', hp)
        if (hitCount >= requiredHits || hp <= 0) {
          target.disableBody(true, true)
        }
      }
    }
  }

  private updateCommonEnemies(): void {
    for (const enemy of this.commonEnemies) {
      if (!enemy.active) {
        continue
      }
      const stunUntil = Number(enemy.getData('stunUntil') ?? 0)
      if (this.time.now < stunUntil) {
        enemy.setVelocityX(0)
        enemy.setTint(0xcdf8ff)
        continue
      }
      enemy.clearTint()

      const minX = Number(enemy.getData('patrolMin') ?? enemy.x - 80)
      const maxX = Number(enemy.getData('patrolMax') ?? enemy.x + 80)
      const speed = Number(enemy.getData('speed') ?? 60)
      if (enemy.x <= minX) {
        enemy.setVelocityX(speed)
      } else if (enemy.x >= maxX) {
        enemy.setVelocityX(-speed)
      }
    }
  }

  private updateMiniBosses(): void {
    if (this.fusionActive && this.fusionSentinel.active) {
      const stunUntil = Number(this.fusionSentinel.getData('stunUntil') ?? 0)
      if (this.time.now < stunUntil) {
        this.fusionSentinel.setTint(0xd8f6ff)
      } else {
        this.fusionSentinel.clearTint()
        if (this.time.now - Number(this.fusionSentinel.getData('lastAttackAt') ?? 0) > 1500) {
          this.fireEnemyBurst(this.fusionSentinel, 3, 230)
          this.fusionSentinel.setData('lastAttackAt', this.time.now)
        }
      }
    }

    if (this.constructActive && this.corruptedConstruct.active) {
      const stunUntil = Number(this.corruptedConstruct.getData('stunUntil') ?? 0)
      if (this.time.now < stunUntil) {
        this.corruptedConstruct.setTint(0xd9d0ff)
      } else {
        this.corruptedConstruct.clearTint()
        if (this.time.now - Number(this.corruptedConstruct.getData('lastAttackAt') ?? 0) > 1650) {
          const roll = Phaser.Math.Between(0, 100)
          if (roll < 60) {
            const dir = this.player.x > this.corruptedConstruct.x ? 1 : -1
            this.corruptedConstruct.setVelocityX(dir * 220)
            this.time.delayedCall(260, () => this.corruptedConstruct.setVelocityX(0))
            this.statusMessage = 'Corrupted Construct charge!'
          } else {
            this.spawnConstructDrone()
            this.statusMessage = 'Corrupted Construct summoned drones!'
          }
          this.corruptedConstruct.setData('lastAttackAt', this.time.now)
          this.updateUiText()
        }
      }
    }
  }

  private updateFinalBoss(): void {
    if (!this.finalBossActive || !this.firstCorruption.active || this.finalBossDefeated) {
      return
    }

    const stunUntil = Number(this.firstCorruption.getData('stunUntil') ?? 0)
    if (this.time.now < stunUntil) {
      this.firstCorruption.setTint(0xf4e5ff)
      return
    }
    this.firstCorruption.clearTint()

    const phase = this.getFinalBossPhase()
    const speed = phase === 1 ? 1.5 : phase === 2 ? 2.1 : 2.8
    this.firstCorruption.x += this.chromaforgeDirection() * speed
    if (this.firstCorruption.x < 4300) {
      this.firstCorruption.setData('dir', 1)
    } else if (this.firstCorruption.x > 4540) {
      this.firstCorruption.setData('dir', -1)
    }

    if (this.time.now - this.bossLastActionAt < (phase === 3 ? 850 : phase === 2 ? 1050 : 1300)) {
      return
    }

    this.bossLastActionAt = this.time.now
    if (phase === 1) {
      this.firstCorruptionPunchShockwave()
      return
    }
    if (phase === 2) {
      this.firstCorruptionBeamSpread()
      return
    }

    const roll = Phaser.Math.Between(0, 100)
    if (roll < 52) {
      this.firstCorruptionBeamSpread(10)
    } else {
      this.firstCorruptionAbsorbAttempt()
    }
  }

  private getFinalBossPhase(): 1 | 2 | 3 {
    const ratio = this.firstCorruptionHp / this.firstCorruptionMaxHp
    if (ratio > 0.66) {
      return 1
    }
    if (ratio > 0.33) {
      return 2
    }
    return 3
  }

  private firstCorruptionPunchShockwave(): void {
    const dir = this.player.x >= this.firstCorruption.x ? 1 : -1
    const wave = this.add.rectangle(this.firstCorruption.x + dir * 60, 836, 28, 24, 0xffa2c7, 0.85)
    this.tweens.add({
      targets: wave,
      x: wave.x + dir * 320,
      duration: 450,
      onUpdate: () => {
        if (Phaser.Geom.Intersects.RectangleToRectangle(wave.getBounds(), this.player.getBounds())) {
          this.applyDamage(1, 'Shockwave hit!')
        }
      },
      onComplete: () => wave.destroy(),
    })
    this.statusMessage = 'Exomon: shockwave!'
    this.updateUiText()
  }

  private firstCorruptionBeamSpread(count = 7): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (-0.75 + (1.5 * i) / Math.max(1, count - 1)) * Math.PI
      const shot = this.enemyShots.get(this.firstCorruption.x, this.firstCorruption.y, 'enemy-shot-forge') as
        | Phaser.Physics.Arcade.Image
        | null
      if (!shot) {
        continue
      }
      shot.enableBody(true, this.firstCorruption.x, this.firstCorruption.y, true, true)
      shot.setActive(true)
      shot.setVisible(true)
      shot.setVelocity(Math.cos(angle) * 250, Math.sin(angle) * 250)
      this.time.delayedCall(1700, () => shot.disableBody?.(true, true))
    }
    this.statusMessage = 'Exomon: beam spread!'
    this.updateUiText()
  }

  private firstCorruptionAbsorbAttempt(): void {
    this.finalBossAbsorbActive = true
    this.finalBossAbsorbInterrupted = false
    this.statusMessage = 'Exomon is absorbing energy! Use Solar Bind!'
    this.updateUiText()

    const ring = this.add.circle(this.firstCorruption.x, this.firstCorruption.y, 24, 0xffd1ef, 0.42)
    this.tweens.add({
      targets: ring,
      scale: 5,
      alpha: 0,
      duration: 900,
      onComplete: () => ring.destroy(),
    })

    this.time.delayedCall(1050, () => {
      if (!this.finalBossAbsorbActive) {
        return
      }
      this.finalBossAbsorbActive = false
      if (!this.finalBossAbsorbInterrupted) {
        this.applyDamage(2, 'Absorption blast!')
        this.firstCorruptionHp = Math.min(this.firstCorruptionMaxHp, this.firstCorruptionHp + 2.5)
      }
    })
  }

  private chromaforgeDirection(): number {
    const current = Number(this.firstCorruption.getData('dir') ?? -1)
    return current === 0 ? -1 : current
  }

  private spawnConstructDrone(): void {
    const minion = this.bossMinions.get(this.corruptedConstruct.x, this.corruptedConstruct.y + 26, 'enemy-scout') as
      | EnemyUnit
      | null
    if (!minion) {
      return
    }
    minion.enableBody(true, minion.x, minion.y, true, true)
    minion.setActive(true)
    minion.setVisible(true)
    minion.setCollideWorldBounds(true)
    ;(minion.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    minion.setData('hp', 8)
    minion.setData('maxHp', 8)
    minion.setData('hitCount', 0)
    minion.setData('requiredHits', 10)
    minion.setData('lastHitAt', 0)
    minion.setVelocityX(Phaser.Math.Between(-110, 110))
    this.physics.add.collider(minion, this.platforms)

    this.time.delayedCall(3000, () => {
      if (minion.active) {
        minion.disableBody(true, true)
      }
    })
  }

  private fireEnemyBurst(from: EnemyUnit, count: number, speed: number): void {
    const dx = this.player.x - from.x
    const dy = this.player.y - from.y
    const base = Math.atan2(dy, dx)
    const spread = count === 1 ? [0] : [-0.22, 0, 0.22]
    for (const s of spread) {
      const shot = this.enemyShots.get(from.x, from.y, 'enemy-shot-forge') as Phaser.Physics.Arcade.Image | null
      if (!shot) {
        continue
      }
      const angle = base + s
      shot.enableBody(true, from.x, from.y, true, true)
      shot.setActive(true)
      shot.setVisible(true)
      shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      this.time.delayedCall(1500, () => shot.disableBody?.(true, true))
    }
  }

  private scheduleFallingRocks(): void {
    const spawnXs = [980, 1620, 2380, 3200, 3740]
    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive) {
          return
        }
        const x = Phaser.Utils.Array.GetRandom(spawnXs)
        const rock = this.rocks.get(x, 60, 'forge-rock') as Phaser.Physics.Arcade.Image | null
        if (!rock) {
          return
        }
        rock.enableBody(true, x, 60, true, true)
        rock.setActive(true)
        rock.setVisible(true)
        rock.setVelocity(Phaser.Math.Between(-20, 20), 20)
        rock.setGravityY(900)
        this.time.delayedCall(2600, () => rock.disableBody?.(true, true))
      },
    })
  }

  private addTimedLaser(x: number, y: number, w: number, h: number, onMs: number, offMs: number): void {
    const rect = this.add.rectangle(x, y, w, h, 0xff78b0, 0.66)
    rect.setDepth(12)
    const data: TimedLaser = {
      rect,
      bounds: new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h),
      active: true,
      onMs,
      offMs,
    }
    this.timedLasers.push(data)

    const toggle = (): void => {
      data.active = !data.active
      data.rect.setVisible(data.active)
      this.time.delayedCall(data.active ? data.onMs : data.offMs, toggle)
    }
    this.time.delayedCall(onMs, toggle)
  }

  private createSlipperyZone(centerX: number, centerY: number, width: number, height: number): Phaser.Geom.Rectangle {
    this.add.rectangle(centerX, centerY, width, height, 0x7fd8ff, 0.28)
    return new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height)
  }

  private checkHazards(): void {
    const pBounds = this.player.getBounds()
    for (const pit of this.pitZones) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, pit)) {
        this.applyDamage(1, 'Fell into a void pit!', true)
        return
      }
    }
    for (const laser of this.timedLasers) {
      if (laser.active && Phaser.Geom.Intersects.RectangleToRectangle(pBounds, laser.bounds)) {
        this.applyDamage(1, 'Laser hazard!')
        return
      }
    }
  }

  private updateSectionTriggers(): void {
    if (!this.section2Triggered && this.player.x > 1700) {
      this.section2Triggered = true
      this.startFusionSentinelEncounter()
    }
    if (this.section2Triggered && !this.mini1Defeated && !this.fusionActive && !this.fusionSentinel.active && this.player.x > 1820) {
      this.startFusionSentinelEncounter()
    }

    if (!this.section3Triggered && (this.player.x > 3000 || this.mini1Defeated)) {
      this.section3Triggered = true
      this.startMatterBridgeSequence()
    }
    if (this.section3Triggered && !this.mini2Defeated && !this.constructActive && !this.corruptedConstruct.active && this.player.x > 3340) {
      this.startCorruptedConstructEncounter()
    }

    if (!this.finalTriggered && this.player.x > 4200 && this.mini2Defeated) {
      this.finalTriggered = true
      this.startFinalBossSequence()
    }
    if (!this.finalTriggered && this.player.x > 4400) {
      this.finalTriggered = true
      this.startFinalBossSequence()
    }
  }

  private ensureEncounterRecovery(): void {
    if (this.cutsceneActive) {
      return
    }
    if (this.time.now - this.lastEncounterRecoveryAt < 850) {
      return
    }
    this.lastEncounterRecoveryAt = this.time.now

    if (this.section2Triggered && !this.mini1Defeated && !this.fusionSentinel.active && !this.fusionActive) {
      this.fusionActive = true
      this.fusionSentinel.enableBody(true, Phaser.Math.Clamp(this.player.x + 150, 2060, 2400), 612, true, true)
      this.fusionSentinel.setVisible(true)
      this.statusMessage = 'Fusion Sentinel re-engaged.'
      this.updateUiText()
      return
    }

    if (this.section3Triggered && !this.mini2Defeated && !this.corruptedConstruct.active && !this.constructActive) {
      this.constructActive = true
      this.corruptedConstruct.enableBody(true, Phaser.Math.Clamp(this.player.x + 180, 3400, 3720), 780, true, true)
      this.corruptedConstruct.setVisible(true)
      this.statusMessage = 'Corrupted Construct re-engaged.'
      this.updateUiText()
      return
    }

    if (this.finalTriggered && !this.finalBossDefeated && !this.firstCorruption.active) {
      this.finalBossActive = true
      const spawnX = Phaser.Math.Clamp(this.player.x + 180, 4340, 4500)
      this.firstCorruption.enableBody(true, spawnX, 752, true, true)
      this.firstCorruption.setVisible(true)
      this.firstCorruption.setActive(true)
      this.bossLastActionAt = this.time.now - 1000
      this.statusMessage = 'Exomon re-engaged.'
      this.updateUiText()
    }
  }

  private tryRecoverFinalEncounterNearExit(): void {
    if (this.finalBossDefeated) {
      return
    }
    if (this.firstCorruption.active && this.finalBossActive) {
      return
    }
    this.finalTriggered = true
    this.finalBossActive = true
    const spawnX = Phaser.Math.Clamp(this.player.x - 120, 4340, 4500)
    this.firstCorruption.enableBody(true, spawnX, 752, true, true)
    this.firstCorruption.setVisible(true)
    this.firstCorruption.setActive(true)
    this.bossLastActionAt = this.time.now - 1000
  }

  private startFusionSentinelEncounter(): void {
    this.fusionActive = true
    this.fusionHp = this.fusionMaxHp
    this.fusionHitCount = 0
    this.lastFusionHitAt = 0
    this.fusionDamageLockUntil = this.time.now + 1100
    this.fusionSentinel.enableBody(true, 2240, 612, true, true)
    this.startDialogue(
      [
        'Mini-Boss: Fusion Sentinel',
        'It rotates elements and fires composite bursts.',
        'Use Solar Bind to control the tempo.',
        'Press Space to engage.',
      ],
      () => {
        this.statusMessage = 'Fusion Sentinel engaged.'
        this.updateUiText()
      },
    )
  }

  private startMatterBridgeSequence(): void {
    if (this.matterBridgeBuilt) {
      return
    }
    this.startDialogue(
      [
        'Chromaforge: I arrived with nothing but a pile of matter.',
        'Chromaforge: I shaped it.',
        'Chromaforge: I forged this world.',
        'Press Space to form the bridge.',
      ],
      () => {
        this.buildMatterBridge()
        this.startCorruptedConstructEncounter()
      },
    )
  }

  private buildMatterBridge(): void {
    if (this.matterBridgeBuilt) {
      return
    }
    this.matterBridgeBuilt = true
    const bridge: Array<[number, number, number, number, number]> = [
      [3720, 790, 150, 20, 0x9cd1ff],
      [3900, 750, 150, 20, 0x9cd1ff],
      [4080, 710, 150, 20, 0x9cd1ff],
    ]
    bridge.forEach(([x, y, w, h, c]) => {
      const p = this.createStaticPlatform(x, y, w, h, c)
      p.setAlpha(0)
      this.tweens.add({ targets: p, alpha: 1, duration: 360 })
      this.platforms.push(p)
      this.physics.add.collider(this.player, p)
      this.physics.add.collider(this.fusionSentinel, p)
      this.physics.add.collider(this.corruptedConstruct, p)
      this.physics.add.collider(this.firstCorruption, p)
    })
    this.statusMessage = 'The Matter Bridge formed.'
    this.updateUiText()
  }

  private startCorruptedConstructEncounter(): void {
    this.constructActive = true
    this.constructHp = this.constructMaxHp
    this.constructHitCount = 0
    this.lastConstructHitAt = 0
    this.constructDamageLockUntil = this.time.now + 1100
    this.corruptedConstruct.enableBody(true, 3520, 780, true, true)
    this.startDialogue(
      [
        'Mini-Boss: Corrupted Construct',
        'It uses knockback strikes and summons drones.',
        'Press Space to engage.',
      ],
      () => {
        this.statusMessage = 'Corrupted Construct engaged.'
        this.updateUiText()
      },
    )
  }

  private startFinalBossSequence(): void {
    if (this.finalBossActive || this.finalBossDefeated) {
      return
    }
    this.finalBossActive = true
    this.finalBossDefeated = false
    this.firstCorruptionHp = this.firstCorruptionMaxHp
    this.firstCorruptionHitCount = 0
    this.lastFirstCorruptionHitAt = 0
    const spawnX = Phaser.Math.Clamp(this.player.x + 210, 4320, 4500)
    this.firstCorruption.setData('dir', -1)
    this.firstCorruption.enableBody(true, spawnX, 752, true, true)
    this.firstCorruption.setVisible(true)
    this.firstCorruption.setActive(true)
    this.firstCorruption.setDepth(40)
    this.finalBossDamageLockUntil = this.time.now + 1500
    this.startDialogue(
      [
        'Final Boss: Exomon',
        'Phase 1: shockwaves. Phase 2: beam spreads. Phase 3: absorb cycles.',
        'Use Solar Bind to interrupt absorption.',
        'Press Space to begin the final battle.',
      ],
      () => {
        this.bossLastActionAt = this.time.now - 1200
        this.statusMessage = 'Exomon engaged.'
        this.updateUiText()
      },
    )
  }

  private damageFusionSentinel(_amount: number): void {
    if (!this.fusionActive || !this.fusionSentinel.active || this.mini1Defeated) {
      return
    }
    const now = this.time.now
    if (now < this.fusionDamageLockUntil) {
      return
    }
    if (now - this.lastFusionHitAt < 360) {
      return
    }
    this.lastFusionHitAt = now
    this.fusionHitCount += 1
    const ratio = Phaser.Math.Clamp(1 - this.fusionHitCount / this.fusionRequiredHits, 0, 1)
    this.fusionHp = this.fusionMaxHp * ratio
    if (this.fusionHitCount >= this.fusionRequiredHits) {
      this.mini1Defeated = true
      this.fusionActive = false
      this.fusionSentinel.disableBody(true, true)
      this.statusMessage = 'Fusion Sentinel defeated.'
      this.updateUiText()
    }
  }

  private damageCorruptedConstruct(_amount: number): void {
    if (!this.constructActive || !this.corruptedConstruct.active || this.mini2Defeated) {
      return
    }
    const now = this.time.now
    if (now < this.constructDamageLockUntil) {
      return
    }
    if (now - this.lastConstructHitAt < 360) {
      return
    }
    this.lastConstructHitAt = now
    this.constructHitCount += 1
    const ratio = Phaser.Math.Clamp(1 - this.constructHitCount / this.constructRequiredHits, 0, 1)
    this.constructHp = this.constructMaxHp * ratio
    if (this.constructHitCount >= this.constructRequiredHits) {
      this.mini2Defeated = true
      this.constructActive = false
      this.corruptedConstruct.disableBody(true, true)
      this.statusMessage = 'Corrupted Construct defeated. Final chamber unlocked.'
      if (!this.finalTriggered) {
        this.finalTriggered = true
        this.time.delayedCall(450, () => this.startFinalBossSequence())
      }
      this.updateUiText()
    }
  }

  private damageFirstCorruption(_amount: number): void {
    if (!this.finalBossActive || !this.firstCorruption.active || this.finalBossDefeated) {
      return
    }
    const now = this.time.now
    if (now < this.finalBossDamageLockUntil) {
      return
    }
    if (now - this.lastFirstCorruptionHitAt < 520) {
      return
    }
    this.lastFirstCorruptionHitAt = now
    this.firstCorruptionHitCount += 1
    const ratio = Phaser.Math.Clamp(1 - this.firstCorruptionHitCount / this.firstCorruptionRequiredHits, 0, 1)
    this.firstCorruptionHp = this.firstCorruptionMaxHp * ratio
    if (this.firstCorruptionHitCount >= this.firstCorruptionRequiredHits) {
      this.finalBossDefeated = true
      this.firstCorruption.disableBody(true, true)
      this.finishStage()
    }
    this.updateUiText()
  }

  private finishStage(): void {
    if (this.stageClearTriggered || this.exitPortalActive) {
      return
    }
    this.exitPortalActive = true
    if (this.exitPortal) {
      this.exitPortal.setPosition(4520, 790)
      this.exitPortal.setVisible(true)
      this.exitPortal.setStrokeStyle(2, 0xd7f2ff, 0.9)
      this.exitPortal.setFillStyle(0xa7e2ff, 0.6)
      this.tweens.add({
        targets: this.exitPortal,
        alpha: { from: 0.35, to: 0.9 },
        duration: 560,
        yoyo: true,
        repeat: -1,
      })
    }
    this.startDialogue(
      [
        'Exomon has fallen.',
        'Chromaforge: The forge remembers.',
        'Chromaforge: The trials were never the end.',
        'Exit portal opened. Reach it to clear Stage 6.',
      ],
      () => {
        this.statusMessage = 'Portal active. Move to extraction.'
        this.updateUiText()
      },
    )
  }

  private completeStage(): void {
    if (this.stageClearTriggered) {
      return
    }
    this.stageClearTriggered = true
    gameProgress.forgeOfOriginsCleared = true
    saveGameProgress()
    this.startDialogue(['STAGE CLEAR - Press Space.'], () => {
      this.scene.start('stage-select')
    })
  }

  private applyDamage(amount: number, message: string, forceRespawn = false): void {
    if (this.isPlayerInvulnerable || this.cutsceneActive) {
      return
    }

    this.playerHealth = Math.max(0, this.playerHealth - amount * this.damageReductionMul)
    this.isPlayerInvulnerable = true
    this.player.setTint(0xffb7b7)
    this.statusMessage = message
    this.updateUiText()

    if (forceRespawn || this.playerHealth <= 0) {
      this.playerHealth = this.playerMaxHealth
      this.player.setPosition(this.checkpointX, this.checkpointY)
      this.player.setVelocity(0, 0)
      this.player.setAccelerationX(0)
      this.statusMessage = 'Respawned at checkpoint.'
      this.updateUiText()
    }

    this.time.delayedCall(this.invulnerabilityMs, () => {
      this.isPlayerInvulnerable = false
      this.player.clearTint()
    })
  }

  private startIntroCutscene(): void {
    this.startDialogue(
      [
        'Stage 6: Forge of Origins',
        'This is the original Forge Core - birthplace of the Dungeon Planet.',
        'Chromaforge is fully active in this zone.',
        'Press Space to deploy.',
      ],
      () => {
        this.statusMessage = 'Forge of Origins mission started.'
        this.updateUiText()
      },
    )
  }

  private startDialogue(lines: string[], onEnd?: () => void): void {
    this.cutsceneLines = lines
    this.cutsceneIndex = 0
    this.cutsceneActive = true
    this.cutsceneOnEnd = onEnd ?? null
    this.showCutsceneLine(lines[0])
  }

  private showCutsceneLine(line: string): void {
    if (!this.cutscenePanel || !this.cutsceneText) {
      this.cutscenePanel = this.add.rectangle(480, 420, 900, 180, 0x050814, 0.86)
      this.cutscenePanel.setStrokeStyle(2, 0x9ec9ff, 0.95)
      this.cutscenePanel.setDepth(200)
      this.cutscenePanel.setScrollFactor(0)

      this.cutsceneText = this.add.text(66, 350, '', {
        color: '#f4f7ff',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        wordWrap: { width: 840 },
        lineSpacing: 8,
      })
      this.cutsceneText.setDepth(201)
      this.cutsceneText.setScrollFactor(0)
    }

    this.cutscenePanel.setVisible(true)
    this.cutsceneText.setVisible(true)
    this.cutsceneText.setText(line)
  }

  private advanceCutscene(): void {
    this.cutsceneIndex += 1
    if (this.cutsceneIndex >= this.cutsceneLines.length) {
      this.cutsceneActive = false
      this.cutscenePanel.setVisible(false)
      this.cutsceneText.setVisible(false)
      if (this.cutsceneOnEnd) {
        const cb = this.cutsceneOnEnd
        this.cutsceneOnEnd = null
        cb()
      }
      return
    }
    this.cutsceneText.setText(this.cutsceneLines[this.cutsceneIndex])
  }

  private updateUiText(): void {
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    const fusionState = this.mini1Defeated ? 'Defeated' : this.fusionActive ? `${this.fusionHp.toFixed(1)} HP` : 'Not Engaged'
    const constructState = this.mini2Defeated
      ? 'Defeated'
      : this.constructActive
        ? `${this.constructHp.toFixed(1)} HP`
        : 'Not Engaged'
    const exomonState = this.finalBossDefeated
      ? 'Defeated'
      : this.finalBossActive
        ? `${this.firstCorruptionHp.toFixed(1)} HP`
        : 'Not Spawned'
    this.uiText.setText(
      [
        'Dungeon Busters',
        'Stage 6: Forge of Origins',
        `Hero: ${this.selectedHero.displayName}`,
        `Special (X): ${this.selectedHero.moves.special.name}`,
        `HP: ${hp}`,
        `Fusion Sentinel: ${fusionState}`,
        `Corrupted Construct: ${constructState}`,
        `Exomon: ${exomonState}`,
        this.statusMessage,
      ].join('\n'),
    )
  }

  private drawBar(key: string, x: number, y: number, width: number, current: number, max: number, color: number): void {
    let gfx = this.healthBars.get(key)
    if (!gfx) {
      gfx = this.add.graphics()
      gfx.setDepth(120)
      this.healthBars.set(key, gfx)
    }
    gfx.clear()
    if (max <= 0 || current <= 0) {
      return
    }
    const ratio = Phaser.Math.Clamp(current / max, 0, 1)
    gfx.fillStyle(0x000000, 0.62)
    gfx.fillRect(x - width / 2 - 1, y - 1, width + 2, 7)
    gfx.fillStyle(0x2a2a2a, 0.85)
    gfx.fillRect(x - width / 2, y, width, 5)
    gfx.fillStyle(color, 0.95)
    gfx.fillRect(x - width / 2, y, Math.max(1, width * ratio), 5)
  }

  private clearBar(key: string): void {
    const gfx = this.healthBars.get(key)
    if (!gfx) {
      return
    }
    gfx.clear()
    gfx.destroy()
    this.healthBars.delete(key)
  }

  private updateHealthBars(): void {
    this.drawBar('player', this.player.x, this.player.y - 48, 58, this.playerHealth, this.playerMaxHealth, 0x8dff9d)

    for (let i = 0; i < this.commonEnemies.length; i += 1) {
      const enemy = this.commonEnemies[i]
      const hp = Number(enemy.getData('hp') ?? 0)
      const max = Number(enemy.getData('maxHp') ?? 4)
      const key = `enemy-${i}`
      if (!enemy.active || hp <= 0) {
        const gfx = this.healthBars.get(key)
        if (gfx) {
          gfx.clear()
          gfx.destroy()
          this.healthBars.delete(key)
        }
        continue
      }
      this.drawBar(key, enemy.x, enemy.y - 30, 32, hp, max, 0xffb18b)
    }

    if (this.fusionActive && this.fusionSentinel.active) {
      this.drawBar('fusion', this.fusionSentinel.x, this.fusionSentinel.y - 48, 80, this.fusionHp, this.fusionMaxHp, 0x9be8ff)
    } else {
      this.clearBar('fusion')
    }

    if (this.constructActive && this.corruptedConstruct.active) {
      this.drawBar('construct', this.corruptedConstruct.x, this.corruptedConstruct.y - 78, 90, this.constructHp, this.constructMaxHp, 0xc8afff)
    } else {
      this.clearBar('construct')
    }

    if (this.finalBossActive && this.firstCorruption.active) {
      this.drawBar(
        'first-corruption',
        this.firstCorruption.x,
        this.firstCorruption.y - this.firstCorruption.displayHeight * 0.58,
        130,
        this.firstCorruptionHp,
        this.firstCorruptionMaxHp,
        0xff9fca,
      )
    } else {
      this.clearBar('first-corruption')
    }

    const staleMinions: EnemyUnit[] = []
    for (const [minion, gfx] of this.minionBars.entries()) {
      gfx.clear()
      if (!minion.active) {
        gfx.destroy()
        staleMinions.push(minion)
        continue
      }
      const hp = Number(minion.getData('hp') ?? 0)
      const max = Number(minion.getData('maxHp') ?? 3)
      if (hp <= 0) {
        gfx.destroy()
        staleMinions.push(minion)
        continue
      }
      const ratio = Phaser.Math.Clamp(hp / max, 0, 1)
      const width = 26
      const y = minion.y - 24
      gfx.fillStyle(0x000000, 0.62)
      gfx.fillRect(minion.x - width / 2 - 1, y - 1, width + 2, 6)
      gfx.fillStyle(0x2a2a2a, 0.84)
      gfx.fillRect(minion.x - width / 2, y, width, 4)
      gfx.fillStyle(0xffc08e, 0.95)
      gfx.fillRect(minion.x - width / 2, y, Math.max(1, width * ratio), 4)
    }
    for (const minion of staleMinions) {
      this.minionBars.delete(minion)
    }

    this.bossMinions.children.each((obj) => {
      const minion = obj as EnemyUnit
      if (!minion.active) {
        return true
      }
      if (!this.minionBars.has(minion)) {
        const gfx = this.add.graphics()
        gfx.setDepth(120)
        this.minionBars.set(minion, gfx)
      }
      return true
    })
  }

  private cleanupHealthBars(): void {
    for (const gfx of this.healthBars.values()) {
      gfx.clear()
      gfx.destroy()
    }
    this.healthBars.clear()
    for (const gfx of this.minionBars.values()) {
      gfx.clear()
      gfx.destroy()
    }
    this.minionBars.clear()
  }

  private playTone(freq: number, durationSec = 0.06): void {
    const ctx = (this.sound as unknown as { context?: AudioContext }).context
    if (!ctx) {
      return
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.value = 0.025
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durationSec)
  }

  private createStaticPlatform(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    color: number,
  ): Phaser.GameObjects.Rectangle {
    const p = this.add.rectangle(centerX, centerY, width, height, color)
    this.physics.add.existing(p, true)
    return p
  }
}
