import Phaser from 'phaser'

export type CombatSprite = Phaser.Physics.Arcade.Sprite

export type CombatConfig = {
  maxHp: number
  widthRatio?: number
  heightRatio?: number
  resetHp?: boolean
}

export type DamageResult = {
  applied: boolean
  hp: number
  maxHp: number
  died: boolean
}

export type StompConfig = {
  damage?: number
  hitCooldownMs?: number
  bounceVelocity?: number
  minFallVelocity?: number
  stompWindow?: number
  horizontalInset?: number
}

export function configureCombatant(sprite: CombatSprite, config: CombatConfig): void {
  if (config.resetHp ?? true) {
    sprite.setData('hp', config.maxHp)
    sprite.setData('lastHitAt', 0)
  } else if (typeof sprite.getData('lastHitAt') !== 'number') {
    sprite.setData('lastHitAt', 0)
  }
  sprite.setData('maxHp', config.maxHp)

  const body = sprite.body as Phaser.Physics.Arcade.Body | null
  if (!body) {
    return
  }

  const widthRatio = config.widthRatio ?? 0.7
  const heightRatio = config.heightRatio ?? 0.82
  const bodyWidth = Math.max(8, Math.round(sprite.displayWidth * widthRatio))
  const bodyHeight = Math.max(8, Math.round(sprite.displayHeight * heightRatio))
  body.setSize(bodyWidth, bodyHeight, true)
}

export function getCombatHp(sprite: CombatSprite): number {
  return Number(sprite.getData('hp') ?? 0)
}

export function getCombatMaxHp(sprite: CombatSprite): number {
  return Number(sprite.getData('maxHp') ?? 0)
}

export function applyCombatDamage(
  scene: Phaser.Scene,
  sprite: CombatSprite,
  amount: number,
  hitCooldownMs: number,
): DamageResult {
  const maxHp = getCombatMaxHp(sprite)
  if (!sprite.active || maxHp <= 0) {
    return { applied: false, hp: 0, maxHp, died: false }
  }

  const now = scene.time.now
  const lastHitAt = Number(sprite.getData('lastHitAt') ?? 0)
  if (now - lastHitAt < hitCooldownMs) {
    return { applied: false, hp: getCombatHp(sprite), maxHp, died: false }
  }

  const hp = Math.max(0, getCombatHp(sprite) - amount)
  sprite.setData('lastHitAt', now)
  sprite.setData('hp', hp)

  if (hp <= 0) {
    sprite.disableBody(true, true)
    return { applied: true, hp: 0, maxHp, died: true }
  }

  return { applied: true, hp, maxHp, died: false }
}

export function canStompEnemy(player: CombatSprite, enemy: CombatSprite, config: StompConfig = {}): boolean {
  const playerBody = player.body as Phaser.Physics.Arcade.Body | null
  const enemyBody = enemy.body as Phaser.Physics.Arcade.Body | null
  if (!playerBody || !enemyBody || !player.active || !enemy.active) {
    return false
  }

  const minFallVelocity = config.minFallVelocity ?? 140
  if (playerBody.velocity.y < minFallVelocity) {
    return false
  }

  const playerBounds = player.getBounds()
  const enemyBounds = enemy.getBounds()
  const horizontalInset = config.horizontalInset ?? 10
  const horizontalOverlap =
    playerBounds.right > enemyBounds.left + horizontalInset && playerBounds.left < enemyBounds.right - horizontalInset
  const stompWindow = config.stompWindow ?? Math.max(12, enemy.displayHeight * 0.16)
  const comingFromAbove = playerBounds.bottom <= enemyBounds.centerY + stompWindow

  return horizontalOverlap && comingFromAbove
}

export function bounceAfterStomp(player: CombatSprite, bounceVelocity = -320): void {
  player.setVelocityY(bounceVelocity)
}

export function applyStompDamage(
  scene: Phaser.Scene,
  player: CombatSprite,
  enemy: CombatSprite,
  config: StompConfig = {},
): DamageResult | null {
  if (!canStompEnemy(player, enemy, config)) {
    return null
  }

  bounceAfterStomp(player, config.bounceVelocity ?? -320)
  return applyCombatDamage(scene, enemy, config.damage ?? 2, config.hitCooldownMs ?? 220)
}
