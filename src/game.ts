import Phaser from 'phaser'
import { BloodyHillsScene } from './bloody-hills'
import { applyCombatDamage, applyStompDamage, configureCombatant } from './combat'
import { IntroStoryScene } from './intro-story'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type HeroDefinition,
  type HeroId,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress, getLivesDisplay, loseLife, resetLives, saveGameProgress } from './progress'
import { RockyCavernsScene } from './rocky-caverns'
import { preloadSpriteAssets } from './sprite-assets'
import { StageSelectScene } from './stage-select'
import { HeroSelectScene } from './hero-select'
import { LaserAlleyScene } from './laser-alley'
import { LavaBogScene } from './lava-bog'
import { GameLogScene } from './game-log'
import { ForgeOfOriginsScene } from './forge-of-origins'
import { DungeonMinigameScene, MeteorDodgeScene } from './minigames'
import { addMinigameEntrances } from './minigame-entrances'

type PipeGuard = {
  sprite: Phaser.Physics.Arcade.Sprite
  minX: number
  maxX: number
  speed: number
}

class Stage1 extends Phaser.Scene {
  private readonly LEVEL_W = 2400
  private readonly LEVEL_H = 900
  private player!: Phaser.Physics.Arcade.Sprite
  private enemy!: Phaser.Physics.Arcade.Sprite
  private enemy2!: Phaser.Physics.Arcade.Sprite
  private pipeGuards: PipeGuard[] = []
  private shots!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private slipperyZones: Phaser.Geom.Rectangle[] = []
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []
  private keyPiece: Phaser.GameObjects.Rectangle | null = null
  private exitDoor!: Phaser.GameObjects.Rectangle
  private uiText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private waterfallBackdrop!: Phaser.GameObjects.TileSprite
  private cutscenePanel!: Phaser.GameObjects.Rectangle
  private cutsceneText!: Phaser.GameObjects.Text
  private cutsceneLines: string[] = []
  private cutsceneLineIndex = 0
  private cutsceneActive = true
  private spaceKey!: Phaser.Input.Keyboard.Key
  private abilityKey!: Phaser.Input.Keyboard.Key
  private selectedHero!: HeroDefinition
  private effectiveStats = computeEffectivePlayerStats(DEFAULT_HERO_ID, 'SLIPPERY_HILLS', {
    moveAcceleration: 900,
    maxVelocityX: 260,
    jumpVelocity: 520,
    shotCooldownMs: 220,
    shotSpeed: 520,
    damage: 1,
    defense: 1,
  })
  private readonly abilityCooldownMs = 1300
  private lastAbilityAt = 0
  private abilityCooldownScale = 1
  private shotCooldownScale = 1
  private abilityPowerScale = 1
  private playerHasKey = false
  private stageClearTriggered = false
  private statusMessage = 'Find the Torrent Key Piece.'
  private readonly stageName = 'Stage 1: Slippery Slopes'
  private playerMaxHealth = 7
  private playerHealth = 5
  private checkpointX = 140
  private checkpointY = 680
  private healthPickup: Phaser.GameObjects.Rectangle | null = null
  private powerPickup: Phaser.GameObjects.Rectangle | null = null
  private hiddenPipe: Phaser.GameObjects.Rectangle | null = null
  private hiddenPipeTop: Phaser.GameObjects.Rectangle | null = null
  private secretExitPipe: Phaser.GameObjects.Rectangle | null = null
  private coinPickups: Phaser.GameObjects.Arc[] = []
  private secretRoomObjects: Phaser.GameObjects.GameObject[] = []
  private shopZone!: Phaser.GameObjects.Zone
  private shopText!: Phaser.GameObjects.Text
  private isSquatting = false
  private normalPlayerDisplayWidth = 40
  private normalPlayerDisplayHeight = 60
  private damageReductionMul = 1
  private speedBoostActive = false

  private readonly normalDragX = 900
  private readonly slipperyDragX = 180
  private readonly normalMaxVelocityX = 260
  private readonly slipperyMaxVelocityX = 320
  private readonly moveAcceleration = 900
  private readonly playerSpawnX = 140
  private readonly playerSpawnY = 680
  private readonly enemyPatrolMinX = 640
  private readonly enemyPatrolMaxX = 900
  private readonly enemyPatrolSpeed = 62
  private readonly enemy2PatrolMinX = 2270
  private readonly enemy2PatrolMaxX = 2370
  private readonly enemy2PatrolSpeed = 52
  private readonly hiddenPipeX = 1320
  private readonly hiddenPipeY = 824
  private readonly secretRoomX = 420
  private readonly secretRoomY = 260
  private readonly hitInvulnerabilityMs = 1350
  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0
  private startX = this.playerSpawnX
  private startY = this.playerSpawnY
  private returningFromMinigame = false
  private returnMessage = ''

  constructor() {
    super('stage1')
  }

  init(data: { fromMinigame?: boolean; returnX?: number; returnY?: number; returnMessage?: string }): void {
    this.returningFromMinigame = data.fromMinigame ?? false
    this.startX = data.returnX ?? this.playerSpawnX
    this.startY = data.returnY ?? this.playerSpawnY
    this.returnMessage = data.returnMessage ?? ''
  }

  preload(): void {
    preloadSpriteAssets(this)
  }

