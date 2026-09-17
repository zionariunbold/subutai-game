# Сүбээдэйн бүслэлт — Next.js

Next.js App Router + React + TypeScript UI + Canvas 2D game engine.
No API keys, backend or paid services required.

## Run

Install Node.js 22 LTS or newer, then from this directory:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production

```bash
npm run typecheck
npm run build
npm start
```

Deploy to Vercel by importing the project and using the Next.js preset.

## Source map

- `app/page.tsx`: home route
- `app/layout.tsx`: document and metadata
- `app/globals.css`: responsive styling
- `components/SiegeGame.tsx`: client component, UI and engine lifecycle
- `lib/game.js`: Canvas drawing, enemies, arrows, collisions, waves and audio

The game engine remains JavaScript; the Next.js UI uses TypeScript. The component mounts the engine in useEffect and cleans up animation frames, listeners, timers and audio on unmount, including development Strict Mode remounts.

## Controls

WASD / arrow keys: move. Hold mouse button: fire. Space: dash. P: pause. Enter: start/restart. Touch controls are available on narrow screens.

Defeat three waves and destroy the central gate to win. Green pickups restore health. Sound is optional.
"# subutai-game" 
