# Decisions from the spec review (for David, morning of 2026-10-18)

An independent review of the whole spec ran overnight. The full report is in [`spec-review.md`](spec-review.md), with section numbers in brackets below. It was meant to run on Fable, but Fable needed usage credits on the account, so a fresh Opus agent that hadn't seen our conversation did it instead. It can be re-run on Fable once credits are available.

**Already fixed overnight** (stale text only, no new decisions): the glossary's old data model, session identity wording, decision 1 and 7 wording to match decision 16, `user@domain` in the no-JS diagram, undo-versus-session wording, "headless Inkscape", two versus three CLI peers, the stale `live` ref, links without a ref, the server MUPPET's place in the deployment diagram, "borrows", "polyfill", and the "decided" labels on Verification and Milestones.

**Since the review:** branches are now called **sessions**, and xtxp.link is a **muppet disco** that finds hosts rather than serving documents (decisions 17 and 18). This list uses the new terms; the report predates them, and its "gateway" findings now apply to whichever host serves a session. B5 and C2 are partly answered by the disco.

Each item below needs your call. The recommendation is the reviewer's, with mine noted where it differs.

---

## A. Blocking M1

**A1. Name history points by snapshot, not state vector** [2.1, high] — **decided** (decision 19): option (a), a short snapshot hash in URLs and ETags, the full snapshot recorded on the session.
Yrs keeps deletions outside the state vector, so a state vector alone doesn't pin a state. Forks, `@{…}` history URLs and ETags all go wrong; for example, deleting a shape wouldn't change an ETag built from the state vector.
*Recommendation:* use a snapshot (state vector plus delete set, or a hash of it) wherever a point in history is named, and keep Yrs garbage collection off from day one.

**A2. Hosts refuse whole client IDs, never single updates** [2.2, high] — **decided, with a change** (decision 19): hosts admit or refuse whole *sessions*. Every connection edits in its own session; a refused session stays a session and shows as an onion skin. This also answers C6.
Yrs needs each client's updates to be contiguous, so refusing one update leaves that client's later ones stuck forever. An admitted edit that depends on a refused one also gets stuck.
*Recommendation:* a peer's copy of a session only ever contains admitted updates; previews live in separate local documents. A host refuses a whole client ID, with a defined error. A refused client starts again with a fresh client ID.

**A3. Fresh client ID per session per connection** [2.3, high] — **decided** (decision 19).
Reusing a client ID on a session and its fork makes merges silently drop edits.
*Recommendation:* make it a rule. Bindings are scoped to a session address (drop the undefined "DocId"), and the first binding for a client ID wins.

**A4. Deterministic move algorithm** [2.5, high] — **decided** (decision 20): numbered algorithm on the Math page; cycle-caught nodes rooted in ascending node ID order; `yrs_tree` spiked against it.
The order in which nodes caught in a cycle are reattached isn't pinned, so two implementations can build different trees. Also undefined: a cycle with no rooted parent, a deleted parent, and the tie-break key.
*Recommendation:* write the read algorithm as numbered pseudocode, then spike `yrs_tree` against it before choosing adopt or write-our-own.

**A5. Tree schema details** [2.6, 2.7, 2.8, high] — **decided** (decision 20), all as recommended: position on the edge, client-ID suffix on keys, tombstones, text nodes, expanded names, fixed genesis, op-ID node IDs.
- *Position travels with the parent:* store each child's position on its edge to the parent, so a concurrent move can't end up with one person's parent and another's position.
- *Fractional key collisions:* define key generation with a tie-breaker.
- *Deletion:* tombstone or removal, and what happens to edits inside a deleted node.
- *Node kinds:* text nodes alongside elements (SVG `<text>`/`<tspan>` needs mixed content).
- *Namespaces:* how `inkscape:`, `sodipodi:` and `xlink:` names are stored.
- *Genesis:* the root is created by one shared initial update.
- *Node IDs:* generated without coordination.

**A6. Canonical form for hashing** [3.1.3, high] — **decided** (decision 21): Xmesh canonical form v0, on the Math page.
*Recommendation:* skip full W3C C14N and define "Xmesh canonical form v0": sorted attributes, fixed namespace prefixes, UTF-8, no insignificant whitespace, defined escaping.

**A7. One wire format** [1.6, 1.7, high] — **decided as a starting point** (decision 21): Yrs v1 updates in XTXP frames, XML Patch for import and export only, the stream as a WebSocket upgrade. David: needs further work.
The spec currently implies three: binary Yrs updates, an `application/xtxp+xml` "patch stream" over HTTP, and XML Patch.
*Recommendation:* on the wire, XTXP carries Yrs updates in one encoding (v1 or v2) inside XTXP frames. XML Patch is only an import and export format for edits. Either drop the HTTP "raw patch stream" from content negotiation, or make it an upgrade to the WebSocket binding.

