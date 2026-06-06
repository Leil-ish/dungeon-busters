import Phaser from 'phaser'
import { gameProgress, saveGameProgress } from './progress'

type PipeShopOptions = {
  stageKey: string
  roomTitle: string
  player: Phaser.Physics.Arcade.Sprite
  pipeX: number
  pipeY: number
  roomX: number
  roomY: number
  unlockMessage: string
  returnMessage: string
  isUnlocked: () => boolean
  setStatus: (message: string) => void
  updateUi: () => void
  heal: (amount: number) => void
  boostPower: () => void
  boostSpeed: () => void
  boostDefense: () => void
  addLife: () => void
  playTone?: (freq: number, durationSec?: number) => void
}

type ShopItem = {
  id: string
  name: string
  price: number
  description: string
  buyMessage: string
  apply: () => void
}

export class PipeShop {
  private readonly scene: Phaser.Scene
  private readonly options: PipeShopOptions
  private readonly roomObjects: Phaser.GameObjects.GameObject[] = []
  private readonly coinPickups: Phaser.GameObjects.Arc[] = []
  private pipeBase!: Phaser.GameObjects.Rectangle
  private pipeTop!: Phaser.GameObjects.Rectangle
  private exitPipe!: Phaser.GameObjects.Rectangle
  private shopZone!: Phaser.GameObjects.Zone
  private shopText!: Phaser.GameObjects.Text
  private itemKeys: Phaser.Input.Keyboard.Key[] = []
  private revealed = false
  private insideRoom = false

  constructor(scene: Phaser.Scene, options: PipeShopOptions) {
    this.scene = scene
    this.options = options
    this.create()
  }

  update(isSquatting: boolean, buyPressed: boolean): boolean {
    this.revealIfReady()
    if (isSquatting) {
      this.tryEnter()
      this.tryExit()
    }
    if (this.insideRoom && this.scene.physics.overlap(this.options.player, this.shopZone)) {
      this.options.setStatus('Secret shop: press 1-5 to choose an item.')
      this.refreshShopText()
      this.options.updateUi()
      const chosenItem = this.getChosenItem()
      if (chosenItem) {
        this.buyItem(chosenItem)
        return true
      }
      return buyPressed
    }
    return false
  }

