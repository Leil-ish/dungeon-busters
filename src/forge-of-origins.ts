import Phaser from 'phaser'
import { applyCombatDamage, configureCombatant, getCombatHp, getCombatMaxHp } from './combat'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type HeroDefinition,
  type HeroId,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress, getLivesDisplay, loseLife, resetLives, saveGameProgress } from './progress'
import { preloadSpriteAssets } from './sprite-assets'
import { addMinigameEntrances } from './minigame-entrances'

type TimedLaser = {
  rect: Phaser.GameObjects.Rectangle
  bounds: Phaser.Geom.Rectangle
  active: boolean
  onMs: number
  offMs: number
}

type MoltenPool = {
  rect: Phaser.GameObjects.Rectangle
  bounds: Phaser.Geom.Rectangle
  bubble: Phaser.GameObjects.Ellipse
}

type EnemyUnit = Phaser.Physics.Arcade.Sprite
type ForgeArenaState =
  | 'fusion_idle'
  | 'fusion_active'
  | 'fusion_cleared'
  | 'construct_idle'
  | 'construct_active'
  | 'construct_cleared'
  | 'exomon_idle'
  | 'exomon_active'
  | 'exomon_cleared'
  | 'stage_clear'

export class ForgeOfOriginsScene extends Phaser.Scene {
  private readonly LEVEL_W = 5200
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

  private readonly fusionMaxHp = 40
  private fusionSentinelHp = 40
  private readonly constructMaxHp = 56
  private corruptedConstructHp = 56
  private firstCorruptionHp = 96
  private readonly firstCorruptionMaxHp = 96

  private finalBossDefeated = false
  private finalBossAbsorbActive = false
  private finalBossAbsorbInterrupted = false

  private mini1Defeated = false
  private mini2Defeated = false

  private timedLasers: TimedLaser[] = []
  private slipperyZones: Phaser.Geom.Rectangle[] = []
  private pitZones: Phaser.Geom.Rectangle[] = []
  private moltenPools: MoltenPool[] = []
  private arenaState: ForgeArenaState = 'fusion_idle'
  private activeArenaGates: Phaser.GameObjects.Rectangle[] = []

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private fireKey!: Phaser.Input.Keyboard.Key
  private abilityKey!: Phaser.Input.Keyboard.Key
  private punchKey!: Phaser.Input.Keyboard.Key
  private kickKey!: Phaser.Input.Keyboard.Key

  private uiText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
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
  private startX = 140
  private startY = 680
  private returningFromMinigame = false
  private returnMessage = ''
  private lastAbilityAt = 0
  private abilityPowerScale = 1
  private lastMeleeAt = 0
  private meleeComboStep = 0
  private chromaforgeCrashArmed = false
  private chromaforgeCrashDiveStarted = false
  private facingDir = 1
  private bossLastActionAt = 0
  private lastFusionHitAt = 0
  private lastConstructHitAt = 0
  private lastFirstCorruptionHitAt = 0
  private fusionDamageLockUntil = 0
  private constructDamageLockUntil = 0
  private finalBossDamageLockUntil = 0
  private readonly normalDragX = 860
  private readonly slipperyDragX = 180
  private readonly abilityCooldownMs = 1700

  private healthBars = new Map<string, Phaser.GameObjects.Graphics>()
  private minionBars = new Map<EnemyUnit, Phaser.GameObjects.Graphics>()

  constructor() {
    super('forge-of-origins')
  }

