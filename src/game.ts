import Phaser from 'phaser'
import { BloodyHillsScene } from './bloody-hills'
import {
  DEFAULT_HERO_ID,
  HEROES,
  type HeroDefinition,
  type HeroId,
  computeEffectivePlayerStats,
} from './heroes'
import { gameProgress } from './progress'
import { RockyCavernsScene } from './rocky-caverns'
import { StageSelectScene } from './stage-select'
import { HeroSelectScene } from './hero-select'

class Stage1 extends Phaser.Scene {
  private readonly LEVEL_W = 2400
  private readonly LEVEL_H = 900
  private player!: Phaser.Physics.Arcade.Sprite
  private enemy!: Phaser.Physics.Arcade.Sprite
  private enemy2!: Phaser.Physics.Arcade.Sprite
  private shots!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private slipperyZones: Phaser.Geom.Rectangle[] = []
  private staticPlatforms: Phaser.GameObjects.Rectangle[] = []
  private keyPiece: Phaser.GameObjects.Rectangle | null = null
  private exitDoor!: Phaser.GameObjects.Rectangle
  private uiText!: Phaser.GameObjects.Text
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
  private playerHasKey = false
  private stageClearTriggered = false
  private statusMessage = 'Find the Torrent Key Piece.'
  private readonly stageName = 'Stage 1: Slippery Hills'

  private readonly normalDragX = 900
  private readonly slipperyDragX = 180
  private readonly normalMaxVelocityX = 260
  private readonly slipperyMaxVelocityX = 320
  private readonly moveAcceleration = 900
  private readonly playerSpawnX = 140
  private readonly playerSpawnY = 680
  private readonly enemyPatrolMinX = 640
  private readonly enemyPatrolMaxX = 900
  private readonly enemyPatrolSpeed = 90
  private readonly enemy2PatrolMinX = 2270
  private readonly enemy2PatrolMaxX = 2370
  private readonly enemy2PatrolSpeed = 70
  private readonly hitInvulnerabilityMs = 1000
  private readonly shotCooldownMs = 220
  private readonly shotSpeed = 520
  private isPlayerInvulnerable = false
  private facingDir = 1
  private lastShotAt = 0

