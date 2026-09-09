# Court first builder UI

`builder-ui.js` exports `mountBuilderUI({ onAction })`. It appends one native accessible control surface and returns `{ render, destroy, element }`. The host owns the document, compiler, court renderer, playhead, persistence, and dialogs; the UI emits actions and can be rendered again with the shared session state.

The host supplies the versioned document and stable shot identifiers. The UI accepts arbitrary shot arrays and exposes the supported families, target coordinates and presets, receiver/contact/serve choices, arc and pace preferences, movement pins, handedness, edit operations, assistance toggles, planner round trip, import/export dialogs, and transport controls. It does not calculate trajectories or interpret planner drawings.

The inspector starts collapsed. Selecting or adding a shot opens the basic editor; coordinates, contact choices and pins live in a persistent Details disclosure. File and Plays disclosures hold secondary actions. A separately scrolling sequence keeps Add, Auto Shading and Coverage Guides reachable through 64 shots. Wide layouts reserve a slim inspector only while it is open; short landscape uses a compact control rail beside the court, and portrait uses a dismissible editing sheet. The host measures actual scene/control bounds rather than assuming fixed header heights. `3d` is the fresh default and `view` actions preserve the host's single session. Camera choices are presentation state and use `camera` actions.

The host should load `builder-ui.css`, add `body.builder-workspace` while mounted, render its production court beneath the transparent `[data-builder-court-region]` area, and route actions to its document/session reducer. `render` intentionally avoids replacing document-dependent DOM when only time, save status, busy state, or play/pause changes, so text fields and range controls retain focus during playback updates. The application retains this UI/controller across planner visits so the draft and history survive. `destroy()` is available for complete UI teardown, not ordinary workspace switching. `builder-integration.css` refines the shared shell into measured phone and short-landscape layouts; 200% text uses a readable scrolling flow.

Current layout, interaction evidence, waypoint preview policy and measurements: [court-centered usability verification](COURT_CENTERED_BUILDER.md).

## Phone editing contract

The selected card exposes family, hitter, target placement and Flight. Details expands precise coordinates, contact/receiver/serve choices, and movement for any player; a partner command uses the optional `playerMovement` map. Done closes immediate undoable edits. It does not discard committed changes. Cancel placement discards the unfinished gesture, and changing shots, views, camera, playback or viewport releases its owner. On compact phones placement temporarily hides the sequence and assistance row to expose more court.

Numeric coordinates display up to three decimal places to avoid ray-casting noise. Opening, focusing or dismissing a field does not change the full precision source; JSON export preserves it. Empty and out-of-range inputs remain invalid until corrected or cancelled, rather than becoming zero. Field-level pending status is distinct from a completed local save.

The details sheet is a nonmodal region with a bounded internal scroll area. The library/import dialogs retain native modality. System fonts, safe areas, visualViewport and explicit labels are shared browser standards, not a claim of native UIKit behavior. See [guidance](IPHONE_INTERFACE_GUIDANCE.md) and [verification](UNIFIED_IPHONE_VERIFICATION.md).
