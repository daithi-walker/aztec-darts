# Darth Games (DG) — Dave & Garth ™ 2026

A 3D Cricket darts game running in the browser. Aztec stone aesthetic, procedural fire shaders, full Cricket scoring rules, tap-to-hit board interaction, and an editable throw history.

## Tech stack

- **Three.js r0.169** — 3D rendering, post-processing bloom, GLSL procedural fire shaders
- **3MF geometry** — real wedge and bull models loaded via `ThreeMFLoader`
- **No build step** — single `index.html` entry point, game logic in `src/game.js`

## Run locally

```bash
npm run serve
# or
python3 -m http.server 9977 --bind 0.0.0.0
```

Then open [http://localhost:9977](http://localhost:9977).

The models load over HTTP — `file://` does not work.

## Tests

```bash
npm test
```

Uses Node's built-in test runner (`node:test`). No dependencies to install.

## Docs

- [docs/FEATURES.md](docs/FEATURES.md) — full feature reference
