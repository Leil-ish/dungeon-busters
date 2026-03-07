export type StageId =
  | 'SLIPPERY_HILLS'
  | 'ROCKY_CAVERNS'
  | 'LASER_HILLS'
  | 'ZOMBIE_MOUNTAINS'
  | 'LAVA_BOG'
  | 'BLOODY_HILLS'
  | 'FORGE_OF_ORIGINS'

export type HeroId =
  | 'MICRALIS'
  | 'ELECTROMAN'
  | 'INSPECTOR_GLOWMAN'
  | 'ICEMECKEL'
  | 'VOLCANO_MAN'
  | 'SWIRL_EXANIMO'
  | 'ILLISLIM'
  | 'HURRICANO_MAN'
  | 'CHROMAFORGE'

export type HeroAbilityId =
  | 'PHOTON_DASH'
  | 'THUNDER_SLIDE'
  | 'RADIANT_BARRIER'
  | 'FREEZE_PATCH'
  | 'MOLTEN_TRAIL'
  | 'FUSION_WAVE'
  | 'ABSORB'
  | 'GUST_DASH'
  | 'SOLAR_BIND'

export type HeroSuperId =
  | 'OVERDRIVE_CANNON'
  | 'STORM_BURST'
  | 'SOLAR_FLARE'
  | 'GLACIAL_LOCKDOWN'
  | 'VOLCANIC_ERUPTION'
  | 'ELEMENTAL_SPIRAL'
  | 'SLIME_DOMINION'
  | 'HURRICANE_SURGE'
  | 'FORGE_BURST'

export type HeroAffinity = {
  speedMul: number
  damageMul: number
  defenseMul: number
  jumpMul?: number
}

export type HeroTuning = {
  speedMul: number
  jumpMul: number
  damageMul: number
  defenseMul: number
  cooldownMul: number
  shotSpeedMul: number
}

export type MoveDefinition = {
  name: string
  description: string
  implementation: 'implemented' | 'partial' | 'todo'
  notes?: string
}

export type HeroMoveSet = {
  basic: MoveDefinition
  charge: MoveDefinition
  special: MoveDefinition
  super: MoveDefinition
}

export type HeroDefinition = {
  id: HeroId
  displayName: string
  textureKey: string
  specialAbility: HeroAbilityId
  superAbility: HeroSuperId
  tuning: HeroTuning
  affinity: Record<StageId, HeroAffinity>
  moves: HeroMoveSet
}

export type RuntimePlayerStats = {
  moveAcceleration: number
  maxVelocityX: number
  jumpVelocity: number
  shotCooldownMs: number
  shotSpeed: number
  damage: number
  defense: number
}

const makeAffinity = (
  slippery: HeroAffinity,
  rocky: HeroAffinity,
  laser: HeroAffinity,
  zombie: HeroAffinity,
  lava: HeroAffinity,
  bloody: HeroAffinity,
  forge?: HeroAffinity,
): Record<StageId, HeroAffinity> => ({
  SLIPPERY_HILLS: slippery,
  ROCKY_CAVERNS: rocky,
  LASER_HILLS: laser,
  ZOMBIE_MOUNTAINS: zombie,
  LAVA_BOG: lava,
  BLOODY_HILLS: bloody,
  FORGE_OF_ORIGINS: forge ?? { speedMul: 1.0, damageMul: 1.0, defenseMul: 1.0, jumpMul: 1.0 },
})