  constructor() {
    super('stage1')
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
    gfx.generateTexture('hurricano-man', 20, 60)
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
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, heroTexture)
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(1200)
    this.player.setDragX(this.normalDragX)
    this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)

    this.physics.add.collider(this.player, this.staticPlatforms)

    this.enemy = this.physics.add.sprite(this.enemyPatrolMaxX, 698, 'enemy-block')
    this.enemy.setCollideWorldBounds(true)
    this.enemy.setImmovable(true)
    ;(this.enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy.setVelocityX(-this.enemyPatrolSpeed)

    this.physics.add.collider(this.enemy, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy, () => this.handleEnemyHit())

    this.enemy2 = this.physics.add.sprite(this.enemy2PatrolMaxX, 316, 'enemy-block')
    this.enemy2.setCollideWorldBounds(true)
    this.enemy2.setImmovable(true)
    ;(this.enemy2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
    this.enemy2.setVelocityX(-this.enemy2PatrolSpeed)
    this.physics.add.collider(this.enemy2, this.staticPlatforms)
    this.physics.add.overlap(this.player, this.enemy2, () => this.handleEnemyHit())

    this.shots = this.physics.add.group({
      allowGravity: false,
      maxSize: 10,
    })
    this.physics.add.collider(this.shots, this.staticPlatforms, (shotObj) => {
      const shot = shotObj as Phaser.Physics.Arcade.Image
      shot.disableBody(true, true)
    })
    this.physics.add.overlap(this.shots, this.enemy, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.shots, this.enemy2, (shotObj, enemyObj) => {
      this.handleEnemyShot(shotObj as Phaser.Physics.Arcade.Image, enemyObj as Phaser.Physics.Arcade.Sprite)
    })

    this.slipperyZones = [
      this.createSlipperyZone(520, worldHeight - 170, 260, 180),
      this.createSlipperyZone(1080, worldHeight - 170, 320, 180),
      this.createSlipperyZone(1990, 640, 360, 240),
    ]

    this.keyPiece = this.add.rectangle(2310, 300, 26, 26, 0xffd84f)
    this.physics.add.existing(this.keyPiece, true)

    this.exitDoor = this.add.rectangle(worldWidth - 120, worldHeight - 150, 54, 140, 0x7e5cff)
    this.physics.add.existing(this.exitDoor, true)

    this.physics.add.overlap(this.player, this.keyPiece, () => {
      if (!this.keyPiece || this.playerHasKey) {
        return
      }

      this.playerHasKey = true
      gameProgress.torrentKeyPiece = true
      this.keyPiece.destroy()
      this.keyPiece = null
      this.statusMessage = 'Torrent Key Piece collected.'
      this.updateUiText()
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)

    this.uiText = this.add.text(16, 16, '', {
      color: '#f3f6ff',
      fontSize: '18px',
      fontFamily: 'sans-serif',
      backgroundColor: '#0a1020cc',
      padding: { x: 10, y: 8 },
    })
    this.uiText.setScrollFactor(0)
    this.uiText.setDepth(10)
    this.updateUiText()

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.initializeCutscene()
  }

  update(): void {
    this.waterfallBackdrop.tilePositionY += 0.45

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
      this.player.setMaxVelocity(this.effectiveStats.maxVelocityX * (this.slipperyMaxVelocityX / this.normalMaxVelocityX), 900)
    } else {
      this.player.setDragX(this.normalDragX)
      this.player.setMaxVelocity(this.effectiveStats.maxVelocityX, 900)
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

  private updateUiText(): void {
    this.uiText.setText(
      `Dungeon Busters\n${this.stageName}\nHero: ${this.heroName}\nTorrent Key Piece: ${this.playerHasKey ? 'Yes' : 'No'}\n${this.statusMessage}`,
    )
  }

  private handleEnemyHit(): void {
    if (this.isPlayerInvulnerable) {
      return
    }

    this.isPlayerInvulnerable = true
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY)
    this.player.setVelocity(0, 0)
    this.player.setAccelerationX(0)
    this.player.setTint(0xff9f9f)
    this.statusMessage = 'Oof! Try again.'
    this.updateUiText()

    const defenseScale = Phaser.Math.Clamp(this.effectiveStats.defense, 0.85, 1.2)
    const invulnMs = this.hitInvulnerabilityMs * defenseScale
    this.time.delayedCall(invulnMs, () => {
      this.isPlayerInvulnerable = false
      this.player.clearTint()
    })
  }

  private fireShot(): void {
    const now = this.time.now
    if (now - this.lastShotAt < this.effectiveStats.shotCooldownMs) {
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
    enemy.disableBody(true, true)
    this.statusMessage = 'Enemy down!'
    this.updateUiText()
  }

  private get heroName(): string {
    return this.selectedHero?.displayName ?? 'Micralis'
  }

  private tryUseHeroAbility(): void {
    if (this.selectedHero.specialAbility !== 'GUST_DASH') {
      this.statusMessage = `${this.selectedHero.moves.special.name}: Coming soon`
      this.updateUiText()
      return
    }

    const now = this.time.now
    if (now - this.lastAbilityAt < this.abilityCooldownMs) {
      return
    }

    this.lastAbilityAt = now
    this.player.setVelocityX(this.facingDir * (this.effectiveStats.maxVelocityX + 260))
    const enemies = [this.enemy, this.enemy2]
    for (const enemy of enemies) {
      if (!enemy.active) {
        continue
      }

      const dx = enemy.x - this.player.x
      const inFront = this.facingDir > 0 ? dx >= 0 : dx <= 0
      if (inFront && Math.abs(dx) < 180) {
        enemy.setVelocityX(this.facingDir * 180)
      }
    }

    this.statusMessage = 'Gust Dash!'
    this.updateUiText()
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
  scene: [StageSelectScene, HeroSelectScene, Stage1, RockyCavernsScene, BloodyHillsScene],
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
  },
}

export const startGame = (): Phaser.Game => new Phaser.Game(config)
