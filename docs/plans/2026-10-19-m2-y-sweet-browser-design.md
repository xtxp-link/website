# M2-y-sweet, part A: the browser as a view (design)

**Status:** design approved by David in conversation, 2026-10-19, section by section. This file is the written spec for his review; the implementation plan follows once he approves it.

M1-y-sweet ([report](https://xtxp.link/build/m1-y-sweet-report/)) put two terminals on one drawing through a stock y-sweet. M2-y-sweet adds a browser and the Inkscape fork. They meet only at the y-sweet document, so each gets its own spec. This one is **part A, the browser**. The Inkscape fork (part B) needs Inkscape's native toolchain, and is specified and built on David's machine later.

It builds the [browser as client](https://xtxp.link/spec/browser/) (decision 26) as a watch-only first step. The CLI muppet edits the XTXP logo, and a browser shows each change: by refreshing, by the page's own response staying open, or through a small WebSocket polyfill. The spike measures all three.

## 1. What part A is for

- **Show a drawing changing live in a browser**, edited from the TUI, with as little JavaScript as each delivery mode allows.
- **Answer the browser spec's open questions** with evidence:
  - whether markers and `view-transition-name`s work inside inline SVG;
  - whether a streamed patch starts a view transition by itself;
  - how a page knows to go live.
- **Measure the three delivery modes** against each other: latency and jank in the browser, and server load, scalability and bandwidth.

## 2. Decisions for part A

Agreed by David during brainstorming on 2026-10-19, as spike-level decisions like M1-y-sweet's P1 to P9.

| # | Decision |
| --- | --- |
| B1 | **Part A first, and on its own.** The browser and the Inkscape fork share nothing but the document; part B gets its own spec, written on David's machine. |
| B2 | **Watch only.** The CLI muppet is the only editor. Forms (decision 23), popover handles and confirmation patches are a follow-up. |
| B3 | **Three delivery modes from one renderer:** refresh (the no-JS baseline), stream (the page's response stays open, the spec's patch stream) and WebSocket (a small polyfill). One page format and one patch format serve all three. |
| B4 | **Each mode can be forced** with `?live=refresh`, `?live=stream` or `?live=ws`, and patch size with `?grain=node` or `?grain=region`, for comparing modes. With no parameters the page picks for itself (section 6.4). |
| B5 | **`xtxp-muppet serve`:** a subcommand of the existing binary. One process holds **one** y-sweet connection per document and fans the same rendered patches out to every viewer, as XTXP's own host would. |
| B6 | **Measurement is part of the build:** client metrics behind `?metrics=1`, a server `/metrics` endpoint, and a load tool, `tools/bench-browser`. |
| B7 | **The document is the XTXP logo** (`logo-on-blue.svg` from this site), seeded as `logo`. |
| B8 | **Real browsers in the tests:** a pinned Chromium trunk snapshot (158, with native `<template for>`) and Chromium 141 (without it), both driven by Playwright. |
| B9 | **David cross-tests in his own Chrome** from a session on his Mac, following the [browser checklist](2026-10-19-m2-y-sweet-browser-checklist.md). |

## 3. Pieces

```
crates/xtxp-muppet/src/render/    the renderer: tree → page and patches (pure, no I/O)
crates/xtxp-muppet/src/adapters/serve/
                                  HTTP server, fan-out, the three modes, /metrics
crates/xtxp-muppet/assets/live.js the polyfill and the optional metrics script
tools/bench-browser               the load tool
tests/browser/                    Playwright end-to-end tests (Node)
scripts/fetch-chromium.sh         downloads the pinned Chromium snapshot into .tools
scripts/try-it.sh                 + --browser and --reset
crates/xmesh/tests/fixtures/xtxp-logo.svg
```

`serve` is a new set of adapters on the existing hexagonal core (P9). The core runs in watch-only mode against y-sweet, and a new View hands each screen to the renderer. The renderer is a pure module: it takes trees and gives HTML, with no network, clock or threads, and it is tested that way.

## 4. What the probe found

A quick probe in Chromium 158 (trunk snapshot 1722227) on 2026-10-19, before the design was settled:

| Probe | Result |
| --- | --- |
| `<template for>` patching HTML | Works natively, with no flag; the template is consumed. |
| Markers inside inline `<svg>` | Found: the patch lands in the right place. |
| The patched SVG element | **Parsed as HTML, not SVG.** A replacement `<rect>` lands in the XHTML namespace and never draws; its `/>` isn't honoured, so the end marker nests inside it. |
| `streamHTML`, `setHTMLUnsafe`, `startViewTransition` | All present by default. |
| Markers in the DOM | Processing-instruction nodes in 158; older browsers parse `<?start …>` as comments. |

So **native patches can't replace individual SVG elements**: patch content is parsed in an HTML context. Native stream mode patches SVG by region, and the polyfill can still patch per node by parsing in the SVG parent's context. This shapes sections 5 and 6, and goes into the browser spec's open questions.

## 5. Rendering

### 5.1 The page

An HTML page with a header line (document name, snapshot hash, connection state) and the document's root element as **inline `<svg>`**. Comments and processing instructions around the root aren't shown. The page has `@view-transition { navigation: auto; }` and a little CSS; no other styling work.

### 5.2 Markers and names

Every element and text node inside the SVG is wrapped in markers named from its node ID:

```html
<?start name="n2-7"><path id="cross" … style="view-transition-name: cross"/><?end>
```

- **Marker names** are `n{client}-{clock}`.
- **`view-transition-name`** is the element's `id` made into a valid CSS identifier where it has one, otherwise the node ID name; text nodes get none. Duplicates within the page get a suffix.
- **Attributes** are written back with their usual prefixes (`inkscape:label`, `xlink:href`, `sodipodi:…`); unknown namespaces are written as `ns{n}:local` with an `xmlns:ns{n}` declaration on the root.
- **Escaping:** attribute values and text are HTML-escaped. Text inside `<style>` is written raw, as the parser expects, with `</` escaped.
- **No sanitising**, as the M2 plan says ("rendering safety is a note to revisit"). This is a local, watch-only spike on documents its user wrote.

**Region marker:** the whole `<svg>` is also wrapped in a marker outside it, `<?start name="doc">…<?end>`, which sits in HTML and can always be patched natively.

### 5.3 What goes in a patch

The core's existing "changed" list covers attribute and text edits only, so the renderer keeps its own record. For each node it remembers its name and attributes (or its text) and the list of its children's IDs. After each update:

- a node is **dirty** if it's new, or any of those changed; an insert or delete makes the parent dirty;
- the patch set is one patch per dirty node with no dirty ancestor, each re-rendering that node's whole subtree;
- with `grain=region`, any change gives one patch for the region marker `doc`.

### 5.4 The patch format

Exactly the spec's form, with two attributes added for measurement:

```html
<template for="n2-7" data-seq="41" data-sent="1760900000123"><?start name="n2-7">…<?end></template>
```

`data-seq` is the change's sequence number in this `serve` process; `data-sent` is the server's time in milliseconds when it was published. A patch set is all the templates for one change, sent together.

## 6. The server and the three modes

### 6.1 Process

```
xtxp-muppet serve logo --listen 127.0.0.1:3000 [--server localhost:8080]
```

- **The y-sweet side** runs on its own thread, as `open --read-only` does: the core in watch-only mode, reconnecting as before. Its View passes each screen to the renderer.
- **Fan-out:** each change becomes one patch set (sequence number, send time, snapshot hash, node-grain and region-grain HTML) published once on a broadcast channel. The server keeps the current full page and its snapshot hash.
- **The web side** is an **axum** server on a multi-threaded tokio runtime, so serving viewers doesn't compete with the y-sweet loop.
- **One document per process.** Its page is `/`.

### 6.2 Getting the start right

- A viewer **subscribes before its first render** and skips patch sets with a sequence number at or below the render's.
- A viewer that **falls behind** the broadcast buffer gets one region patch (the whole document) instead of the backlog, so a slow viewer never makes the server buffer without limit.
- Every **new WebSocket connection** starts with a region patch.

### 6.3 The modes

| Mode | URL | How changes arrive | JavaScript |
| --- | --- | --- | --- |
| **Refresh** (baseline) | `/?live=refresh` | `<meta http-equiv="refresh" content="1">` (`&every=N` to change it). The `ETag` is the snapshot hash; an unchanged poll gets `304 Not Modified`. Cross-document view transitions animate each reload where supported. | none |
| **Stream** | `/?live=stream` | The full page, then the response stays open, flushing patch sets as `<template for>` children of `<body>`. A heartbeat comment every 15 s finds dead connections. Default grain: **region**, because native patches can't replace SVG elements (section 4). | none (`&polyfill=1` lets the polyfill apply the templates, for browsers without `<template for>`) |
| **WebSocket** | `/?live=ws` | The full page plus `live.js`, which opens `/live` and receives each patch set as one text message. Default grain: **node**. | `live.js` |

### 6.4 With no parameters

The page carries the refresh as `<noscript><meta http-equiv="refresh" …></noscript>`, so a browser with JavaScript off gets the baseline. With JavaScript on, one small inline script checks for native `<template for>` support. If it's there, the script moves to `?live=stream`; otherwise it loads `live.js` and uses the WebSocket. How best to detect `<template for>` is itself one of the spec's open questions; the build finds a test that works and the report records it.

### 6.5 The polyfill (`live.js`)

A few dozen lines, no framework:

- **Finding markers:** walks the document for `<?start name>` / `<?end>` pairs, as processing-instruction nodes or as comments (older browsers), and keeps a map from name to the pair.
- **Applying a patch:** removes the nodes between the pair, and inserts the patch's content parsed **in the context of the markers' parent** (`Range.createContextualFragment`), so an SVG patch gives SVG elements. New markers in the content are indexed.
- **View transitions:** each patch set is applied inside `document.startViewTransition()` where the browser has it, otherwise directly.
- **Reconnects** with backoff after a drop, as the muppet does; the server's first message on every connection is a region patch, so nothing is missed.
- In stream mode with `&polyfill=1`, a `MutationObserver` picks up each streamed `<template for>` and applies it the same way.

## 7. Measurement

### 7.1 In the browser (`?metrics=1`, any mode)

A small script records, for each patch set:

- **latency:** from `data-sent` to when the patch is applied. In WebSocket mode `live.js` reports it; in stream mode a `MutationObserver` sees the native patch land; in refresh mode it's taken at page load, against the render time stamped on the page.
- **view transition duration**, from `transition.finished`;
- **jank:** frames longer than 50 ms.

Every 2 s it sends a batch to `POST /metrics/client` with `sendBeacon`, and shows p50 and p95 latency in a small overlay. On one machine the server's and browser's clocks agree; across machines the report says latency is approximate.

### 7.2 On the server (`GET /metrics`)

JSON with:

- per mode: open connections, connections accepted, patch sets and bytes sent, and for refresh `200` and `304` counts;
- render time per change (p50, p95), for both grains;
- region resyncs for viewers that fell behind;
- process memory and CPU time, through `getrusage`, so it works on macOS and Linux;
- the browser metrics received, aggregated per mode and grain.

### 7.3 Load (`tools/bench-browser`)

```
bench-browser --url http://127.0.0.1:3000 --mode ws --grain node --viewers 100 \
              --edits-per-sec 5 --seconds 30 [--ysweet localhost:8080 --doc logo]
```

- **Viewers** are lightweight readers, not browsers: refresh polls with `If-None-Match`; stream reads the open response and picks out each `<template for>`; WebSocket reads messages.
- **Edits** come from a peer built into the tool, on Xmesh and `xtxp-wire` like the muppet. It alternates the cross's stroke colour and width at the given rate and records when each edit was sent, and the snapshot hash it produces.
- **End-to-end latency** runs from an edit being sent to the patch set carrying its snapshot reaching each viewer: y-sweet, the server muppet and delivery together. The server's own share is reported from `data-sent`.
- **Output:** one row per run: mode, grain, viewers, edit rate, latency (p50, p95, p99), bytes per viewer per second, server CPU % and memory (from `/metrics` before and after), and errors or missed patch sets. CSV, plus a Markdown table.
- `scripts/bench-browser.sh` runs every mode and grain at 1, 10, 100 and 1,000 viewers.

**Caveats the report will state:** the tool and the server share one machine and compete for CPU; 1,000 connections may need a higher `ulimit -n`; the numbers compare modes with each other and aren't production capacity.

## 8. Testing

Test-first throughout, as in M1-y-sweet.

- **Renderer (unit tests, pure):**
  - markers and names for every node kind, including text and `<style>`;
  - escaping, namespace prefixes, duplicate transition names;
  - dirty-node detection for attribute, text, insert, delete and move, with no patch for an ancestor of a dirty node, and region grain;
  - patches parse back to the rendered tree.
- **Server (in-process):** a fake source feeds screens straight to the fan-out, with no y-sweet.
  - refresh: `200`, then `304` for the same `ETag`, then `200` after a change;
  - stream: the page, then a patch set per change on the same open response;
  - WebSocket: a region patch first, then patch sets;
  - a viewer that falls behind gets a region patch;
  - `/metrics` counts add up.
- **End to end:** a real y-sweet, `xtxp-muppet serve`, and headless Chromium through Playwright, in `tests/browser/`:
  - for each mode and grain, `xtxp-muppet edit` recolours the cross and the browser's SVG shows it as an SVG element in the SVG namespace (within the poll interval for refresh);
  - **native stream mode in Chromium 158**; **the polyfill in Chromium 141**, where `<template for>` doesn't exist;
  - the no-parameter page picks stream in 158 and the WebSocket in 141, and the refresh loop with JavaScript off;
  - `live.js` reconnects after the server drops it;
  - the first probes for the report: whether a streamed patch starts a view transition, and whether SVG children take a `view-transition-name`.
- **`bench-browser`:** a short smoke run in CI (10 viewers per mode, 5 s) so it doesn't rot. The full matrix runs on David's Mac.
- **CI:** a new `browser` job fetches and caches the Chromium snapshot (`scripts/fetch-chromium.sh`, revision 1722227) and y-sweet, then runs `tests/browser`. Chromium 141 is Playwright's own build.

## 9. Try it

`scripts/try-it.sh --browser`:

1. as before, builds y-sweet and the muppet and starts y-sweet;
2. seeds the document `logo` from `crates/xmesh/tests/fixtures/xtxp-logo.svg`, unless it exists;
3. starts `xtxp-muppet serve logo` on `localhost:3000`;
4. prints the URLs (`/`, `/?live=refresh`, `/?live=stream`, `/?live=ws`, each with `&metrics=1` to measure) and the command for the editor: `target/release/xtxp-muppet open logo`.

`--reset` deletes the stored documents (`.ysweet-data/demo` and `.ysweet-data/logo`), after asking, so the run seeds them fresh. It refuses while something is listening on port 8080, since a running y-sweet would write its copy straight back.

## 10. What the spike reports

A new section of the M1-y-sweet report, or its own page under "Building it" once there is more than a section's worth:

- the answers to the browser spec's open questions, with which browser each came from (Chromium 158 and 141 here; David's Chrome);
- the latency, bandwidth and server-load table for each mode and grain;
- screenshots and a short screen recording from David's Chrome, from the [checklist](2026-10-19-m2-y-sweet-browser-checklist.md);
- amendments to the browser spec, starting with section 4's finding.

## 11. Not in part A

- **Editing from the browser:** forms, popover handles and confirmation patches (B2).
- **Auth, TLS and reaching the server from another machine.** Sharing a link with a friend needs these, with y-sweet's token auth: the next iteration.
- **More than one document per `serve` process.**
- **The Inkscape fork** (part B).
- **Awareness** (other people's selections).
