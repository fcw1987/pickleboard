# Pickleboard 🏓

Pickleboard is a lightweight, local-first pickleball strategy board. It displays a regulation-proportioned 44′ × 20′ court plus an expanded planning area, and lets coaches and players position teams, move the ball, trace movement, and draw annotations.

The production application is dependency free: HTML, CSS, vanilla browser JavaScript, inline SVG, and a service worker. Development tooling uses Node.js and Playwright for reproducible browser tests.

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

The page itself has no production package dependencies or build step. It can be hosted by any static HTTPS server. Opening `index.html` directly may display the basic application, but it is not a supported way to test installation, updates, or offline behavior.

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

Keep the production runtime dependency free and preserve the existing SVG court geometry unless a product change explicitly requires otherwise. Run `npm test` before opening a pull request. PWA changes should always be tested through HTTP on localhost or HTTPS, including an upgrade from an existing cache.

## License

This repository does not currently include a formal software license. The owner should choose one before relying on reuse or redistribution permissions.