**A8. Handshake security** [2.10, high] — **decided** (decision 22), as recommended.
Signing only a random challenge lets a malicious host relay it and log in elsewhere as the victim.
*Recommendation:* Ed25519; the signed challenge includes a domain tag, the host's name, the session and the nonce. Awareness messages are scoped to the authenticated connection.

**A9. Smallest M1** [3.1] — **decided** (decision 22), as recommended, with the y-sweet review first.
*Recommendation:* one host binary, `@main` only, three CLI peers (one a late joiner), key files, static grants signed by the owner, file storage, a chaos proxy that drops, delays and duplicates frames, and revocation either left out of M1 or limited to "refuse and disconnect".

## B. Blocking M2

**B1. Inkscape adapter contract** [3.2.1, high] — **decided, with changes** (decision 23): no automatic id suffixes: the document is exactly the user's version, and duplicate ids after a merge are a conflict to resolve, possibly with a person deciding; partitioned ids are a future experiment. Every XML node kind is mapped, not dropped. Undo and whiteboard behaviour start from Inkboard's semantics, then get deliberated against tldraw and Miro.
- mapping between node IDs and Inkscape's XML nodes
- suppressing echoes, so remote changes aren't recaptured as local edits
- how Ctrl+Z works: the reviewer recommends a Yrs undo manager scoped to the local user, bypassing Inkscape's own undo stack for shared documents
- collisions in Inkscape's auto-generated `id`s, which break `url(#…)` references
- unsupported node kinds

**B2. The no-JS editing model** [3.2.3, high] — **decided** (decision 23): forms can be rich HTML and CSS, but each edit is a form POST.
Which forms exist (select, edit attribute, recolour, move, delete, add a basic shape), and how a POST names its target.

**B3. Rendering safety** [2.15, high] — **not adopted** (decision 23): scripts aren't the protocol's business; a note to revisit before hosting others' documents in earnest. CSRF tokens on forms stay.
User SVG can carry scripts. Sanitise it, apply a strict CSP, and serve user content from a separate origin. Edit forms need CSRF protection.

**B4. Keys for no-JS users** [2.13, 3.2.4, medium] — **decided** (decision 23): an ephemeral key tied to the HTTP session, perhaps kept by a cookie.
*Recommendation:* a server-generated device key per sign-in, granted by the owner, rather than the server holding a user's root key.

**B5. Website scope for M2** [3.2.7, medium] — **decided** (decision 23): native documents only.
*Recommendation:* native documents only; no website overlays yet.

## C. Can wait until after M2

- **C1. Trust between sessions** [1.11, 2.4]: trust lets edits bypass admission and passes along chains of sessions; "paused" and "merged" are described inconsistently. Decide whether trust is per edge, and how revocation interacts with it.
- **C2. Website session addresses** [1.9]: where a website's sessions live in the address, and who may write `@origin`.
- **C3. Open versus fork on a taken name** [1.13]: define `open(name)` and `fork(parent, name)` as separate operations.
- **C4. LAN hosts and TLS** [1.10]: `.lan` names can't get public certificates; how LAN hosts authenticate.
- **C5. End-to-end encryption** [1.21]: a blind host can't answer sync, so mark E2E as out of scope until after M4, or design an envelope for it.
- **C6. "Fork owned by the revoked user"** [2.12] — **answered by A2**: the revoked user's session stops being merged and stays theirs.
- **C7. Restoring an old version** [2.11]: merging a session from the past doesn't undo later changes; "restore" needs generated inverse operations.
- **C8. SVG attribute granularity** [2.9]: `style`, `d` and `transform` are single values, so concurrent changes to different style properties clash.
- **C9. Sign-in providers** [2.13]: the reviewer couldn't confirm that Mozilla accounts offer user storage to third parties; the key-custody threat needs stating.
- **C10. `@` in bare URLs and hostnames without dots** [2.14]: the reviewer suggests treating bare URLs as path only, and defining allowed host forms (`localhost`, IPv6, ports).
- **C11. Decision log stubs** [1.23]: the reviewer suggests one-line stubs for removed decisions. This contradicts your earlier call not to narrate reversals, so I'd leave it as is.

## D. Other suggestions

- A short normative block on each spec page, using MUST/SHOULD [4.1].
- Define "document", and add glossary entries for Client ID, Node ID, Snapshot and Gateway [4.2].
- A threat-model page [4.3].
- A data model for comments and spatial chat [4.4].
- Prior art to verify and add: Figma's multiplayer write-up, Ink & Switch's branching work, Braid-HTTP, and the interleaving-anomalies paper [4.5].
- Say explicitly that XML is the document model, not the wire encoding [4.6].
