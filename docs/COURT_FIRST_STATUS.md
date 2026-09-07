# Court-first park polish — local candidate

Source: clean published `f130801`. Branch: `feature/court-first-park`. Production and publication settings are unchanged. Archived private development history is not used.

## Contract and ownership

- Astra: integration, shared park layout/renderer, cache/package verification and final review.
- Luna (`gpt-5.6-luna`, explicitly selected): reproducible compact banner and HELP sign. No underlying runtime metadata beyond selected configuration was exposed.
- Sol (`gpt-5.6-sol`, explicitly selected): responsive projection/fitting, existing native border controls, interaction/resize tests in an isolated worktree.
- Fresh visual review follows integration.

Court coordinates, legal offcourt positions, approved player/paddle art, eight lessons, ball, timeline and snapshot contract remain authoritative. Decoration never determines court fitting. Wider viewports use a shallower elevated ground projection; narrow layouts retain the longitudinal orientation. Upright actors and net are reprojected, not flattened into the ground.

The old upper tree is replaced by a compact original two-line pixel banner. Existing right-side sign becomes HELP; MENU is an accessible left-border plaque. Scenery remains static; no crowd, animation loop, dependency, framework or camera-control redesign.

## Baseline

`npm run check`: 78 unit tests, 77 static references and brand checks passed. Full Chromium baseline and matching board/guided/replay captures use the unchanged source on an isolated preview. Evidence is kept under `release-results/park-layout`, with application-only captures and no machine paths embedded.

At 1440×900 the original painted court polygon occupies 169,438 CSS px² in editing and 90,174 CSS px² in guided view. These are projected court surface areas, not surrounding grass or SVG rectangles. Matrix-based measurements at six matching viewports are retained with the captures.

## Progress

- Original banner/HELP assets generated and visually inspected; weak first banner contrast corrected to navy on ivory.
- Shared banner placement replaces top tree; SVG projection refresh hook added without recreating textures.
- Layout/control integration, complete browser checks, visual correction, cache upgrade and package contract refresh remain in progress.

Any updated package hash fixture will identify this new local candidate explicitly; it will not claim unchanged runtime equivalence to the previous release or authorize deployment.