export const HEROES: Record<HeroId, HeroDefinition> = {
  MICRALIS: {
    id: 'MICRALIS',
    displayName: 'Micralis',
    textureKey: 'hero-micralis',
    specialAbility: 'PHOTON_DASH',
    superAbility: 'OVERDRIVE_CANNON',
    tuning: { speedMul: 1.0, jumpMul: 1.0, damageMul: 1.0, defenseMul: 1.0, cooldownMul: 1.0, shotSpeedMul: 1.0 },
    affinity: makeAffinity(
      { speedMul: 1.04, damageMul: 1.03, defenseMul: 1.02, jumpMul: 1.03 },
      { speedMul: 1.02, damageMul: 1.02, defenseMul: 1.04, jumpMul: 1.01 },
      { speedMul: 1.03, damageMul: 1.04, defenseMul: 1.01, jumpMul: 1.02 },
      { speedMul: 0.99, damageMul: 1.01, defenseMul: 1.04, jumpMul: 1.0 },
      { speedMul: 0.98, damageMul: 0.99, defenseMul: 1.03, jumpMul: 0.99 },
      { speedMul: 1.01, damageMul: 1.03, defenseMul: 1.0, jumpMul: 1.02 },
    ),
    moves: {
      basic: {
        name: 'Laser Slash',
        description: 'Fast short-range laser melee.',
        implementation: 'todo',
      },
      charge: {
        name: 'Beam Shot',
        description: 'Straight medium-range laser beam.',
        implementation: 'todo',
        notes: 'TODO: hook into charge system when added.',
      },
      special: {
        name: 'Photon Dash',
        description: 'Quick forward dash that damages enemies.',
        implementation: 'partial',
        notes: 'TODO: currently mapped to shared dash-style hooks only.',
      },
      super: {
        name: 'Overdrive Cannon',
        description: 'Large forward laser sweep.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  ELECTROMAN: {
    id: 'ELECTROMAN',
    displayName: 'Electroman',
    textureKey: 'hero-electroman',
    specialAbility: 'THUNDER_SLIDE',
    superAbility: 'STORM_BURST',
    tuning: { speedMul: 1.03, jumpMul: 1.01, damageMul: 1.02, defenseMul: 0.96, cooldownMul: 0.95, shotSpeedMul: 1.05 },
    affinity: makeAffinity(
      { speedMul: 1.03, damageMul: 1.02, defenseMul: 0.98, jumpMul: 1.01 },
      { speedMul: 0.9, damageMul: 0.98, defenseMul: 0.96, jumpMul: 0.97 },
      { speedMul: 1.08, damageMul: 1.15, defenseMul: 1.0, jumpMul: 1.03 },
      { speedMul: 0.95, damageMul: 0.96, defenseMul: 0.94, jumpMul: 0.98 },
      { speedMul: 0.97, damageMul: 0.98, defenseMul: 0.95, jumpMul: 0.99 },
      { speedMul: 1.02, damageMul: 1.03, defenseMul: 0.96, jumpMul: 1.0 },
    ),
    moves: {
      basic: {
        name: 'Spark Shot',
        description: 'Small fast electric projectile.',
        implementation: 'implemented',
        notes: 'Reuses current projectile pattern.',
      },
      charge: {
        name: 'Thunder Bolt',
        description: 'Slower, stronger electric projectile.',
        implementation: 'todo',
        notes: 'TODO: add when charge attacks are enabled.',
      },
      special: {
        name: 'Thunder Slide',
        description: 'Electrified dash damaging enemies in path.',
        implementation: 'todo',
      },
      super: {
        name: 'Storm Burst',
        description: 'Lightning strikes across screen.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  INSPECTOR_GLOWMAN: {
    id: 'INSPECTOR_GLOWMAN',
    displayName: 'Inspector Glowman',
    textureKey: 'hero-glowman',
    specialAbility: 'RADIANT_BARRIER',
    superAbility: 'SOLAR_FLARE',
    tuning: { speedMul: 0.97, jumpMul: 0.99, damageMul: 1.0, defenseMul: 1.1, cooldownMul: 1.03, shotSpeedMul: 0.98 },
    affinity: makeAffinity(
      { speedMul: 0.92, damageMul: 0.98, defenseMul: 1.05, jumpMul: 0.96 },
      { speedMul: 1.02, damageMul: 1.0, defenseMul: 1.08, jumpMul: 1.0 },
      { speedMul: 1.05, damageMul: 1.04, defenseMul: 1.15, jumpMul: 1.02 },
      { speedMul: 1.03, damageMul: 1.0, defenseMul: 1.1, jumpMul: 1.01 },
      { speedMul: 0.96, damageMul: 0.95, defenseMul: 1.0, jumpMul: 0.97 },
      { speedMul: 0.99, damageMul: 0.98, defenseMul: 1.06, jumpMul: 1.0 },
    ),
    moves: {
      basic: {
        name: 'Glow Pulse',
        description: 'Short-range light burst.',
        implementation: 'todo',
      },
      charge: {
        name: 'Prism Shot',
        description: 'Piercing light beam through enemies.',
        implementation: 'todo',
      },
      special: {
        name: 'Radiant Barrier',
        description: 'Temporary shield with damage reduction.',
        implementation: 'todo',
      },
      super: {
        name: 'Solar Flare',
        description: 'Screen flash that stuns enemies briefly.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  ICEMECKEL: {
    id: 'ICEMECKEL',
    displayName: 'Icemeckel',
    textureKey: 'hero-icemeckel',
    specialAbility: 'FREEZE_PATCH',
    superAbility: 'GLACIAL_LOCKDOWN',
    tuning: { speedMul: 1.0, jumpMul: 1.02, damageMul: 0.98, defenseMul: 1.05, cooldownMul: 1.0, shotSpeedMul: 0.97 },
    affinity: makeAffinity(
      { speedMul: 1.12, damageMul: 1.08, defenseMul: 1.1, jumpMul: 1.08 },
      { speedMul: 1.0, damageMul: 0.99, defenseMul: 1.02, jumpMul: 1.0 },
      { speedMul: 0.9, damageMul: 0.9, defenseMul: 0.92, jumpMul: 0.95 },
      { speedMul: 1.03, damageMul: 1.0, defenseMul: 1.05, jumpMul: 1.0 },
      { speedMul: 1.12, damageMul: 1.07, defenseMul: 1.1, jumpMul: 1.06 },
      { speedMul: 1.02, damageMul: 1.0, defenseMul: 1.04, jumpMul: 1.01 },
    ),
    moves: {
      basic: {
        name: 'Ice Shard',
        description: 'Straight projectile.',
        implementation: 'todo',
      },
      charge: {
        name: 'Frost Lance',
        description: 'Strong piercing ice shot.',
        implementation: 'todo',
      },
      special: {
        name: 'Freeze Patch',
        description: 'Freezes ground and slows enemies.',
        implementation: 'todo',
      },
      super: {
        name: 'Glacial Lockdown',
        description: 'Freezes enemies briefly.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  VOLCANO_MAN: {
    id: 'VOLCANO_MAN',
    displayName: 'Volcano Man',
    textureKey: 'hero-volcano-man',
    specialAbility: 'MOLTEN_TRAIL',
    superAbility: 'VOLCANIC_ERUPTION',
    tuning: { speedMul: 0.94, jumpMul: 0.96, damageMul: 1.12, defenseMul: 1.03, cooldownMul: 1.05, shotSpeedMul: 0.95 },
    affinity: makeAffinity(
      { speedMul: 0.9, damageMul: 0.95, defenseMul: 0.94, jumpMul: 0.94 },
      { speedMul: 1.01, damageMul: 1.04, defenseMul: 1.03, jumpMul: 0.99 },
      { speedMul: 0.97, damageMul: 1.0, defenseMul: 0.97, jumpMul: 0.97 },
      { speedMul: 0.98, damageMul: 1.03, defenseMul: 1.0, jumpMul: 0.98 },
      { speedMul: 1.2, damageMul: 1.18, defenseMul: 1.12, jumpMul: 1.03 },
      { speedMul: 1.06, damageMul: 1.08, defenseMul: 1.03, jumpMul: 1.0 },
    ),
    moves: {
      basic: {
        name: 'Lava Burst',
        description: 'Short molten projectile.',
        implementation: 'todo',
      },
      charge: {
        name: 'Magma Cannon',
        description: 'Heavy explosive projectile.',
        implementation: 'todo',
      },
      special: {
        name: 'Molten Trail',
        description: 'Leaves damaging lava trail.',
        implementation: 'todo',
      },
      super: {
        name: 'Volcanic Eruption',
        description: 'Area explosion around hero.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  SWIRL_EXANIMO: {
    id: 'SWIRL_EXANIMO',
    displayName: 'Swirl Exanimo',
    textureKey: 'hero-swirl-exanimo',
    specialAbility: 'FUSION_WAVE',
    superAbility: 'ELEMENTAL_SPIRAL',
    tuning: { speedMul: 1.03, jumpMul: 1.04, damageMul: 1.01, defenseMul: 0.99, cooldownMul: 1.18, shotSpeedMul: 1.02 },
    affinity: makeAffinity(
      { speedMul: 1.03, damageMul: 1.02, defenseMul: 0.99, jumpMul: 1.03 },
      { speedMul: 1.02, damageMul: 1.01, defenseMul: 1.0, jumpMul: 1.02 },
      { speedMul: 1.04, damageMul: 1.03, defenseMul: 0.99, jumpMul: 1.03 },
      { speedMul: 1.05, damageMul: 1.02, defenseMul: 1.0, jumpMul: 1.05 },
      { speedMul: 1.02, damageMul: 1.03, defenseMul: 0.99, jumpMul: 1.01 },
      { speedMul: 1.04, damageMul: 1.03, defenseMul: 1.0, jumpMul: 1.03 },
    ),
    moves: {
      basic: {
        name: 'Swirl Shot',
        description: 'Rotating projectile cycling elements.',
        implementation: 'todo',
      },
      charge: {
        name: 'Swirl Shot (Charged)',
        description: 'Amplified rotating elemental projectile.',
        implementation: 'todo',
      },
      special: {
        name: 'Fusion Wave',
        description: 'Temporarily buffs stats / blends elemental effects.',
        implementation: 'todo',
      },
      super: {
        name: 'Elemental Spiral',
        description: 'Multi-element tornado damage.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  ILLISLIM: {
    id: 'ILLISLIM',
    displayName: 'Illislim',
    textureKey: 'hero-illislim',
    specialAbility: 'ABSORB',
    superAbility: 'SLIME_DOMINION',
    tuning: { speedMul: 0.98, jumpMul: 0.98, damageMul: 0.9, defenseMul: 1.12, cooldownMul: 1.03, shotSpeedMul: 0.96 },
    affinity: makeAffinity(
      { speedMul: 1.0, damageMul: 0.95, defenseMul: 1.08, jumpMul: 0.99 },
      { speedMul: 0.99, damageMul: 0.95, defenseMul: 1.1, jumpMul: 0.98 },
      { speedMul: 0.97, damageMul: 0.92, defenseMul: 1.08, jumpMul: 0.97 },
      { speedMul: 1.01, damageMul: 0.95, defenseMul: 1.11, jumpMul: 1.0 },
      { speedMul: 0.98, damageMul: 0.93, defenseMul: 1.09, jumpMul: 0.98 },
      { speedMul: 1.0, damageMul: 0.94, defenseMul: 1.1, jumpMul: 0.99 },
    ),
    moves: {
      basic: {
        name: 'Slime Glob',
        description: 'Projectile that slows enemies.',
        implementation: 'todo',
      },
      charge: {
        name: 'Elastic Whip',
        description: 'Extended melee reach attack.',
        implementation: 'todo',
      },
      special: {
        name: 'Absorb',
        description: 'Temporarily reduces damage from last hit type.',
        implementation: 'todo',
      },
      super: {
        name: 'Slime Dominion',
        description: 'Buffs team stats / slows enemies.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  HURRICANO_MAN: {
    id: 'HURRICANO_MAN',
    displayName: 'Hurricano Man',
    textureKey: 'hero-hurricano-man',
    specialAbility: 'GUST_DASH',
    superAbility: 'HURRICANE_SURGE',
    tuning: { speedMul: 1.06, jumpMul: 1.06, damageMul: 0.95, defenseMul: 0.92, cooldownMul: 0.93, shotSpeedMul: 1.08 },
    affinity: makeAffinity(
      { speedMul: 1.12, damageMul: 1.01, defenseMul: 0.95, jumpMul: 1.12 },
      { speedMul: 0.9, damageMul: 0.95, defenseMul: 0.9, jumpMul: 0.92 },
      { speedMul: 1.06, damageMul: 0.99, defenseMul: 0.93, jumpMul: 1.04 },
      { speedMul: 1.12, damageMul: 1.04, defenseMul: 0.96, jumpMul: 1.12 },
      { speedMul: 0.95, damageMul: 0.94, defenseMul: 0.89, jumpMul: 0.96 },
      { speedMul: 1.1, damageMul: 1.02, defenseMul: 0.93, jumpMul: 1.08 },
    ),
    moves: {
      basic: {
        name: 'Gust Shot',
        description: 'Wind projectile with knockback.',
        implementation: 'partial',
        notes: 'Currently reuses generic projectile; TODO add stronger knockback profile.',
      },
      charge: {
        name: 'Cyclone Toss',
        description: 'Larger knockback projectile.',
        implementation: 'todo',
        notes: 'TODO: add when charge system exists.',
      },
      special: {
        name: 'Gust Dash',
        description: 'High-speed dash with minor enemy push.',
        implementation: 'implemented',
      },
      super: {
        name: 'Hurricane Surge',
        description: 'Surrounding wind field pushing enemies away.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
  CHROMAFORGE: {
    id: 'CHROMAFORGE',
    displayName: 'Chromaforge',
    textureKey: 'hero-chromaforge',
    specialAbility: 'SOLAR_BIND',
    superAbility: 'FORGE_BURST',
    tuning: { speedMul: 1.08, jumpMul: 1.06, damageMul: 1.12, defenseMul: 1.05, cooldownMul: 0.92, shotSpeedMul: 1.1 },
    affinity: makeAffinity(
      { speedMul: 1.02, damageMul: 1.02, defenseMul: 1.03, jumpMul: 1.02 },
      { speedMul: 1.03, damageMul: 1.02, defenseMul: 1.02, jumpMul: 1.02 },
      { speedMul: 1.04, damageMul: 1.04, defenseMul: 1.01, jumpMul: 1.03 },
      { speedMul: 1.03, damageMul: 1.03, defenseMul: 1.02, jumpMul: 1.03 },
      { speedMul: 1.08, damageMul: 1.1, defenseMul: 1.06, jumpMul: 1.05 },
      { speedMul: 1.05, damageMul: 1.06, defenseMul: 1.04, jumpMul: 1.04 },
      { speedMul: 1.2, damageMul: 1.18, defenseMul: 1.12, jumpMul: 1.12 },
    ),
    moves: {
      basic: {
        name: 'Triple Spectrum Shot',
        description: 'Fires three beams: straight, up-angle, down-angle.',
        implementation: 'implemented',
      },
      charge: {
        name: 'Forge Melee Combo',
        description: 'Punch combo and forward kick lunge.',
        implementation: 'partial',
      },
      special: {
        name: 'Solar Bind',
        description: 'Energy pulse that stuns enemies briefly.',
        implementation: 'implemented',
      },
      super: {
        name: 'Forge Burst',
        description: 'Large circular energy explosion.',
        implementation: 'todo',
        notes: 'TODO: super system not implemented yet.',
      },
    },
  },
}

export const DEFAULT_HERO_ID: HeroId = 'MICRALIS'

export const computeEffectivePlayerStats = (
  heroId: HeroId,
  stageId: StageId,
  base: RuntimePlayerStats,
): RuntimePlayerStats => {
  const hero = HEROES[heroId]
  const affinity = hero.affinity[stageId]
  const jumpMul = affinity.jumpMul ?? 1

  return {
    moveAcceleration: base.moveAcceleration * hero.tuning.speedMul * affinity.speedMul,
    maxVelocityX: base.maxVelocityX * hero.tuning.speedMul * affinity.speedMul,
    jumpVelocity: base.jumpVelocity * hero.tuning.jumpMul * jumpMul,
    shotCooldownMs: base.shotCooldownMs * hero.tuning.cooldownMul,
    shotSpeed: base.shotSpeed * hero.tuning.shotSpeedMul * affinity.speedMul,
    damage: base.damage * hero.tuning.damageMul * affinity.damageMul,
    defense: base.defense * hero.tuning.defenseMul * affinity.defenseMul,
  }
}