  init(data: { fromMinigame?: boolean; returnX?: number; returnY?: number; returnMessage?: string }): void {
    this.returningFromMinigame = data.fromMinigame ?? false
    this.startX = data.returnX ?? 140
    this.startY = data.returnY ?? 680
    this.returnMessage = data.returnMessage ?? ''
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
    addMinigameEntrances(this, {
      stageKey: 'forge-of-origins',
      player: this.player,
      returnScene: 'forge-of-origins',
      setStatus: (message) => {
        this.statusMessage = message
        this.updateUiText()
      },
    })
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
      fontSize: '16px',
      backgroundColor: '#090a1bcc',
      padding: { x: 10, y: 8 },
      wordWrap: { width: 560 },
      fixedWidth: 580,
    })
    this.uiText.setDepth(100)
    this.uiText.setScrollFactor(0)
    this.livesText = this.add.text(this.scale.width - 16, 16, '', {
      color: '#ffdca8',
      fontFamily: 'sans-serif',
      fontSize: '21px',
      backgroundColor: '#090a1bcc',
      padding: { x: 10, y: 6 },
      fixedWidth: 176,
      align: 'right',
    })
    this.livesText.setOrigin(1, 0)
    this.livesText.setDepth(100)
    this.livesText.setScrollFactor(0)
    if (this.returnMessage) {
      this.statusMessage = this.returnMessage
    }
    this.updateUiText()

    if (this.returningFromMinigame) {
      this.cutsceneActive = false
    } else {
      this.startIntroCutscene()
    }
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
    this.updateChromaforgeCrash()
    this.handleCombatInputs()

    this.updateCommonEnemies()
    this.updateMiniBosses()
    this.updateFinalBoss()

    this.updateSectionTriggers()
    this.checkHazards()
    this.updateHealthBars()

    if (this.exitPortal && this.physics.overlap(this.player, this.exitPortal) && !this.stageClearTriggered) {
      if (this.exitPortalActive) {
        this.completeStage()
      } else if (this.time.now - this.lastPortalPromptAt > 900) {
        this.lastPortalPromptAt = this.time.now
        if (this.arenaState === 'exomon_idle') {
          this.startFinalBossSequence()
        } else if (this.arenaState === 'exomon_active' && !this.firstCorruption.active) {
          this.restoreBossForArena('exomon_active')
        }
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
      // Start lane: ground combat.
      [360, 860, 720, 80, 0x3c3554],
      [1120, 860, 520, 80, 0x3c3554],

      // Short platform route with clean jumps.
      [1520, 770, 180, 24, 0x6872b5],
      [1760, 700, 180, 24, 0x6872b5],
      [2000, 630, 180, 24, 0x6872b5],

      // Fusion arena: flat fight floor.
      [2460, 860, 900, 80, 0x3c3554],

      // Construct transition: one clear climb.
      [3200, 760, 220, 24, 0x7a5fbf],
      [3460, 690, 220, 24, 0x7a5fbf],
      [3720, 620, 220, 24, 0x7a5fbf],

      // Construct arena: flat fight floor.
      [4140, 860, 920, 80, 0x3c3554],

      // Final approach and boss lane.
      [4640, 790, 220, 24, 0x9c8cff],
      [4880, 860, 700, 80, 0x3c3554],
    ]

    this.platforms = defs.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))

    this.pitZones = [this.createPitZone(1770, 884, 420, 42), this.createPitZone(3460, 884, 300, 42)]
    this.createMoltenPool(2140, 846, 120, 24)
    this.createMoltenPool(2780, 846, 126, 24)
    this.createMoltenPool(3890, 846, 118, 24)
    this.createMoltenPool(4395, 846, 134, 24)
    this.createMoltenPool(4800, 846, 108, 24)
  }

  private createPitZone(centerX: number, centerY: number, width: number, height: number): Phaser.Geom.Rectangle {
    this.add.rectangle(centerX, centerY, width, height, 0x120000, 0.28)
    return new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height)
  }

  private createMoltenPool(centerX: number, centerY: number, width: number, height: number): void {
    const crust = this.add.rectangle(centerX, centerY + height * 0.42, width + 10, 12, 0x2e221c, 0.92)
    crust.setDepth(4)
    const glow = this.add.ellipse(centerX, centerY + 2, width + 24, height + 18, 0xff6e36, 0.18)
    glow.setDepth(4)
    const rect = this.add.rectangle(centerX, centerY, width, height, 0xff7f36, 0.82)
    rect.setStrokeStyle(2, 0xffc16e, 0.7)
    rect.setDepth(6)
    const bubble = this.add.ellipse(centerX - width * 0.18, centerY - 3, 18, 8, 0xffdc9a, 0.45)
    bubble.setDepth(7)
    this.tweens.add({
      targets: [glow, rect],
      alpha: { from: 0.6, to: 0.95 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    })
    this.tweens.add({
      targets: bubble,
      x: centerX + width * 0.2,
      scaleX: 1.25,
      scaleY: 1.15,
      alpha: { from: 0.18, to: 0.62 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    })
    this.moltenPools.push({
      rect,
      bubble,
      bounds: new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height),
    })
  }

  private createPlayerAndEnemies(): void {
    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'hero-micralis'
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'hero-micralis'

    this.player = this.physics.add.sprite(this.startX, this.startY, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 980)
    configureCombatant(this.player, { maxHp: this.playerMaxHealth, widthRatio: 0.66, heightRatio: 0.9 })
    this.physics.add.collider(this.player, this.platforms)

    const spawnEnemy = (x: number, y: number, minX: number, maxX: number): EnemyUnit => {
      const enemy = this.physics.add.sprite(x, y, enemyTexture)
      enemy.setImmovable(true)
      enemy.setCollideWorldBounds(true)
      ;(enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      configureCombatant(enemy, { maxHp: 12, widthRatio: 0.72, heightRatio: 0.8 })
      enemy.setData('patrolMin', minX)
      enemy.setData('patrolMax', maxX)
      enemy.setData('speed', 60)
      enemy.setVelocityX(-60)
      this.physics.add.collider(enemy, this.platforms)
      this.physics.add.overlap(this.player, enemy, () => this.handlePlayerEnemyContact(enemy, 'Enemy hit!'))
      this.commonEnemies.push(enemy)
      return enemy
    }

    spawnEnemy(980, 798, 900, 1240)
    spawnEnemy(2460, 798, 2180, 2740)
    spawnEnemy(4150, 798, 3860, 4420)

    this.fusionSentinel = this.physics.add.sprite(2460, 780, enemyTexture)
    this.fusionSentinel.setScale(1.2)
    this.fusionSentinel.setTint(0x95f0ff)
    this.fusionSentinel.setImmovable(true)
    this.fusionSentinel.setCollideWorldBounds(true)
    ;(this.fusionSentinel.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    configureCombatant(this.fusionSentinel, { maxHp: this.fusionMaxHp, widthRatio: 0.82, heightRatio: 0.9 })
    this.fusionSentinel.disableBody(true, true)
    this.physics.add.collider(this.fusionSentinel, this.platforms)
    this.physics.add.overlap(this.player, this.fusionSentinel, () => this.handlePlayerEnemyContact(this.fusionSentinel, 'Fusion Sentinel hit!'))

    this.corruptedConstruct = this.physics.add.sprite(4140, 770, enemyTexture)
    this.corruptedConstruct.setDisplaySize(140, 140)
    this.corruptedConstruct.setTint(0xc3a5ff)
    this.corruptedConstruct.setImmovable(true)
    this.corruptedConstruct.setCollideWorldBounds(true)
    ;(this.corruptedConstruct.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    configureCombatant(this.corruptedConstruct, { maxHp: this.constructMaxHp, widthRatio: 0.76, heightRatio: 0.86 })
    this.corruptedConstruct.disableBody(true, true)
    this.physics.add.collider(this.corruptedConstruct, this.platforms)
    this.physics.add.overlap(this.player, this.corruptedConstruct, () =>
      this.handlePlayerEnemyContact(this.corruptedConstruct, 'Corrupted Construct impact!'),
    )

    const finalTexture = this.textures.exists('hero-exemon') ? 'hero-exemon' : 'exomon-boss-block'
    this.firstCorruption = this.physics.add.sprite(4980, 740, finalTexture)
    this.firstCorruption.setDisplaySize(220, 220)
    this.firstCorruption.setImmovable(true)
    this.firstCorruption.setCollideWorldBounds(true)
    ;(this.firstCorruption.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    configureCombatant(this.firstCorruption, { maxHp: this.firstCorruptionMaxHp, widthRatio: 0.72, heightRatio: 0.86 })
    this.firstCorruption.disableBody(true, true)
    this.physics.add.collider(this.firstCorruption, this.platforms)
    this.physics.add.overlap(this.player, this.firstCorruption, () => this.handlePlayerEnemyContact(this.firstCorruption, 'Exomon struck!'))
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
    this.physics.add.overlap(this.player, this.bossMinions, (_playerObj, minionObj) => {
      this.handlePlayerEnemyContact(minionObj as EnemyUnit, 'Drone hit!')
    })

    this.physics.add.overlap(this.shots, this.bossMinions, (shotObj, minionObj) => {
      const shot = shotObj as Phaser.Physics.Arcade.Image
      const minion = minionObj as EnemyUnit
      if (!minion.active) {
        return
      }
      shot.disableBody(true, true)
      const result = applyCombatDamage(this, minion, 1, 220)
      if (result.died) {
        const bar = this.minionBars.get(minion)
        if (bar) {
          bar.destroy()
          this.minionBars.delete(minion)
        }
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
        applyCombatDamage(this, target, 1, 220)
      })
    }

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
    this.exitPortal = this.add.rectangle(this.LEVEL_W - 140, 758, 56, 96, 0xa7e2ff, 0.25)
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
      this.startChromaforgeCrash()
      this.updateUiText()
      return
    }

    const targets: EnemyUnit[] = [...this.commonEnemies]
    const power = this.abilityPowerScale
    if (this.fusionActive && this.fusionSentinel.active) {
      targets.push(this.fusionSentinel)
    }
    if (this.constructActive && this.corruptedConstruct.active) {
      targets.push(this.corruptedConstruct)
    }
    if (this.finalBossActive && this.firstCorruption.active) {
      targets.push(this.firstCorruption)
    }
    const damageTarget = (enemy: EnemyUnit, amount: number, cooldownMs = 220): boolean => {
      if (!enemy.active) {
        return false
      }
      if (enemy === this.fusionSentinel) {
        const prevHp = this.fusionSentinelHp
        this.lastFusionHitAt = Math.max(0, this.lastFusionHitAt - Math.max(0, 360 - cooldownMs))
        this.damageFusionSentinel(amount)
        return this.fusionSentinelHp < prevHp
      }
      if (enemy === this.corruptedConstruct) {
        const prevHp = this.corruptedConstructHp
        this.lastConstructHitAt = Math.max(0, this.lastConstructHitAt - Math.max(0, 360 - cooldownMs))
        this.damageCorruptedConstruct(amount)
        return this.corruptedConstructHp < prevHp
      }
      if (enemy === this.firstCorruption) {
        const prevHp = this.firstCorruptionHp
        this.lastFirstCorruptionHitAt = Math.max(0, this.lastFirstCorruptionHitAt - Math.max(0, 520 - cooldownMs))
        this.damageFirstCorruption(amount)
        return this.firstCorruptionHp < prevHp
      }
      const result = applyCombatDamage(this, enemy, amount, cooldownMs)
      if (!result.applied) {
        return false
      }
      if (result.died) {
        enemy.disableBody(true, true)
      }
      return true
    }
    const impactRadiusX = 185 + power * 45
    const impactRadiusY = 130 + power * 24
    const affectFrontTargets = (
      rangeX: number,
      rangeY: number,
      handler: (enemy: EnemyUnit) => void,
    ): number => {
      let hits = 0
      for (const enemy of targets) {
        if (!enemy.active) continue
        const dx = enemy.x - this.player.x
        const dy = Math.abs(enemy.y - this.player.y)
        const inFront = this.facingDir > 0 ? dx >= 0 : dx <= 0
        if (inFront && Math.abs(dx) <= rangeX && dy <= rangeY) {
          hits += 1
          handler(enemy)
        }
      }
      return hits
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
        this.player.setTint(0x9ed8ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 250 + 40 * power))
        this.player.setVelocityY(Math.min((this.player.body as Phaser.Physics.Arcade.Body).velocity.y, -80))
        affectFrontTargets(impactRadiusX, impactRadiusY, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.7 * power : 1.35 * power, 170)
          enemy.setVelocityX(this.facingDir * (220 + 35 * power))
        })
        this.time.delayedCall(200, () => this.player.clearTint())
        this.statusMessage = 'Photon Dash: lances through the forge line!'
        this.playTone(700, 0.07)
        break
      case 'THUNDER_SLIDE':
        this.damageReductionMul = Math.min(this.damageReductionMul, 0.16)
        this.player.setTint(0xbde9ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 350 + 45 * power))
        pushTargets(280 + 35 * power)
        const pulse = this.add.circle(this.player.x + this.facingDir * 36, this.player.y + 4, 28, 0xbde9ff, 0.42)
        pulse.setDepth(28)
        this.tweens.add({
          targets: pulse,
          scale: 4.6,
          alpha: 0,
          duration: 260,
          onComplete: () => pulse.destroy(),
        })
        affectFrontTargets(265 + 30 * power, 155, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.95 * power : 1.85 * power, 145)
          enemy.setTint(0xbde9ff)
          enemy.setVelocity(this.facingDir * (100 + 20 * power), -130)
          enemy.setData('stunUntil', this.time.now + 1050)
          this.time.delayedCall(1050, () => {
            if (!enemy.active) {
              return
            }
            enemy.clearTint()
            enemy.setVelocityX(this.facingDir * 45)
          })
        })
        this.enemyShots.children.each((obj) => {
          const shot = obj as Phaser.Physics.Arcade.Image
          if (!shot.active || !shot.visible) {
            return true
          }
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, shot.x, shot.y) <= 220 + 20 * power) {
            shot.disableBody(true, true)
          }
          return true
        })
        this.bossMinions.children.each((obj) => {
          const minion = obj as EnemyUnit
          if (!minion.active) {
            return true
          }
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, minion.x, minion.y) <= 180 + 20 * power) {
            damageTarget(minion, 1.3 * power, 120)
          }
          return true
        })
        this.time.delayedCall(340, () => this.player.clearTint())
        this.time.delayedCall(560, () => {
          if (this.damageReductionMul <= 0.16) {
            this.damageReductionMul = 1
          }
        })
        this.statusMessage = 'Thunder Slide: arc field collapsed the forge fire!'
        this.playTone(760, 0.08)
        break
      case 'GUST_DASH':
        this.player.setTint(0xbaf6ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 330 + 35 * power))
        this.player.setVelocityY(-200 - 35 * power)
        affectFrontTargets(impactRadiusX + 25, impactRadiusY + 35, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.35 * power : 1.1 * power, 180)
          enemy.setVelocity(this.facingDir * (270 + 25 * power), -170 - 25 * power)
        })
        this.time.delayedCall(220, () => this.player.clearTint())
        this.statusMessage = 'Gust Dash: wind shear launch!'
        this.playTone(640, 0.08)
        break
      case 'RADIANT_BARRIER':
        this.damageReductionMul = 0.24
        this.player.setTint(0xc6f6ff)
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + Math.ceil(power))
        affectFrontTargets(160 + 20 * power, 130, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.2 * power : 0.9 * power, 160)
          enemy.setTint(0xfff2a8)
          this.time.delayedCall(320, () => enemy.active && enemy.clearTint())
        })
        this.time.delayedCall(2200, () => {
          this.damageReductionMul = 1
          this.player.clearTint()
        })
        this.statusMessage = 'Radiant Barrier active. Light holds the line.'
        this.playTone(520, 0.1)
        break
      case 'FREEZE_PATCH': {
        const patch = this.add.rectangle(this.player.x, this.player.y + 48, 220 + power * 30, 26, 0xb8f5ff, 0.55)
        this.physics.add.existing(patch, true)
        const patchRect = new Phaser.Geom.Rectangle(
          this.player.x - patch.width / 2,
          this.player.y + 35,
          patch.width,
          26,
        )
        const timer = this.time.addEvent({
          delay: 90,
          repeat: 24,
          callback: () => {
            for (const enemy of targets) {
              const body = enemy.body as Phaser.Physics.Arcade.Body | null
              if (enemy.active && body && Phaser.Geom.Rectangle.Contains(patchRect, enemy.x, enemy.y)) {
                enemy.setVelocityX(body.velocity.x * 0.6)
                damageTarget(enemy, enemy === this.firstCorruption ? 0.4 * power : 0.3 * power, 180)
              }
            }
          },
        })
        this.time.delayedCall(2400, () => {
          timer.remove(false)
          patch.destroy()
        })
        this.statusMessage = 'Freeze Patch deployed. The arena floor seizes up.'
        this.playTone(410, 0.1)
        break
      }
      case 'MOLTEN_TRAIL': {
        const trail = this.add.rectangle(
          this.player.x - this.facingDir * 40,
          this.player.y + 42,
          150 + power * 24,
          20,
          0xff6b3d,
          0.7,
        )
        this.physics.add.existing(trail, true)
        affectFrontTargets(impactRadiusX, 110, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.55 * power : 1.3 * power, 150)
          enemy.setVelocityX(this.facingDir * (170 + 20 * power))
        })
        for (const enemy of targets) {
          this.physics.add.overlap(trail, enemy, () => {
            damageTarget(enemy, enemy === this.firstCorruption ? 0.55 * power : 0.45 * power, 210)
          })
        }
        this.time.delayedCall(2400, () => trail.destroy())
        this.statusMessage = 'Molten Trail ignited. The forge floor starts burning.'
        this.playTone(320, 0.09)
        break
      }
      case 'FUSION_WAVE':
        this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + 110 + 20 * power, 980)
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 1)
        affectFrontTargets(impactRadiusX + 15, 135, (enemy) => {
          damageTarget(enemy, enemy === this.firstCorruption ? 1.35 * power : 1.1 * power, 170)
          enemy.setVelocityX(this.facingDir * (190 + 30 * power))
        })
        this.time.delayedCall(2600, () => {
          this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 980)
        })
        this.statusMessage = 'Fusion Wave boost active. Reactor output surges.'
        this.playTone(740, 0.1)
        break
      case 'ABSORB':
        this.damageReductionMul = 0.4
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + Math.ceil(power))
        affectFrontTargets(170 + 20 * power, 130, (enemy) => {
          if (damageTarget(enemy, enemy === this.firstCorruption ? 1.2 * power : 1 * power, 170)) {
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 0.5)
            enemy.setTint(0xbf7dff)
            this.time.delayedCall(260, () => enemy.active && enemy.clearTint())
          }
        })
        this.time.delayedCall(2600, () => {
          this.damageReductionMul = 1
        })
        this.statusMessage = 'Absorb active. Enemy force feeds your core.'
        this.playTone(380, 0.1)
        break
      case 'SOLAR_BIND':
        this.player.setTint(0xffd777)
        this.player.setVelocityY(-220 - 40 * power)
        const hits = affectFrontTargets(230 + power * 30, 160, (enemy) => {
          if (damageTarget(enemy, enemy === this.firstCorruption ? 1.7 * power : 1.5 * power, 160)) {
            enemy.setTint(0xfff2a8)
            enemy.setVelocityX(0)
            this.time.delayedCall(900, () => enemy.active && enemy.clearTint())
          }
        })
        this.time.delayedCall(240, () => this.player.clearTint())
        this.statusMessage = hits > 0 ? 'Solar Bind: branded and pinned!' : 'Solar Bind flashes forward.'
        this.playTone(590, 0.1)
        break
      default:
        this.statusMessage = `${this.selectedHero.moves.special.name}: Coming soon`
    }
    this.updateUiText()
  }

  private startChromaforgeCrash(): void {
    this.chromaforgeCrashArmed = true
    this.chromaforgeCrashDiveStarted = false
    this.player.setTint(0xf6d3ff)
    this.player.setVelocityX(this.facingDir * 120)
    this.player.setVelocityY(-560)
    this.statusMessage = 'Chromaforge Crash armed!'
    this.playTone(820, 0.1)
  }

  private updateChromaforgeCrash(): void {
    if (!this.chromaforgeCrashArmed || this.cutsceneActive) {
      return
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body | null
    if (!body) {
      return
    }
    if (!this.chromaforgeCrashDiveStarted && body.velocity.y >= -30) {
      this.chromaforgeCrashDiveStarted = true
      this.player.setVelocityY(980)
      return
    }
    if (!this.chromaforgeCrashDiveStarted || !body.blocked.down) {
      return
    }

    this.chromaforgeCrashArmed = false
    this.chromaforgeCrashDiveStarted = false
    this.player.clearTint()
    this.applyChromaforgeCrashImpact()
  }

  private applyChromaforgeCrashImpact(): void {
    const pulse = this.add.circle(this.player.x, this.player.y + 18, 34, 0xffd0ff, 0.5)
    pulse.setDepth(30)
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 3.4,
      duration: 220,
      onComplete: () => pulse.destroy(),
    })

    let hits = 0
    const hitBounds = new Phaser.Geom.Rectangle(this.player.x - 120, this.player.y - 10, 240, 90)
    const hitEnemy = (enemy: EnemyUnit, damage: number): void => {
      if (!enemy.active || !Phaser.Geom.Intersects.RectangleToRectangle(hitBounds, enemy.getBounds())) {
        return
      }
      hits += 1
      if (enemy === this.fusionSentinel) {
        this.damageFusionSentinel(damage)
        return
      }
      if (enemy === this.corruptedConstruct) {
        this.damageCorruptedConstruct(damage + 2)
        return
      }
      if (enemy === this.firstCorruption) {
        this.damageFirstCorruption(damage)
        return
      }
      applyCombatDamage(this, enemy, damage, 120)
      if (Number(enemy.getData('hp') ?? 1) <= 0) {
        enemy.disableBody(true, true)
      }
    }

    for (const enemy of this.commonEnemies) {
      hitEnemy(enemy, 5)
    }
    if (this.fusionActive) {
      hitEnemy(this.fusionSentinel, 6)
    }
    if (this.constructActive) {
      hitEnemy(this.corruptedConstruct, 6)
    }
    if (this.finalBossActive) {
      hitEnemy(this.firstCorruption, 6)
    }
    this.bossMinions.children.each((obj) => {
      const minion = obj as EnemyUnit
      if (!minion.active || !Phaser.Geom.Intersects.RectangleToRectangle(hitBounds, minion.getBounds())) {
        return true
      }
      hits += 1
      minion.disableBody(true, true)
      const bar = this.minionBars.get(minion)
      if (bar) {
        bar.destroy()
        this.minionBars.delete(minion)
      }
      return true
    })

    this.statusMessage = hits > 0 ? `Chromaforge Crash hit ${hits}!` : 'Chromaforge Crash landed.'
    this.playTone(260, 0.14)
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
        applyCombatDamage(this, target, damage, 220)
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
      this.checkFusionSentinelShotHits()
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
      this.checkCorruptedConstructShotHits()
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

  private checkFusionSentinelShotHits(): void {
    if (!this.fusionActive || !this.fusionSentinel.active || this.mini1Defeated) {
      return
    }
    const sentinelBounds = this.fusionSentinel.getBounds()
    this.shots.children.each((obj) => {
      const shot = obj as Phaser.Physics.Arcade.Image
      if (!shot.active || !shot.visible) {
        return true
      }
      if (!Phaser.Geom.Intersects.RectangleToRectangle(shot.getBounds(), sentinelBounds)) {
        return true
      }
      shot.disableBody(true, true)
      this.damageFusionSentinel(1)
      return false
    })
  }

  private checkCorruptedConstructShotHits(): void {
    if (!this.constructActive || !this.corruptedConstruct.active || this.mini2Defeated) {
      return
    }
    const constructBounds = this.corruptedConstruct.getBounds()
    this.shots.children.each((obj) => {
      const shot = obj as Phaser.Physics.Arcade.Image
      if (!shot.active || !shot.visible) {
        return true
      }
      if (!Phaser.Geom.Intersects.RectangleToRectangle(shot.getBounds(), constructBounds)) {
        return true
      }
      shot.disableBody(true, true)
      this.damageCorruptedConstruct(1)
      return false
    })
  }

  private handlePlayerEnemyContact(enemy: EnemyUnit, message: string): void {
    if (!enemy.active) {
      return
    }
    if (this.tryStompEnemy(enemy)) {
      return
    }
    this.applyDamage(1, message)
  }

  private tryStompEnemy(enemy: EnemyUnit): boolean {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | null
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body | null
    if (!playerBody || !enemyBody || !enemy.active || this.cutsceneActive) {
      return false
    }
    if (playerBody.velocity.y < 140) {
      return false
    }
    const playerBounds = this.player.getBounds()
    const enemyBounds = enemy.getBounds()
    const horizontalOverlap = playerBounds.right > enemyBounds.left + 10 && playerBounds.left < enemyBounds.right - 10
    const stompWindow = enemy === this.firstCorruption ? Math.max(26, enemy.displayHeight * 0.18) : 12
    const comingFromAbove = playerBounds.bottom <= enemyBounds.centerY + stompWindow
    if (!horizontalOverlap || !comingFromAbove) {
      return false
    }

    this.player.setVelocityY(enemy === this.firstCorruption ? -360 : -320)
    if (enemy === this.fusionSentinel) {
      this.damageFusionSentinel(2)
    } else if (enemy === this.corruptedConstruct) {
      this.damageCorruptedConstruct(2)
    } else if (enemy === this.firstCorruption) {
      this.damageFirstCorruption(2)
    } else if (this.bossMinions.contains(enemy)) {
      const result = applyCombatDamage(this, enemy, 2, 220)
      if (result.died) {
        const bar = this.minionBars.get(enemy)
        if (bar) {
          bar.destroy()
          this.minionBars.delete(enemy)
        }
      }
    } else {
      applyCombatDamage(this, enemy, 2, 220)
    }
    this.statusMessage = 'Stomp hit!'
    this.updateUiText()
    return true
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
    if (this.firstCorruption.x < 4840) {
      this.firstCorruption.setData('dir', 1)
    } else if (this.firstCorruption.x > 5100) {
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
    configureCombatant(minion, { maxHp: 12, widthRatio: 0.72, heightRatio: 0.8 })
    const spawnX = this.corruptedConstruct.x + Phaser.Math.Between(-68, 68)
    this.playForgeBreachEffect(spawnX, 842, 0xffb27a, 30)
    minion.setPosition(spawnX, 882)
    minion.setAlpha(0)
    minion.setVelocityX(Phaser.Math.Between(-110, 110))
    this.physics.add.collider(minion, this.platforms)
    this.tweens.add({
      targets: minion,
      y: this.corruptedConstruct.y + 26,
      alpha: 1,
      duration: 260,
      ease: 'Quad.out',
    })

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
    for (const moltenPool of this.moltenPools) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, moltenPool.bounds)) {
        this.applyDamage(this.playerMaxHealth * 5, 'Melted in the forge core!', true)
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
    if (this.arenaState === 'fusion_idle' && this.player.x > 2240) {
      this.startFusionSentinelEncounter()
    }
    if (this.arenaState === 'fusion_active' && !this.fusionSentinel.active && !this.mini1Defeated) {
      this.restoreBossForArena('fusion_active')
    }

    if (this.arenaState === 'construct_idle' && this.mini1Defeated && this.player.x > 4040) {
      this.startMatterBridgeSequence()
    }
    if (this.arenaState === 'construct_active' && !this.corruptedConstruct.active && !this.mini2Defeated) {
      this.restoreBossForArena('construct_active')
    }

    if (this.arenaState === 'exomon_idle' && this.mini2Defeated && this.player.x > 4940) {
      this.startFinalBossSequence()
    }
    if (this.arenaState === 'exomon_active' && !this.firstCorruption.active && !this.finalBossDefeated) {
      this.restoreBossForArena('exomon_active')
    }
  }

  private startFusionSentinelEncounter(): void {
    if (this.mini1Defeated || this.fusionActive) {
      return
    }
    this.closeArenaGates(2050, 2890)
    this.arenaState = 'fusion_active'
    this.fusionActive = true
    this.fusionSentinelHp = this.fusionMaxHp
    configureCombatant(this.fusionSentinel, {
      maxHp: this.fusionMaxHp,
      widthRatio: 0.82,
      heightRatio: 0.9,
      resetHp: true,
    })
    this.lastFusionHitAt = 0
    this.fusionDamageLockUntil = this.time.now + 700
    this.fusionSentinel.enableBody(true, 2460, 910, true, true)
    configureCombatant(this.fusionSentinel, {
      maxHp: this.fusionMaxHp,
      widthRatio: 0.82,
      heightRatio: 0.9,
      resetHp: false,
    })
    this.fusionSentinel.setData('hp', this.fusionSentinelHp)
    this.fusionSentinel.setVelocity(0, 0)
    this.checkpointX = 2300
    this.checkpointY = 700
    this.startDialogue(
      [
        'Mini-Boss: Fusion Sentinel',
        'It rotates elements and fires composite bursts.',
        'It is surfacing straight out of the forge floor.',
        'Use Solar Bind to control the tempo.',
        'Press Space to engage.',
      ],
      () => {
        this.raiseBossFromForge(this.fusionSentinel, 2460, 910, 780, 0x9be8ff, 'Fusion Sentinel breached the forge floor!')
      },
    )
  }

  private startMatterBridgeSequence(): void {
    if (this.mini2Defeated || this.constructActive || this.arenaState !== 'construct_idle') {
      return
    }
    this.startDialogue(
      [
        'Chromaforge: I arrived with nothing but a pile of matter.',
        'Chromaforge: I shaped it.',
        'Chromaforge: I forged this world.',
        'Press Space to advance.',
      ],
      () => {
        this.startCorruptedConstructEncounter()
      },
    )
  }

  private startCorruptedConstructEncounter(): void {
    if (this.mini2Defeated || this.constructActive) {
      return
    }
    this.closeArenaGates(3740, 4550)
    this.arenaState = 'construct_active'
    this.constructActive = true
    this.corruptedConstructHp = this.constructMaxHp
    configureCombatant(this.corruptedConstruct, {
      maxHp: this.constructMaxHp,
      widthRatio: 0.76,
      heightRatio: 0.86,
      resetHp: true,
    })
    this.lastConstructHitAt = 0
    this.constructDamageLockUntil = this.time.now + 700
    this.corruptedConstruct.enableBody(true, 4140, 920, true, true)
    configureCombatant(this.corruptedConstruct, {
      maxHp: this.constructMaxHp,
      widthRatio: 0.76,
      heightRatio: 0.86,
      resetHp: false,
    })
    this.corruptedConstruct.setData('hp', this.corruptedConstructHp)
    this.corruptedConstruct.setData('maxHp', this.constructMaxHp)
    this.corruptedConstruct.setVelocity(0, 0)
    this.checkpointX = 4000
    this.checkpointY = 720
    this.startDialogue(
      [
        'Mini-Boss: Corrupted Construct',
        'It uses knockback strikes and summons drones.',
        'Watch the forge vents. It tears through them on entry.',
        'Press Space to engage.',
      ],
      () => {
        this.raiseBossFromForge(this.corruptedConstruct, 4140, 920, 770, 0xdab8ff, 'Corrupted Construct tore up through the floor!')
      },
    )
  }

  private startFinalBossSequence(): void {
    if (this.finalBossActive || this.finalBossDefeated) {
      return
    }
    this.closeArenaGates(4760, 5160)
    this.arenaState = 'exomon_active'
    this.finalBossActive = true
    this.finalBossDefeated = false
    this.firstCorruptionHp = this.firstCorruptionMaxHp
    configureCombatant(this.firstCorruption, {
      maxHp: this.firstCorruptionMaxHp,
      widthRatio: 0.72,
      heightRatio: 0.86,
      resetHp: true,
    })
    this.lastFirstCorruptionHitAt = 0
    const spawnX = 5000
    this.firstCorruption.setData('dir', -1)
    this.firstCorruption.enableBody(true, spawnX, 860, true, true)
    configureCombatant(this.firstCorruption, {
      maxHp: this.firstCorruptionMaxHp,
      widthRatio: 0.72,
      heightRatio: 0.86,
      resetHp: false,
    })
    this.firstCorruption.setVisible(true)
    this.firstCorruption.setActive(true)
    this.firstCorruption.setDepth(40)
    this.firstCorruption.setVelocity(0, 0)
    this.finalBossDamageLockUntil = this.time.now + 900
    this.checkpointX = 4860
    this.checkpointY = 740
    this.startDialogue(
      [
        'Final Boss: Exomon',
        'Phase 1: shockwaves. Phase 2: beam spreads. Phase 3: absorb cycles.',
        'The forge core is unstable now. Stay out of the molten metal.',
        'Use Solar Bind to interrupt absorption.',
        'Press Space to begin the final battle.',
      ],
      () => {
        this.raiseBossFromForge(this.firstCorruption, spawnX, 860, 740, 0xffafd6, 'Exomon erupted out of the forge core!')
      },
    )
  }

  private raiseBossFromForge(
    enemy: EnemyUnit,
    x: number,
    startY: number,
    targetY: number,
    tint: number,
    message: string,
  ): void {
    enemy.setActive(true)
    enemy.setVisible(true)
    enemy.setPosition(x, startY)
    enemy.setVelocity(0, 0)
    enemy.setAlpha(0)
    this.playForgeBreachEffect(x, 852, tint, Math.max(34, enemy.displayWidth * 0.28))
    this.cameras.main.shake(170, 0.003)
    this.tweens.add({
      targets: enemy,
      y: targetY,
      alpha: 1,
      duration: 420,
      ease: 'Cubic.out',
      onComplete: () => {
        enemy.setAlpha(1)
        if (enemy === this.firstCorruption) {
          this.bossLastActionAt = this.time.now - 1200
          this.firstCorruption.setData('dir', -1)
        }
        this.statusMessage = message
        this.updateUiText()
      },
    })
  }

  private playForgeBreachEffect(x: number, y: number, tint: number, radius: number): void {
    const vent = this.add.ellipse(x, y + 6, radius * 2.2, radius * 0.75, 0x050203, 0.95)
    vent.setDepth(14)
    const glow = this.add.ellipse(x, y + 2, radius * 2.6, radius, tint, 0.3)
    glow.setDepth(13)
    const sparks: Phaser.GameObjects.Arc[] = []
    for (let i = 0; i < 6; i += 1) {
      const spark = this.add.circle(x + Phaser.Math.Between(-18, 18), y - 4, Phaser.Math.Between(4, 7), 0xffc88a, 0.8)
      spark.setDepth(15)
      sparks.push(spark)
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-42, 42),
        y: spark.y - Phaser.Math.Between(30, 74),
        alpha: 0,
        scale: 0.4,
        duration: 320 + i * 18,
        onComplete: () => spark.destroy(),
      })
    }
    this.tweens.add({
      targets: glow,
      scaleX: 1.25,
      scaleY: 1.45,
      alpha: 0,
      duration: 340,
      onComplete: () => glow.destroy(),
    })
    this.tweens.add({
      targets: vent,
      scaleX: 1.18,
      duration: 230,
      yoyo: true,
      onComplete: () => {
        this.time.delayedCall(380, () => vent.destroy())
      },
    })
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
    this.fusionSentinelHp = Math.max(0, this.fusionSentinelHp - _amount)
    this.fusionSentinel.setData('hp', this.fusionSentinelHp)
    this.fusionSentinel.setData('maxHp', this.fusionMaxHp)
    this.fusionSentinel.setTint(0xd8f6ff)
    this.time.delayedCall(90, () => {
      if (this.fusionSentinel.active) {
        this.fusionSentinel.clearTint()
      }
    })
    if (this.fusionSentinelHp <= 0) {
      this.fusionSentinel.disableBody(true, true)
      this.mini1Defeated = true
      this.fusionActive = false
      this.arenaState = 'construct_idle'
      this.openArenaGates()
      this.statusMessage = 'Fusion Sentinel defeated.'
    } else {
      this.statusMessage = `Fusion Sentinel HP: ${this.fusionSentinelHp.toFixed(1)}`
    }
    this.updateUiText()
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
    this.corruptedConstructHp = Math.max(0, this.corruptedConstructHp - _amount)
    this.corruptedConstruct.setData('hp', this.corruptedConstructHp)
    this.corruptedConstruct.setData('maxHp', this.constructMaxHp)
    this.corruptedConstruct.setTint(0xe0cfff)
    this.time.delayedCall(90, () => {
      if (this.corruptedConstruct.active) {
        this.corruptedConstruct.clearTint()
      }
    })
    if (this.corruptedConstructHp <= 0) {
      this.corruptedConstruct.disableBody(true, true)
      this.mini2Defeated = true
      this.constructActive = false
      this.arenaState = 'exomon_idle'
      this.openArenaGates()
      this.statusMessage = 'Corrupted Construct defeated. Final chamber unlocked.'
    } else {
      this.statusMessage = `Corrupted Construct HP: ${this.corruptedConstructHp.toFixed(1)}`
    }
    this.updateUiText()
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
    const result = applyCombatDamage(this, this.firstCorruption, _amount, 340)
    if (!result.applied) {
      return
    }
    this.firstCorruptionHp = result.hp
    if (result.died) {
      this.finalBossDefeated = true
      this.finalBossActive = false
      this.finalBossAbsorbActive = false
      this.arenaState = 'exomon_cleared'
      this.openArenaGates()
      this.finishStage()
    }
    this.updateUiText()
  }

  private finishStage(): void {
    if (this.stageClearTriggered || this.exitPortalActive) {
      return
    }
    this.exitPortalActive = true
    this.arenaState = 'stage_clear'
    if (this.exitPortal) {
      this.exitPortal.setPosition(5060, 748)
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
    if (forceRespawn) {
      this.playerHealth = 0
    }

    if (this.playerHealth <= 0) {
      const remainingLives = loseLife()
      if (remainingLives <= 0) {
        resetLives()
        this.playerHealth = this.playerMaxHealth
        this.player.setVelocity(0, 0)
        this.player.setAccelerationX(0)
        this.statusMessage = 'GAME OVER! Out of lives.'
        this.updateUiText()
        this.physics.pause()
        const blackout = this.add.rectangle(
          this.scale.width / 2,
          this.scale.height / 2,
          this.scale.width,
          this.scale.height,
          0x050103,
          0.92,
        )
        blackout.setDepth(240)
        blackout.setScrollFactor(0)
        const text = this.add.text(this.scale.width / 2, this.scale.height / 2 - 18, 'GAME OVER', {
          color: '#fff1f1',
          fontFamily: 'sans-serif',
          fontSize: '72px',
          align: 'center',
          fontStyle: 'bold',
        })
        text.setOrigin(0.5)
        text.setDepth(241)
        text.setScrollFactor(0)
        const subtext = this.add.text(this.scale.width / 2, this.scale.height / 2 + 46, 'Out of lives', {
          color: '#ffb3b3',
          fontFamily: 'sans-serif',
          fontSize: '28px',
          align: 'center',
        })
        subtext.setOrigin(0.5)
        subtext.setDepth(241)
        subtext.setScrollFactor(0)
        this.time.delayedCall(2200, () => this.scene.start('stage-select'))
      } else {
        this.playerHealth = this.playerMaxHealth
        this.player.setPosition(this.checkpointX, this.checkpointY)
        this.player.setVelocity(0, 0)
        this.player.setAccelerationX(0)
        this.statusMessage = `Lost a life! ${remainingLives} left.`
        this.updateUiText()
      }
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
    const fusionHp = getCombatHp(this.fusionSentinel)
    const fusionMaxHp = getCombatMaxHp(this.fusionSentinel)
    const constructHp = getCombatHp(this.corruptedConstruct)
    const constructMaxHp = getCombatMaxHp(this.corruptedConstruct)
    const exomonHp = getCombatHp(this.firstCorruption)
    const exomonMaxHp = getCombatMaxHp(this.firstCorruption)
    const fusionState = this.mini1Defeated ? 'Defeated' : this.fusionActive ? `${fusionHp.toFixed(1)}/${fusionMaxHp} HP` : 'Not Engaged'
    const constructState = this.mini2Defeated
      ? 'Defeated'
      : this.constructActive
        ? `${constructHp.toFixed(1)}/${constructMaxHp} HP`
        : 'Not Engaged'
    const exomonState = this.finalBossDefeated
      ? 'Defeated'
      : this.finalBossActive
        ? `${exomonHp.toFixed(1)}/${exomonMaxHp} HP`
        : 'Not Spawned'
    this.uiText.setText(
      [
        'Dungeon Busters',
        'Stage 6: Forge of Origins',
        `Hero: ${this.selectedHero.displayName}`,
        'Controls: Arrows move/jump | Space shoot | X special | Z punch | C kick',
        `Special (X): ${this.selectedHero.moves.special.name}`,
        'Tip: Jump on monsters to stomp for bonus damage.',
        `HP: ${hp}`,
        `Fusion Sentinel: ${fusionState}`,
        `Corrupted Construct: ${constructState}`,
        `Exomon: ${exomonState}`,
        this.statusMessage,
      ].join('\n'),
    )
    if (this.livesText) {
      this.livesText.setText(`Lives ${getLivesDisplay()}`)
    }
  }

  private closeArenaGates(leftX: number, rightX: number): void {
    this.openArenaGates()
    const makeGate = (x: number) => {
      const gate = this.add.rectangle(x, 730, 20, 260, 0xffd0d0, 0.18)
      gate.setStrokeStyle(2, 0xffc4c4, 0.85)
      gate.setDepth(20)
      this.physics.add.existing(gate, true)
      this.physics.add.collider(this.player, gate)
      this.activeArenaGates.push(gate)
    }
    makeGate(leftX)
    makeGate(rightX)
  }

  private openArenaGates(): void {
    for (const gate of this.activeArenaGates) {
      gate.destroy()
    }
    this.activeArenaGates = []
  }

  private restoreBossForArena(state: Extract<ForgeArenaState, 'fusion_active' | 'construct_active' | 'exomon_active'>): void {
    if (state === 'fusion_active' && !this.mini1Defeated) {
      this.fusionActive = true
      this.fusionSentinel.enableBody(true, 2460, 780, true, true)
      configureCombatant(this.fusionSentinel, {
        maxHp: this.fusionMaxHp,
        widthRatio: 0.82,
        heightRatio: 0.9,
        resetHp: false,
      })
      this.fusionSentinelHp = Number(this.fusionSentinel.getData('hp') ?? this.fusionSentinelHp ?? this.fusionMaxHp)
      this.fusionSentinel.setData('hp', this.fusionSentinelHp)
      this.fusionSentinel.setData('maxHp', this.fusionMaxHp)
      this.fusionSentinel.setActive(true)
      this.fusionSentinel.setVisible(true)
      return
    }
    if (state === 'construct_active' && !this.mini2Defeated) {
      this.constructActive = true
      this.corruptedConstruct.enableBody(true, 4140, 770, true, true)
      configureCombatant(this.corruptedConstruct, {
        maxHp: this.constructMaxHp,
        widthRatio: 0.76,
        heightRatio: 0.86,
        resetHp: false,
      })
      this.corruptedConstructHp = Number(this.corruptedConstruct.getData('hp') ?? this.corruptedConstructHp ?? this.constructMaxHp)
      this.corruptedConstruct.setData('hp', this.corruptedConstructHp)
      this.corruptedConstruct.setData('maxHp', this.constructMaxHp)
      this.corruptedConstruct.setActive(true)
      this.corruptedConstruct.setVisible(true)
      return
    }
    if (state === 'exomon_active' && !this.finalBossDefeated) {
      this.finalBossActive = true
      this.firstCorruption.enableBody(true, 5000, 740, true, true)
      configureCombatant(this.firstCorruption, {
        maxHp: this.firstCorruptionMaxHp,
        widthRatio: 0.72,
        heightRatio: 0.86,
        resetHp: false,
      })
      this.firstCorruption.setActive(true)
      this.firstCorruption.setVisible(true)
      this.firstCorruption.setAlpha(1)
      this.firstCorruption.setDepth(40)
      this.firstCorruption.setVelocity(0, 0)
      this.firstCorruption.setData('dir', -1)
      this.bossLastActionAt = this.time.now - 900
    }
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
      this.drawBar(
        'fusion',
        this.fusionSentinel.x,
        this.fusionSentinel.y - this.fusionSentinel.displayHeight * 0.64,
        88,
        getCombatHp(this.fusionSentinel),
        getCombatMaxHp(this.fusionSentinel),
        0x9be8ff,
      )
    } else {
      this.clearBar('fusion')
    }

    if (this.constructActive && this.corruptedConstruct.active) {
      this.drawBar(
        'construct',
        this.corruptedConstruct.x,
        this.corruptedConstruct.y - this.corruptedConstruct.displayHeight * 0.62,
        98,
        getCombatHp(this.corruptedConstruct),
        getCombatMaxHp(this.corruptedConstruct),
        0xc8afff,
      )
    } else {
      this.clearBar('construct')
    }

    if (this.finalBossActive && this.firstCorruption.active) {
      this.drawBar(
        'first-corruption',
        this.firstCorruption.x,
        this.firstCorruption.y - this.firstCorruption.displayHeight * 0.58,
        150,
        getCombatHp(this.firstCorruption),
        getCombatMaxHp(this.firstCorruption),
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
