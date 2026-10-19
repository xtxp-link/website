# M2-y-sweet part A (the browser as a view) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `xtxp-muppet serve` shows a y-sweet document live in a browser, in three delivery modes (refresh, stream, WebSocket polyfill), with measurement and a load tool.

**Architecture:** A pure renderer in the muppet library turns trees into a marked-up page and per-node or per-region `<template for>` patches. A `serve` adapter runs the existing core in watch-only mode against y-sweet on its own thread, publishes each change once on a broadcast hub, and an axum server delivers it to viewers by refresh, by an open response, or over a WebSocket to `live.js`. Measurement is built into the page (`?metrics=1`), the server (`/metrics`) and a separate load tool.

**Tech Stack:** Rust (existing workspace), axum 0.8 with the `ws` feature, tokio multi-threaded runtime, `libc` for `getrusage`, plain JavaScript for `live.js`, Node 22 with Playwright 1.56.1 for browser tests, Chromium trunk snapshot 1722227 (158) and Playwright's Chromium 141.

**Spec:** `docs/plans/2026-10-19-m2-y-sweet-browser-design.md` (in `xtxp-link/website`). Code goes in `xtxp-link/xtxp-rs`.

## Global Constraints

- Watch only (B2): no forms, no POSTs that edit, no handles.
- One `serve` process holds one y-sweet connection for one document, page at `/` (B5, section 6.1).
- Query parameters, exactly: `live=refresh|stream|ws`, `grain=node|region`, `every=N` (refresh seconds, default `1`), `metrics=1`, `polyfill=1` (stream only).
- Default grain: `region` for stream, `node` for ws; refresh renders full pages.
- Marker names `n{client}-{clock}`; region marker name `doc`, wrapped around the whole `<svg>`.
- Patch form: `<template for="NAME" data-seq="S" data-sent="MS"><?start name="NAME">…<?end></template>`; `data-sent` is server Unix time in milliseconds.
- Refresh: `<meta http-equiv="refresh" content="N">`, `ETag` = `"` + snapshot hash + `"`, `304 Not Modified` when `If-None-Match` matches.
- Stream heartbeat: a `<!--hb-->` comment every 15 s.
- Client metrics: batches every 2 s by `sendBeacon` to `POST /metrics/client`; jank = frames longer than 50 ms.
- `serve` defaults: `--listen 127.0.0.1:3000`, `--server localhost:8080`.
- No sanitising (spec 5.2): render what the document holds.
- Chromium snapshot revision `1722227`, into `.tools/chromium-1722227/`; Playwright `1.56.1` (its Chromium is 141, build 1194).
- Bench matrix: viewers 1, 10, 100, 1,000; CI smoke: 10 viewers per mode for 5 s.
- Rust: `cargo fmt` and `cargo clippy --workspace --all-targets -- -D warnings` clean before every commit.

## Review Focus

1. **A browser opens the page before `serve` has synced with y-sweet** (or while y-sweet is down): the page renders with the header saying "connecting" and an empty drawing, and goes live once synced; nothing panics. Test: Task 3, `page_before_first_sync_says_connecting`.
2. **`serve` reconnects to y-sweet with a fresh client ID**: node IDs are the items' IDs, not the client's, so the same tree after a reconnect produces **no** patches and viewers' markers stay valid. Test: Task 2, `same_tree_after_reconnect_gives_no_patch`.
3. **Text or attributes that look like markup** (`"`, `<`, `&`, `<?end>`, and `</style>` inside a `<style>`): escaping keeps every marker pair intact. Test: Task 1, `markup_in_values_cannot_break_markers`.
4. **A tab closed abruptly, or left open for hours**: dead stream and WebSocket connections are dropped (a failed heartbeat or send) and `/metrics` open-connection counts go back down. Test: Task 4, `closed_stream_viewer_is_dropped_and_counted`.
5. **The document's root element is deleted, or the tree is empty**: the region patch renders an empty `<svg>` region rather than failing, and later content patches still land. Test: Task 2, `empty_tree_renders_empty_region`.

---

## File Structure

