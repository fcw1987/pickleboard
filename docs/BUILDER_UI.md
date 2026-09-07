# Court first builder UI

`builder-ui.js` exports `mountBuilderUI({ onAction })`. It appends one native accessible control surface and returns `{ render, destroy, element }`. The host owns the document, compiler, court renderer, playhead, persistence, and dialogs; the UI emits actions and can be rendered again with the shared session state.

The host supplies the versioned document and stable shot identifiers. The UI accepts arbitrary shot arrays and exposes the supported families, target coordinates and presets, receiver/contact/serve choices, arc and pace preferences, movement pins, handedness, edit operations, assistance toggles, planner round trip, import/export dialogs, and transport controls. It does not calculate trajectories or interpret planner drawings.

The court remains the dominant region. Wide layouts reserve `--builder-side-width` for the inspector; all layouts reserve `--builder-bottom-height` for transport. Narrow layouts collapse the inspector into a shallow sheet. `3d` is the fresh default and `view` actions preserve the host's single session. Camera choices are presentation state and use `camera` actions.

The host should load `builder-ui.css`, add `body.builder-workspace` while mounted, render its production court beneath the transparent `[data-builder-court-region]` area, and route actions to its document/session reducer. `render` intentionally avoids replacing document-dependent DOM when only time, save status, busy state, or play/pause changes, so text fields and range controls retain focus during playback updates. The host should call `destroy()` when leaving the builder.
