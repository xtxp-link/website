# Handover to Claude Code: XTXP MVP (M1, then M2)

**Status:** ready to start, 2026-10-18. Every review item that blocks M1 or M2 has been decided (decisions 17 to 23 on the spec site).

## 1. Repositories

Three repositories under the `xtxp-link` GitHub organisation, each with one job. All are public by default, and the layout is set for the first milestones; expect it to be tidied later. The site maps them under Contribute → Repositories.

| Repository | What it holds | Status |
| --- | --- | --- |
| `xtxp-link/website` | **The spec** and its public site, https://xtxp.link (Astro Starlight, deployed by Cloudflare on push to `main`), plus **plans and handovers** in `docs/plans/`, including this file. | Exists |
| `xtxp-link/xtxp-rs` | **The Rust reference implementation**: Xmesh, the wire crate, the host, CLI peers, the fuzzer, feature files and test vectors. | David creates it, public and empty, before M1 |
| `xtxp-link/inkscape` | **The Inkscape fork**, with `xtxp-rs` vendored as a submodule and linked through Xmesh's C interface. | Forked for M2 |

Behaviour (the spec, decisions, feature-level intent) changes in `website`; code changes in `xtxp-rs` and `inkscape`. A piece of work that changes both lands in both.

In `website`: diagrams are PlantUML in `diagrams/`, rendered with `npm run diagrams` (needs Java), and the SVGs are committed. Fetch and rebase before every push, because David also edits the site.

## 2. What this is

XTXP lets many people edit one XML document at once, with branchable history, from a forked Inkscape down to a browser with JavaScript switched off. SVG is the first document type.

**The spec is the source of truth:** https://xtxp.link, built from the `xtxp-link/website` repository. Read these pages before writing code, in this order:

