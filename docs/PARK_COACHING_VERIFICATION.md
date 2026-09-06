# Pickleball Park coaching verification

The coaching runtime uses one declarative lesson catalog, one shared timeline, and one authored pixel actor family across the editable board, guided lessons, and optional 3D replay.

## Maintainer contract

- Eight illustrative lessons cover serve/return, drops, drives, dink exchange, volley/block, short-hop reset, and lob/overhead examples.
- Guided and 3D views sample the same ball flight and contact timeline.
- Entering a lesson captures the editable board snapshot; Exit restores it.
- Previous/Next, Restart, Play/Pause, Loop, speed, camera changes, and reduced-motion handling preserve the shared session rules.
- Park landmarks and regulation court geometry come from the shared local layout and geometry modules.

These lessons are teaching examples, not a complete officiating engine, biomechanics model, or physical simulation.

## Public visual evidence

Reviewed app-only stills are collected in [rebrand verification](REBRAND_VERIFICATION.md). Large historical galleries, recordings, raw logs, and machine-specific review artifacts remain local and are not part of this public snapshot.

## Source contracts

See [pixel actor assets](PIXEL_ACTOR_ASSETS.md), [park art](PARK_ART.md), [asset provenance](ASSET_PROVENANCE.md), and [visual direction](VISUAL_DIRECTION.md) before changing artwork, pivots, camera presentation, or shared layout geometry.