  create(): void {
    const worldWidth = this.LEVEL_W
    const worldHeight = this.LEVEL_H
    const selectedHeroId = (gameProgress.selectedHeroId ?? DEFAULT_HERO_ID) as HeroId
    this.selectedHero = HEROES[selectedHeroId] ?? HEROES[DEFAULT_HERO_ID]
    this.effectiveStats = computeEffectivePlayerStats(this.selectedHero.id, 'SLIPPERY_HILLS', {
      moveAcceleration: this.moveAcceleration,
      maxVelocityX: this.normalMaxVelocityX,
      jumpVelocity: 520,
      shotCooldownMs: this.shotCooldownMs,
      shotSpeed: this.shotSpeed,
      damage: 1,
      defense: 1,
    })

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setBackgroundColor('#1d2538')

    const levelPlatforms: Array<[number, number, number, number, number]> = [
      [220, 860, 440, 80, 0x3f8f5b],
      [760, 860, 360, 80, 0x3f8f5b],
      [1240, 860, 360, 80, 0x3f8f5b],
      [1580, 860, 220, 80, 0x3f8f5b],
      [760, 740, 360, 26, 0x6c7a96],
      [1760, 740, 180, 24, 0x6c7a96],
      [1880, 640, 180, 24, 0x6c7a96],
      [1990, 540, 170, 24, 0x6c7a96],
      [2090, 440, 220, 24, 0x6c7a96],
      [2320, 350, 160, 24, 0x6c7a96],
      [2280, 860, 240, 80, 0x3f8f5b],
    ]

    this.staticPlatforms = levelPlatforms.map(([x, y, width, height, color]) =>
      this.createStaticPlatform(x, y, width, height, color),
    )

    const gfx = this.add.graphics({ x: 0, y: 0 })
    gfx.setVisible(false)
    gfx.fillStyle(0xf2ca52, 1)
    gfx.fillRect(0, 0, 40, 60)
    gfx.generateTexture('player-block', 40, 60)
    gfx.clear()
    gfx.fillStyle(0xff6a6a, 1)
    gfx.fillRect(0, 0, 44, 44)
    gfx.generateTexture('enemy-block', 44, 44)
    gfx.clear()
    gfx.fillStyle(0x7bf4ff, 1)
    gfx.fillRect(0, 0, 16, 8)
    gfx.generateTexture('electro-shot', 16, 8)
    gfx.clear()
    gfx.fillStyle(0x7bd8ff, 1)
    gfx.fillRect(0, 0, 20, 60)
    gfx.fillStyle(0xffffff, 0.9)
    gfx.fillRect(7, 0, 6, 60)
    gfx.generateTexture('hero-hurricano-man', 20, 60)
    gfx.clear()
    gfx.fillStyle(0x12293d, 1)
    gfx.fillRect(0, 0, 64, 64)
    gfx.fillStyle(0x78d3ff, 0.2)
    gfx.fillRect(4, 0, 8, 64)
    gfx.fillRect(20, 0, 8, 64)
    gfx.fillRect(36, 0, 8, 64)
    gfx.fillRect(52, 0, 8, 64)
    gfx.generateTexture('waterfall-stripes', 64, 64)
    gfx.destroy()

    this.waterfallBackdrop = this.add.tileSprite(480, 270, 960, 540, 'waterfall-stripes')
    this.waterfallBackdrop.setScrollFactor(0)
    this.waterfallBackdrop.setDepth(-20)

    const heroTexture = this.textures.exists(this.selectedHero.textureKey) ? this.selectedHero.textureKey : 'player-block'
    const enemyTexture = this.textures.exists('enemy-scout') ? 'enemy-scout' : 'enemy-block'
    this.player = this.physics.add.sprite(this.startX, this.startY, heroTexture)
    if (heroTexture === 'hero-exemon') {
      this.player.setDisplaySize(56, 64)
    }
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
    configureCombatant(this.player, { maxHp: this.playerMaxHealth, widthRatio: 0.66, heightRatio: 0.9 })
    this.normalPlayerDisplayWidth = this.player.displayWidth
    this.normalPlayerDisplayHeight = this.player.displayHeight

    this.physics.add.collider(this.player, this.staticPlatforms)

    this.enemy = this.physics.add.sprite(this.enemyPatrolMaxX, 698, enemyTexture)
    this.enemy.setCollideWorldBounds(true)
    this.enemy.setImmovable(true)
    ;(this.enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    configureCombatant(this.enemy, { maxHp: 10, widthRatio: 0.72, heightRatio: 0.8 })
    this.enemy.setVelocityX(-this.enemyPatrolSpeed)

    this.physics.add.collider(this.enemy, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy, () => this.handleEnemyHit(this.enemy))

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 316, enemyTexture)
    this.enemy2.setCollideWorldBounds(true)
    this.enemy2.setImmovable(true)
    ;(this.enemy2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    configureCombatant(this.enemy2, { maxHp: 10, widthRatio: 0.72, heightRatio: 0.8 })
    this.enemy2.setVelocityX(-this.enemy2PatrolSpeed)
    this.physics.add.collider(this.enemy2, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy2, () => this.handleEnemyHit(this.enemy2))
    this.createPipeGuards(enemyTexture)

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
    this.physics.add.overlap(this.shots, this.enemy, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.enemy2, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    for (const guard of this.pipeGuards) {
      this.physics.add.overlap(this.shots, guard.sprite, (shotObj, enemyObj) => {
        this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
      })
    }

    this.slipperyZones = [
      this.createSlipperyZone(520, worldHeight - 170, 260, 180),
      this.createSlipperyZone(1080, worldHeight - 170, 320, 180),
      this.createSlipperyZone(1990, 640, 360, 240),
      this.createSlipperyZone(1490, 840, 700, 100),
    ]
    this.createBottomSpikes()

    this.keyPiece = this.add.rectangle(2310, 300, 26, 26, 0xffd84f)
    this.physics.add.existing(this.keyPiece, true)

    this.exitDoor = this.add.rectangle(worldWidth - 120, worldHeight - 150, 54, 140, 0x7e5cff)
    this.physics.add.existing(this.exitDoor, true)
    this.createCheckpointsAndItems()
    this.createMinigameEntrances()
    this.createPipeSecret()

    this.physics.add.overlap(this.player, this.keyPiece, () => {
      if (!this.keyPiece || this.playerHasKey) {
        return
      }

      this.playerHasKey = true
      gameProgress.torrentKeyPiece = true
      saveGameProgress()
      this.keyPiece.destroy()
      this.keyPiece = null
      this.statusMessage = 'Torrent Key Piece collected.'
      this.playTone(720, 0.12)
      this.updateUiText()
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#f3f6ff',
      fontSize: '16px',
      fontFamily: 'sans-serif',
      backgroundColor: '#0a1020cc',
      padding: { x: 10, y: 8 },
      wordWrap: { width: 560 },
      fixedWidth: 580,
    })
    this.uiText.setScrollFactor(0)
    this.uiText.setDepth(10)
    this.livesText = this.add.text(this.scale.width - 16, 16, '', {
      color: '#ffdca8',
      fontSize: '21px',
      fontFamily: 'sans-serif',
      backgroundColor: '#0a1020cc',
      padding: { x: 10, y: 6 },
      fixedWidth: 176,
      align: 'right',
    })
    this.livesText.setOrigin(1, 0)
    this.livesText.setScrollFactor(0)
    this.livesText.setDepth(10)
    if (this.returnMessage) {
      this.statusMessage = this.returnMessage
    }
    this.updateUiText()

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    if (this.returningFromMinigame) {
      this.cutsceneActive = false
    } else {
      this.initializeCutscene()
    }
  }

  update(): void {
    this.waterfallBackdrop.tilePositionY += 0.45

    if (!this.cutsceneActive && this.cutscenePanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.cutscenePanel.setVisible(false)
        this.cutsceneText.setVisible(false)
      }
      return
    }

    if (this.cutsceneActive) {
      this.player.setAccelerationX(0)
      this.player.setVelocityX(0)

      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.advanceCutscene()
      }

      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const wantsSquat = this.cursors.down.isDown && body.blocked.down
    this.setPlayerSquatting(wantsSquat)
    this.updateShopPrompt()
    this.tryUseHiddenPipe()
    this.tryUseSecretExitPipe()

    const isInSlipperyZone = this.slipperyZones.some((zone) =>
      Phaser.Geom.Rectangle.Contains(zone, this.player.x, this.player.y),
    )
    const squatSpeedMul = this.isSquatting ? 0.45 : 1

    if (isInSlipperyZone) {
      this.player.setDragX(this.slipperyDragX)
      this.player.setMaxVelocity(
        (this.effectiveStats.maxVelocityX * (this.slipperyMaxVelocityX / this.normalMaxVelocityX) + (this.speedBoostActive ? 80 : 0)) *
          squatSpeedMul,
        900,
      )
    } else {
      this.player.setDragX(this.normalDragX)
      this.player.setMaxVelocity((this.effectiveStats.maxVelocityX + (this.speedBoostActive ? 80 : 0)) * squatSpeedMul, 900)
    }

    if (this.cursors.left.isDown) {
      this.player.setAccelerationX(-this.effectiveStats.moveAcceleration * squatSpeedMul)
      this.facingDir = -1
    } else if (this.cursors.right.isDown) {
      this.player.setAccelerationX(this.effectiveStats.moveAcceleration * squatSpeedMul)
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

    if (this.cursors.up.isDown && body.blocked.down && !this.isSquatting) {
      this.player.setVelocityY(-this.effectiveStats.jumpVelocity)
    }
    if (!this.isSquatting && body.blocked.down && this.player.y > this.LEVEL_H - 36 && !this.cutsceneActive) {
      this.applyDamage(1, 'You fell between the blocks!', true)
    }

    if (this.physics.overlap(this.player, this.exitDoor)) {
      if (this.playerHasKey && !this.stageClearTriggered) {
        this.stageClearTriggered = true
        this.statusMessage = 'STAGE CLEAR! Returning to stage select...'
        this.updateUiText()
        this.time.delayedCall(1200, () => this.scene.start('stage-select'))
      } else if (!this.playerHasKey) {
        this.statusMessage = 'Need the Torrent Key Piece!'
        this.updateUiText()
      }
    }

    if (this.enemy.active) {
      if (this.enemy.x <= this.enemyPatrolMinX) {
        this.enemy.setVelocityX(this.enemyPatrolSpeed)
      } else if (this.enemy.x >= this.enemyPatrolMaxX) {
        this.enemy.setVelocityX(-this.enemyPatrolSpeed)
      }
    }

    if (this.enemy2.active) {
      if (this.enemy2.x <= this.enemy2PatrolMinX) {
        this.enemy2.setVelocityX(this.enemy2PatrolSpeed)
      } else if (this.enemy2.x >= this.enemy2PatrolMaxX) {
        this.enemy2.setVelocityX(-this.enemy2PatrolSpeed)
      }
    }

    this.updatePipeGuards()
  }

  private createSlipperyZone(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): Phaser.Geom.Rectangle {
    this.add.rectangle(centerX, centerY, width, height, 0x63d2ff, 0.35)
    return new Phaser.Geom.Rectangle(centerX - width / 2, centerY - height / 2, width, height)
  }

  private createCheckpointsAndItems(): void {
    const checkpointDefs: Array<[number, number]> = [
      [900, 700],
      [2020, 500],
    ]

    checkpointDefs.forEach(([x, y]) => {
      const flag = this.add.rectangle(x, y, 20, 72, 0xffc76b, 0.9)
      this.physics.add.existing(flag, true)
      this.physics.add.overlap(this.player, flag, () => this.activateCheckpoint(flag, x, y))
    })

    this.healthPickup = this.add.rectangle(1180, 790, 24, 24, 0x7aff7a, 0.95)
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

    this.powerPickup = this.add.rectangle(1840, 705, 22, 22, 0x82e8ff, 0.95)
    this.physics.add.existing(this.powerPickup, true)
    this.physics.add.overlap(this.player, this.powerPickup, () => {
      if (!this.powerPickup) {
        return
      }
      this.shotCooldownScale = 0.85
      this.abilityCooldownScale = 0.85
      this.abilityPowerScale = 1.35
      this.powerPickup.destroy()
      this.powerPickup = null
      this.statusMessage = 'Power core found. Abilities empowered and cooldowns boosted.'
      this.playTone(640, 0.1)
      this.updateUiText()
    })
  }

  private createPipeGuards(enemyTexture: string): void {
    const guardDefs: Array<[number, number, number, number, number]> = [
      [1210, 698, 1140, 1285, 76],
      [1425, 698, 1360, 1495, 68],
      [1535, 698, 1480, 1600, 64],
    ]

    this.pipeGuards = guardDefs.map(([x, y, minX, maxX, speed]) => {
      const sprite = this.physics.add.sprite(x, y, enemyTexture)
      sprite.setCollideWorldBounds(true)
      sprite.setImmovable(true)
      ;(sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
      configureCombatant(sprite, { maxHp: 6, widthRatio: 0.72, heightRatio: 0.8 })
      sprite.setTint(0x8cffaa)
      sprite.setVelocityX(speed)
      this.physics.add.collider(sprite, this.staticPlatforms)
      this.physics.add.overlap(this.player, sprite, () => this.handleEnemyHit(sprite))
      return { sprite, minX, maxX, speed }
    })
  }

  private createPipeSecret(): void {
    const pipeBase = this.add.rectangle(this.hiddenPipeX, this.hiddenPipeY, 54, 58, 0x21b45b, 0.08)
    const pipeTop = this.add.rectangle(this.hiddenPipeX, this.hiddenPipeY - 34, 78, 22, 0x39e57b, 0.08)
    this.hiddenPipe = pipeBase
    this.hiddenPipeTop = pipeTop
    this.physics.add.existing(pipeBase, true)
    this.physics.add.existing(pipeTop, true)
    this.add.text(this.hiddenPipeX, this.hiddenPipeY + 42, 'Hidden Pipe', {
      color: '#bfffd3',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      backgroundColor: '#071024aa',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setAlpha(0.12)

    const secretPlatforms = [
      this.createStaticPlatform(this.secretRoomX, this.secretRoomY + 170, 520, 26, 0x284a5d),
      this.createStaticPlatform(this.secretRoomX - 250, this.secretRoomY + 70, 28, 220, 0x1d3345),
      this.createStaticPlatform(this.secretRoomX + 250, this.secretRoomY + 70, 28, 220, 0x1d3345),
      this.createStaticPlatform(this.secretRoomX, this.secretRoomY - 44, 520, 26, 0x1d3345),
    ]
    this.secretRoomObjects.push(...secretPlatforms)
    this.physics.add.collider(this.player, secretPlatforms)

    this.secretRoomObjects.push(this.add.rectangle(this.secretRoomX, this.secretRoomY + 64, 500, 210, 0x071024, 0.72))
    this.secretRoomObjects.push(this.add.text(this.secretRoomX - 218, this.secretRoomY - 18, 'Secret Pipe Room', {
      color: '#fff4d1',
      fontFamily: 'sans-serif',
      fontSize: '18px',
      backgroundColor: '#071024aa',
      padding: { x: 6, y: 3 },
    }))

    const exitBase = this.add.rectangle(this.secretRoomX - 196, this.secretRoomY + 132, 52, 58, 0x21b45b, 0.95)
    const exitTop = this.add.rectangle(this.secretRoomX - 196, this.secretRoomY + 98, 76, 22, 0x39e57b, 0.95)
    this.secretExitPipe = exitBase
    this.secretRoomObjects.push(exitBase, exitTop)
    this.physics.add.existing(exitBase, true)
    this.physics.add.existing(exitTop, true)
    const exitLabel = this.add.text(this.secretRoomX - 196, this.secretRoomY + 174, 'Squat to exit', {
      color: '#bfffd3',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      backgroundColor: '#071024cc',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5)
    this.secretRoomObjects.push(exitLabel)

    this.createSecretCoins()
    this.createSecretShop()
    this.setSecretRoomVisible(false)
  }

  private createSecretCoins(): void {
    if (gameProgress.stage1PipeCoinsCollected) {
      return
    }

    const coinPositions: Array<[number, number]> = [
      [this.secretRoomX - 90, this.secretRoomY + 84],
      [this.secretRoomX - 42, this.secretRoomY + 62],
      [this.secretRoomX + 8, this.secretRoomY + 84],
      [this.secretRoomX + 58, this.secretRoomY + 62],
      [this.secretRoomX + 108, this.secretRoomY + 84],
      [this.secretRoomX + 158, this.secretRoomY + 62],
    ]

    this.coinPickups = coinPositions.map(([x, y]) => {
      const coin = this.add.circle(x, y, 11, 0xffd84f, 1)
      coin.setStrokeStyle(2, 0xfff0a8, 1)
      this.secretRoomObjects.push(coin)
      this.physics.add.existing(coin, true)
      this.physics.add.overlap(this.player, coin, () => this.collectSecretCoin(coin))
      return coin
    })
  }

  private createSecretShop(): void {
    const shopX = this.secretRoomX + 184
    const shopY = this.secretRoomY + 122
    const shopBody = this.add.rectangle(shopX, shopY, 96, 84, 0x4b2b68, 0.96)
    const shopSign = this.add.rectangle(shopX, shopY - 52, 118, 24, 0xffd166, 0.95)
    const shopTitle = this.add.text(shopX, shopY - 60, 'ITEM SHOP', {
      color: '#231528',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      fixedWidth: 118,
      align: 'center',
    }).setOrigin(0.5, 0)
    this.secretRoomObjects.push(shopBody, shopSign, shopTitle)
    this.shopText = this.add.text(shopX - 78, shopY - 30, '', {
      color: '#f6f8ff',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      lineSpacing: 4,
      backgroundColor: '#071024cc',
      padding: { x: 6, y: 4 },
      fixedWidth: 156,
    })
    this.secretRoomObjects.push(this.shopText)
    this.shopZone = this.add.zone(shopX, shopY, 150, 112)
    this.physics.add.existing(this.shopZone, true)
    this.refreshShopText()
  }

  private collectSecretCoin(coin: Phaser.GameObjects.Arc): void {
    if (!coin.active) {
      return
    }
    coin.destroy()
    this.coinPickups = this.coinPickups.filter((pickup) => pickup !== coin)
    gameProgress.coins += 1
    if (this.coinPickups.length === 0) {
      gameProgress.stage1PipeCoinsCollected = true
    }
    saveGameProgress()
    this.statusMessage = `Coin found! Coins: ${gameProgress.coins}`
    this.playTone(780, 0.06)
    this.refreshShopText()
    this.updateUiText()
  }

  private refreshShopText(): void {
    if (!this.shopText) {
      return
    }
    const healthStatus = gameProgress.stage1ShopHealthBought ? 'sold' : '1 coin'
    const powerStatus = gameProgress.stage1ShopPowerBought ? 'sold' : '2 coins'
    const lifeStatus = gameProgress.stage1ShopLifeBought ? 'sold' : '3 coins'
    this.shopText.setText(`Coins: ${gameProgress.coins}\n1. Snack Pack: ${healthStatus}\n2. Power Fizzy: ${powerStatus}\n3. Bonus Life: ${lifeStatus}\nSpace buys next`)
  }

  private setSecretRoomVisible(visible: boolean): void {
    for (const obj of this.secretRoomObjects) {
      ;(obj as Phaser.GameObjects.GameObject & { setVisible?: (value: boolean) => void }).setVisible?.(visible)
      const body = (obj as Phaser.GameObjects.GameObject & { body?: { enable: boolean } }).body
      if (body) {
        body.enable = visible
      }
    }
    const shopBody = (this.shopZone as Phaser.GameObjects.Zone & { body?: { enable: boolean } }).body
    if (shopBody) {
      shopBody.enable = visible
    }
  }

  private updateShopPrompt(): void {
    if (!this.shopZone || !this.physics.overlap(this.player, this.shopZone)) {
      return
    }
    this.statusMessage = 'Secret shop: press Space to buy a cheap item.'
    this.refreshShopText()
    this.updateUiText()
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.buyNextShopItem()
      this.lastShotAt = this.time.now
    }
  }

  private buyNextShopItem(): void {
    if (!gameProgress.stage1ShopHealthBought && gameProgress.coins >= 1) {
      gameProgress.coins -= 1
      gameProgress.stage1ShopHealthBought = true
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 4)
      this.statusMessage = 'Bought Snack Pack. Big heal!'
      this.finishShopPurchase()
      return
    }

    if (!gameProgress.stage1ShopPowerBought && gameProgress.coins >= 2) {
      gameProgress.coins -= 2
      gameProgress.stage1ShopPowerBought = true
      this.shotCooldownScale = Math.min(this.shotCooldownScale, 0.75)
      this.abilityCooldownScale = Math.min(this.abilityCooldownScale, 0.75)
      this.abilityPowerScale = Math.max(this.abilityPowerScale, 1.45)
      this.statusMessage = 'Bought Power Fizzy. Shots and specials boosted!'
      this.finishShopPurchase()
      return
    }

    if (!gameProgress.stage1ShopLifeBought && gameProgress.coins >= 3) {
      gameProgress.coins -= 3
      gameProgress.stage1ShopLifeBought = true
      gameProgress.remainingLives = Math.min(5, gameProgress.remainingLives + 1)
      this.statusMessage = 'Bought Bonus Life. Extra safety!'
      this.finishShopPurchase()
      return
    }

    this.statusMessage = 'Need more coins, or the shop is sold out.'
    this.playTone(180, 0.08)
    this.updateUiText()
  }

  private finishShopPurchase(): void {
    saveGameProgress()
    this.refreshShopText()
    this.playTone(920, 0.09)
    this.updateUiText()
  }

  private updatePipeGuards(): void {
    for (const guard of this.pipeGuards) {
      if (!guard.sprite.active) {
        continue
      }
      if (guard.sprite.x <= guard.minX) {
        guard.sprite.setVelocityX(guard.speed)
      } else if (guard.sprite.x >= guard.maxX) {
        guard.sprite.setVelocityX(-guard.speed)
      }
    }

    if (this.arePipeGuardsDefeated() && this.hiddenPipe && this.hiddenPipe.alpha < 0.9) {
      this.hiddenPipe.setAlpha(0.95)
      this.hiddenPipeTop?.setAlpha(0.95)
      this.statusMessage = 'Secret pipe revealed! Squat on it to enter.'
      this.playTone(680, 0.12)
      this.updateUiText()
    }
  }

  private arePipeGuardsDefeated(): boolean {
    return this.pipeGuards.length > 0 && this.pipeGuards.every((guard) => !guard.sprite.active)
  }

  private tryUseHiddenPipe(): void {
    if (!this.isSquatting || !this.hiddenPipe || !this.arePipeGuardsDefeated()) {
      return
    }
    if (!this.physics.overlap(this.player, this.hiddenPipe)) {
      return
    }
    this.setSecretRoomVisible(true)
    this.player.setPosition(this.secretRoomX - 196, this.secretRoomY + 72)
    this.player.setVelocity(0, 0)
    this.statusMessage = 'You squatted into the secret pipe room!'
    this.playTone(520, 0.12)
    this.updateUiText()
  }

  private tryUseSecretExitPipe(): void {
    if (!this.isSquatting || !this.secretExitPipe || !this.physics.overlap(this.player, this.secretExitPipe)) {
      return
    }
    this.setSecretRoomVisible(false)
    this.player.setPosition(this.hiddenPipeX + 86, this.hiddenPipeY - 64)
    this.player.setVelocity(0, 0)
    this.statusMessage = 'Back from the pipe room.'
    this.playTone(420, 0.1)
    this.updateUiText()
  }

  private createMinigameEntrances(): void {
    addMinigameEntrances(this, {
      stageKey: 'stage1',
      player: this.player,
      returnScene: 'stage1',
      setStatus: (message) => {
        this.statusMessage = message
        this.updateUiText()
      },
    })
  }

  private createBottomSpikes(): void {
    const spikeXs = [1760, 1810, 1860, 1910, 1960]
    spikeXs.forEach((x) => {
      const spike = this.add.rectangle(x, 846, 34, 30, 0xd84949, 0.95)
      this.physics.add.existing(spike, true)
      this.physics.add.overlap(this.player, spike, () => {
        this.applyDamage(1, 'Spikes! Careful on the lower lane.', true)
      })
    })
  }

  private activateCheckpoint(flag: Phaser.GameObjects.Rectangle, x: number, y: number): void {
    if (flag.getData('active')) {
      return
    }

    this.checkpointX = x
    this.checkpointY = y - 24
    flag.setData('active', true)
    flag.setFillStyle(0x8affc1, 1)
    this.statusMessage = 'Checkpoint reached.'
    this.playTone(500, 0.08)
    this.updateUiText()
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

  private setPlayerSquatting(shouldSquat: boolean): void {
    if (this.isSquatting === shouldSquat) {
      return
    }

    this.isSquatting = shouldSquat

    if (shouldSquat) {
      this.player.setDisplaySize(this.normalPlayerDisplayWidth, this.normalPlayerDisplayHeight * 0.58)
      this.player.setTint(0xd8f7ff)
    } else {
      this.player.setDisplaySize(this.normalPlayerDisplayWidth, this.normalPlayerDisplayHeight)
      this.player.clearTint()
    }
  }

  private updateUiText(): void {
    const hp = `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
    this.uiText.setText(
      `Dungeon Busters\n${this.stageName}\nHero: ${this.heroName}\nSpecial (X): ${this.selectedHero.moves.special.name}\nHP: ${hp}\nCoins: ${gameProgress.coins}\nPlatform Parts: ${gameProgress.platformParts}\nTorrent Key Piece: ${this.playerHasKey ? 'Yes' : 'No'}\n${this.statusMessage}`,
    )
    if (this.livesText) {
      this.livesText.setText(`Lives ${getLivesDisplay()}`)
    }
  }

  private handleEnemyHit(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.tryStompEnemy(enemy)) {
      return
    }
    this.applyDamage(1, 'Oof! Try again.')
  }

  private tryStompEnemy(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.cutsceneActive || !enemy.active) {
      return false
    }

    const result = applyStompDamage(this, this.player, enemy)
    if (!result) {
      return false
    }

    this.statusMessage = result.died ? 'Stomp hit! Enemy down.' : `Stomp hit! Enemy HP: ${result.hp}`
    this.playTone(520, 0.07)
    this.updateUiText()
    return true
  }

  private applyDamage(amount: number, message: string, forceRespawn = false): void {
    if (this.isPlayerInvulnerable) {
      return
    }

    this.playerHealth = Math.max(0, this.playerHealth - amount * this.damageReductionMul)
    this.isPlayerInvulnerable = true
    this.player.setTint(0xff9f9f)
    this.statusMessage = message
    this.updateUiText()
    this.playTone(220, 0.09)
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
        blackout.setDepth(200)
        blackout.setScrollFactor(0)
        const text = this.add.text(this.scale.width / 2, this.scale.height / 2 - 18, 'GAME OVER', {
          color: '#fff1f1',
          fontFamily: 'sans-serif',
          fontSize: '72px',
          align: 'center',
          fontStyle: 'bold',
        })
        text.setOrigin(0.5)
        text.setDepth(201)
        text.setScrollFactor(0)
        const subtext = this.add.text(this.scale.width / 2, this.scale.height / 2 + 46, 'Out of lives', {
          color: '#ffb3b3',
          fontFamily: 'sans-serif',
          fontSize: '28px',
          align: 'center',
        })
        subtext.setOrigin(0.5)
        subtext.setDepth(201)
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

    const defenseScale = Phaser.Math.Clamp(this.effectiveStats.defense, 0.85, 1.2)
    const invulnMs = this.hitInvulnerabilityMs * defenseScale
    this.time.delayedCall(invulnMs, () => {
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

  private handleEnemyShot(
    shot: Phaser.Physics.Arcade.Image,
    enemy: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!enemy.active) {
      return
    }

    shot.disableBody(true, true)
    const result = applyCombatDamage(this, enemy, 1, 220)
    if (!result.applied) {
      return
    }
    if (result.died) {
      enemy.disableBody(true, true)
      this.statusMessage = this.arePipeGuardsDefeated() ? 'Pipe guards defeated. A secret pipe appeared!' : 'Enemy down!'
    } else {
      this.statusMessage = `Enemy HP: ${result.hp}`
    }
    this.updateUiText()
  }

  private getStageEnemies(): Phaser.Physics.Arcade.Sprite[] {
    return [this.enemy, this.enemy2, ...this.pipeGuards.map((guard) => guard.sprite)]
  }

  private get heroName(): string {
    return this.selectedHero?.displayName ?? 'Micralis'
  }

  private tryUseHeroAbility(): void {
    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs * this.abilityCooldownScale) {
      return
    }

    this.lastAbilityAt = now
    const enemies = this.getStageEnemies()
    const power = this.abilityPowerScale
    const impactRadiusX = 170 + power * 40
    const impactRadiusY = 120 + power * 24
    const damageEnemy = (enemy: Phaser.Physics.Arcade.Sprite, amount: number, cooldownMs = 220): boolean => {
      if (!enemy.active) {
        return false
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
    const affectFrontEnemies = (
      rangeX: number,
      rangeY: number,
      handler: (enemy: Phaser.Physics.Arcade.Sprite) => void,
    ): number => {
      let hits = 0
      for (const enemy of enemies) {
        if (!enemy.active) {
          continue
        }
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
    const pushEnemies = (push = 190): void => {
      for (const enemy of enemies) {
        if (!enemy.active) {
          continue
        }

        const dx = enemy.x - this.player.x
        const inFront = this.facingDir > 0 ? dx >= 0 : dx <= 0
        if (inFront && Math.abs(dx) < 190) {
          enemy.setVelocityX(this.facingDir * push)
        }
      }
    }

    switch (this.selectedHero.specialAbility) {
      case 'PHOTON_DASH':
        this.player.setTint(0x9ed8ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 240 + 40 * power))
        this.player.setVelocityY(Math.min((this.player.body as Phaser.Physics.Arcade.Body).velocity.y, -80))
        affectFrontEnemies(impactRadiusX, impactRadiusY, (enemy) => {
          damageEnemy(enemy, 1.4 * power, 170)
          enemy.setVelocityX(this.facingDir * (220 + 40 * power))
        })
        this.time.delayedCall(180, () => this.player.clearTint())
        this.statusMessage = 'Photon Dash: cut straight through the line!'
        this.playTone(700, 0.07)
        break
      case 'THUNDER_SLIDE':
        this.damageReductionMul = Math.min(this.damageReductionMul, 0.18)
        this.player.setTint(0xbde9ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 340 + 40 * power))
        pushEnemies(260 + 35 * power)
        const pulse = this.add.circle(this.player.x + this.facingDir * 30, this.player.y + 6, 24, 0xbde9ff, 0.38)
        pulse.setDepth(28)
        this.tweens.add({
          targets: pulse,
          scale: 4,
          alpha: 0,
          duration: 260,
          onComplete: () => pulse.destroy(),
        })
        affectFrontEnemies(240 + 30 * power, 145, (enemy) => {
          damageEnemy(enemy, 1.85 * power, 150)
          enemy.setTint(0xbde9ff)
          enemy.setVelocity(this.facingDir * (90 + 20 * power), -120)
          this.time.delayedCall(950, () => {
            if (!enemy.active) {
              return
            }
            enemy.clearTint()
            enemy.setVelocityX(this.facingDir * 40)
          })
        })
        this.time.delayedCall(320, () => this.player.clearTint())
        this.time.delayedCall(520, () => {
          if (this.damageReductionMul <= 0.18) {
            this.damageReductionMul = 1
          }
        })
        this.statusMessage = 'Thunder Slide: lightning lane opened!'
        this.playTone(760, 0.08)
        break
      case 'GUST_DASH':
        this.player.setTint(0xbaf6ff)
        this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 320 + 40 * power))
        this.player.setVelocityY(-180 - 35 * power)
        affectFrontEnemies(impactRadiusX + 20, impactRadiusY + 30, (enemy) => {
          damageEnemy(enemy, 1.1 * power, 180)
          enemy.setVelocity(this.facingDir * (260 + 30 * power), -160 - 20 * power)
        })
        this.time.delayedCall(220, () => this.player.clearTint())
        this.statusMessage = 'Gust Dash: wind shear launch!'
        this.playTone(640, 0.08)
        break
      case 'RADIANT_BARRIER':
        this.damageReductionMul = 0.26
        this.player.setTint(0xc6f6ff)
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + Math.ceil(power))
        affectFrontEnemies(150 + 20 * power, 120, (enemy) => {
          damageEnemy(enemy, 0.9 * power, 160)
          enemy.setTint(0xfff2a8)
          this.time.delayedCall(300, () => enemy.active && enemy.clearTint())
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
            for (const enemy of this.getStageEnemies()) {
              const body = enemy.body as Phaser.Physics.Arcade.Body | null
              if (enemy.active && body && Phaser.Geom.Rectangle.Contains(patchRect, enemy.x, enemy.y)) {
                enemy.setVelocityX(body.velocity.x * 0.65)
                damageEnemy(enemy, 0.35 * power, 180)
              }
            }
          },
        })
        this.time.delayedCall(2200, () => {
          timer.remove(false)
          patch.destroy()
        })
        this.statusMessage = 'Freeze Patch deployed. Ice keeps grinding them down.'
        this.playTone(410, 0.1)
        break
      }
      case 'MOLTEN_TRAIL': {
        const trail = this.add.rectangle(this.player.x - this.facingDir * 36, this.player.y + 42, 150 + power * 30, 22, 0xff6b3d, 0.78)
        this.physics.add.existing(trail, true)
        affectFrontEnemies(140 + 20 * power, 90, (enemy) => {
          damageEnemy(enemy, 1.3 * power, 150)
        })
        this.physics.add.overlap(trail, this.enemy, () => {
          if (!this.enemy.active) return
          damageEnemy(this.enemy, 0.7 * power, 180)
        })
        this.physics.add.overlap(trail, this.enemy2, () => {
          if (!this.enemy2.active) return
          damageEnemy(this.enemy2, 0.7 * power, 180)
        })
        this.time.delayedCall(2200, () => trail.destroy())
        this.statusMessage = 'Molten Trail ignited. The ground stays hot.'
        this.playTone(320, 0.09)
        break
      }
      case 'FUSION_WAVE':
        if (!this.speedBoostActive) {
          this.speedBoostActive = true
          this.player.setTint(0xd8f7ff)
          this.player.setMaxVelocity(this.effectiveStats.maxVelocityX + 110 + 20 * power, 900)
          this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 1)
          affectFrontEnemies(190 + 20 * power, 120, (enemy) => {
            damageEnemy(enemy, 1.1 * power, 180)
            enemy.setVelocityX(this.facingDir * (240 + 20 * power))
          })
          this.time.delayedCall(2600, () => {
            this.speedBoostActive = false
            this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
            this.player.clearTint()
          })
        }
        this.statusMessage = 'Fusion Wave boost active. Elements aligned.'
        this.playTone(740, 0.1)
        break
      case 'ABSORB':
        this.damageReductionMul = 0.42
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 1 + Math.floor(power))
        affectFrontEnemies(150 + 10 * power, 120, (enemy) => {
          if (damageEnemy(enemy, 1.05 * power, 180)) {
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 0.4)
          }
        })
        this.time.delayedCall(3000, () => {
          this.damageReductionMul = 1
        })
        this.statusMessage = 'Absorb active. Drain and endure.'
        this.playTone(380, 0.1)
        break
      case 'SOLAR_BIND':
        this.player.setTint(0xf6d3ff)
        this.player.setVelocityY(-520)
        this.player.setVelocityX(this.facingDir * 120)
        this.time.delayedCall(260, () => this.player.setVelocityY(900))
        this.time.delayedCall(480, () => {
          let hits = 0
          affectFrontEnemies(190 + 20 * power, 170, (enemy) => {
            if (damageEnemy(enemy, 2.4 * power, 120)) {
              hits += 1
              enemy.setVelocityY(-220)
            }
          })
          this.player.clearTint()
          this.statusMessage = hits > 0 ? `Chromaforge Crash hit ${hits}!` : 'Chromaforge Crash landed.'
          this.updateUiText()
        })
        this.statusMessage = 'Chromaforge Crash armed!'
        this.playTone(590, 0.1)
        break
      default:
        this.statusMessage = `${this.selectedHero.moves.special.name}: Coming soon`
    }

    this.updateUiText()
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

  private initializeCutscene(): void {
    this.cutsceneLines = [
      'Inspector Glowman: Team, the cave is unstable. Move with care.',
      'Bouldereye: I will clear the path if the rocks collapse.',
      'Electroman: Keep comms open. I can light up anything in the dark.',
      'Micralis: I will scout ahead. Find the Torrent Key Piece, then reach the exit.',
      'Press Space to begin.',
    ]
    this.cutsceneLineIndex = 0
    this.cutsceneActive = true

    this.cutscenePanel = this.add.rectangle(480, 430, 880, 190, 0x071024, 0.78)
    this.cutscenePanel.setStrokeStyle(2, 0x8ab8ff, 0.95)
    this.cutscenePanel.setScrollFactor(0)
    this.cutscenePanel.setDepth(20)

    this.cutsceneText = this.add.text(70, 360, '', {
      color: '#f4f7ff',
      fontSize: '24px',
      fontFamily: 'sans-serif',
      wordWrap: { width: 820 },
      lineSpacing: 8,
    })
    this.cutsceneText.setScrollFactor(0)
    this.cutsceneText.setDepth(21)
    this.cutsceneText.setText(this.cutsceneLines[this.cutsceneLineIndex])
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
    this.cutscenePanel.setVisible(false)
    this.cutsceneText.setVisible(false)
    this.statusMessage = 'Cutscene complete. Go!'
    this.updateUiText()
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 540,
  scene: [
    IntroStoryScene,
    StageSelectScene,
    GameLogScene,
    DungeonMinigameScene,
    MeteorDodgeScene,
    HeroSelectScene,
    Stage1,
    RockyCavernsScene,
    BloodyHillsScene,
    LaserAlleyScene,
    LavaBogScene,
    ForgeOfOriginsScene,
  ],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  render: {
    antialias: false,
    roundPixels: true,
    pixelArt: true,
  },
}

export const startGame = (): Phaser.Game => new Phaser.Game(config)
