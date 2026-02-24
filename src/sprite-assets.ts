import Phaser from 'phaser'

const SPRITE_MANIFEST: Array<[string, string]> = [
  ['hero-bouldereye', 'sprites/Bouldereye.png'],
  ['hero-micralis', 'sprites/Micralis.png'],
  ['hero-electroman', 'sprites/Electroman.png'],
  ['hero-glowman', 'sprites/inspector-glowman.png'],
  ['hero-icemeckel', 'sprites/Icemeckel.png'],
  ['hero-volcano-man', 'sprites/volcano-man.png'],
  ['hero-swirl-exanimo', 'sprites/swirl-exanimo.png'],
  ['hero-illislim', 'sprites/Illislim.png'],
  ['hero-hurricano-man', 'sprites/hurricano-man.png'],
  ['enemy-scout', 'sprites/Bouldereye.png'],
]

export const preloadSpriteAssets = (scene: Phaser.Scene): void => {
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    // Helps debug missing sprite files in development.
    console.warn(`[sprites] failed to load: ${file.src}`)
  })

  for (const [key, path] of SPRITE_MANIFEST) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `${import.meta.env.BASE_URL}${path}`)
    }
  }
}