1. [What is XTXP?](https://xtxp.link/overview/what-is-xtxp/) and [North star](https://xtxp.link/overview/north-star/)
2. [Architecture](https://xtxp.link/overview/architecture/)
3. [The Math](https://xtxp.link/spec/math/), [The Wire](https://xtxp.link/spec/wire/), [Identity and access](https://xtxp.link/spec/identity/), [Sessions and history](https://xtxp.link/spec/sessions/)
4. [Verification](https://xtxp.link/build/verification/), [Milestones](https://xtxp.link/build/milestones/), [The Inkscape fork](https://xtxp.link/build/inkscape-fork/)
5. [Decision log](https://xtxp.link/discussion/decisions/) and [Open questions](https://xtxp.link/discussion/open-questions/)
6. [Prior art](https://xtxp.link/discussion/prior-art/): read the Yrs, y-sweet, Yjs sync protocol, Inkscape undo and Inkboard entries before designing the matching parts

## 3. Where each milestone runs

| Stage | Where | Why |
| --- | --- | --- |
| Step 0 and M1 | **A cloud Claude Code session** | Pure Rust, headless, no UI. Needs only GitHub and crates.io. |
| M2 | **Claude Code on David's own machine** | Building Inkscape needs its full native toolchain and a desktop to run it on. |

**Before the M1 session:** create `xtxp-link/xtxp-rs` (empty) and attach it to the session along with `xtxp-link/website`, so spec updates can land in the same piece of work.

**Before the M2 session:** check out `website` and `xtxp-rs` locally, fork Inkscape to `xtxp-link/inkscape` and check that out too, install a Rust toolchain, and follow Inkscape's own build instructions for the platform until a stock Inkscape builds and runs.

## 4. Ground rules

- **Vocabulary.** A line of a document's history is a **session** (a branch, in git's terms), down to one user's private state. xtxp.link is a **muppet disco**: it finds hosts and hosts nothing, and it's a later milestone.
- **Behaviour first.** Write Gherkin `.feature` files and JSON test vectors before implementation code. The vectors are the contract.
- **Pure core.** Xmesh has no networking, no file access, no clocks and no threads. Everything that touches the world is an adapter.
- **One language for the MVP: Rust.** Xmesh is a thin layer on Yrs. Hosting is a small Rust server.
- **Make something, get feedback, understand, make the next thing.** Build on stable open foundations first; they have already found and fixed problems a fresh design would rediscover.
- **Reuse before writing.** Check Yrs (including its XML types), y-sweet and the Yjs sync protocol first. Look at Inkboard's code before writing the Inkscape adapter.
- **No-JS test.** Every user-facing decision must still work in a browser with JavaScript off.
- **Keep the spec current.** When a decision is made or changed, update the relevant spec page and the decision log in `xtxp-link/website` in the same piece of work. The log lists only decisions in force; don't narrate reversals. Decisions are David's: propose, then write them in once he agrees.
- **Cut scope aggressively.** Don't build roadmap items (ledger, keyframes, native C++, Elixir/BEAM, signed hash chains) or later milestones early.

## 5. Working model

One **principal** agent owns everything that crosses a boundary: CRDT semantics, the wire protocol, identity and access, the feature files and vectors, and the cross-implementation tests. One **expert sub-agent per stack** does the building and answers to the vectors:

| Expert | Owns in the MVP |
| --- | --- |
| Engine (Rust) | `xmesh`: XML on Yrs's XML types, XML Patch subset, canonical XML; C interface (for M2) |
| Hosting (Rust) | `muppet-host`: WebSocket endpoint, identity handshake, admission by session, storage, server-side MUPPET (M2) |
| Wire | `xtxp-wire`: Yjs sync messages plus XTXP's identity and access messages |
| Inkscape fork (M2) | The MUPPET adapter in the fork |
| Web, no JS (M2) | The HTML edit loop: forms, redirects, ETag polling |

**Process:** if the superpowers plugin is installed, start with its brainstorming skill to settle the open points in section 9, then write a plan, then build test-first. Otherwise follow the same order by hand.

## 6. Step 0: review y-sweet (before any hosting code)

Review y-sweet for reuse as the basis of hosting. The checklist is on the [Milestones page](https://xtxp.link/build/milestones/#before-m1-review-y-sweet): fit for Xmesh documents and XTXP's messages, tokens versus key-based grants, sessions and forking, storage, hosting options, licence and maintenance.

**Deliverables:**
- A recommendation: extend y-sweet, borrow from it, or start fresh.
- A recommendation on hosting for M1: a self-hosted binary or Cloudflare Workers with Durable Objects.
- Both written up on the spec site, with a decision-log entry once David agrees.

## 7. M1: headless convergence (cloud)

**Goal:** prove convergence, reconnect sync and the identity handshake over a real network before anyone draws anything.

### Repository layout

A Cargo workspace in `xtxp-link/xtxp-rs`:

```
crates/xmesh          pure core: schema on Yrs, moves, XML Patch subset, canonical XML
crates/xtxp-wire      message types and framing
crates/muppet-host    headless MUPPET hosting sessions over WebSocket
crates/xtxp-cli       CLI peer: replays a vector stream, can drop and reconnect
tools/fuzzer          generates JSON vectors from the feature files' behaviours
tools/chaos-proxy     drops, delays and duplicates frames between peers and host
features/             Gherkin feature files
vectors/              generated and hand-written JSON vectors
```

### Scope

- **Document model:** Yrs's own XML types, as on the [Math page](https://xtxp.link/spec/math/#data-model) (decision 20): elements, attributes and text; comments, processing instructions and CDATA as elements with reserved names (settle the encoding); expanded names; node IDs from creating items; fixed genesis.
- **Moves:** a delete plus an inserted copy, in one transaction. Write the [known gaps](https://xtxp.link/spec/math/#moves-in-v1-a-copy) as expected-failure vectors; don't build a tree layer of our own yet.
- **Snapshots:** state vector plus delete set; a short hash in URLs and ETags; Yrs garbage collection off (decision 19).
- **Canonical XML:** [canonical form v0](https://xtxp.link/spec/math/#canonical-form-v0) (decision 21).
- **XML Patch:** the `add`, `replace` and `remove` subset needed by the vectors, for import and export only.
- **Wire:** Yjs sync step 1 and 2 plus updates, as Yrs v1 updates in XTXP frames over WebSocket; `hello`, `challenge`, `prove`, `bind`; `grant` and `revoke`. A starting point that David expects to need further work (decision 21).
- **Identity:** Ed25519 keys loaded from files, every signature domain-tagged as on the [Identity page](https://xtxp.link/spec/identity/#what-gets-signed) (decision 22). Static grants signed by the owner. Sign-in to fetch keys is out of scope.
- **Sessions:** one shared session, `@main`. Each peer connection edits in its own session with a fresh client ID, and the host admits whole sessions into `@main` by merging; a refused session is simply not merged (decision 19). Named forks, previews and trust come later.
- **Storage:** files on disk; append updates, compact periodically.
- **Hosting:** one host binary.

### Done when

1. Every vector converges under many shuffled delivery orders: same SHA-256 of canonical XML, no cycles, idempotent re-delivery. The known move gaps run as expected failures.
2. Three CLI peers, one of them a late joiner, connected to one host over WebSocket through the chaos proxy, end with identical hashes.
3. A late joiner loads the full state in one update.
4. A key without a write grant has its session refused: never merged into `@main`, and the other peers keep converging.
5. After a revocation reaches the host, that key's session stops being merged.
6. A signature made for one host, session or purpose is rejected anywhere else.
7. A fork rebuilt from its snapshot keeps content deleted after the fork, and deleting a shape changes the snapshot hash.
8. All of the above runs in CI.

## 8. M2: Inkscape plus a browser with no JavaScript (local)

**Goal:** the first demo a person can see, and a direct test of the north star.

### Scope

- **Xmesh C interface**, linked into the fork in `xtxp-link/inkscape`, which vendors `xtxp-rs` as a submodule; its build needs a Rust toolchain. CI rebases the fork onto Inkscape's main branch on a schedule.
- **Inkscape adapter:** start from Inkboard's code (`src/jabber_whiteboard/` in Inkscape 0.46). Capture edits at Inkscape's undo transaction commit, so each action becomes one batch of operations, and apply incoming operations outside the local undo stack. Follow the [adapter contract](https://xtxp.link/build/inkscape-fork/#the-adapter-contract) (decision 23):
  - a side table maps node IDs to Inkscape's XML nodes; nothing extra is written into the document
  - echoes are suppressed while remote edits are applied
  - every XML node kind maps, comments, processing instructions and CDATA included; warn only on XML that isn't well-formed
  - `id`s are never rewritten: the document is exactly the user's version
  - undo and other whiteboard semantics come from Inkboard for this first implementation; tldraw and Miro come later
  - test the known Inkboard pitfalls: automatically named gradients and patterns, `defs` and metadata, and new windows
- **Duplicate ids:** after a merge, detect and flag them as a [conflict above the CRDT](https://xtxp.link/spec/sessions/#conflicts-above-the-crdt). The resolution algorithm is open; don't invent one.
- **Server-side MUPPET**, in the host binary: renders the drawing as HTML and SVG, accepts edits as form POSTs, redirects, and serves `ETag`/`304` for meta-refresh polling. The page can be rich HTML and CSS, but every edit is a form POST carrying its node ID, the snapshot hash the page was rendered from, and a CSRF token ([Addressing](https://xtxp.link/spec/addressing/#forms)). Don't sanitise or block scripts: rendering safety is a note to revisit.
- **No-JS identity:** an ephemeral key tied to the HTTP session (a cookie may keep it), granted access by the drawing's owner.
- **Addressing:** the host serves its own sessions at `https://{host}/{path}@{ref}`, with bare URLs redirecting to `@main`. Native documents only; no muppet disco.

### Done when

1. Inkscape and a browser with JavaScript disabled edit the same drawing, and both see each other's changes.
2. One Inkscape action becomes one batch of operations, and Ctrl+Z in Inkscape undoes only that user's own actions (the starting semantics).
3. Unchanged polls return `304 Not Modified`.
4. Comments, processing instructions and CDATA written by one Inkscape arrive intact in the other.
5. Two sessions creating the same `id` merge, converge, and the duplicate is flagged.

## 9. Open points to settle along the way

- **Reserved names** for comments, processing instructions and CDATA inside Yrs's XML types.
- **Message framing:** how XTXP's own messages sit alongside the Yjs sync messages.
- **Hosting:** a self-hosted binary or Durable Objects, from the y-sweet review.
- **Snapshot hashes:** which hash, how short, and how it's written after `@`.

Propose answers to David; don't settle them silently. Everything else on the [open questions](https://xtxp.link/discussion/open-questions/) page can wait until after M2.

## 10. Out of scope for the MVP

Ledger and keyframes, the XMPP bridge, the muppet disco (discovery, the bouncer, federation), live web branching, the sketch-level [use cases](https://xtxp.link/overview/use-cases/), the Wasm MUPPET (M3), sign-in to fetch keys, named forks and previews beyond what M2 needs, sessions on other hosts and trust between them, rendering safety, signed hash chains, native C++ and Elixir/BEAM.

## 11. Background

A spec review was run on 2026-10-18 by an independent Opus agent (Fable was intended but needed usage credits; it can be re-run on Fable later). The report is [`2026-10-18-spec-review.md`](2026-10-18-spec-review.md), and David's decisions on it are recorded in [`2026-10-18-review-decisions.md`](2026-10-18-review-decisions.md) and on the site (decisions 19 to 23). The report predates the move from "branch" to "session" and from "gateway" to "muppet disco". Items in section C of the decisions list wait until after M2.