  private create(): void {
    this.pipeBase = this.scene.add.rectangle(this.options.pipeX, this.options.pipeY, 54, 58, 0x21b45b, 0.08)
    this.pipeTop = this.scene.add.rectangle(this.options.pipeX, this.options.pipeY - 34, 78, 22, 0x39e57b, 0.08)
    this.scene.physics.add.existing(this.pipeBase, true)
    this.scene.physics.add.existing(this.pipeTop, true)
    this.scene.add
      .text(this.options.pipeX, this.options.pipeY + 42, 'Hidden Pipe', {
        color: '#bfffd3',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        backgroundColor: '#071024aa',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setAlpha(0.14)

    const roomPlatforms = [
      this.createRoomPlatform(this.options.roomX, this.options.roomY + 170, 720, 26, 0x284a5d),
      this.createRoomPlatform(this.options.roomX - 360, this.options.roomY + 70, 28, 220, 0x1d3345),
      this.createRoomPlatform(this.options.roomX + 360, this.options.roomY + 70, 28, 220, 0x1d3345),
      this.createRoomPlatform(this.options.roomX, this.options.roomY - 44, 720, 26, 0x1d3345),
    ]
    this.scene.physics.add.collider(this.options.player, roomPlatforms)

    this.roomObjects.push(this.scene.add.rectangle(this.options.roomX - 120, this.options.roomY + 64, 450, 210, 0x071024, 0.72))
    this.roomObjects.push(this.scene.add.rectangle(this.options.roomX + 248, this.options.roomY + 64, 250, 210, 0x170b22, 0.82))
    this.roomObjects.push(this.scene.add.rectangle(this.options.roomX + 116, this.options.roomY + 64, 8, 194, 0xffd166, 0.75))
    this.roomObjects.push(
      this.scene.add.text(this.options.roomX - 332, this.options.roomY - 18, `${this.options.roomTitle}: Coin Vault`, {
        color: '#fff4d1',
        fontFamily: 'sans-serif',
        fontSize: '18px',
        backgroundColor: '#071024aa',
        padding: { x: 6, y: 3 },
      }),
    )

    this.exitPipe = this.scene.add.rectangle(this.options.roomX - 196, this.options.roomY + 132, 52, 58, 0x21b45b, 0.95)
    const exitTop = this.scene.add.rectangle(this.options.roomX - 196, this.options.roomY + 98, 76, 22, 0x39e57b, 0.95)
    this.roomObjects.push(this.exitPipe, exitTop)
    this.scene.physics.add.existing(this.exitPipe, true)
    this.scene.physics.add.existing(exitTop, true)
    this.roomObjects.push(
      this.scene.add
        .text(this.options.roomX - 196, this.options.roomY + 174, 'Squat to exit', {
          color: '#bfffd3',
          fontFamily: 'sans-serif',
          fontSize: '12px',
          backgroundColor: '#071024cc',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5),
    )

    this.createCoins()
    this.createShop()
    this.createShopKeys()
    this.setRoomVisible(false)
  }

  private createRoomPlatform(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    color: number,
  ): Phaser.GameObjects.Rectangle {
    const platform = this.scene.add.rectangle(centerX, centerY, width, height, color)
    this.scene.physics.add.existing(platform, true)
    this.roomObjects.push(platform)
    return platform
  }

  private createCoins(): void {
    if (this.isFlagSet('coins')) {
      return
    }
    const positions: Array<[number, number]> = [
      [this.options.roomX - 286, this.options.roomY + 92],
      [this.options.roomX - 246, this.options.roomY + 62],
      [this.options.roomX - 206, this.options.roomY + 92],
      [this.options.roomX - 166, this.options.roomY + 62],
      [this.options.roomX - 126, this.options.roomY + 92],
      [this.options.roomX - 86, this.options.roomY + 62],
      [this.options.roomX - 46, this.options.roomY + 92],
      [this.options.roomX - 6, this.options.roomY + 62],
      [this.options.roomX - 266, this.options.roomY + 124],
      [this.options.roomX - 226, this.options.roomY + 124],
      [this.options.roomX - 186, this.options.roomY + 124],
      [this.options.roomX - 146, this.options.roomY + 124],
      [this.options.roomX - 106, this.options.roomY + 124],
      [this.options.roomX - 66, this.options.roomY + 124],
      [this.options.roomX - 26, this.options.roomY + 124],
      [this.options.roomX + 14, this.options.roomY + 124],
    ]
    positions.forEach(([x, y]) => {
      const coin = this.scene.add.circle(x, y, 11, 0xffd84f, 1)
      coin.setStrokeStyle(2, 0xfff0a8, 1)
      this.roomObjects.push(coin)
      this.coinPickups.push(coin)
      this.scene.physics.add.existing(coin, true)
      this.scene.physics.add.overlap(this.options.player, coin, () => this.collectCoin(coin))
    })
  }

  private createShop(): void {
    const shopX = this.options.roomX + 248
    const shopY = this.options.roomY + 122
    const shopBody = this.scene.add.rectangle(shopX, shopY, 96, 84, 0x4b2b68, 0.96)
    const shopSign = this.scene.add.rectangle(shopX, shopY - 52, 118, 24, 0xffd166, 0.95)
    const shopTitle = this.scene.add
      .text(shopX, shopY - 60, 'ITEM SHOP', {
        color: '#231528',
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        fixedWidth: 118,
        align: 'center',
      })
      .setOrigin(0.5, 0)
    this.roomObjects.push(shopBody, shopSign, shopTitle)
    this.shopText = this.scene.add.text(shopX - 104, shopY - 38, '', {
      color: '#f6f8ff',
      fontFamily: 'sans-serif',
      fontSize: '11px',
      lineSpacing: 3,
      backgroundColor: '#071024cc',
      padding: { x: 6, y: 4 },
      fixedWidth: 208,
    })
    this.roomObjects.push(this.shopText)
    this.shopZone = this.scene.add.zone(shopX, shopY, 218, 138)
    this.scene.physics.add.existing(this.shopZone, true)
    this.refreshShopText()
  }

  private createShopKeys(): void {
    const keyboard = this.scene.input.keyboard
    if (!keyboard) return
    this.itemKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
    ]
  }

  private collectCoin(coin: Phaser.GameObjects.Arc): void {
    if (!coin.active) return
    coin.destroy()
    const index = this.coinPickups.indexOf(coin)
    if (index >= 0) this.coinPickups.splice(index, 1)
    gameProgress.coins += 1
    if (this.coinPickups.length === 0) this.setFlag('coins')
    saveGameProgress()
    this.options.setStatus(`Coin found! Coins: ${gameProgress.coins}`)
    this.options.playTone?.(780, 0.06)
    this.refreshShopText()
    this.options.updateUi()
  }

  private revealIfReady(): void {
    if (this.revealed || !this.options.isUnlocked()) return
    this.revealed = true
    this.pipeBase.setAlpha(0.95)
    this.pipeTop.setAlpha(0.95)
    this.options.setStatus(this.options.unlockMessage)
    this.options.playTone?.(680, 0.12)
    this.options.updateUi()
  }

  private tryEnter(): void {
    if (!this.revealed || this.insideRoom) return
    const nearPipe =
      Math.abs(this.options.player.x - this.options.pipeX) <= 76 &&
      Math.abs(this.options.player.y - (this.options.pipeY - 30)) <= 128
    if (!nearPipe) return
    this.insideRoom = true
    this.setRoomVisible(true)
    this.options.player.setPosition(this.options.roomX - 196, this.options.roomY + 72)
    this.options.player.setVelocity(0, 0)
    this.options.setStatus('You squatted into a secret pipe room!')
    this.options.playTone?.(520, 0.12)
    this.options.updateUi()
  }

  private tryExit(): void {
    if (!this.insideRoom || !this.scene.physics.overlap(this.options.player, this.exitPipe)) return
    this.insideRoom = false
    this.setRoomVisible(false)
    this.options.player.setPosition(this.options.pipeX + 86, this.options.pipeY - 64)
    this.options.player.setVelocity(0, 0)
    this.options.setStatus(this.options.returnMessage)
    this.options.playTone?.(420, 0.1)
    this.options.updateUi()
  }

  private getShopItems(): ShopItem[] {
    return [
      {
        id: 'health',
        name: 'Snack Pack',
        price: 1,
        description: '+4 HP',
        buyMessage: 'Bought Snack Pack. Big heal!',
        apply: () => this.options.heal(4),
      },
      {
        id: 'power',
        name: 'Power Fizzy',
        price: 2,
        description: 'stronger specials',
        buyMessage: 'Bought Power Fizzy. Specials hit harder!',
        apply: () => this.options.boostPower(),
      },
      {
        id: 'speed',
        name: 'Speed Boots',
        price: 2,
        description: 'faster movement',
        buyMessage: 'Bought Speed Boots. You move faster!',
        apply: () => this.options.boostSpeed(),
      },
      {
        id: 'shield',
        name: 'Shield Patch',
        price: 2,
        description: 'take less damage',
        buyMessage: 'Bought Shield Patch. Damage reduced!',
        apply: () => this.options.boostDefense(),
      },
      {
        id: 'life',
        name: 'Bonus Life',
        price: 3,
        description: '+1 life',
        buyMessage: 'Bought Bonus Life. Extra safety!',
        apply: () => this.options.addLife(),
      },
    ]
  }

  private getChosenItem(): ShopItem | null {
    const items = this.getShopItems()
    for (let i = 0; i < this.itemKeys.length && i < items.length; i += 1) {
      if (Phaser.Input.Keyboard.JustDown(this.itemKeys[i])) {
        return items[i]
      }
    }
    return null
  }

  private buyItem(item: ShopItem): void {
    if (this.isFlagSet(item.id)) {
      this.options.setStatus(`${item.name} is sold out.`)
      this.options.playTone?.(180, 0.08)
      this.options.updateUi()
      return
    }
    if (gameProgress.coins < item.price) {
      this.options.setStatus(`${item.name} costs ${item.price} coins.`)
      this.options.playTone?.(180, 0.08)
      this.options.updateUi()
      return
    }
    gameProgress.coins -= item.price
    this.setFlag(item.id)
    item.apply()
    this.options.setStatus(item.buyMessage)
    this.finishShopPurchase()
  }

  private finishShopPurchase(): void {
    saveGameProgress()
    this.refreshShopText()
    this.options.playTone?.(920, 0.09)
    this.options.updateUi()
  }

  private refreshShopText(): void {
    if (!this.shopText) return
    const itemLines = this.getShopItems().map((item, index) => {
      const status = this.isFlagSet(item.id) ? 'sold' : `${item.price}c`
      return `${index + 1}. ${item.name} ${status} - ${item.description}`
    })
    this.shopText.setText(`Coins: ${gameProgress.coins}\n${itemLines.join('\n')}`)
  }

  private setRoomVisible(visible: boolean): void {
    for (const obj of this.roomObjects) {
      ;(obj as Phaser.GameObjects.GameObject & { setVisible?: (value: boolean) => void }).setVisible?.(visible)
      const body = (obj as Phaser.GameObjects.GameObject & { body?: { enable: boolean } }).body
      if (body) body.enable = visible
    }
    const shopBody = (this.shopZone as Phaser.GameObjects.Zone & { body?: { enable: boolean } }).body
    if (shopBody) shopBody.enable = visible
  }

  private flagKey(kind: string): string {
    return `pipe-shop:${this.options.stageKey}:${kind}`
  }

  private isFlagSet(kind: string): boolean {
    return gameProgress.clearedMinigames[this.flagKey(kind)] === true
  }

  private setFlag(kind: string): void {
    gameProgress.clearedMinigames[this.flagKey(kind)] = true
  }
}
