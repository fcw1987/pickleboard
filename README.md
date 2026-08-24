# Pickleboard 🏓

Pickleboard is a lightweight, local-first pickleball strategy board. It displays a regulation-proportioned 44′ × 20′ court plus an expanded planning area, and lets coaches and players position teams, move the ball, trace movement, and draw annotations.

The production application is dependency free: HTML, CSS, vanilla browser JavaScript, inline SVG, and a service worker. Development tooling uses Node.js and Playwright for reproducible browser tests.

## Features

- Four draggable branded player tokens: Team 1 uses green artwork and Team 2 uses orange artwork
- Per-player left/right handedness, toggled with a double click and retained for the browser session
- A draggable neon-green ball
- Singles and doubles starting arrangements
- Movement tracers with automatic expiry and manual clearing
- Freehand drawing mode with undo and clear actions
- Light and dark themes with the preference stored locally
- Mouse and touch interaction
- Viewport-fitted portrait, landscape, mobile, and desktop layouts
- Installable PWA shell with repeat-visit offline support
- No backend, account, analytics, or remote persistence

Player positions and drawings are currently session-only and are lost when the page reloads. Theme preference is the only application setting stored in `localStorage`.

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

The browser suite covers clean initialization, drawing mode and strokes, token drag synchronization, singles/doubles behavior, the public mode API and Reset, theme restoration, service-worker installation/offline/upgrade behavior, cache isolation and freshness, and representative portrait, landscape, and desktop viewports.

## Architecture

```text
index.html       Application shell, inline SVG court, controls, and help content
styles.css       Themes, court presentation, overlays, and responsive sizing
script.js        Pickleboard state, interactions, SVG updates, and public API
manifest.json    PWA installation metadata
sw.js            Versioned static-shell cache and offline navigation behavior
assets/players/  Four transparent PNG player visuals (green/orange, left/right)
icons/           PWA and Apple launcher icons
tests/           Playwright browser tests and local test helpers
.github/         CI quality gate
```

A single `Pickleboard` instance owns the current board behavior. Token position changes flow through `updateTokenPosition()`, which keeps each visible SVG player image and its larger transparent hit target synchronized. Player images use a body-center anchor while preserving the source PNG aspect ratio. Artwork is selected centrally from the player’s current team color and explicit left/right handedness. Double-clicking a player toggles that individual handedness without changing its position; handedness is session-only and survives mode changes and Reset. `currentGameMode` is authoritative for mode changes made through the controls, public API, and Reset. `drawingMode` is authoritative for drawing UI state.

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
  ball: { cx: 16, cy: 45 }
}

doubles: {
  player1: { cx: 5, cy: -1 },
  player2: { cx: 15, cy: 14 },
  player3: { cx: 5, cy: 45 },
  player4: { cx: 15, cy: 45 },
  ball: { cx: 16, cy: 45 }
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
