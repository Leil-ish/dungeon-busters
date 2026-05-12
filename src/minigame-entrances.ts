import Phaser from 'phaser'
import { drawMinigameShape, getStageMinigames, isMinigameCleared } from './minigame-registry'

type EntranceOptions = {
  stageKey: string
  player: Phaser.Physics.Arcade.Sprite
  returnScene: string
  setStatus: (message: string) => void
}

export function addMinigameEntrances(scene: Phaser.Scene, options: EntranceOptions): void {
  const interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
  let activePrompt = ''
  let launching = false
  for (const minigame of getStageMinigames(options.stageKey)) {
    const cleared = isMinigameCleared(minigame.id)
    const stroke = cleared ? 0x4cc8ff : 0xff5757
    drawMinigameShape(scene, minigame.x, minigame.y, minigame.kind, stroke)
    scene.add
      .text(minigame.x, minigame.y + 58, minigame.shortLabel, {
        color: '#f3f6ff',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        backgroundColor: '#0a1020cc',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)

    const zone = scene.add.zone(minigame.x, minigame.y + 8, 118, 112)
    scene.physics.add.existing(zone, true)
    scene.physics.add.overlap(options.player, zone, () => {
      const prompt = cleared
        ? `${minigame.shortLabel}: press E to replay. Cleared`
        : `${minigame.shortLabel}: press E to enter. Uncleared`
      if (activePrompt !== prompt) {
        activePrompt = prompt
        options.setStatus(prompt)
      }
      if (!launching && Phaser.Input.Keyboard.JustDown(interactKey)) {
        launching = true
        scene.scene.start('dungeon-minigame', {
          minigameId: minigame.id,
          returnScene: options.returnScene,
          returnX: Math.max(80, minigame.x - 70),
          returnY: Math.max(100, minigame.y - 70),
          returnMessage: `${minigame.shortLabel} finished. Back in the dungeon.`,
        })
      }
    })
  }
}
