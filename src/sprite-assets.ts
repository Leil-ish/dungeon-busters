import Phaser from 'phaser'

const SPRITE_MANIFEST: Array<[string, string]> = [
  ['hero-bouldereye', 'sprites/Bouldereye.png'],
  ['hero-micralis', 'sprites/Micralis.png'],
  ['hero-electroman', 'sprites/Electroman.png'],
  ['hero-glowman', 'sprites/Inspector Glowman.png'],
  ['hero-icemeckel', 'sprites/Icemeckel.png'],
  ['hero-volcano-man', 'sprites/Volcano%20Man.png'],
  ['hero-swirl-exanimo', 'sprites/Swirl Exanimo.png'],
  ['hero-illislim', 'sprites/Illislim.png'],
  ['hero-hurricano-man', 'sprites/Hurricano Man.png'],
  ['enemy-scout', 'sprites/Monster%201.png'],
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
