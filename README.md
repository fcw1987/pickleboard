# Pickleboard 🏓

Pickleboard is a lightweight, local-first pickleball strategy board. It displays a regulation-proportioned 44′ × 20′ court plus an expanded planning area, and lets coaches and players position teams, move the ball, trace movement, and draw annotations.

Pickleboard remains a lightweight static application built with HTML, CSS, vanilla browser JavaScript, inline SVG, and a service worker. Three.js is isolated to the optional 3D playback mode; development tooling uses Node.js and Playwright for reproducible tests.

## Features

- Four draggable branded player tokens: Team 1 uses green artwork and Team 2 uses orange artwork
- Per-player left/right handedness: all players start right-handed; double click on desktop or double tap on touch devices to toggle
- A draggable neon-green ball
- Singles and doubles starting arrangements
- Movement tracers with automatic expiry and manual clearing
- Freehand drawing mode with undo and clear actions
- Light and dark themes with the preference stored locally
- Mouse and touch interaction
- Viewport-fitted portrait, landscape, mobile, and desktop layouts
- Installable PWA shell with repeat-visit offline support
- Four guided Plays with manual or automatic step-by-step playback
- No backend, account, analytics, or remote persistence

Player positions, drawings, and handedness are session-only and are lost when the page reloads. Reset restores positions but preserves handedness for the current session. Theme preference is the only application setting stored in `localStorage`.

## Run locally

Service workers do not operate from a normal `file://` page. Use the included local HTTP server for development and PWA testing:

```bash
npm install
npm start
```

Then open <http://127.0.0.1:4173/>.

The application has no build step and can be hosted by any static HTTPS server. The checked-in `vendor/` modules provide the sole production dependency, Three.js, for offline 3D playback. Opening `index.html` directly may display the basic application, but it is not a supported way to test modules, installation, updates, or offline behavior.

## Test

Install Chromium once after installing dependencies:

```bash
npx playwright install chromium
```

Run all static checks and browser regression tests:

```bash
npm test
```

Useful narrower commands:

```bash
npm run check
npm run test:browser
npm run test:headed
```

The browser suite covers clean initialization, player artwork and handedness, desktop double click and touch double tap behavior, touch/mouse drag synchronization, drawing mode and strokes, singles/doubles behavior, the public mode API and Reset, theme restoration, service-worker installation/offline/upgrade behavior, cache isolation and freshness, and representative portrait, landscape, and desktop viewports.

## Architecture

```text
index.html       Application shell, inline SVG court, controls, and help content
styles.css       Themes, court presentation, overlays, and responsive sizing
script.js        Pickleboard state, interactions, SVG updates, and public API
guided-plays.js  Declarative play catalog and reusable playback engine
manifest.json    PWA installation metadata
sw.js            Versioned static-shell cache and offline navigation behavior
assets/players/  Four transparent PNG player visuals (green/orange, left/right-handed)
icons/           PWA and Apple launcher icons
tests/           Playwright browser tests and local test helpers
.github/         CI quality gate
```

A single `Pickleboard` instance owns the current board behavior. Token position changes flow through `updateTokenPosition()`, which keeps each visible SVG player image and its larger transparent hit target synchronized. Player images use a body-center anchor while preserving the source PNG aspect ratio. Green artwork is front-facing on the far/top side and orange artwork is back-facing on the near/bottom side, so the teams face each other across the court; this viewing orientation is inherent to the team artwork, not separate application state. Artwork is selected centrally from the player’s current team color and explicit physical left/right handedness; all four players default to right-handed. Double-clicking on desktop or double tapping the same player on a touch device toggles that individual handedness without changing its position or front/back orientation. Handedness is session-only and survives mode changes and Reset, while singles/doubles may change the artwork’s team color. `currentGameMode` is authoritative for mode changes made through the controls, public API, and Reset. `drawingMode` is authoritative for drawing UI state.

## Guided Plays

The menu's **Plays** section provides four illustrative opening patterns: Serve & Return, Third Shot Drop, Third Shot Drive, and Fifth Shot Drop. `guided-plays.js` contains both the declarative catalog and one reusable `GuidedPlayEngine`; adding another play should primarily mean adding a validated definition with a mode and ordered steps rather than new playback logic.

