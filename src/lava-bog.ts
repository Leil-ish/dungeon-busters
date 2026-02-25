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

type LavaZone = {
  rect: Phaser.GameObjects.Rectangle
  bounds: Phaser.Geom.Rectangle
}

type FallingDrip = {
  rect: Phaser.GameObjects.Rectangle
  bounds: Phaser.Geom.Rectangle
}

type EruptingVent = {
  vent: Phaser.GameObjects.Rectangle
  x: number
  baseY: number
}

export class LavaBogScene extends Phaser.Scene {
  private readonly LEVEL_W = 3200
  private readonly LEVEL_H = 900

  private player!: Phaser.Physics.Arcade.Sprite
  private patrolEnemy!: Phaser.Physics.Arcade.Sprite
  private lavaBot!: Phaser.Physics.Arcade.Sprite
  private miniBoss!: Phaser.Physics.Arcade.Sprite
  private miniBossLabel!: Phaser.GameObjects.Text
  private miniBossBaseY = 470
  private chromaforge!: Phaser.Physics.Arcade.Sprite
  private chromaforgeLabel!: Phaser.GameObjects.Text
  private chromaforgeAllies: Phaser.Physics.Arcade.Sprite[] = []

  private bouldereye!: Phaser.Physics.Arcade.Sprite
  private illislimAlly!: Phaser.Physics.Arcade.Sprite
  private hurricanoAlly!: Phaser.Physics.Arcade.Sprite
  private vaultCell!: Phaser.GameObjects.Rectangle
  private illislimCell!: Phaser.GameObjects.Rectangle
  private hurricanoCell!: Phaser.GameObjects.Rectangle
  private rescueTrigger!: Phaser.GameObjects.Zone
  private bossTrigger!: Phaser.GameObjects.Zone
  private illislimTrigger!: Phaser.GameObjects.Zone
  private hurricanoTrigger!: Phaser.GameObjects.Zone
  private exitDoor!: Phaser.GameObjects.Rectangle

