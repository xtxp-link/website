# Handover to Claude Code: XTXP MVP (M1, then M2)

**Status:** draft for David's review, 2026-10-18. Items marked *pending review* depend on decisions David makes after reading the spec review (see "Pending decisions" below).

## 1. What this is

XTXP (XML to XML Protocol) lets many people edit one XML document at once, with branchable history, from a forked Inkscape down to a browser with JavaScript switched off. SVG is the first document type.

**The spec is the source of truth:** https://xtxp.link, built from the `xtxp-link/website` repository. Read these pages before writing code, in this order:

1. [What is XTXP?](https://xtxp.link/overview/what-is-xtxp/) and [North star](https://xtxp.link/overview/north-star/)
2. [Architecture](https://xtxp.link/overview/architecture/)
3. [The Math](https://xtxp.link/spec/math/), [The Wire](https://xtxp.link/spec/wire/), [Identity and access](https://xtxp.link/spec/identity/), [Branches and history](https://xtxp.link/spec/branches/)
4. [Verification](https://xtxp.link/build/verification/), [Milestones](https://xtxp.link/build/milestones/), [The Inkscape fork](https://xtxp.link/build/inkscape-fork/)
5. [Decision log](https://xtxp.link/discussion/decisions/) and [Open questions](https://xtxp.link/discussion/open-questions/)
6. [Prior art](https://xtxp.link/discussion/prior-art/): read the Yrs, Wallace, y-sweet, Yjs sync protocol, Inkscape undo and Inkboard entries before designing the matching parts

## 2. Ground rules

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
crates/muppet-host    headless MUPPET hosting a branch over WebSocket
crates/xtxp-cli       CLI peer: replays a vector stream, can drop and reconnect
tools/fuzzer          generates JSON vectors from the feature files' behaviours
features/             Gherkin feature files
vectors/              generated and hand-written JSON vectors
```

### Scope

- **Document model:** elements, attributes and element moves. Text content only if it's cheap; otherwise defer.
- **XML Patch:** the `add`, `replace` and `remove` subset needed by the vectors.
- **Moves:** Wallace's algorithm. Decide first whether to adopt `yrs_tree` or write a small layer of our own.
- **Canonical XML:** pick one deterministic serialisation for hashing and document it on the Math page.
- **Wire:** Yjs sync step 1 and 2 plus updates; `hello`, `challenge`, `prove`, `bind`; `grant` and `revoke` for write access.
- **Identity:** Ed25519 keys loaded from files. Sign-in to fetch keys is out of scope for M1.
- **Branches:** a single branch, `@main`. Fork, merge and trust come later.
- **Storage:** append updates, compact periodically.

### Done when

1. Every vector converges under many shuffled delivery orders: same SHA-256 of canonical XML, no cycles, idempotent re-delivery.
2. Two CLI peers and a late joiner, connected to one host over WebSocket with connections dropped on purpose, end with identical hashes.
3. A late joiner loads the full state in one update.
4. A key without a write grant has its edits refused.
5. After a revocation reaches the host, that key's new edits are not admitted.
6. All of the above runs in CI.

## 6. M2: Inkscape plus a browser with no JavaScript

**Goal:** the first demo a person can see, and a direct test of the north star.

### Scope

- **Xmesh C interface**, linked into an Inkscape fork. The fork's build needs a Rust toolchain.
- **Inkscape adapter:** start from Inkboard's code (`src/jabber_whiteboard/` in Inkscape 0.46). Capture edits at Inkscape's undo transaction commit, so each action becomes one batch of operations. Apply incoming operations outside the local undo stack. Test the known Inkboard pitfalls: automatically named gradients and patterns, `defs` and metadata, and new windows.
- **Server-side MUPPET:** renders the drawing as HTML and SVG, accepts edits as form POSTs, redirects, and serves `ETag`/`304` for meta-refresh polling (see the no-JS edit diagram on the Addressing page).
- **Addressing:** `{host}/{path}@{ref}` for native documents, with bare URLs redirecting to `@main`.

### Done when

1. Inkscape and a browser with JavaScript disabled edit the same drawing, and both see each other's changes.
2. One Inkscape action becomes one batch of operations, and Ctrl+Z in Inkscape undoes only that user's own actions.
3. Unchanged polls return `304 Not Modified`.

## 7. Open points to settle at the start

From the [open questions](https://xtxp.link/discussion/open-questions/) page, the ones that block M1 or M2:

- Adopt `yrs_tree`, or write our own move layer on Wallace's algorithm.
- The canonical XML form used for hashing.
- How XTXP's own messages are framed alongside the Yjs sync messages.
- `@main` or `@latest` as the default branch name.
- Hosting: a self-hosted binary or Durable Objects (from the y-sweet review).

Everything else on that page can wait until after M2.

## 8. Out of scope for the MVP

Ledger and keyframes, the XMPP bridge, live web branching and the xtxp.link gateway for websites (open question 9), the Wasm MUPPET (M3), sign-in to fetch keys, branches on other hosts and trust between them, signed hash chains, native C++ and Elixir/BEAM.

## 9. Pending decisions

A spec review was run on 2026-10-18. Its report and the decisions it raises are in `handover/review-decisions.md` in this repository. David will decide those before work starts; update this handover and the spec with his answers.

## 10. Repositories and access

- **Spec:** `xtxp-link/website` (Astro Starlight, deployed to xtxp.link by Cloudflare on push to `main`). Diagrams are PlantUML in `diagrams/`, rendered with `npm run diagrams` (needs Java), and the SVGs are committed.
- **Implementation:** a new repository to be created with David's agreement.
- **Inkscape fork:** to be created for M2, with the engine vendored as a submodule and CI rebasing onto Inkscape's main branch on a schedule.