Each step declares a label, explanation, duration, absolute SVG-coordinate positions for the existing tokens, and an optional ball shot path. The engine animates the authoritative player and ball state through `requestAnimationFrame`, keeps hit targets synchronized, and owns a separate SVG shot-path layer so play cues never become user drawings or movement tracers.

Entering a Play captures the current mode, token positions, player handedness, drawings, tracers, and drawing-mode state. Play mode locks manual board editing. **Exit** restores the captured arrangement; **Restart** returns only to the selected Play's first step. Handedness is never encoded in play data and remains unchanged. User drawings are preserved, while play paths are transient and removed on restart or exit. Reduced-motion preference makes step transitions immediate without removing manual or automatic navigation.

The play catalog and engine are part of the versioned service-worker shell, so the library works on offline repeat visits. Browser tests cover the exact catalog, manual and automatic playback, pause/final-step behavior, restoration, locking, reduced motion, required viewports, and offline execution.

## 3D playback foundation

An active 2D Play now offers **3D View**, an isolated Three.js replay layer. The 2D board and `guided-plays.js` remain authoritative: the 3D adapter consumes the selected Play's existing step order, player/ball positions, labels, and shot endpoints rather than maintaining a second catalog.

Three.js `0.185.1` is the only production dependency. Its ES-module builds are copied into `vendor/` so the static PWA remains fully offline and does not depend on a CDN. `three-d-playback.js` owns scene objects, cameras, rendering, controls, and disposal; `three-d-core.js` stays renderer-independent and owns coordinate conversion, optional shot metadata normalization, deterministic trajectories, and the centralized playback clock.

Coordinate mapping is centralized in `boardToWorld()`:

```text
Pickleboard x (0..20 ft) → Three.js x, centered at x=10
Pickleboard y (0..44 ft) → Three.js z, centered at y=22
physical height in feet   → Three.js y
1 foot                    → 0.3048 meters
```

The modeled court is 20×44 feet with seven-foot kitchens. The net is modeled at the regulation 34-inch center height; the 36-inch sideline height is retained as a dimension constant for future net shaping. Players are lightweight capsule/head/leg figures with green/orange branding, navy clothing/paddles, team-facing orientation, and paddle placement based on existing handedness.

Shots may optionally add metadata without affecting the 2D engine:

```javascript
shot: {
  from: { x, y },
  to: { x, y },
  type: 'drop',
  trajectory3d: {
    speedMph: 18,
    apexFeet: 7.5,
    netClearanceInches: 16,
    contactHeightFeet: 2.2,
    spin: { type: 'backspin', rpm: 550 },
    bounce: { enabled: true, heightFeet: 1.25 }
  }
}
```

The Third Shot Drop is the rich proof shot. A deterministic parametric arc derives duration from horizontal distance and a simplified average travel speed, validates net clearance, reaches the shared 2D target, and produces one illustrative bounce. Spin RPM drives visible ball rotation; topspin/backspin/flat currently alter post-bounce forward travel modestly rather than simulating aerodynamic Magnus forces. Other shots use type-based defaults, so every existing Play can load in 3D without duplicated definitions.

One `PlaybackClock` coordinates players, ball rotation, trajectory, pause/restart, and global rates of 1×, 0.5×, or 0.25×. Named cameras are Overhead 3D, Sideline, Behind Green, and Behind Orange. Exiting disposes geometry/materials and the WebGL renderer, stops the frame loop, and returns to the same 2D Play state. The Three.js modules and 3D code are included in the versioned service-worker shell for offline repeat use.

All four Guided Plays now compile and complete in 3D. Shot types provide valid defaults when rich `trajectory3d` metadata is absent, including the drive and compact block used by Third Shot Drive and Fifth Shot Drop.

Procedural players use separate named transforms for hips, torso, head/cap, shoulders, elbows, hands, thighs, knees, lower legs, feet, and a paddle attached beneath the active hand. The athletic ready pose, navy hoodie/cap/paddle language, green/orange accents, and contact shadows establish a lightweight Pickleboard identity while leaving joints directly addressable by future animation code.

