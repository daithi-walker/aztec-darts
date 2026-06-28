# Features

## Cricket game rules

- **Targets**: 15–20 and Bull (outer + inner). All 21 numbers are on the board; only the 7 Cricket targets score.
- **Marks**: 3 per player per number. Outer Bull = 1 mark, Inner Bull = 2 marks.
- **Scoring**: Once a player reaches 3 marks, further hits on that number score points (face value × overflow) — but only while the opponent has not yet closed it.
- **Closing**: When both players reach 3 marks, the number closes and the block disappears.
- **Win condition**: All Cricket targets closed and leading in points (or tied).
- **Turn structure**: 3 darts per turn, alternating players.

## 3D board

- 20 wedge segments built from a real 3MF model, instanced around the Y axis in standard dartboard order.
- Bull centre loaded from a separate 3MF model.
- Double and triple ring arcs rendered as flat `MeshStandardMaterial` segments with high emissive intensity.
- Number labels projected from 3D world space to DOM overlay each frame — always on the top face of the wedge.
- Closed numbers dim and get a strikethrough.

### Wedge height levels

As both players accumulate marks on a number, the stone block shrinks in 3 levels:

| Shared pips | Block height |
|-------------|-------------|
| 0 | Full (1.0) |
| 1 | 2/3 |
| 2 | 1/3 |
| 3 (closed) | Gone (0) |

The block shrinks from the top; the base stays fixed. Rings track the shrinking top face. Transitions are smoothly lerped. When a score edit triggers `replayAll`, stone heights snap instantly to the correct level with no spring-back animation.

## Flame system

- **GLSL procedural fire**: 2-octave FBM noise on billboard quads, `AdditiveBlending`, bloom via `UnrealBloomPass`.
- **Glow only** (1–2 marks): emissive stone + ring glow, no flame planes. Intensity proportional to mark lead.
- **Full fire** (3 marks, opponent not closed): flame planes visible, intensity 1.0. Colour = scoring player's colour.
- **Burst spike**: on a scoring hit, `flameBurst = 1.0` decays over ~1.5s — spikes flame height and point light.
- **Colour**: always pure P1 blue (`#2288ff`) or P2 orange (`#ffaa00`). No mixing.
- **Bull**: own flame planes + point light, animated with the same logic.
- **Performance**: 4 flame planes per wedge (down from 7); FBM at 2 octaves (down from 4); animation loop pauses when the browser tab is hidden.

## Tap-to-hit

- Raycaster fires against the **actual wedge meshes** (not a fixed-height disc), so hits register on the visible stone surface regardless of camera angle or stone height.
- Number is determined by **which mesh was hit** — not angle calculation — so clicking the side of an adjacent wedge never misregisters.
- Zone (Single / Double / Triple) is determined by the hit point radius; Double/Triple are forced to Single on closed numbers (rings are gone).
- Closed/fully-dropped wedges are excluded from raycast targets entirely.
- Off-board taps do nothing.
- Double-tap snaps camera back to home position.

## Turn bar (top)

- Shows current player name (colour-coded) or winner message.
- Buttons: **Miss**, **Pass** (burns remaining darts), **↩ Undo**, **New Game**, **⌂** (camera home).
- Dart emojis shown above the Last Hit panel on the left.

## Last Hit editor (left panel)

Shows the most recent dart thrown. Fully editable:

- **Number carousel** (‹/›): cycles through `—` (miss), 20, 1, 18, … 5, B (bull), wrapping.
- **Multiplier buttons**: S / D / T for numbers; O / I for bull; hidden when miss selected.
- Any change triggers a full replay of history to recalculate all scores. Stone heights snap immediately — no animation spring-back.

## History & undo

- Every dart is recorded as `{ label, number, multiplier, player, turn, dart }`.
- History panel shows turns newest-first with a running points total per turn.
- Each dart cell in history is a tap-to-edit picker (same carousel + multiplier UI).
- **Undo** (↩) removes the last dart and replays from scratch.

## Player rename

- Tap the P1 (blue) or P2 (orange) label in the Cricket scoreboard header.
- An inline input appears pre-filled with the current name.
- Enter or blur to save; Escape to cancel.
- Name reflects immediately in: top bar status, winner message, scoreboard header.
- Names persist across new games.

## Hit feedback

- A small dot appears at the exact point on the stone surface where the ray hit.
- A label (e.g. `T20`, `D5`, `OB`, `IB`, `3`) fades in above the dot showing the registered zone and number.
- Both fade out over ~0.7s.
- Tap the dot/label colour to confirm the hit was registered correctly.

## Debug overlay

Toggle via the **Debug** checkbox in the footer. Shows on every click:

- Hit coordinates (`x`, `z`) and radius in world units.
- World-space angle (degrees from 12 o'clock, clockwise).
- Detected number, zone, and wedge state (marks per player, closed, dropY).
- Live camera azimuth, elevation, and distance — updates every frame as you orbit.
- **Tap the panel to copy** all stats to clipboard (panel flashes white to confirm).

## Demo scenes

A "Demo Scenes" toggle (bottom centre) reveals preset board states covering the full visual range: Start, First Hit, Accruing, Control, High Flames, Mellow, Closing, Stone Drop, Winner.

## Camera

- Orbit + zoom via `OrbitControls` (mouse/touch).
- **⌂** button or double-tap smoothly lerps back to home position `(0, 6, 8)`.

## Branding

DG — Darth Games · Dave & Garth · ™ 2026 (bottom right).
