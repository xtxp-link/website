# M2-y-sweet, part A: browser checklist (David's Chrome)

For a Claude session running **on David's Mac** (the Claude Desktop app with Claude in Chrome, or `claude remote-control` in the `xtxp-rs` folder), driving his own Chrome. It fills in the parts of the report that a cloud container can't: his real browser, real screenshots and a recording, and the load matrix on his hardware. The [design](2026-10-19-m2-y-sweet-browser-design.md) has the details behind each step.

Record every result in `docs/reports/m2-y-sweet-browser-crosstest.md` in `xtxp-rs`, with the date, the Chrome version (`chrome://version`) and the macOS version, and save captures in `docs/reports/captures/`.

## 0. Set up

- [ ] Check out `main` of `xtxp-rs` and pull.
- [ ] Run `scripts/try-it.sh --browser`. Note the URLs it prints.
- [ ] Open a terminal with `target/release/xtxp-muppet open logo`: this is the editor for every step below.
- [ ] Record the Chrome version. Native `<template for>` needs 150 or later; if it's older, say so and continue (stream mode will fall back).

## 1. Each mode, by eye

For each URL: `/?live=refresh`, `/?live=stream`, `/?live=ws`, then `/` with no parameters.

- [ ] The logo appears, the same as `logo-on-blue.svg`.
- [ ] In the TUI, change the cross's `stroke-width` with ← → and the background rect's `fill`. The change appears in the browser: within a second for refresh, at once for the others.
- [ ] Note whether the change **animates** (a view transition) or jumps.
- [ ] Take a screenshot before and after one change.
- [ ] For `/` with no parameters: which mode did it pick? (Look at the URL and the header's connection state.)

## 2. The open questions

- [ ] **Stream mode with node grain** (`/?live=stream&grain=node`): does an edited SVG element still draw after the patch? (Expected not, per the design's section 4. Confirm in Chrome's DevTools: the element's namespace, `$0.namespaceURI`.)
- [ ] **Does a streamed patch start a view transition by itself?** In `/?live=stream`, make a change and watch; record a short screen recording of the change.
- [ ] **Do SVG elements take a `view-transition-name`?** In `/?live=ws&grain=node`, change the cross's colour and watch whether only the cross animates, or the whole drawing.
- [ ] **JavaScript off:** in Chrome's settings for `localhost`, block JavaScript and open `/`. It should fall back to the refresh loop and still update.
- [ ] **JavaScript off, left open:** leave that tab open for 5 minutes, making an edit every minute. Does every edit appear? (Headless Chromium sometimes stops the refresh loop; see `docs/reports/m2-y-sweet-browser-probes.md` in `xtxp-rs`.)

## 3. Client metrics

For each mode and grain (`refresh`; `stream` with `region`; `ws` with `node` and with `region`), with `&metrics=1`:

- [ ] Make 20 changes, spaced out, by holding → on the cross's `stroke-width` in the TUI.
- [ ] Record the overlay's p50 and p95 latency, and any jank count.
- [ ] Save `GET /metrics` as JSON at the end of each mode.

## 4. A recording

- [ ] Record about 30 seconds of the TUI and the browser side by side, in `/` with no parameters: recolour the cross, change its width, change the background. This is the report's headline capture.

## 5. The load matrix

- [ ] Run `scripts/bench-browser.sh` (raise `ulimit -n` to 4096 first). It runs every mode and grain at 1, 10, 100 and 1,000 viewers.
- [ ] Copy the Markdown table it writes into the report, with the Mac's model, chip and memory.
- [ ] Note anything that failed, such as missed patch sets or errors, and at what viewer count.

## 6. Hand back

- [ ] Commit `docs/reports/` on a branch and open a PR to `xtxp-rs`.
- [ ] Tell the cloud session (or David) what surprised you; the report gets written from the results.
