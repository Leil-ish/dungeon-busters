import Phaser from 'phaser'

const SPRITE_MANIFEST: Array<[string, string]> = [
  ['hero-bouldereye', 'sprites/Bouldereye.png'],
  ['hero-micralis', 'sprites/Micralis.png'],
  ['hero-electroman', 'sprites/Electroman.png'],
  ['hero-glowman', 'sprites/Inspector%20Glowman.png'],
  ['hero-icemeckel', 'sprites/Icemeckel.png'],
  ['hero-volcano-man', 'sprites/Volcano%20Man.png'],
  ['hero-exemon', 'sprites/Exemon.png'],
  ['hero-swirl-exanimo', 'sprites/Swirl%20Exanimo.png'],
  ['hero-illislim', 'sprites/Illislim.png'],
  ['hero-hurricano-man', 'sprites/Hurricano%20Man.png'],
  ['hero-chromaforge', 'sprites/Chromaforge%20Playable.png'],
  ['enemy-scout', 'sprites/Monster%201.png'],
  ['enemy-laser-warden', 'sprites/Laser%20Warden.png'],
  ['enemy-infix', 'sprites/Infix.png'],
  ['boss-chromaforge', 'sprites/Chromaforge.png'],
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