```
xtxp-rs/
  crates/xmesh/tests/fixtures/xtxp-logo.svg        copy of website public/brand/logo-on-blue.svg
  crates/xtxp-muppet/
    Cargo.toml                                     + axum, libc; feature "adapters" grows
    src/render/mod.rs                              pub API: Grain, PatchSet, Renderer
    src/render/html.rs                             node, page and region HTML; escaping; names
    src/render/dirty.rs                            per-node records and dirty roots
    src/adapters/serve/mod.rs                      `serve` entry: core thread + axum server
    src/adapters/serve/hub.rs                      broadcast hub, current page, sequence numbers
    src/adapters/serve/modes.rs                    refresh, stream and ws handlers; query parsing
    src/adapters/serve/metrics.rs                  counters, client batches, getrusage, /metrics JSON
    src/adapters/cli.rs                            + Sub::Serve
    assets/live.js                                 the polyfill
    assets/metrics.js                              the client metrics script
    tests/serve.rs                                 in-process server tests (fake source)
  tools/bench-browser/                             the load tool (bin + lib)
  tests/browser/                                   Playwright: package.json, playwright.config.mjs, *.spec.mjs
  scripts/fetch-chromium.sh, scripts/bench-browser.sh, scripts/try-it.sh (+ --browser, --reset)
  .github/workflows/ci.yml                         + browser job
  docs/reports/m2-y-sweet-browser-probes.md        what the automated probes found
website/
  src/content/docs/build/m1-y-sweet-report.mdx     + browser section (or new page)
  src/content/docs/spec/browser.mdx                + the SVG-namespace finding under "Still open"
```

---

### Task 1: Renderer HTML: page, nodes, markers, escaping

**Files:**
- Create: `crates/xtxp-muppet/src/render/mod.rs`, `crates/xtxp-muppet/src/render/html.rs`, `crates/xmesh/tests/fixtures/xtxp-logo.svg`
- Modify: `crates/xtxp-muppet/src/lib.rs` (`pub mod render;`, not behind `adapters`)

**Interfaces:**
- Produces:
  - `pub fn marker_name(id: NodeId) -> String` → `"n{client}-{clock}"`
  - `pub fn render_node(n: &IdNode, names: &mut TransitionNames) -> String`: the node's subtree, every element and text node wrapped in its markers.
  - `pub fn render_region(tree: &[IdNode]) -> String`: `<?start name="doc"><svg …>…</svg><?end>` for the root element (the first non-reserved element), or `<?start name="doc"><?end>` if there is none.
  - `pub struct PageInfo<'a> { pub doc: &'a str, pub snapshot: &'a str, pub connected: bool, pub seq: u64, pub sent_ms: u64, pub head: &'a str, pub body_end: &'a str }`
  - `pub fn render_page(tree: &[IdNode], info: &PageInfo) -> String`: a full HTML document. `<head>` gets `info.head` (used by modes for meta refresh and scripts); `<body data-seq data-sent>` holds a header (`doc`, `@`+first 16 of snapshot, "● live" or "○ connecting"), the region, then `info.body_end`.
  - `pub struct TransitionNames` (`new()`): hands out CSS-safe, page-unique `view-transition-name`s.

- [ ] **Step 1: Copy the fixture:** `curl -sS https://raw.githubusercontent.com/xtxp-link/website/main/public/brand/logo-on-blue.svg -o crates/xmesh/tests/fixtures/xtxp-logo.svg`. The tests below seed it, which checks that it parses.

