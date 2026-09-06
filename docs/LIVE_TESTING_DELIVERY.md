# Live testing delivery

## Source and publication safety

The approved desktop source is `f89cdfd6b7a0a9cbf4e1662c192634d6b794460f`, based on the pixel park milestone `dd0c3fa`. The sanitized candidate starts from the existing public main `e67d060ca44a3c27af346007e619927bc6e3c9a1`; it does not import unpublished development ancestry. Original branches, the private audit checkpoint, and the original accepted-source tag remain local. **Never merge those archived branches into public history.** Future development starts from published main.

All 81 application/runtime files (1,437,276 bytes) are enumerated in `tests/fixtures/approved-runtime.json`, with SHA-256 hashes from the approved source. `npm run build:site` requires exact path-set and byte equivalence, compares the two vendor modules with the installed locked Three.js package, and excludes docs, tests, source previews, generators, dependencies and agent memory. The only added deployment files are `.nojekyll`, `runtime-manifest.json` and `build-info.json`. They are publication metadata, not application changes or offline-cache additions.

Only five reviewed application stills are published with the repository. Recordings, raw logs, local-machine metadata, historical galleries and private audit detail remain local. Runtime artwork, reproducible source assets, attribution and existing license notices are preserved. No software license has been introduced.

## Verification before first push

- `npm ci`: passed with the existing lockfile and unchanged dependency versions.
- `npm run check`: 55 unit tests passed; 77 static asset references and active brand integrity passed.
- `npm run check:generated`: all 62 asset/source outputs reproduced exactly.
- `PORT=4187 npx playwright test --workers=1`: 122 Chromium tests passed.
- `PORT=4188 npx playwright test --config=playwright.webkit.config.mjs --workers=1`: 115 passed, seven preexisting local failures. These are diagnostic results, not approved hosted exceptions.
- `npm run build:site && npm run verify:package`: four cases passed (Chromium/WebKit × clean install/actual production upgrade). All 81 package hashes and 78 declared cache entries (including both directory and index shell URLs) matched. Each case loaded all eight lessons in both views after the owned HTTP server was stopped. Upgrade preserved the open editing session, theme, install identity and unrelated cache.

The prior production source and worker were verified against the real public responses before replacement: revision `e67d060`, cache v8; all 23 cached files plus `sw.js` matched source. `tests/fixtures/prior-production.json` records their hashes. The package test reconstructs those exact bytes from public Git history and upgrades at the same origin and existing Pages path. It does not substitute the newer private v14 baseline.

The package test originally caught two harness assumptions: the directory shell is a separate cache entry, and shared elapsed time is seconds. Both were corrected without changing runtime or weakening state/hash assertions. Local results precede hosted CI; a precommit package carries the base revision in its metadata and is never deployed.

## Delivery policy

Quality runs on main pull requests and main pushes. Checks, Chromium, WebKit and Package must all succeed; the aggregate **Quality gate** rejects missing, skipped, cancelled or failed jobs. Browser concurrency is one per job. No general WebKit allow-failure or blanket quarantine is used. The exact infrastructure signatures in [issue 14](https://github.com/fcw1987/pickleboard/issues/14) require a same-job no-application-code reproduction, pinned browser/test identities, and strict report classification; unexpected passes or any unmatched failure block delivery. All original tests still execute and the mandatory real-offline package job is unchanged.

Pages deployment is manual and restricted to trusted main. It selects the successful main Quality run for the exact input SHA, downloads that run's already-tested Pages tar, validates the build identity, manifest digest, complete file set and every runtime hash, and reuploads the same tar bytes. It does not rebuild from latest main. PR runs cannot deploy. Failure reports and build artifacts have bounded seven-day retention.

Hosted run, PR, merged SHA, deployment, public tag and live smoke results will be recorded after execution. Merely pushing a candidate is not deployment success.

## Recovery and owner testing

The previous verified public revision is retained in Git history and its public asset hash fixture. No shared history needs rewriting. If live startup/assets or restoration fail, pause publication and prepare a forward recovery commit using the known-good source, explicit runtime manifest review and a new worker cache version where necessary. Run the package/upgrade checks, merge through the gate, then deploy that checked artifact manually. Redeploying old files alone does not prove every installed client reverted; verify installed-client caches and received hashes. Do not clear unrelated browser data. The old deployment is not claimed to have a modern gated artifact or an instant one-click rollback.

For live testing, verify `build-info.json` and `runtime-manifest.json` at the public site without deleting site data. Arrange players, draw, open Serve & Return, pause, enable Loop, enter replay, change camera and speed, return and exit; the arrangement and drawing should return. Also try Short-Hop Reset and Lob & Overhead. On physical phones, focus on touch, rotation, smoothness, background return, installation and real disconnected operation. Automation is not physical-device or native-Safari verification.

Report issues with: device, OS/browser, build revision, lesson, camera, steps, expected result, actual result, and a screenshot or clip.

## Hosted generation correction

The first hosted run rejected generated PNG byte differences on its newer Node/zlib build. The aggregate gate correctly rejected Checks=failure and all three skipped downstream jobs. The check now generates into an empty temporary asset tree and requires the complete output path set, exact non-PNG bytes, and exact PNG geometry, metadata, CRC validity and inflated scanline bytes. It counts compression-only differences explicitly; it is not a perceptual image comparison. Negative tests reject changed pixels, dimensions, metadata, paths and corrupt CRCs. Deployment still requires every original encoded runtime byte and the independently pinned manifest hash; generated scratch files never replace the approved assets. Hosted results must confirm whether the observed differences are lossless-compression-only.

## Hosted WebKit findings

The Linux run [34063739734](https://github.com/fcw1987/pickleboard/actions/runs/34063739734) passed 61 unit checks, all 122 Chromium tests and all four exact-package fresh/upgrade cases. Full WebKit reproduced 115 passes and exactly seven preexisting signatures: six Playwright offline-emulation navigation errors and one cache entry lost across navigation. The complete HTML/trace report was retained. A separate diagnostic with no application code and no cache deletion reproduces the failure signatures; its valid service worker works after the server is stopped. A strictly bounded policy is tracked in issue 14, expires for review on 2026-10-06, and fails on new/missing/skipped/timed-out/flaky/unexpectedly passing cases or changed signatures. It does not convert those original assertions into passing tests. Native Safari and physical-device behavior are distinct.

Hosted Node 22.23.2 / zlib 1.3.1-e00f703 reproduced every pixel/metadata byte, with 44 PNG files differing only in compression encoding. The shipped 81-file runtime and its pinned SHA-256 manifest remain byte-for-byte identical to the approved source.
