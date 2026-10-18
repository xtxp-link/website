# Handover to Claude Code: XTXP MVP (M1, then M2)

**Status:** draft for David's review, 2026-10-18. Items marked *pending review* depend on decisions David makes after reading the spec review (see "Pending decisions" below).

## 1. What this is

XTXP (XML to XML Protocol) lets many people edit one XML document at once, with branchable history, from a forked Inkscape down to a browser with JavaScript switched off. SVG is the first document type.

**The spec is the source of truth:** https://xtxp.link, built from the `xtxp-link/website` repository. Read these pages before writing code, in this order:

1. [What is XTXP?](https://xtxp.link/overview/what-is-xtxp/) and [North star](https://xtxp.link/overview/north-star/)
2. [Architecture](https://xtxp.link/overview/architecture/)
3. [The Math](https://xtxp.link/spec/math/), [The Wire](https://xtxp.link/spec/wire/), [Identity and access](https://xtxp.link/spec/identity/), [Sessions and history](https://xtxp.link/spec/sessions/)
4. [Verification](https://xtxp.link/build/verification/), [Milestones](https://xtxp.link/build/milestones/), [The Inkscape fork](https://xtxp.link/build/inkscape-fork/)
5. [Decision log](https://xtxp.link/discussion/decisions/) and [Open questions](https://xtxp.link/discussion/open-questions/)
6. [Prior art](https://xtxp.link/discussion/prior-art/): read the Yrs, Wallace, y-sweet, Yjs sync protocol, Inkscape undo and Inkboard entries before designing the matching parts

## 2. Ground rules

- **Vocabulary.** A line of a document's history is a **session** (a branch, in git's terms), down to one user's private state. xtxp.link is a **muppet disco**: it finds hosts and hosts nothing. Both are on the spec site (decisions 17 and 18).

- **Behaviour first.** Write Gherkin `.feature` files and JSON test vectors before implementation code. The vectors are the contract.
- **Pure core.** Xmesh has no networking, no file access, no clocks and no threads. Everything that touches the world is an adapter.
- **One language for the MVP: Rust.** Xmesh is a thin layer on Yrs. Hosting is a small Rust server.
- **Reuse before writing.** Check Yrs, `yrs_tree`, y-sweet and the Yjs sync protocol first. Look at Inkboard's code before writing the Inkscape adapter.
- **No-JS test.** Every user-facing decision must still work in a browser with JavaScript off.
- **Keep the spec current.** When a decision is made or changed, update the relevant spec page and the decision log in `xtxp-link/website` in the same piece of work. The log lists only decisions in force; don't narrate reversals.
- **Don't build roadmap items** (ledger, keyframes, native C++, Elixir/BEAM, signed hash chains) or later milestones early.

## 3. Working model

One **principal** agent owns everything that crosses a boundary: CRDT semantics, the wire protocol, identity and access, the feature files and vectors, and the cross-implementation tests. One **expert sub-agent per stack** does the building and answers to the vectors:

| Expert | Owns in the MVP |
| --- | --- |
| Engine (Rust) | `xmesh`: tree schema on Yrs, cycle-safe moves, XML Patch subset, canonical XML; C interface (for M2) |
| Hosting (Rust) | `muppet-host`: WebSocket endpoint, identity handshake, admission and grants, storage, server-side MUPPET (M2) |
| Wire | `xtxp-wire`: Yjs sync messages plus XTXP's identity and access messages |
| Inkscape fork (M2) | The MUPPET adapter in the fork |
| Web, no JS (M2) | The HTML edit loop: forms, redirects, ETag polling |

**Process:** if the superpowers plugin is installed, start with its brainstorming skill to settle the open points in section 7, then write a plan, then build test-first. Otherwise follow the same order by hand.

## 4. Step 0: review y-sweet (before any hosting code)

Review y-sweet for reuse as the basis of hosting. The checklist is on the [Milestones page](https://xtxp.link/build/milestones/#before-m1-review-y-sweet): fit for Xmesh documents and XTXP's messages, tokens versus key-based grants, branching, storage, hosting options, licence and maintenance.

**Deliverables:**
- A recommendation: extend y-sweet, borrow from it, or start fresh.
- A recommendation on hosting for M1: a self-hosted binary or Cloudflare Workers with Durable Objects.
- Both written up on the spec site, with a decision-log entry once David agrees.

## 5. M1: headless convergence

**Goal:** prove convergence, reconnect sync and the identity handshake over a real network before anyone draws anything.

### Proposed repository layout

A new implementation repository (name to agree with David, for example `xtxp-link/xtxp`), as a Cargo workspace:

```
crates/xmesh          pure core: schema on Yrs, moves, XML Patch subset, canonical XML
crates/xtxp-wire      message types and framing
crates/muppet-host    headless MUPPET hosting a session over WebSocket
crates/xtxp-cli       CLI peer: replays a vector stream, can drop and reconnect
tools/fuzzer          generates JSON vectors from the feature files' behaviours
features/             Gherkin feature files
vectors/              generated and hand-written JSON vectors
```

### Scope

- **Document model:** the schema on the Math page: elements and text nodes, expanded names, attributes, moves, deletion (decision 20).
- **XML Patch:** the `add`, `replace` and `remove` subset needed by the vectors.
- **Moves:** the numbered algorithm on the Math page. Spike `yrs_tree` against it first; adopt it only if it gives the same trees on every vector.
- **Canonical XML:** canonical form v0, as on the Math page (decision 21).
- **Wire:** Yjs sync step 1 and 2 plus updates, as Yrs v1 updates in XTXP frames over WebSocket; `hello`, `challenge`, `prove`, `bind`; `grant` and `revoke` for write access. Expect this to change (decision 21).
- **Identity:** Ed25519 keys loaded from files, every signature domain-tagged as on the Identity page (decision 22). Static grants signed by the owner. Sign-in to fetch keys is out of scope for M1.
- **Chaos proxy:** between peers and host, dropping, delaying and duplicating frames.
- **Sessions:** one shared session, `@main`. Each peer connection edits in its own session with a fresh client ID, and the host admits it into `@main` by merging (decision 19). Named forks, previews and trust come later.
- **Storage:** files on disk; append updates, compact periodically.

### Done when

1. Every vector converges under many shuffled delivery orders: same SHA-256 of canonical XML, no cycles, idempotent re-delivery.
2. Two CLI peers and a late joiner, connected to one host over WebSocket with connections dropped on purpose, end with identical hashes.
3. A late joiner loads the full state in one update.
4. A key without a write grant has its session refused: never merged into `@main`, and the other peers keep converging.
5. After a revocation reaches the host, that key's session stops being merged.
6. A signature made for one host, session or purpose is rejected anywhere else.
7. A fork rebuilt from its snapshot keeps content deleted after the fork, and deleting a shape changes the ETag hash.
8. All of the above runs in CI.

## 6. M2: Inkscape plus a browser with no JavaScript

**Goal:** the first demo a person can see, and a direct test of the north star.

### Scope

- **Xmesh C interface**, linked into an Inkscape fork. The fork's build needs a Rust toolchain.
- **Inkscape adapter:** start from Inkboard's code (`src/jabber_whiteboard/` in Inkscape 0.46). Capture edits at Inkscape's undo transaction commit, so each action becomes one batch of operations. Apply incoming operations outside the local undo stack. Follow the adapter contract on the Inkscape fork page (decision 23): side-table node mapping, echo suppression, Ctrl+Z as a Yrs undo of the user's own session, never rewriting `id`s. Test the known Inkboard pitfalls: automatically named gradients and patterns, `defs` and metadata, and new windows.
- **Server-side MUPPET:** renders the drawing as HTML and SVG, accepts edits as form POSTs, redirects, and serves `ETag`/`304` for meta-refresh polling (see the no-JS edit diagram on the Addressing page). The forms, sanitising, `script-src 'none'`, a separate content origin and CSRF tokens are on the Addressing page (decision 23).
- **No-JS identity:** a server-generated device key per sign-in, granted by the drawing's owner.
- **Duplicate ids:** detect and flag them after a merge. The resolution algorithm is open.
- **Addressing:** the host serves its own sessions at `https://{host}/{path}@{ref}`, with bare URLs redirecting to `@main`. No muppet disco: xtxp.link doesn't serve documents.

### Done when

1. Inkscape and a browser with JavaScript disabled edit the same drawing, and both see each other's changes.
2. One Inkscape action becomes one batch of operations, and Ctrl+Z in Inkscape undoes only that user's own actions.
3. Unchanged polls return `304 Not Modified`.
4. A drawing containing a script renders with the script stripped, under `script-src 'none'`.
5. Two sessions creating the same `id` merge, converge, and the duplicate is flagged.

## 7. Open points to settle at the start

From the [open questions](https://xtxp.link/discussion/open-questions/) page:

- Spike `yrs_tree` against the decided move algorithm (adopt only if it matches).
- How XTXP's own messages are framed alongside the Yjs sync messages.
- Hosting: a self-hosted binary or Durable Objects (from the y-sweet review).

From the spec review (`handover/review-decisions.md`, section A for M1 and B for M2), *pending review*:

- **Decided** (decisions 19 to 22): snapshots name points in history, with a short hash in URLs and ETags (A1); hosts admit or refuse whole sessions, and every connection edits in its own session (A2); a fresh client ID per session per connection (A3); the move algorithm (A4) and tree schema (A5), both on the Math page; canonical form v0 (A6); Yrs v1 updates in XTXP frames as the starting wire format (A7, which David expects to need further work); domain-tagged Ed25519 signatures (A8); the smallest M1 (A9).
- **M1 and M2:** nothing left pending from the review. M2's contracts are decision 23.

Everything else can wait until after M2.

## 8. Out of scope for the MVP

Ledger and keyframes, the XMPP bridge, the muppet disco (xtxp.link as discovery, the bouncer, federation), live web branching (open question 9), the sketch-level [use cases](https://xtxp.link/overview/use-cases/), the Wasm MUPPET (M3), sign-in to fetch keys, sessions on other hosts and trust between them, signed hash chains, native C++ and Elixir/BEAM.

## 9. Pending decisions

A spec review was run on 2026-10-18 by an independent Opus agent (Fable was intended but needed usage credits; it can be re-run on Fable later). The full report is `handover/spec-review.md` and the decisions it raises are in `handover/review-decisions.md` in this repository. David will decide those before work starts; update this handover and the spec with his answers.

## 10. Repositories and access

- **Spec:** `xtxp-link/website` (Astro Starlight, deployed to xtxp.link by Cloudflare on push to `main`). Diagrams are PlantUML in `diagrams/`, rendered with `npm run diagrams` (needs Java), and the SVGs are committed.
- **Implementation:** a new repository to be created with David's agreement.
- **Inkscape fork:** to be created for M2, with the engine vendored as a submodule and CI rebasing onto Inkscape's main branch on a schedule.
