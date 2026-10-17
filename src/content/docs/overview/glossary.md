---
title: Glossary
description: Terms used across the XTXP specification.
---

**Admission**
: A tracker's decision, in arrival order, that an operation counts on its branch: the client ID is bound to a key that holds write access.

**Binding** (identity)
: A signed statement that a public key owns a client ID on a document. It is how operations get their author without being signed one by one.

**Binding** (transport)
: A way of carrying XTXP: WebSocket, HTTP, or the XMPP bridge.

**Branch**
: A fork of a document's history at a given state vector. Undo, proposed edits and previews are all branches. Each server-side branch is held by one tracker process.

**CRDT**
: Conflict-free replicated data type. A data structure whose concurrent updates can be applied in any order and still converge to the same state.

**`@{ref}`**
: The suffix on every XTXP address that says which version is meant: `@origin` (a website as its origin server publishes it), `@main` (the shared branch), a branch name, or a state vector. The last `@` in a URL always starts the ref.

**`@origin`**
: The ref for an ordinary website's authoritative version: the stream of changes from the origin server, as the upstream peer sees it. Read-only. Not to be confused with genesis (vector 0), the start of a document's history.

**Genesis (vector 0)**
: The first state of a document. For live web branching, it is the fetched origin page.

**Immortal parent**
: An XML element node that is never replaced, only updated. Attributes live in a map and children in an array inside it, so concurrent edits to one element never orphan each other.

**Keyframe**
: A compacted snapshot of a branch's state, held in hot memory so new clients load instantly instead of replaying history.

**Ledger**
: The chronological log of patches for a branch, flushed to cold storage. It makes undo branchable and unbounded.

**MUPPET**
: Multi User Progressive Patch Execution Tree. The client-side embedding of Xmesh, and the application layer: it owns all views, including the vector canvas and spatial chat and comments. (This absorbed what was earlier called Convector.)

**Onion skin**
: A translucent overlay of another state (a branch, a paused queue, a peer's in-flight edits) drawn over the current one.

**Paused queue**
: Local edits a MUPPET holds back from the wire, shown as a preview until released.

**Public key (identity)**
: What a user is in XTXP. Proved by signing a challenge; fetched onto a device through an existing sign-in, from the user's own storage.

**Redline**
: A per-author tracked-changes view: the diff produced when a branch is replayed into its parent.

**State vector**
: A map from each client to the highest clock value seen from it. Two peers exchange state vectors to work out which operations the other is missing.

**Tracker**
: An Erlang process holding one branch's history, keyframes and presence, admitting operations against the branch's grants, and routing them.

**Upstream peer**
: For live web branching, the origin website treated as a peer. Its "edits" are the differences between successive fetches.

**Xmesh**
: The CRDT engine: a pure, hexagonal C++20 core. A pure Elixir port is deferred to a later spike.

**XTXP**
: XML to XML Protocol. The specification: The Math and The Wire.

**YATA**
: Yet Another Transformation Approach. The sequence CRDT algorithm Xmesh uses to order concurrent insertions.
