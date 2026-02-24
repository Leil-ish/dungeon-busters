import Phaser from 'phaser'

const SPRITE_MANIFEST: Array<[string, string]> = [
  ['hero-micralis', '/sprites/micralis.png'],
  ['hero-electroman', '/sprites/electroman.png'],
  ['hero-glowman', '/sprites/inspector-glowman.png'],
  ['hero-icemeckel', '/sprites/icemeckel.png'],
  ['hero-volcano-man', '/sprites/volcano-man.png'],
  ['hero-swirl-exanimo', '/sprites/swirl-exanimo.png'],
  ['hero-illislim', '/sprites/illislim.png'],
  ['hero-hurricano-man', '/sprites/hurricano-man.png'],
  ['enemy-scout', '/sprites/enemy-scout.png'],
]

export const preloadSpriteAssets = (scene: Phaser.Scene): void => {
  for (const [key, path] of SPRITE_MANIFEST) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, path)
    }
  }
}
