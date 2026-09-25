# Interactive Analog Clock

A live analog clock built entirely from HTML5 Canvas 2D primitives (arcs, lines, text) —
no clock image is used anywhere. Built for the Computer Graphics Lab, Assignment 1 (25 marks).

## 1. Project Purpose

Demonstrates core 2D computer graphics concepts:
- drawing with primitives and coordinate placement
- real-time animation driven by system time
- rotation, translation, and scaling implemented as true coordinate transforms
  (not CSS or image-level effects)

## 2. How to Run

No build step, no server, no dependencies. Just open the file:

```
analog-clock/index.html
```

directly in any modern browser (double-click it, or use "Open File").

## 3. Controls

| Control | Effect |
|---|---|
| Drag on the clock face | Translates (moves) the clock within the canvas |
| Mouse wheel over the canvas | Zooms in/out (scaling), proportions preserved |
| Zoom slider (control panel) | Alternate zoom control, synced with the wheel |
| Reset view | Returns position to center and zoom to 100% |
| 24-hour format toggle | Switches the digital readout between 12h (AM/PM) and 24h |
| Smooth seconds toggle | Switches the second hand between smooth sub-second motion and a discrete once-per-second tick |
| Midnight / Paper | Switches the canvas theme (dark / light) |

The right-hand panel also shows the current viewport zoom percentage and the current
local time/date live, updated every frame. The left-hand panel shows the same
transform math live (hand angles in degrees, scale %, offset in px), a small unit-circle
diagram plotting the three hand angles, and a rubric-concept checklist whose dots light
up while you're actively translating or scaling. The footer legend labels which
on-screen interaction demonstrates each required transform — useful during
source-code inspection.

The clock is never permanently lost off-screen — if it's dragged out of view, **Reset
view** always brings it back to center.

## 4. Transformation Pipeline

All transformations act on the drawn geometry via the Canvas 2D transform stack
(`save()` / `translate()` / `scale()` / `rotate()` / `restore()`), per frame:

```
ctx.translate(canvasCenter)     // fixed base origin
ctx.translate(offsetX, offsetY) // user translation (drag)
ctx.scale(scale, scale)         // user scaling (wheel/slider)
  -> draw face, ticks, numerals (all in clock-local coordinates)
  -> for each hand:
       ctx.save()
       ctx.rotate(handAngle)    // per-hand rotation
       draw the hand line
       ctx.restore()
```

Because translation and scaling are applied to the outer transform before any drawing
happens, and each hand's rotation is scoped with its own `save()/restore()`, every hand
rotates independently around the (already translated/scaled) clock center — rotation
never affects the clock's position or size, and dragging/zooming never affects hand
angles.

## 5. Hand-Angle Math

Angle convention: `0 radians = 12 o'clock`, increasing clockwise. Canvas's native
`rotate()` measures clockwise from the positive x-axis, so every face angle is shifted
by `-90°` (`-PI/2`) before being passed to `rotate()`.

- **Second hand:** `angle = (seconds [+ ms/1000 if smooth]) / 60 * 2π` — the smooth-seconds
  toggle controls whether milliseconds are included.
- **Minute hand:** `angle = (minutes + seconds/60) / 60 * 2π` — advances continuously
  across the minute rather than jumping once per minute.
- **Hour hand:** `angle = (hours + minutes/60) / 12 * 2π` — the `minutes/60` term is
  what makes the hour hand creep smoothly toward the next hour instead of jumping on
  the hour mark.

Tick marks use the same angle convention: 60 positions at `i/60 * 2π`, with every 5th
tick (`i % 5 === 0`) drawn longer and thicker as an hour tick.

## 6. File Structure

```
analog-clock/
├── index.html   # dashboard layout: info panel, canvas panel, control panel, legend
├── style.css    # layout, theming (Midnight/Paper), controls
├── clock.js     # state, input handling, transforms, rendering, animation loop
└── README.md    # this file
```