The court includes a physical slab, contrasting kitchen surface, neutral surround, raised lines, and a segmented net mesh. A curved top tape uses 36-inch sideline and 34-inch center heights without cloth simulation. Camera presets use explicit position, target, and field of view: overhead remains tactical; behind-team views sit near human coaching height; sideline emphasizes trajectory height and clearance. The ball is rendered 16% larger than its physical collision/trajectory radius solely for replay readability.

This foundation is deliberately illustrative, not validated sports physics. Future physics can replace `createTrajectory()` without replacing the Play catalog, coordinate adapter, renderer, or clock. Natural next steps are calibrated launch velocities, aerodynamic spin, richer bounce surfaces, stroke-state metadata, and animation of the existing procedural joint hierarchy before considering skeletal assets.

## Court coordinate model

The SVG coordinate system uses feet:

```javascript
courtBounds = {
  left: -8,
  right: 28,
  top: -8,
  bottom: 52
}
```

The regulation court occupies `x = 0..20` and `y = 0..44`. The expanded view box gives eight feet of planning space around it. The net is at `y = 22`; the non-volley zone extends from `y = 15` through `y = 29`.

Current mode defaults are:

```javascript
singles: {
  player1: { cx: 5, cy: -1 },
  player2: { cx: 15, cy: 45 },
  player3: { cx: 5, cy: 36 }, // hidden
  player4: { cx: 15, cy: 36 }, // hidden
  ball: { cx: 19, cy: 45 }
}

doubles: {
  player1: { cx: 5, cy: -1 },
  player2: { cx: 15, cy: 14 },
  player3: { cx: 5, cy: 45 },
  player4: { cx: 15, cy: 45 },
  ball: { cx: 19, cy: 45 }
}
```

These starting positions and team assignments are intentional game behavior.

## Court appearance

- Dark green: expanded outside planning area
- Green: general court surface
- Gray: non-volley zone (kitchen)
- Navy: four service boxes
- White: court boundaries and service lines
- Black: net
- Green and orange branded player artwork: opposing teams
- Neon green: ball

## Public API

The browser exposes the current instance as `window.pickleboard`:

```javascript
window.pickleboard.getTokenPositions()
window.pickleboard.setTokenPosition('player1', 10, 12)
window.pickleboard.resetPositions()
window.pickleboard.setGameMode('singles') // true
window.pickleboard.setGameMode('invalid') // false
```

`setGameMode()` validates the requested mode and synchronizes the visible radio control. Reset always uses the authoritative current mode.

## PWA update and cache policy

The worker maintains an explicitly versioned `pickleboard-static-*` shell cache. It:

- Precaches only application-owned static files
- Intercepts only same-origin `GET` navigations and explicitly listed static assets
- Uses the network first when online so changed releases replace cached files
- Updates the cached shell only from the application root or `index.html`, not arbitrary same-origin pages
- Falls back to the cached application shell for offline navigation
- Deletes only obsolete caches in the Pickleboard namespace
- Activates and claims clients after the complete new shell is cached

Changing a shell asset—including any player PNG—requires incrementing the static cache version in `sw.js`. Browser tests exercise installation, offline repeat visits (including all four player images), upgrades, unrelated-cache preservation, and replacement of stale cached assets.

## CI

`.github/workflows/quality.yml` installs development dependencies and Chromium, then runs `npm test` on pushes and pull requests to `main`.

## Browser support

The production code targets current evergreen Chrome, Edge, Firefox, and Safari releases with SVG, CSS custom properties, service workers, Cache Storage, and modern JavaScript support. Automated coverage currently runs in Chromium; touch behavior and cross-browser PWA installation should still be manually checked before releases that alter those areas.

## Contributing

Keep the production runtime lightweight, isolate Three.js to 3D playback, and preserve the existing SVG court geometry unless a product change explicitly requires otherwise. Run `npm test` before opening a pull request. PWA changes should always be tested through HTTP on localhost or HTTPS, including an upgrade from an existing cache.

## License

This repository does not currently include a formal software license. The owner should choose one before relying on reuse or redistribution permissions.
