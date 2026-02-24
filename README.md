# Dungeon Busters (Micah's Game)

A kid-created action platformer built with Phaser 3 + TypeScript.

## Play Goals (v0.1.0)
- Stage 1: Slippery Slopes
- Stage 2: Rocky Caverns
- Stage 3: Bloody Hills
- Stage 4: Laser Alley
- Rescue heroes, clear exits, and progress through stages.

## Controls
- `Left / Right`: Move
- `Up`: Jump
- `Space`: Shoot / advance cutscene text
- `X`: Hero special (implemented for Hurricano Man as Gust Dash)
- `X`: Hero special (baseline implementation for all listed heroes)
- Stage Select: `1`, `2`, `3`
- Stage Select: `4` opens Laser Alley
- Hero Select: `Up/Down`, `Enter`, `Backspace`

## Current Hero System
- Hero Select appears before stage start.
- Stage lock rules: Stage 2 requires Torrent Key Piece, Stage 3 requires Cavern Map Piece.
- Hero lock rules: starts with Micralis/Electroman/Inspector Glowman; rescue heroes unlock as found.
- Micralis is default and balanced.
- Stage affinity multipliers modify effective stats per stage.
- Intro story screen appears before stage select.
- Checkpoints, HP bars, and pickup items (heal + power core) are active in stages 1-3.

## Run Locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run build:pages
```

## GitHub Pages
Deployment workflow is included in `.github/workflows/deploy-pages.yml`.
Push to `main` to deploy.

## Notes
This is an MVP focused on playability and fun. Art, charge attacks, and full super systems are intentionally staged for future updates.
