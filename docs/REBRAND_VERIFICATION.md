# Pickleball Park rebrand verification

The public snapshot uses **Pickleball Park** as the product name and `pickleballpark` for new project-owned package identity. The approved runtime keeps the existing coaching behavior, session model, install start URL, service-worker scope, theme preference, and compatibility API names.

## Public evidence

The small checked-in gallery contains reviewed app-only stills:

- [Editable board](rebrand/after/board.png)
- [Guided lesson](rebrand/after/guided.png)
- [3D replay](rebrand/after/replay.png)
- [Menu](rebrand/after/menu.png)
- [Help](rebrand/after/help.png)

These are static browser viewport captures. Recordings, raw test logs, machine metadata, and historical before/after dumps remain local development evidence and are intentionally omitted from this public snapshot.

## Artwork and provenance

The park sign and player artwork are repository-authored and reproducibly generated. See [asset provenance](ASSET_PROVENANCE.md), [park art](PARK_ART.md), and [pixel actor contract](PIXEL_ACTOR_ASSETS.md). No external artwork, font files, remote asset service, or new license dependency was introduced by the rebrand.

## Compatibility

Existing integration symbols, theme storage, cache ownership, and the `./index.html` start URL retain continuity. The display name, manifest/package display metadata, current prose, and source-authored sign use the new product name. Historical development evidence is not part of the public snapshot.

## Verification limits

The public stills establish the visible desktop app states represented above. They do not claim physical-device coverage, native Safari coverage, universal performance, or frame-accurate recording behavior. Run the repository's current test commands locally before release.