  private shots!: Phaser.Physics.Arcade.Group
  private botShots!: Phaser.Physics.Arcade.Group
  private bossMinions!: Phaser.Physics.Arcade.Group
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []
  private lavaZones: LavaZone[] = []
  private fallingDrips: FallingDrip[] = []
  private vents: EruptingVent[] = []
  private activeEruption: Phaser.GameObjects.Rectangle | null = null

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private fireKey!: Phaser.Input.Keyboard.Key
  private abilityKey!: Phaser.Input.Keyboard.Key
  private uiText!: Phaser.GameObjects.Text

  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneLineIndex = 0
  private cutsceneActive = true
  private rescueSequenceActive = false
  private dialogueOnEnd: (() => void) | null = null

  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'LAVA_BOG', {
    moveAcceleration: 900,
    maxVelocityX: 260,
    jumpVelocity: 590,
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
  private readonly patrolMinX = 980
  private readonly patrolMaxX = 1220
  private readonly patrolSpeed = 60

  private stageClearTriggered = false
  private rescueDone = false
  private illislimRescued = false
  private hurricanoRescued = false
  private bossFightStarted = false
  private miniBossDefeated = false
  private miniBossHealth = 18
  private chromaforgeFightStarted = false
  private chromaforgeDefeated = false
  private chromaforgeHealth = 22
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0
  private lastAbilityAt = 0
  private shotCooldownScale = 1
  private abilityCooldownScale = 1
  private damageReductionMul = 1
  private speedBoostActive = false
  private allyLastShotAt = 0
  private readonly allyShotCooldownMs = 2200
  private bossLastActionAt = 0
  private bossMoveDir = 1
  private chromaforgeLastActionAt = 0
  private chromaforgeMoveDir = 1
  private readonly miniBossMaxHealth = 18
  private readonly chromaforgeMaxHealth = 22
  private patrolEnemyHealth = 3
  private readonly patrolEnemyMaxHealth = 3
  private lavaBotHealth = 4
  private readonly lavaBotMaxHealth = 4
  private readonly allyMaxHealth = 6
  private readonly bouldereyeMaxHealth = 8
  private healthBarGfx = new Map<string, Phaser.GameObjects.Graphics>()
  private minionHealthBars = new Map<Phaser.Physics.Arcade.Sprite, Phaser.GameObjects.Graphics>()

  private playerMaxHealth = 10
  private playerHealth = 7
  private checkpointX = 140
  private checkpointY = 690
  private healthPickup: Phaser.GameObjects.Rectangle | null = null
  private powerPickup: Phaser.GameObjects.Rectangle | null = null

  private statusMessage = 'Cross Lava Bog and rescue Bouldereye.'
  private readonly stageName = 'Stage 5: Lava Bog'

  constructor() {
    super('lava-bog')
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBounds(0, 0, this.LEVEL_W, this.LEVEL_H)
    this.cameras.main.setBackgroundColor('#1e0f0b')

    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'LAVA_BOG', {
      moveAcceleration: this.moveAcceleration,
      maxVelocityX: this.normalMaxVelocityX,
      jumpVelocity: 590,
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
    const infixTexture = this.textures.exists('enemy-infix') ? 'enemy-infix' : enemyTexture
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
    this.physics.add.collider(this.player, this.staticPlatforms)

    this.patrolEnemy = this.physics.add.sprite(this.patrolMaxX, 698, enemyTexture)
    this.patrolEnemy.setCollideWorldBounds(true)
    this.patrolEnemy.setImmovable(true)
    ;(this.patrolEnemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.patrolEnemy.setVelocityX(-this.patrolSpeed)
    this.physics.add.collider(this.patrolEnemy, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.patrolEnemy, () => this.applyDamage(1, 'Enemy hit!'))

    this.lavaBot = this.physics.add.sprite(1970, 498, enemyTexture)
    this.lavaBot.setImmovable(true)
    this.lavaBot.setCollideWorldBounds(true)
    ;(this.lavaBot.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.physics.add.collider(this.lavaBot, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.lavaBot, () => this.applyDamage(1, 'Lava Bot contact!'))

    this.miniBoss = this.physics.add.sprite(2860, 470, infixTexture)
    this.miniBoss.setDisplaySize(132, 132)
    this.miniBoss.setImmovable(true)
    this.miniBoss.setCollideWorldBounds(true)
    ;(this.miniBoss.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ;(this.miniBoss.body as Phaser.Physics.Arcade.Body).setSize(88, 96, true)
    this.physics.add.collider(this.miniBoss, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.miniBoss, () => this.applyDamage(1, 'Infix hit!'))
    this.miniBoss.disableBody(true, true)
    this.miniBossLabel = this.add.text(this.miniBoss.x - 26, this.miniBoss.y - 88, 'INFIX', {
      color: '#ffd2b5',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      backgroundColor: '#2a1007cc',
      padding: { x: 6, y: 3 },
    })
    this.miniBossLabel.setVisible(false)
    this.miniBossLabel.setDepth(24)

    const chromaforgeTexture = this.textures.exists('boss-chromaforge') ? 'boss-chromaforge' : enemyTexture
    this.chromaforge = this.physics.add.sprite(3070, 300, chromaforgeTexture)
    this.chromaforge.setDisplaySize(170, 170)
    this.chromaforge.setImmovable(true)
    this.chromaforge.setCollideWorldBounds(true)
    ;(this.chromaforge.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    ;(this.chromaforge.body as Phaser.Physics.Arcade.Body).setSize(112, 120, true)
    this.physics.add.collider(this.chromaforge, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.chromaforge, () => this.applyDamage(1, 'Chromaforge impact!'))
    this.chromaforge.disableBody(true, true)
    this.chromaforgeLabel = this.add.text(this.chromaforge.x - 58, this.chromaforge.y - 96, 'CHROMAFORGE', {
      color: '#ffdff8',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      backgroundColor: '#2a1025cc',
      padding: { x: 6, y: 3 },
    })
    this.chromaforgeLabel.setVisible(false)
    this.chromaforgeLabel.setDepth(24)

    this.createWeapons()
    this.createRescueObjects()
    this.createCheckpointsAndItems()
    this.createVolcanoVents()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#f6efe9',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      backgroundColor: '#150b08cc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setDepth(50)
    this.uiText.setScrollFactor(0)
    this.updateUiText()

    this.initializeIntroCutscene()
    this.scheduleBotShot()
    this.scheduleMiniBossShot()
    this.scheduleLavaDrips()
    this.scheduleVentEruptions()
  }

  update(): void {
    if (this.cutsceneActive) {
      this.player.setAccelerationX(0)
      this.player.setVelocityX(0)
      if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
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

    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
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
      if (!this.miniBossDefeated) {
        this.statusMessage = 'Defeat Infix first!'
        this.updateUiText()
      } else {
        this.startRescueSequence()
      }
    }

    if (!this.bossFightStarted && this.physics.overlap(this.player, this.bossTrigger)) {
      this.startBossFightSequence()
    }

    if (this.rescueDone && this.physics.overlap(this.player, this.exitDoor) && !this.chromaforgeFightStarted) {
      this.startChromaforgeSequence()
    }

    this.updatePatrolEnemy()
    this.updateMiniBossMotion()
    this.updateChromaforgeMotion()
    this.checkLavaHazards()
    this.updateFallingDrips()
    this.checkDripHazards()
    this.checkEruptionHazard()
    this.checkAllyRescues()
    this.updateRescuedFollower()
    this.updateAlliedFollowers()
    this.updateAllySupportFire()
    this.updateChromaforgeSupportFire()
    this.updateAllHealthBars()

    if (this.bossFightStarted && !this.miniBossDefeated && this.miniBoss && !this.miniBoss.active) {
      this.miniBossDefeated = true
      this.statusMessage = 'Infix defeated. Vault release open.'
      this.updateUiText()
    }

    if (this.chromaforgeFightStarted && !this.chromaforgeDefeated && this.chromaforge && !this.chromaforge.active) {
      this.chromaforgeDefeated = true
      this.finishGameEnding()
    }

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
      gfx.fillStyle(0xff7748, 1)
      gfx.fillRect(0, 0, 14, 6)
      gfx.generateTexture('laser-bot-shot', 14, 6)
      gfx.clear()
    }

    if (!this.textures.exists('boss-chromaforge')) {
      gfx.fillStyle(0x5c2e6f, 1)
      gfx.fillRect(0, 0, 56, 56)
      gfx.fillStyle(0xe05f8f, 1)
      gfx.fillRect(0, 0, 28, 56)
      gfx.fillStyle(0x5fcbe0, 1)
      gfx.fillRect(28, 0, 28, 56)
      gfx.fillStyle(0xfff1a3, 1)
      gfx.fillRect(22, 8, 12, 12)
      gfx.generateTexture('boss-chromaforge', 56, 56)
      gfx.clear()
    }

    gfx.destroy()
  }

  private createBackdrop(): void {
    const bg = this.add.graphics()
    bg.fillStyle(0x200e0a, 1)
    bg.fillRect(0, 0, this.LEVEL_W, this.LEVEL_H)
    for (let x = 0; x < this.LEVEL_W; x += 180) {
      bg.fillStyle(0x3a160f, 0.28)
      bg.fillRect(x, 0, 42, this.LEVEL_H)
    }
    bg.setDepth(-30)
  }

  private buildLevelGeometry(): void {
    const platforms: Array<[number, number, number, number, number]> = [
      [220, 860, 420, 80, 0x4b352d],
      [700, 860, 280, 80, 0x4b352d],
      [1120, 860, 220, 80, 0x4b352d],
      [1420, 860, 220, 80, 0x4b352d],
      [1740, 860, 220, 80, 0x4b352d],
      [2080, 860, 220, 80, 0x4b352d],
      [2420, 860, 220, 80, 0x4b352d],
      [2760, 860, 220, 80, 0x4b352d],

      [980, 740, 220, 22, 0x7a5a4a],
      [1180, 710, 190, 22, 0x7a5a4a],
      [1380, 680, 180, 22, 0x7a5a4a],
      [1590, 650, 180, 22, 0x7a5a4a],
      [1810, 620, 180, 22, 0x7a5a4a],
      [2040, 590, 170, 22, 0x7a5a4a],
      [2270, 560, 170, 22, 0x7a5a4a],
      [2500, 530, 170, 22, 0x7a5a4a],
      [2730, 500, 190, 22, 0x7a5a4a],
      [2920, 470, 190, 22, 0x7a5a4a],
      [3070, 400, 150, 22, 0x7a5a4a],
    ]

    this.staticPlatforms = platforms.map(([x, y, w, h, color]) => this.createStaticPlatform(x, y, w, h, color))

    this.addLavaZone(820, 860, 120, 70)
    this.addLavaZone(1260, 860, 120, 70)
    this.addLavaZone(1580, 860, 120, 70)
    this.addLavaZone(1920, 860, 120, 70)
    this.addLavaZone(2260, 860, 120, 70)
    this.addLavaZone(2600, 860, 120, 70)
  }

  private addLavaZone(centerX: number, centerY: number, width: number, height: number): void {
    const rect = this.add.rectangle(centerX, centerY, width, height, 0xff5c2b, 0.55)
    rect.setDepth(2)
    this.lavaZones.push({
      rect,
      bounds: new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height),
    })
  }

  private createWeapons(): void {
    this.shots = this.physics.add.group({ allowGravity: false, maxSize: 12 })
    this.physics.add.collider(this.shots, this.staticPlatforms, (obj1, obj2) => {
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

    this.physics.add.overlap(this.shots, this.patrolEnemy, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.lavaBot, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.miniBoss, (shotObj, enemyObj) => {
      this.handleMiniBossShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.chromaforge, (shotObj, enemyObj) => {
      this.handleChromaforgeShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.bossMinions = this.physics.add.group({ allowGravity: false, immovable: true, maxSize: 8 })
    this.physics.add.overlap(this.shots, this.bossMinions, (shotObj, minionObj) => {
      const shot = shotObj as Phaser.Physics.Arcade.Image
      const minion = minionObj as Phaser.Physics.Arcade.Sprite
      if (!minion.active) {
        return
      }
      shot.disableBody(true, true)
      const hp = Math.max(0, Number(minion.getData('hp') ?? 1) - 1)
      minion.setData('hp', hp)
      if (hp <= 0) {
        minion.disableBody(true, true)
        const bar = this.minionHealthBars.get(minion)
        if (bar) {
          bar.destroy()
          this.minionHealthBars.delete(minion)
        }
        this.statusMessage = 'Minion down!'
        this.updateUiText()
      }
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
    this.physics.add.overlap(this.player, this.botShots, () => this.applyDamage(1, 'Molten shot hit!'))
    this.physics.add.overlap(this.player, this.bossMinions, () => this.applyDamage(1, 'Infix minion hit!'))
    this.physics.add.collider(this.bossMinions, this.staticPlatforms)
  }

  private createRescueObjects(): void {
    this.illislimCell = this.add.rectangle(1540, 620, 72, 110, 0x9ef27f, 0.24)
    this.illislimCell.setStrokeStyle(2, 0xc4ffd0, 0.85)
    this.illislimTrigger = this.add.zone(1540, 620, 120, 140)
    this.physics.add.existing(this.illislimTrigger, true)

    this.hurricanoCell = this.add.rectangle(2180, 560, 72, 110, 0x8de8ff, 0.24)
    this.hurricanoCell.setStrokeStyle(2, 0xc8f5ff, 0.85)
    this.hurricanoTrigger = this.add.zone(2180, 560, 120, 140)
    this.physics.add.existing(this.hurricanoTrigger, true)

    this.bossTrigger = this.add.zone(2700, 500, 240, 300)
    this.physics.add.existing(this.bossTrigger, true)

    const illislimTexture = this.textures.exists('hero-illislim') ? 'hero-illislim' : 'player-block'
    this.illislimAlly = this.physics.add.sprite(1540, 620, illislimTexture)
    this.illislimAlly.setVisible(false)
    this.illislimAlly.disableBody(true, true)
    this.physics.add.collider(this.illislimAlly, this.staticPlatforms)

    const hurricanoTexture = this.textures.exists('hero-hurricano-man') ? 'hero-hurricano-man' : 'player-block'
    this.hurricanoAlly = this.physics.add.sprite(2180, 560, hurricanoTexture)
    this.hurricanoAlly.setVisible(false)
    this.hurricanoAlly.disableBody(true, true)
    this.physics.add.collider(this.hurricanoAlly, this.staticPlatforms)

    this.vaultCell = this.add.rectangle(2860, 460, 90, 140, 0xcf9d5d, 0.3)
    this.vaultCell.setStrokeStyle(3, 0xffd18e, 0.9)

    const boulderTexture = this.textures.exists('hero-bouldereye') ? 'hero-bouldereye' : 'player-block'
    this.bouldereye = this.physics.add.sprite(2860, 460, boulderTexture)
    this.bouldereye.setVisible(false)
    this.bouldereye.disableBody(true, true)
    this.physics.add.collider(this.bouldereye, this.staticPlatforms)

    this.rescueTrigger = this.add.zone(2860, 460, 260, 260)
    this.physics.add.existing(this.rescueTrigger, true)

    this.exitDoor = this.add.rectangle(this.LEVEL_W - 90, 340, 54, 140, 0xffa46b)
    this.exitDoor.setAlpha(0.3)
    this.physics.add.existing(this.exitDoor, true)
  }

  private checkAllyRescues(): void {
    if (!this.illislimRescued && this.physics.overlap(this.player, this.illislimTrigger)) {
      this.illislimRescued = true
      gameProgress.illislimRescued = true
      saveGameProgress()
      this.illislimCell.destroy()
      this.illislimAlly.enableBody(true, 1540, 620, true, true)
      this.illislimAlly.setVisible(true)
      this.illislimAlly.setImmovable(true)
      ;(this.illislimAlly.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      this.statusMessage = 'Illislim joined your team!'
      this.playTone(620, 0.1)
      this.updateUiText()
      this.startDialogue(
        [
          'Illislim: The lava tunnels shifted, so I tracked your signal.',
          'Illislim: I can reinforce your flank against Infix.',
          'Press Space to continue.',
        ],
        () => {
          this.statusMessage = 'Illislim is now assisting.'
          this.updateUiText()
        },
      )
      return
    }

    if (!this.hurricanoRescued && this.physics.overlap(this.player, this.hurricanoTrigger)) {
      this.hurricanoRescued = true
      gameProgress.hurricanoManRescued = true
      saveGameProgress()
      this.hurricanoCell.destroy()
      this.hurricanoAlly.enableBody(true, 2180, 560, true, true)
      this.hurricanoAlly.setVisible(true)
      this.hurricanoAlly.setImmovable(true)
      ;(this.hurricanoAlly.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      this.statusMessage = 'Hurricano Man joined your team!'
      this.playTone(700, 0.1)
      this.updateUiText()
      this.startDialogue(
        [
          'Hurricano Man: I rode the ash currents into Lava Bog.',
          'Hurricano Man: I will pressure Infix from range.',
          'Press Space to continue.',
        ],
        () => {
          this.statusMessage = 'Hurricano Man is now assisting.'
          this.updateUiText()
        },
      )
    }
  }

  private startBossFightSequence(): void {
    if (this.bossFightStarted) {
      return
    }
    this.bossFightStarted = true
    this.miniBossDefeated = false
    this.miniBossHealth = this.miniBossMaxHealth
    this.miniBoss.enableBody(true, 2860, 470, true, true)
    this.miniBossLabel.setVisible(true)
    this.startDialogue(
      [
        'Infix: Lava Bog belongs to me.',
        'Micralis: Team formation. Take Infix down.',
        'Press Space to begin the boss fight.',
      ],
      () => {
        this.bossLastActionAt = this.time.now
        this.statusMessage = 'Boss fight started: Infix.'
        this.updateUiText()
      },
    )
  }

  private startChromaforgeSequence(): void {
    if (this.chromaforgeFightStarted || !this.rescueDone) {
      return
    }
    this.chromaforgeFightStarted = true
    this.chromaforgeDefeated = false
    this.chromaforgeHealth = this.chromaforgeMaxHealth
    this.chromaforge.enableBody(true, 3070, 300, true, true)
    this.chromaforgeLabel.setVisible(true)
    this.spawnChromaforgeAllies()
    this.startDialogue(
      [
        'Chromaforge: You broke the vault chain. Final trial begins.',
        'Bouldereye: Dungeon Busters, full formation.',
        'Micralis: All heroes, engage Chromaforge now!',
        'Press Space to begin the final battle.',
      ],
      () => {
        this.chromaforgeLastActionAt = this.time.now
        this.statusMessage = 'Final Boss: Chromaforge.'
        this.updateUiText()
      },
    )
  }

  private spawnChromaforgeAllies(): void {
    for (const ally of this.chromaforgeAllies) {
      ally.destroy()
    }
    this.chromaforgeAllies = []
    const heroTextureKeys = [
      'hero-micralis',
      'hero-electroman',
      'hero-glowman',
      'hero-icemeckel',
      'hero-volcano-man',
      'hero-exemon',
      'hero-illislim',
      'hero-hurricano-man',
      'hero-bouldereye',
    ]
    const unique = heroTextureKeys.filter((key, idx) => heroTextureKeys.indexOf(key) === idx)
    unique.forEach((textureKey, idx) => {
      if (!this.textures.exists(textureKey)) {
        return
      }
      const ally = this.physics.add.sprite(this.player.x - 140 + idx * 34, this.player.y - 80, textureKey)
      if (textureKey === 'hero-exemon') {
        ally.setDisplaySize(38, 44)
      } else {
        ally.setScale(0.85)
      }
      ally.setImmovable(true)
      ;(ally.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      this.chromaforgeAllies.push(ally)
    })
  }

  private updateChromaforgeMotion(): void {
    if (!this.chromaforge.active || this.chromaforgeDefeated) {
      this.chromaforgeLabel.setVisible(false)
      return
    }
    this.chromaforge.y = 300 + Math.sin(this.time.now / 260) * 16
    if (this.chromaforgeFightStarted && !this.cutsceneActive) {
      this.chromaforge.x += this.chromaforgeMoveDir * 2.2
      if (this.chromaforge.x < 2720) {
        this.chromaforgeMoveDir = 1
      } else if (this.chromaforge.x > 3110) {
        this.chromaforgeMoveDir = -1
      }
      if (this.time.now - this.chromaforgeLastActionAt > 1100) {
        this.performChromaforgeAction()
        this.chromaforgeLastActionAt = this.time.now
      }
    }
    this.chromaforgeLabel.setVisible(true)
    this.chromaforgeLabel.setPosition(this.chromaforge.x - 58, this.chromaforge.y - 96)
  }

  private performChromaforgeAction(): void {
    if (!this.chromaforge.active || this.chromaforgeDefeated) {
      return
    }
    const roll = Phaser.Math.Between(0, 99)
    if (roll < 42) {
      this.chromaforgeRadialBurst()
      return
    }
    if (roll < 76) {
      this.chromaforgeTrackingVolley()
      return
    }
    this.chromaforgeSummonMinions()
  }

  private chromaforgeRadialBurst(): void {
    const count = 8
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count
      const shot = this.botShots.get(this.chromaforge.x, this.chromaforge.y, 'laser-bot-shot') as
        | Phaser.Physics.Arcade.Image
        | null
      if (!shot) {
        continue
      }
      shot.enableBody(true, this.chromaforge.x, this.chromaforge.y, true, true)
      shot.setActive(true)
      shot.setVisible(true)
      shot.setVelocity(Math.cos(angle) * 230, Math.sin(angle) * 230)
      this.time.delayedCall(1700, () => shot.disableBody(true, true))
    }
    this.statusMessage = 'Chromaforge: Spectrum burst!'
    this.updateUiText()
  }

  private chromaforgeTrackingVolley(): void {
    const shotCount = 4
    for (let i = 0; i < shotCount; i += 1) {
      this.time.delayedCall(i * 90, () => {
        if (!this.chromaforge.active || this.chromaforgeDefeated) {
          return
        }
        const shot = this.botShots.get(this.chromaforge.x, this.chromaforge.y, 'laser-bot-shot') as
          | Phaser.Physics.Arcade.Image
          | null
        if (!shot) {
          return
        }
        const dx = this.player.x - this.chromaforge.x
        const dy = this.player.y - this.chromaforge.y
        const len = Math.max(1, Math.hypot(dx, dy))
        shot.enableBody(true, this.chromaforge.x, this.chromaforge.y, true, true)
        shot.setActive(true)
        shot.setVisible(true)
        shot.setVelocity((dx / len) * 280, (dy / len) * 280)
        this.time.delayedCall(1700, () => shot.disableBody(true, true))
      })
    }
    this.statusMessage = 'Chromaforge: Focus volley!'
    this.updateUiText()
  }

  private chromaforgeSummonMinions(): void {
    const spawnCount = 2
    for (let i = 0; i < spawnCount; i += 1) {
      const minion = this.bossMinions.get(
        this.chromaforge.x + Phaser.Math.Between(-80, 80),
        this.chromaforge.y + 40,
        'enemy-scout',
      ) as Phaser.Physics.Arcade.Sprite | null
      if (!minion) {
        continue
      }
      minion.enableBody(true, minion.x, minion.y, true, true)
      minion.setActive(true)
      minion.setVisible(true)
      minion.setCollideWorldBounds(true)
      ;(minion.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      minion.setData('hp', 3)
      minion.setData('maxHp', 3)
      minion.setVelocityX(Phaser.Math.Between(-120, 120))
      if (!this.minionHealthBars.has(minion)) {
        const gfx = this.add.graphics()
        gfx.setDepth(30)
        this.minionHealthBars.set(minion, gfx)
      }
      this.time.delayedCall(3500, () => {
        if (minion.active) {
          minion.disableBody(true, true)
        }
      })
    }
    this.statusMessage = 'Chromaforge summoned elite minions!'
    this.updateUiText()
  }

  private createCheckpointsAndItems(): void {
    const defs: Array<[number, number]> = [
      [1020, 690],
      [2280, 530],
    ]
    defs.forEach(([x, y]) => {
      const cp = this.add.rectangle(x, y, 20, 72, 0xffc76b, 0.9)
      this.physics.add.existing(cp, true)
      this.physics.add.overlap(this.player, cp, () => this.activateCheckpoint(cp, x, y))
    })

    this.healthPickup = this.add.rectangle(1700, 790, 24, 24, 0x7aff7a, 0.95)
    this.physics.add.existing(this.healthPickup, true)
    this.physics.add.overlap(this.player, this.healthPickup, () => {
      if (!this.healthPickup) {
        return
      }
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 4)
      this.healthPickup.destroy()
      this.healthPickup = null
      this.statusMessage = 'Health restored.'
      this.playTone(560, 0.1)
      this.updateUiText()
    })

    this.powerPickup = this.add.rectangle(2500, 490, 22, 22, 0xffbf82, 0.95)
    this.physics.add.existing(this.powerPickup, true)
    this.physics.add.overlap(this.player, this.powerPickup, () => {
      if (!this.powerPickup) {
        return
      }
      this.shotCooldownScale = 0.82
      this.abilityCooldownScale = 0.82
      this.powerPickup.destroy()
      this.powerPickup = null
      this.statusMessage = 'Magma core found. Cooldowns reduced.'
      this.playTone(640, 0.1)
      this.updateUiText()
    })
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
        if (!this.scene.isActive() || this.cutsceneActive || !this.lavaBot.active) {
          return
        }

        const shot = this.botShots.get(this.lavaBot.x - 20, this.lavaBot.y, 'laser-bot-shot') as
          | Phaser.Physics.Arcade.Image
          | null
        if (!shot) {
          return
        }

        const dirX = this.player.x - this.lavaBot.x
        const dirY = this.player.y - this.lavaBot.y
        const len = Math.max(1, Math.hypot(dirX, dirY))
        shot.enableBody(true, this.lavaBot.x - 20, this.lavaBot.y, true, true)
        shot.setActive(true)
        shot.setVisible(true)
        shot.setVelocity((dirX / len) * 240, (dirY / len) * 240)
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
        shot.setVelocity((dirX / len) * 250, (dirY / len) * 250)
        this.time.delayedCall(1800, () => shot.disableBody(true, true))
      },
    })
  }

  private updateMiniBossMotion(): void {
    if (!this.miniBoss.active || this.miniBossDefeated) {
      this.miniBossLabel.setVisible(false)
      return
    }
    this.miniBoss.y = this.miniBossBaseY + Math.sin(this.time.now / 300) * 12
    if (this.bossFightStarted && !this.cutsceneActive) {
      this.miniBoss.x += this.bossMoveDir * 1.6
      if (this.miniBoss.x < 2570) {
        this.bossMoveDir = 1
      } else if (this.miniBoss.x > 3040) {
        this.bossMoveDir = -1
      }
    }
    this.miniBossLabel.setVisible(true)
    this.miniBossLabel.setPosition(this.miniBoss.x - 26, this.miniBoss.y - 88)

    if (this.bossFightStarted && !this.cutsceneActive && this.time.now - this.bossLastActionAt > 1450) {
      this.performBossAction()
      this.bossLastActionAt = this.time.now
    }
  }

  private performBossAction(): void {
    if (!this.miniBoss.active || this.miniBossDefeated) {
      return
    }
    const roll = Phaser.Math.Between(0, 99)
    if (roll < 40) {
      this.bossBurstAttack()
      return
    }
    if (roll < 72) {
      this.bossDashSweep()
      return
    }
    this.bossSpawnMinion()
  }

  private bossBurstAttack(): void {
    const baseDx = this.player.x - this.miniBoss.x
    const baseDy = this.player.y - this.miniBoss.y
    const baseAngle = Math.atan2(baseDy, baseDx)
    const spread = [-0.35, -0.16, 0, 0.16, 0.35]
    for (const delta of spread) {
      const shot = this.botShots.get(this.miniBoss.x - 18, this.miniBoss.y - 12, 'laser-bot-shot') as
        | Phaser.Physics.Arcade.Image
        | null
      if (!shot) {
        continue
      }
      const a = baseAngle + delta
      shot.enableBody(true, this.miniBoss.x - 18, this.miniBoss.y - 12, true, true)
      shot.setActive(true)
      shot.setVisible(true)
      shot.setVelocity(Math.cos(a) * 250, Math.sin(a) * 250)
      this.time.delayedCall(1800, () => shot.disableBody(true, true))
    }
    this.statusMessage = 'Infix: Burst volley!'
    this.updateUiText()
  }

  private bossDashSweep(): void {
    const dir = this.player.x >= this.miniBoss.x ? 1 : -1
    const targetX = Phaser.Math.Clamp(this.miniBoss.x + dir * 220, 2520, 3050)
    this.tweens.add({
      targets: this.miniBoss,
      x: targetX,
      duration: 220,
      ease: 'Sine.InOut',
    })
    this.statusMessage = 'Infix: Magma dash!'
    this.updateUiText()
  }

  private bossSpawnMinion(): void {
    const minion = this.bossMinions.get(this.miniBoss.x + Phaser.Math.Between(-70, 70), this.miniBoss.y + 26, 'enemy-scout') as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!minion) {
      return
    }
    minion.enableBody(true, minion.x, minion.y, true, true)
    minion.setActive(true)
    minion.setVisible(true)
    minion.setCollideWorldBounds(true)
    ;(minion.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    minion.setData('hp', 2)
    minion.setData('maxHp', 2)
    minion.setVelocityX(Phaser.Math.Between(-90, 90))
    if (!this.minionHealthBars.has(minion)) {
      const gfx = this.add.graphics()
      gfx.setDepth(30)
      this.minionHealthBars.set(minion, gfx)
    }
    this.time.delayedCall(3200, () => {
      if (minion.active) {
        minion.disableBody(true, true)
      }
      const bar = this.minionHealthBars.get(minion)
      if (bar) {
        bar.destroy()
        this.minionHealthBars.delete(minion)
      }
    })
    this.statusMessage = 'Infix summoned minions!'
    this.updateUiText()
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

  private checkLavaHazards(): void {
    if (this.cutsceneActive) {
      return
    }

    const p = this.player.getBounds()
    for (const lava of this.lavaZones) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(p, lava.bounds)) {
        this.applyDamage(1, 'Lava burn!')
        return
      }
    }
  }

  private createVolcanoVents(): void {
    const ventDefs: Array<[number, number]> = [
      [1290, 828],
      [1930, 828],
      [2590, 828],
    ]
    for (const [x, y] of ventDefs) {
      const vent = this.add.rectangle(x, y, 32, 26, 0x8f3e1b, 0.95)
      vent.setStrokeStyle(2, 0xff9a66, 0.9)
      this.vents.push({ vent, x, baseY: y - 16 })
    }
  }

  private scheduleLavaDrips(): void {
    const dripSpawnXs = [1040, 1490, 1840, 2250, 2680]
    this.time.addEvent({
      delay: 1250,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive) {
          return
        }
        const spawnX = Phaser.Utils.Array.GetRandom(dripSpawnXs)
        const drip = this.add.rectangle(spawnX, 84, 10, 18, 0xff7b43, 0.9)
        drip.setDepth(14)
        this.fallingDrips.push({
          rect: drip,
          bounds: new Phaser.Geom.Rectangle(spawnX - 5, 75, 10, 18),
        })
      },
    })
  }

  private updateFallingDrips(): void {
    for (let i = this.fallingDrips.length - 1; i >= 0; i -= 1) {
      const drip = this.fallingDrips[i]
      drip.rect.y += 8
      drip.bounds.setTo(drip.rect.x - drip.rect.width / 2, drip.rect.y - drip.rect.height / 2, drip.rect.width, drip.rect.height)
      if (drip.rect.y > this.LEVEL_H - 30) {
        drip.rect.destroy()
        this.fallingDrips.splice(i, 1)
      }
    }
  }

  private checkDripHazards(): void {
    if (this.cutsceneActive) {
      return
    }
    const p = this.player.getBounds()
    for (const drip of this.fallingDrips) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(p, drip.bounds)) {
        this.applyDamage(1, 'Lava drip hit!')
        return
      }
    }
  }

  private scheduleVentEruptions(): void {
    this.time.addEvent({
      delay: 2100,
      loop: true,
      callback: () => {
        if (!this.scene.isActive() || this.cutsceneActive || this.vents.length === 0 || this.activeEruption) {
          return
        }
        const vent = Phaser.Utils.Array.GetRandom(this.vents)
        const column = this.add.rectangle(vent.x, vent.baseY, 24, 10, 0xff8b4d, 0.9)
        column.setDepth(13)
        this.activeEruption = column
        this.tweens.add({
          targets: column,
          height: 130,
          y: vent.baseY - 60,
          duration: 150,
          yoyo: true,
          hold: 220,
          onComplete: () => {
            column.destroy()
            if (this.activeEruption === column) {
              this.activeEruption = null
            }
          },
        })
      },
    })
  }

  private checkEruptionHazard(): void {
    if (!this.activeEruption || this.cutsceneActive) {
      return
    }
    const eBounds = this.activeEruption.getBounds()
    const pBounds = this.player.getBounds()
    if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, eBounds)) {
      this.applyDamage(1, 'Volcano eruption hit!')
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
    this.statusMessage = 'The vault seal is cracking...'
    this.updateUiText()

    this.time.delayedCall(650, () => {
      this.vaultCell.destroy()
      this.bouldereye.enableBody(true, 2860, 430, true, true)
      this.bouldereye.setVisible(true)
      this.bouldereye.setImmovable(true)
      ;(this.bouldereye.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    })

    this.time.delayedCall(1400, () => {
      this.cutsceneLines = [
        'Bouldereye: You made it through Lava Bog.',
        'Bouldereye: Team status restored. Move to extraction.',
        'Press Space to continue.',
      ]
      this.cutsceneLineIndex = 0
      this.showCutscenePanel(this.cutsceneLines[0])

      this.rescueDone = true
      this.exitDoor.setAlpha(1)
      this.statusMessage = 'Bouldereye rescued. Reach the exit.'
      this.updateUiText()
    })
  }

  private updateRescuedFollower(): void {
    if (!this.rescueDone || !this.bouldereye.active) {
      return
    }

    const targetX = this.player.x - this.facingDir * 64
    const targetY = this.player.y
    const followLerp = 0.08
    this.bouldereye.x = Phaser.Math.Linear(this.bouldereye.x, targetX, followLerp)
    this.bouldereye.y = Phaser.Math.Linear(this.bouldereye.y, targetY, followLerp)
  }

  private updateAlliedFollowers(): void {
    const followAlly = (
      ally: Phaser.Physics.Arcade.Sprite,
      active: boolean,
      offsetX: number,
      offsetY: number,
    ): void => {
      if (!active || !ally.active) {
        return
      }
      const targetX = this.player.x + offsetX * this.facingDir
      const targetY = this.player.y + offsetY
      const followLerp = 0.08
      ally.x = Phaser.Math.Linear(ally.x, targetX, followLerp)
      ally.y = Phaser.Math.Linear(ally.y, targetY, followLerp)
    }

    followAlly(this.illislimAlly, this.illislimRescued, -84, -6)
    followAlly(this.hurricanoAlly, this.hurricanoRescued, -116, -18)

    if (this.chromaforgeFightStarted) {
      for (let i = 0; i < this.chromaforgeAllies.length; i += 1) {
        const ally = this.chromaforgeAllies[i]
        if (!ally.active) {
          continue
        }
        const row = Math.floor(i / 5)
        const col = i % 5
        const offsetX = -170 + col * 38
        const offsetY = -68 - row * 28
        ally.x = Phaser.Math.Linear(ally.x, this.player.x + offsetX * this.facingDir, 0.08)
        ally.y = Phaser.Math.Linear(ally.y, this.player.y + offsetY, 0.08)
      }
    }
  }

  private updateAllySupportFire(): void {
    if (!this.bossFightStarted || !this.miniBoss.active || this.miniBossDefeated || this.cutsceneActive) {
      return
    }
    if (!this.illislimRescued && !this.hurricanoRescued) {
      return
    }
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.miniBoss.x, this.miniBoss.y) > 700) {
      return
    }
    if (this.time.now - this.allyLastShotAt < this.allyShotCooldownMs) {
      return
    }

    this.allyLastShotAt = this.time.now
    if (this.hurricanoRescued && this.hurricanoAlly.active && this.illislimRescued && this.illislimAlly.active) {
      const useHurricano = Math.floor(this.time.now / this.allyShotCooldownMs) % 2 === 0
      if (useHurricano) {
        this.spawnAllyShot(this.hurricanoAlly.x, this.hurricanoAlly.y - 6, 0x9eefff)
      } else {
        this.spawnAllyShot(this.illislimAlly.x, this.illislimAlly.y - 6, 0x98ffb4)
      }
      return
    }
    if (this.illislimRescued && this.illislimAlly.active) {
      this.spawnAllyShot(this.illislimAlly.x, this.illislimAlly.y - 6, 0x98ffb4)
      return
    }
    if (this.hurricanoRescued && this.hurricanoAlly.active) {
      this.spawnAllyShot(this.hurricanoAlly.x, this.hurricanoAlly.y - 6, 0x9eefff)
    }
  }

  private updateChromaforgeSupportFire(): void {
    if (!this.chromaforgeFightStarted || this.chromaforgeDefeated || !this.chromaforge.active || this.cutsceneActive) {
      return
    }
    if (this.chromaforgeAllies.length === 0) {
      return
    }
    if (this.time.now - this.allyLastShotAt < this.allyShotCooldownMs) {
      return
    }
    this.allyLastShotAt = this.time.now

    const shooters = this.chromaforgeAllies.slice(0, Math.min(4, this.chromaforgeAllies.length))
    for (const ally of shooters) {
      const bolt = this.add.rectangle(ally.x, ally.y - 6, 9, 5, 0xc9e4ff, 0.95)
      bolt.setDepth(20)
      this.tweens.add({
        targets: bolt,
        x: this.chromaforge.x,
        y: this.chromaforge.y,
        duration: 240,
        ease: 'Sine.Out',
        onComplete: () => {
          bolt.destroy()
          if (!this.chromaforge.active || this.chromaforgeDefeated) {
            return
          }
          this.damageChromaforge(0.35)
        },
      })
    }
  }

  private spawnAllyShot(fromX: number, fromY: number, tint: number): void {
    const bolt = this.add.rectangle(fromX, fromY, 10, 6, tint, 0.95)
    bolt.setDepth(20)
    this.tweens.add({
      targets: bolt,
      x: this.miniBoss.x,
      y: this.miniBoss.y,
      duration: 260,
      ease: 'Sine.Out',
      onComplete: () => {
        bolt.destroy()
        if (!this.miniBoss.active || this.miniBossDefeated) {
          return
        }
        this.damageMiniBoss(0.5)
      },
    })
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
    if (enemy === this.patrolEnemy) {
      this.patrolEnemyHealth = Math.max(0, this.patrolEnemyHealth - 1)
      if (this.patrolEnemyHealth <= 0) {
        enemy.disableBody(true, true)
        this.statusMessage = 'Enemy down!'
      } else {
        this.statusMessage = `Patrol enemy HP: ${this.patrolEnemyHealth}`
      }
      this.updateUiText()
      return
    }
    if (enemy === this.lavaBot) {
      this.lavaBotHealth = Math.max(0, this.lavaBotHealth - 1)
      if (this.lavaBotHealth <= 0) {
        enemy.disableBody(true, true)
        this.statusMessage = 'Lava Bot down!'
      } else {
        this.statusMessage = `Lava Bot HP: ${this.lavaBotHealth}`
      }
      this.updateUiText()
      return
    }
    enemy.disableBody(true, true)
  }

  private handleMiniBossShot(shot: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active || this.miniBossDefeated) {
      return
    }

    shot.disableBody(true, true)
    this.damageMiniBoss(1)
  }

  private handleChromaforgeShot(shot: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active || this.chromaforgeDefeated) {
      return
    }
    shot.disableBody(true, true)
    this.damageChromaforge(1)
  }

  private damageMiniBoss(amount: number): void {
    if (!this.miniBoss.active || this.miniBossDefeated) {
      return
    }

    this.miniBossHealth = Math.max(0, this.miniBossHealth - amount)
    this.miniBoss.setTint(0xffc1a4)
    this.time.delayedCall(100, () => {
      if (this.miniBoss.active) {
        this.miniBoss.clearTint()
      }
    })

    if (this.miniBossHealth <= 0) {
      this.miniBossDefeated = true
      this.miniBoss.disableBody(true, true)
      this.miniBossLabel.setVisible(false)
      this.statusMessage = 'Infix defeated. Rescue path open.'
      this.playTone(260, 0.12)
    } else {
      this.statusMessage = `Infix HP: ${this.miniBossHealth.toFixed(1)}`
    }

    this.updateUiText()
  }

  private damageChromaforge(amount: number): void {
    if (!this.chromaforge.active || this.chromaforgeDefeated) {
      return
    }
    this.chromaforgeHealth = Math.max(0, this.chromaforgeHealth - amount)
    this.chromaforge.setTint(0xffd9f7)
    this.time.delayedCall(100, () => {
      if (this.chromaforge.active) {
        this.chromaforge.clearTint()
      }
    })

    if (this.chromaforgeHealth <= 0) {
      this.chromaforgeDefeated = true
      this.chromaforge.disableBody(true, true)
      this.chromaforgeLabel.setVisible(false)
      this.statusMessage = 'Chromaforge defeated. Dungeon Planet stabilized.'
      this.playTone(200, 0.16)
      this.finishGameEnding()
    } else {
      this.statusMessage = `Chromaforge HP: ${this.chromaforgeHealth.toFixed(1)}`
    }
    this.updateUiText()
  }

  private finishGameEnding(): void {
    if (this.stageClearTriggered) {
      return
    }
    this.stageClearTriggered = true
    gameProgress.bouldereyeRescued = true
    gameProgress.lavaBogCleared = true
    gameProgress.gameCompleted = true
    saveGameProgress()
    this.startDialogue(
      [
        'Chromaforge: Trials complete. Team cohesion confirmed.',
        'Bouldereye: Dungeon Busters, mission complete.',
        'THE END - Press Space',
      ],
      () => {
        this.scene.start('intro-story')
      },
    )
  }

  private tryUseHeroAbility(): void {
    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs * this.abilityCooldownScale) {
      return
    }

    this.lastAbilityAt = now
    const enemies = [this.patrolEnemy, this.lavaBot]

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
        this.physics.add.overlap(trail, this.lavaBot, () => this.lavaBot.disableBody(true, true))
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
      'Micralis: Heat levels are off the chart. Stay moving.',
      'Electroman: Vault signature found. Bouldereye is ahead.',
      'Inspector Glowman: Eliminate Infix, then break the vault lock.',
      'Mission: Rescue Bouldereye and extract.',
      'Press Space to start.',
    ]
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true
    this.showCutscenePanel(this.cutsceneLines[0])
  }

  private showCutscenePanel(line: string): void {
    if (!this.cutscenePanel || !this.cutsceneText) {
      this.cutscenePanel = this.add.rectangle(480, 430, 900, 190, 0x120905, 0.84)
      this.cutscenePanel.setStrokeStyle(2, 0xffb68a, 0.95)
      this.cutscenePanel.setDepth(60)
      this.cutscenePanel.setScrollFactor(0)

      this.cutsceneText = this.add.text(66, 360, '', {
        color: '#fff4ea',
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

    if (this.dialogueOnEnd) {
      const callback = this.dialogueOnEnd
      this.dialogueOnEnd = null
      callback()
      return
    }

    if (!this.rescueDone) {
      this.statusMessage = 'Find the vault chamber and rescue Bouldereye.'
    }
    this.updateUiText()
  }

  private startDialogue(lines: string[], onEnd?: () => void): void {
    this.cutsceneLines = lines
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true
    this.dialogueOnEnd = onEnd ?? null
    this.showCutscenePanel(this.cutsceneLines[0])
  }

  private updateUiText(): void {
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    this.uiText.setText(
      [
        'Dungeon Busters',
        this.stageName,
        `Hero: ${this.selectedHero?.displayName ?? 'Micralis'}`,
        `HP: ${hp}`,
        `Infix: ${this.miniBossDefeated ? 'Defeated' : `${this.miniBossHealth.toFixed(1)} HP`}`,
        `Chromaforge: ${this.chromaforgeFightStarted ? (this.chromaforgeDefeated ? 'Defeated' : `${this.chromaforgeHealth.toFixed(1)} HP`) : 'Dormant'}`,
        `Illislim: ${this.illislimRescued ? 'Joined' : 'Missing'}`,
        `Hurricano Man: ${this.hurricanoRescued ? 'Joined' : 'Missing'}`,
        `Bouldereye: ${this.rescueDone ? 'Rescued' : 'Trapped'}`,
        this.statusMessage,
      ].join('\n'),
    )
  }

  private drawHealthBar(
    key: string,
    x: number,
    y: number,
    width: number,
    current: number,
    max: number,
    color = 0x7dff7d,
  ): void {
    let gfx = this.healthBarGfx.get(key)
    if (!gfx) {
      gfx = this.add.graphics()
      gfx.setDepth(29)
      this.healthBarGfx.set(key, gfx)
    }
    gfx.clear()
    if (max <= 0 || current <= 0) {
      return
    }
    const ratio = Phaser.Math.Clamp(current / max, 0, 1)
    gfx.fillStyle(0x000000, 0.65)
    gfx.fillRect(x - width / 2 - 1, y - 1, width + 2, 7)
    gfx.fillStyle(0x2e2e2e, 0.85)
    gfx.fillRect(x - width / 2, y, width, 5)
    gfx.fillStyle(color, 0.95)
    gfx.fillRect(x - width / 2, y, Math.max(1, width * ratio), 5)
  }

  private updateAllHealthBars(): void {
    this.drawHealthBar('player', this.player.x, this.player.y - 48, 52, this.playerHealth, this.playerMaxHealth, 0x8dff8d)

    if (this.patrolEnemy.active) {
      this.drawHealthBar(
        'patrol',
        this.patrolEnemy.x,
        this.patrolEnemy.y - 34,
        42,
        this.patrolEnemyHealth,
        this.patrolEnemyMaxHealth,
        0xffa46b,
      )
    } else {
      this.drawHealthBar('patrol', this.patrolEnemy.x, this.patrolEnemy.y - 34, 42, 0, this.patrolEnemyMaxHealth, 0xffa46b)
    }

    if (this.lavaBot.active) {
      this.drawHealthBar('lavaBot', this.lavaBot.x, this.lavaBot.y - 34, 42, this.lavaBotHealth, this.lavaBotMaxHealth, 0xffa46b)
    } else {
      this.drawHealthBar('lavaBot', this.lavaBot.x, this.lavaBot.y - 34, 42, 0, this.lavaBotMaxHealth, 0xffa46b)
    }

    if (this.miniBoss.active && !this.miniBossDefeated) {
      this.drawHealthBar('infix', this.miniBoss.x, this.miniBoss.y - 52, 92, this.miniBossHealth, this.miniBossMaxHealth, 0xff8c70)
    } else {
      this.drawHealthBar('infix', this.miniBoss.x, this.miniBoss.y - 52, 92, 0, this.miniBossMaxHealth, 0xff8c70)
    }

    if (this.chromaforge.active && !this.chromaforgeDefeated) {
      this.drawHealthBar(
        'chromaforge',
        this.chromaforge.x,
        this.chromaforge.y - 52,
        96,
        this.chromaforgeHealth,
        this.chromaforgeMaxHealth,
        0xe6a1ff,
      )
    } else {
      this.drawHealthBar('chromaforge', this.chromaforge.x, this.chromaforge.y - 52, 96, 0, this.chromaforgeMaxHealth, 0xe6a1ff)
    }

    if (this.illislimRescued && this.illislimAlly.active) {
      this.drawHealthBar('illislim', this.illislimAlly.x, this.illislimAlly.y - 36, 38, this.allyMaxHealth, this.allyMaxHealth, 0x9effbd)
    } else {
      this.drawHealthBar('illislim', 0, 0, 38, 0, this.allyMaxHealth, 0x9effbd)
    }

    if (this.hurricanoRescued && this.hurricanoAlly.active) {
      this.drawHealthBar('hurricano', this.hurricanoAlly.x, this.hurricanoAlly.y - 36, 38, this.allyMaxHealth, this.allyMaxHealth, 0x9edfff)
    } else {
      this.drawHealthBar('hurricano', 0, 0, 38, 0, this.allyMaxHealth, 0x9edfff)
    }

    if (this.rescueDone && this.bouldereye.active) {
      this.drawHealthBar('bouldereye', this.bouldereye.x, this.bouldereye.y - 36, 42, this.bouldereyeMaxHealth, this.bouldereyeMaxHealth, 0xffd18e)
    } else {
      this.drawHealthBar('bouldereye', 0, 0, 42, 0, this.bouldereyeMaxHealth, 0xffd18e)
    }

    for (let i = 0; i < this.chromaforgeAllies.length; i += 1) {
      const ally = this.chromaforgeAllies[i]
      const key = `final-ally-${i}`
      if (this.chromaforgeFightStarted && ally.active) {
        this.drawHealthBar(key, ally.x, ally.y - 24, 30, this.allyMaxHealth, this.allyMaxHealth, 0xbdd6ff)
      } else {
        this.drawHealthBar(key, 0, 0, 30, 0, this.allyMaxHealth, 0xbdd6ff)
      }
    }

    for (const [minion, gfx] of this.minionHealthBars.entries()) {
      gfx.clear()
      if (!minion.active) {
        continue
      }
      const hp = Number(minion.getData('hp') ?? 0)
      const maxHp = Number(minion.getData('maxHp') ?? 2)
      if (hp <= 0) {
        continue
      }
      const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1)
      const x = minion.x
      const y = minion.y - 28
      const width = 26
      gfx.fillStyle(0x000000, 0.65)
      gfx.fillRect(x - width / 2 - 1, y - 1, width + 2, 6)
      gfx.fillStyle(0x2e2e2e, 0.85)
      gfx.fillRect(x - width / 2, y, width, 4)
      gfx.fillStyle(0xffbe86, 0.95)
      gfx.fillRect(x - width / 2, y, Math.max(1, width * ratio), 4)
    }
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