- [ ] **Step 2: Write the failing tests** in `render/html.rs`:
  - `marker_names_are_node_ids`: `marker_name(NodeId{client:5,clock:12}) == "n5-12"`.
  - `logo_renders_as_inline_svg_with_markers`: seed the fixture into an `Xmesh`, `render_region(&doc.tree_with_ids())`; it starts with `<?start name="doc"><svg`, ends with `</svg><?end>`, contains `xmlns="http://www.w3.org/2000/svg"` once, and every `<?start name="n` count equals the `<?end>` count minus one (the region's own).
  - `transition_names_from_ids`: `<path id="cross">` gets `style="view-transition-name: cross"`; an element without `id` gets `view-transition-name: n{c}-{k}`; text nodes get none; two elements with `id="a"` get `a` and `a-2`; `id="2 bad!"` becomes a valid ident (`_2-bad-`).
  - `existing_style_is_kept`: an element with `style="fill:red"` renders `style="fill:red; view-transition-name: …"`.
  - `namespaced_attributes_get_prefixes`: `{http://www.inkscape.org/namespaces/inkscape}label` renders as `inkscape:label`; an unknown namespace `urn:x` renders as `ns1:k` with `xmlns:ns1="urn:x"` on the root.
  - `markup_in_values_cannot_break_markers` (Review Focus 3): attribute value `a"b<c&d`, text `<?end> & <b>`, and a `<style>` whose text contains `</style>`; the output has `&quot;`, `&lt;`, `&amp;`; the style's `</` is written `<\/`; and the marker pairs still balance.
  - `reserved_nodes_render_as_comments`: an XTXP comment node renders as `<!--…-->` inside its markers.
  - `page_has_header_and_slots`: `render_page` with `PageInfo{doc:"logo", snapshot:"abcdef0123456789ff", connected:true, seq:7, sent_ms:1000, head:"<meta x>", body_end:"<script y>"}` contains `<meta x>` in `<head>`, `data-seq="7"`, `logo`, `@abcdef0123456789`, `● live`, the region, and `<script y>` before `</body>`.

- [ ] **Step 3: Run:** `cargo test -p xtxp-muppet --lib render` → FAIL (module missing).

- [ ] **Step 4: Implement** `render/html.rs` and the `mod.rs` re-exports. Element names come from `xmesh::names::split`; prefixes from `xmesh::names::FIXED_PREFIXES`; SVG elements are written without prefix. Self-close elements with no children (`<rect …/>`) — the inline-SVG parser honours `/>` in foreign content.

- [ ] **Step 5: Run:** `cargo test -p xtxp-muppet --lib render` → PASS. `cargo clippy` clean.

- [ ] **Step 6: Commit:** `render: page, node and region HTML with markers and transition names`

---

### Task 2: Renderer: dirty nodes and patch sets

**Files:**
- Create: `crates/xtxp-muppet/src/render/dirty.rs`
- Modify: `crates/xtxp-muppet/src/render/mod.rs`

**Interfaces:**
- Consumes: Task 1's `render_node`, `render_region`, `marker_name`, `TransitionNames`.
- Produces:
  - `#[derive(Clone, Copy, Debug, PartialEq, Eq)] pub enum Grain { Node, Region }`
  - `#[derive(Clone, Debug, PartialEq)] pub struct PatchSet { pub seq: u64, pub sent_ms: u64, pub snapshot: String, pub node_html: String, pub region_html: String }`, with `pub fn html(&self, grain: Grain) -> &str`.
  - `pub struct Renderer` with `pub fn new() -> Renderer`, `pub fn update(&mut self, tree: &[IdNode], snapshot: &str, now_ms: u64) -> Option<PatchSet>` (`None` when nothing changed; `seq` counts from 1), `pub fn full(&self, now_ms: u64) -> PatchSet` (a region patch of the current tree, current `seq`), and `pub fn tree(&self) -> &[IdNode]`.
  - `pub fn template(name: &str, seq: u64, sent_ms: u64, inner: &str) -> String` → the patch form from Global Constraints.

- [ ] **Step 1: Write the failing tests** in `render/dirty.rs` (trees built by seeding `Xmesh` and applying `Op`s):
  - `first_update_is_one_region_patch`: on a fresh `Renderer`, `update` on the logo returns `seq == 1`, `node_html` = one `<template for="doc" …>` (everything is new, so the dirty root is the region), and `region_html` the same.
  - `attribute_change_patches_only_that_element`: change the cross path's `stroke-width`; `node_html` is exactly one `<template for="n…">` for that path, containing its new value; `region_html` is a `doc` template.
  - `text_change_patches_only_the_text_node`: change the `<style>` text; one template, for the text node.
  - `insert_and_delete_patch_the_parent`: insert a `<circle>` into the `<g>`, then remove it; each time one template, for the `<g>`.
  - `move_patches_both_parents_once`: move a path from one `<g>` to another; templates for both parents, none for their common ancestor unless it is dirty itself.
  - `no_patch_for_children_of_a_dirty_node`: change the `<g>`'s attribute and its child's in one update; one template, for the `<g>`.
  - `same_tree_after_reconnect_gives_no_patch` (Review Focus 2): copy the doc into a new `Xmesh` with another client ID (as `Peer::Reconnect` does), `update` with its tree → `None`.
  - `empty_tree_renders_empty_region` (Review Focus 5): `update(&[], …)` after the logo → `region_html` is `<template for="doc" …><?start name="doc"><?end></template>`; a later `update` with the logo again gives a `doc` patch with content.
  - `full_is_a_region_patch_at_current_seq`.

- [ ] **Step 2: Run:** `cargo test -p xtxp-muppet --lib render::dirty` → FAIL.

- [ ] **Step 3: Implement.** A record per node: `(name, attrs)` or text, plus child ID list. Dirty = new or record differs. Dirty roots = dirty nodes whose parent isn't dirty; a deleted node makes its (surviving) parent dirty. If the root element itself is dirty or the root changed, `node_html` is the region patch.

- [ ] **Step 4: Run:** `cargo test -p xtxp-muppet --lib render` → PASS.

- [ ] **Step 5: Commit:** `render: dirty nodes and patch sets, node and region grain`

---

### Task 3: `serve`: the hub, the core thread, refresh mode

**Files:**
- Create: `src/adapters/serve/{mod.rs,hub.rs,modes.rs,metrics.rs}`, `tests/serve.rs`
- Modify: `Cargo.toml` (`axum = { version = "0.8", features = ["ws"], optional = true }`, `libc = { version = "0.2", optional = true }`, tokio features `rt-multi-thread`, both added to `adapters`; `[[test]] name = "serve" required-features = ["adapters"]`), `src/adapters/mod.rs`, `src/adapters/cli.rs`

**Interfaces:**
- Consumes: `render::{Renderer, PatchSet, Grain, render_page, PageInfo}`, `adapters::ws::run`, `core::Mode::Interactive`, `ports::{View, Screen}`.
- Produces:
  - `hub.rs`: `pub struct Hub` (cheap `Clone`, `Arc` inside) with `pub fn new(doc: &str) -> Hub`, `pub fn show(&self, screen: &Screen)` (renders, publishes a `PatchSet` if any, updates the page state; uses Unix-ms time), `pub fn subscribe(&self) -> (tokio::sync::broadcast::Receiver<Arc<PatchSet>>, Snapshot)` where `pub struct Snapshot { pub page_tree: Vec<IdNode>, pub snapshot: String, pub connected: bool, pub seq: u64, pub sent_ms: u64 }` (subscribe first, then copy state, under one lock), `pub fn full(&self) -> Arc<PatchSet>`, `pub fn doc(&self) -> &str`. Broadcast capacity 64.
  - `HubView(Hub)`: `impl View` calling `hub.show`.
  - `modes.rs`: `pub fn router(hub: Hub, metrics: Metrics) -> axum::Router` with `GET /` dispatching on `Query<Params>`; `pub struct Params { live: Option<String>, grain: Option<String>, every: Option<u32>, metrics: Option<u8>, polyfill: Option<u8> }`.
  - `metrics.rs`: `pub struct Metrics` (`Clone`, atomics) with `fn conn_opened(mode)`, `fn conn_closed(mode)`, `fn sent(mode, bytes)`, `fn refresh_status(code)`; `Mode` enum `Refresh | Stream | Ws`. (`/metrics` itself is Task 6.)
  - `mod.rs`: `pub fn run(server: &str, doc: &str, listen: SocketAddr) -> Result<(), String>`: spawns `std::thread` running `ws::run(Mode::Interactive, server, doc, HubView(hub), None)`, then serves `router` on a multi-threaded tokio runtime until Ctrl-C.
  - `cli.rs`: `Sub::Serve { doc: String, #[arg(long, default_value = "127.0.0.1:3000")] listen: SocketAddr }`, with `check_doc`.

- [ ] **Step 1: Write the failing tests** in `tests/serve.rs`. Helper: `fn start() -> (Hub, String /*base url*/)` builds a `Hub::new("logo")`, binds `router` on `127.0.0.1:0` in a background runtime; screens come from seeding/editing an `Xmesh` and calling `hub.show(&Screen{tree, snapshot_hash, connected: true, ..})`. HTTP with a minimal client (`reqwest` as a dev-dependency, `default-features = false`).
  - `page_before_first_sync_says_connecting` (Review Focus 1): no `show` yet; `GET /?live=refresh` → 200, body contains `○ connecting` and `<?start name="doc"><?end>`.
  - `refresh_page_has_meta_and_etag`: after `show(logo)`, `GET /?live=refresh` → 200, `<meta http-equiv="refresh" content="1">`, header `ETag: "<snapshot>"`, the logo's region.
  - `refresh_every_sets_the_interval`: `?live=refresh&every=5` → `content="5"`.
  - `unchanged_poll_is_304`: same request with `If-None-Match` = that ETag → 304, empty body.
  - `changed_poll_is_200`: edit, `show`, same `If-None-Match` → 200 with the new value.
  - `refresh_has_cross_document_transitions`: the page contains `@view-transition { navigation: auto; }`.

- [ ] **Step 2: Run:** `cargo test -p xtxp-muppet --test serve` → FAIL.

- [ ] **Step 3: Implement** hub, `HubView`, refresh mode, metrics counters (refresh 200/304), `serve::run` and `Sub::Serve`. Unknown `live` values → 400 with a one-line text body naming the allowed values.

- [ ] **Step 4: Run:** `cargo test -p xtxp-muppet --test serve` → PASS.

- [ ] **Step 5: Manual check** against a real y-sweet: `y-sweet serve`, `xtxp-muppet init crates/xmesh/tests/fixtures/xtxp-logo.svg --doc logo`, `xtxp-muppet serve logo`, `curl -s localhost:3000/?live=refresh | grep -c '<?start'` → a count above 10; `xtxp-muppet edit logo set-attr <path of cross> stroke-width 20`, then curl again → the new value. Record the output in the ledger.

- [ ] **Step 6: Commit:** `serve: hub, watch-only core thread, refresh mode with ETag and 304`

---

### Task 4: Stream mode

**Files:**
- Modify: `src/adapters/serve/modes.rs`, `src/adapters/serve/hub.rs`, `tests/serve.rs`

**Interfaces:**
- Consumes: `Hub::subscribe`, `Hub::full`, `PatchSet::html(Grain)`, `Metrics`.
- Produces: `GET /?live=stream[&grain=node|region][&polyfill=1]` → `200`, `content-type: text/html; charset=utf-8`, a streaming body (`axum::body::Body::from_stream`) that yields the page (with `body_end` empty, so `</body>` is never sent), then each `PatchSet` newer than the page's `seq` as its HTML for the grain, then `<!--hb-->` every 15 s. On `RecvError::Lagged`, yields `hub.full().html(Grain::Region)` and continues.

- [ ] **Step 1: Write the failing tests** (read the body as a stream of chunks with a timeout):
  - `stream_sends_page_then_patches`: open `?live=stream`; first chunks contain the page with the logo; `show` an edit; the next chunk is one `<template for="doc" data-seq="2"` (region by default) containing the new value; the response is still open.
  - `stream_node_grain_sends_node_templates`: `?live=stream&grain=node`; after an attribute edit the chunk is a `<template for="n…">`.
  - `stream_skips_patches_older_than_the_page`: `show` before and while subscribing; no patch with `data-seq` ≤ the page's `data-seq` arrives.
  - `lagging_stream_viewer_gets_a_region_resync`: subscribe, don't read, `show` 70 edits (capacity 64), then read; a `<template for="doc"` with the latest value arrives and nothing panics.
  - `closed_stream_viewer_is_dropped_and_counted` (Review Focus 4): open, drop the client, `show` an edit; within 1 s the hub has no receiver for it (`metrics` open stream connections back to 0). Heartbeat interval is a parameter of the stream function so the test can use 50 ms.

- [ ] **Step 2: Run:** `cargo test -p xtxp-muppet --test serve stream` → FAIL.

- [ ] **Step 3: Implement.** A guard type decrements the open-connection count on drop, so a client going away (the body stream dropped by hyper) is counted down.

- [ ] **Step 4: Run:** `cargo test -p xtxp-muppet --test serve` → PASS.

- [ ] **Step 5: Commit:** `serve: stream mode, the page's response stays open`

---

### Task 5: WebSocket mode and `live.js`

**Files:**
- Create: `crates/xtxp-muppet/assets/live.js`
- Modify: `src/adapters/serve/modes.rs`, `tests/serve.rs`

**Interfaces:**
- Consumes: `Hub::subscribe`, `Hub::full`, `Metrics`.
- Produces:
  - `GET /?live=ws[&grain=…]` → the page with `<script src="/live.js" data-grain="node|region" defer></script>` in `body_end`.
  - `GET /live.js` → `assets/live.js` (`include_str!`), `content-type: text/javascript`.
  - `GET /live?grain=node|region` → WebSocket. First message: `hub.full()` region HTML; then each newer patch set's HTML for the grain, one text message per patch set; lag → a region resync.
  - `live.js` (no framework, under 150 lines): `window.xtxpLive = { applied: [] , connected: false }` for tests and metrics; finds marker pairs (processing instructions or comments `?start name="…"` / `?end`); `applyPatchSet(html)` parses the message's templates, and for each replaces the nodes between its marker pair with its content parsed by `range.createContextualFragment` in the pair's parent, inside `document.startViewTransition` when present; pushes `{seq, sent, applied: Date.now()}` to `xtxpLive.applied`; reconnects with backoff 100 ms doubling to 5 s; with `polyfill=1` in stream mode, a `MutationObserver` on `<body>` applies each `<template for>` the same way and removes it.

- [ ] **Step 1: Write the failing tests** (server side; the script's behaviour is tested in a browser in Task 7):
  - `ws_page_loads_live_js`: `?live=ws` page contains `<script src="/live.js"`, and `GET /live.js` returns JavaScript containing `startViewTransition` and `createContextualFragment`.
  - `ws_first_message_is_region_then_patches`: connect `tokio-tungstenite` to `/live?grain=node`; first message is a `<template for="doc"`; after an attribute edit, a `<template for="n…">` message.
  - `stream_polyfill_flag_adds_the_script`: `?live=stream&polyfill=1` page contains `<script src="/live.js" data-mode="stream"`.
  - `closed_ws_viewer_is_counted_down`: like Task 4's, for ws.

- [ ] **Step 2: Run:** `cargo test -p xtxp-muppet --test serve ws` → FAIL.

- [ ] **Step 3: Implement** the handlers and `live.js`.

- [ ] **Step 4: Run:** `cargo test -p xtxp-muppet --test serve` → PASS. `node --check crates/xtxp-muppet/assets/live.js` → no output.

- [ ] **Step 5: Commit:** `serve: WebSocket mode and the live.js polyfill`

---

### Task 6: Auto mode and measurement

**Files:**
- Create: `crates/xtxp-muppet/assets/metrics.js`
- Modify: `src/adapters/serve/{modes.rs,metrics.rs}`, `tests/serve.rs`

**Interfaces:**
- Consumes: everything in `serve` so far.
- Produces:
  - `GET /` with no `live` → the page with `<noscript><meta http-equiv="refresh" content="1"></noscript>` and an inline script that, if native `<template for>` works, does `location.replace('?live=stream')`, otherwise loads `/live.js` with `data-mode="ws"`. Detection: parse `<div><?start name="t"><?end><template for="t">x</template></div>` with `Document.parseHTMLUnsafe` (or a detached `<iframe srcdoc>` if absent) and check the text became `x`. The probe result is reported in Task 7.
  - `?metrics=1` (any mode) → adds `<script src="/metrics.js" defer></script>`. `metrics.js` records per patch set `{mode, grain, seq, latency_ms: applied - sent, vt_ms, }` plus `jank` (frames > 50 ms via `requestAnimationFrame` gaps), shows an overlay with p50/p95, and every 2 s `navigator.sendBeacon('/metrics/client', JSON.stringify(batch))`. In stream mode (native) it sees patches with a `MutationObserver` on marker parents; in refresh mode it records one sample at load from `<body data-sent>`.
  - `POST /metrics/client` → 204; stores batches.
  - `GET /metrics` → JSON: `{ "modes": { "refresh"|"stream"|"ws": { "open", "accepted", "patch_sets", "bytes" } }, "refresh": {"ok", "not_modified"}, "render_us": {"node": {"p50","p95"}, "region": {"p50","p95"}}, "resyncs", "process": {"rss_kb", "cpu_ms"}, "client": { "<mode>/<grain>": {"samples", "latency_ms": {"p50","p95"}, "vt_ms": {"p50","p95"}, "jank"} } }`. `process` from `libc::getrusage(RUSAGE_SELF)` (`ru_maxrss` is KB on Linux, bytes on macOS: normalise to KB).

- [ ] **Step 1: Write the failing tests:**
  - `bare_root_has_noscript_refresh_and_picker`.
  - `metrics_flag_adds_the_script`.
  - `metrics_counts_add_up`: open one stream and one ws viewer, make 3 edits, read both; `/metrics` shows `open` 1 and 1, `patch_sets` 3 each (plus the ws region start), `bytes` equal to what the test clients received.
  - `client_batches_are_aggregated`: POST two batches for `ws/node` with latencies 10 and 30 → `client["ws/node"].samples == 2`, p50 10 or 20 (state which in the assertion: nearest-rank, so 10).
  - `process_stats_are_present`: `rss_kb > 0`.

- [ ] **Step 2: Run:** `cargo test -p xtxp-muppet --test serve metrics` → FAIL.

- [ ] **Step 3: Implement.** Render time is measured in `Hub::show` around `Renderer::update`, for both grains.

- [ ] **Step 4: Run:** `cargo test -p xtxp-muppet --test serve` → PASS; `node --check` both assets.

- [ ] **Step 5: Commit:** `serve: auto mode, client metrics and /metrics`

---

### Task 7: Browser tests in real Chromium, and the probes

**Files:**
- Create: `scripts/fetch-chromium.sh`, `tests/browser/{package.json,package-lock.json,playwright.config.mjs,support.mjs,modes.spec.mjs,probes.spec.mjs}`, `docs/reports/m2-y-sweet-browser-probes.md`
- Modify: `.github/workflows/ci.yml`, `.gitignore` (`/tests/browser/node_modules`, `/tests/browser/test-results`)

**Interfaces:**
- Consumes: the `xtxp-muppet` binary (`init`, `edit`, `serve`), y-sweet in `.tools/bin` (as `e2e`), `window.xtxpLive`.
- Produces:
  - `fetch-chromium.sh`: downloads `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/1722227/chrome-linux.zip` (on macOS, `Mac_Arm/1722227/chrome-mac.zip`) into `.tools/chromium-1722227/` if missing; prints the binary path.
  - Playwright projects: `chromium-158` (`executablePath` from `CHROMIUM_158` or `.tools/chromium-1722227/chrome-linux/chrome`) and `chromium-141` (Playwright's own; `PLAYWRIGHT_BROWSERS_PATH` as set in the environment).
  - `support.mjs`: `startStack()` starts y-sweet on a free port, `init`s the logo, starts `serve` on a free port, returns `{base, edit(args), stop()}`.

- [ ] **Step 1: Write the browser tests** (they fail now only if something is wrong; each was seen to fail first by breaking it on purpose: write the expectation, run against `serve` with the feature stubbed out, then restore):
  - `modes.spec.mjs`, for each project and each of `?live=refresh`, `?live=stream` (158 only), `?live=stream&polyfill=1` (141), `?live=ws&grain=node`, `?live=ws&grain=region`:
    - after `edit` sets the cross's `stroke` to `#00ff00`, the page's cross path has that stroke **and** `namespaceURI === 'http://www.w3.org/2000/svg'` within 3 s;
    - the marker pairs are still balanced afterwards;
    - **patches parse back to the rendered tree:** after three edits, the page's `<svg>` serialised (`outerHTML`, with `view-transition-name` styles removed) equals the `<svg>` from a fresh `?live=refresh` load in the same browser.
  - `auto picks stream in 158 and ws in 141`: open `/`; 158 ends on `?live=stream`, 141 has `xtxpLive.connected === true`.
  - `javascript off gets refresh`: a context with `javaScriptEnabled: false` on `/`; after an edit the page shows it within 3 s.
  - `live.js reconnects`: restart `serve`; after it's back, an edit still arrives.
- [ ] **Step 2: Write `probes.spec.mjs`** (records, doesn't assert pass/fail): in 158, (a) stream `grain=node`: the patched element's `namespaceURI`; (b) whether a streamed region patch starts a view transition (`document.getAnimations()` length during the 200 ms after the patch, with `::view-transition` styles present); (c) in ws `grain=node`, whether SVG elements get their own transition group (`getComputedStyle(el).viewTransitionName` and animations on `::view-transition-group(cross)`); (d) the `<template for>` detection result. Writes JSON to `tests/browser/test-results/probes.json`.
- [ ] **Step 3: Run:** `scripts/fetch-chromium.sh && cd tests/browser && npm ci && npx playwright test` → all `modes` pass in both projects.
- [ ] **Step 4: Record** `probes.json` in `docs/reports/m2-y-sweet-browser-probes.md` with the browser versions.
- [ ] **Step 5: CI:** a `browser` job: checkout, Rust, cache `.tools` keyed `ysweet-4f1909b-chromium-1722227`, install y-sweet as in `e2e`, `scripts/fetch-chromium.sh`, `cargo build --release -p xtxp-muppet`, `npm ci` and `npx playwright install-deps chromium`, `npx playwright install chromium`, `npx playwright test`.
- [ ] **Step 6: Commit:** `browser tests in Chromium 158 and 141, with probes`

---

### Task 8: `bench-browser`

**Files:**
- Create: `tools/bench-browser/{Cargo.toml,src/main.rs,src/lib.rs,src/viewers.rs,src/editor.rs,src/report.rs}`, `scripts/bench-browser.sh`
- Modify: workspace `Cargo.toml` (member), `.github/workflows/ci.yml` (smoke step in `browser`)

**Interfaces:**
- Consumes: `xtxp-wire::Peer`, `xmesh::Xmesh` and `xtxp_muppet::adapters::ws`-style connection code (copy the minimal WebSocket loop rather than reuse the core); `serve`'s `/metrics`.
- Produces:
  - CLI (clap): `--url`, `--mode refresh|stream|ws`, `--grain node|region`, `--viewers N`, `--edits-per-sec R`, `--seconds S`, `--ysweet HOST:PORT` (default `localhost:8080`), `--doc` (default `logo`), `--out results.csv` (appends).
  - `editor.rs`: a peer on y-sweet that alternates the cross's `stroke` between `#ff5436` and `#00ff00` and `stroke-width` between `9.9` and `14`, R times a second, recording `(snapshot_hash, sent_at)` per edit.
  - `viewers.rs`: N async viewers per mode; each records `(seq, snapshot or template contents, arrived_at, bytes)`. A viewer matches an arrival to an edit by the patch's content (the stroke values) and the editor's snapshot order.
  - `report.rs`: `pub struct Row { mode, grain, viewers, rate, p50_ms, p95_ms, p99_ms, bytes_per_viewer_s, server_cpu_pct, server_rss_kb, errors, missed }`; CSV append and a Markdown table.
  - `bench-browser.sh`: for each mode × grain (refresh; stream/region; stream/node; ws/node; ws/region) × viewers 1, 10, 100, 1000, runs 30 s at 5 edits/s; writes `bench-results.csv` and `bench-results.md`.

- [ ] **Step 1: Write the failing tests** (`tools/bench-browser/tests/`, against an in-process `serve` from `xtxp-muppet` with a real y-sweet when available, as `e2e` does):
  - `report_percentiles`: `Row` built from latencies `[1..=100]` → p50 50, p95 95, p99 99.
  - `smoke_each_mode`: 10 viewers, 2 edits/s, 3 s, per mode → `missed == 0`, `errors == 0`, `p50_ms > 0`.
- [ ] **Step 2: Run:** `cargo test -p bench-browser` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run:** `cargo test -p bench-browser` → PASS; run `scripts/bench-browser.sh` locally with viewers 1 and 10 only (`VIEWERS="1 10"`), and record the table in the ledger.
- [ ] **Step 5: CI smoke:** in the `browser` job, `bench-browser` with 10 viewers per mode for 5 s.
- [ ] **Step 6: Commit:** `bench-browser: viewers per mode, an editor, latency and bandwidth`

---

### Task 9: Try it, README, report and spec updates

**Files:**
- Modify: `scripts/try-it.sh`, `README.md` (xtxp-rs); `src/content/docs/build/m1-y-sweet-report.mdx`, `src/content/docs/spec/browser.mdx`, `docs/plans/README.md` (website)

- [ ] **Step 1: `try-it.sh`:**
  - `--reset`: if `lsof -iTCP:8080 -sTCP:LISTEN` finds a listener, say "y-sweet is running on 8080; stop it first" and exit 1; otherwise ask `Delete .ysweet-data/demo and .ysweet-data/logo? [y/N]` and delete on `y`.
  - `--browser`: after seeding `demo`, also seed `logo` from `crates/xmesh/tests/fixtures/xtxp-logo.svg` (same "already there" handling), start `target/release/xtxp-muppet serve logo` in the background (killed by the EXIT trap), check port 3000 first as for 8080, and print the URLs from the spec's section 9 and `target/release/xtxp-muppet open logo`.
  - `bash -n` and `shellcheck` clean; run it in the container and record `curl -s localhost:3000/?live=refresh | head -5`.
- [ ] **Step 2: README:** a "In a browser" section: `try-it.sh --browser`, the URLs, what each mode is, `?metrics=1`, `/metrics`, `bench-browser`, and that native stream mode needs Chrome or Edge 150+.
- [ ] **Step 3: Full suite:** fmt, clippy, workspace tests, release fuzzer, e2e, `serve`, browser tests. Push, and watch all CI jobs to green.
- [ ] **Step 4: Website:** add a "The browser (M2-y-sweet part A)" section to the report page with: the probe table (spec section 4 plus Task 7's `probes.json`), the container's bench table (marked as container numbers, viewers 1 and 10), and "David's Chrome: pending the [checklist](…)". In `spec/browser.mdx`'s "Still open", record under **SVG**: native `<template for>` parses patch content in an HTML context, so SVG elements can only be patched by region natively; per-node SVG patches need contextual parsing (the polyfill). `npm run build` clean; PR to `website`.
- [ ] **Step 5: Commit** (xtxp-rs): `try-it --browser and --reset, README`.
