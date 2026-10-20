---
title: Glossary
description: Terms used across the XTXP specification.
---

**Admission**
: A host's decision, in its own arrival order, to merge a whole session into one of its own, because its client IDs are bound to keys that hold write access. Hosts never admit part of a session.

**Binding** (identity)
: A signed statement that a public key owns a client ID on one session. It is how operations get their author without being signed one by one.

**Binding** (transport)
: A way of carrying XTXP: WebSocket, HTTP, the HTML patch stream to browsers, or the XMPP bridge.

**Bouncer**
: *Sketch.* A domain owner's control over its `@origin` session at a muppet disco: which forked sessions are listed, which edits are permitted where, and what is officially relayed. The domain is claimed by public key through a DNS TXT record.

**Client ID**
: The number Yrs stamps on every operation, with a per-client counter. Fresh for every session and every connection, and bound to a public key.

**CRDT**
: Conflict-free replicated data type. A data structure whose concurrent updates can be applied in any order and still converge to the same state.

**`@{ref}`**
: The suffix on every XTXP address that says which version is meant: `@origin` (a website as its origin server publishes it), `@main` (the shared session), a session name, or a snapshot hash. The last `@` in a URL always starts the ref.

**`@origin`**
: The ref for an ordinary website's authoritative version: the stream of changes from the origin server, as the upstream peer sees it. Read-only. Not to be confused with genesis (vector 0), the start of a document's history.

**Declarative partial updates**
: A browser feature: processing-instruction markers name places in a page, and a later `<template for>` replaces what's there, applied by the browser's own parser. How a muppet changes a page in the browser. See [The browser as client](/spec/browser/).

**Genesis (vector 0)**
: The first state of a document: one fixed update that creates the root, identical everywhere. For live web branching, it is the fetched origin page.

**Host**
: A muppet hosting sessions: it admits whole sessions into its own against their grants, routes them and stores them, usually headless on a server.

**Immortal parent**
: An element that edits never replace: attributes change one at a time and children are inserted alongside what's there, so concurrent edits to one element both survive. In v1, a move does replace it with a copy (see The Math).

**Keyframe**
: *Roadmap.* A compacted snapshot of a session, tuned for instant loading. Until then, a session's full state encoded as one Yrs update does the job.

**Ledger**
: *Roadmap.* A chronological log of a session's patches in cold storage. Until then, sessions persist the usual Yjs way: append updates, then compact.

**muppet**
: Multi User Progressive Patch Execution Tree. The client-side embedding of Xmesh and the application layer: it owns all views, including the vector canvas and spatial chat and comments. Run headless, a muppet hosts sessions.

**muppet disco**
: *Future milestone.* A discovery service that helps a client find the muppets hosting the sessions it may see, from a query signed with its key. A disco doesn't host sessions itself, and anyone can run one. xtxp.link is one.

**Node ID**
: The ID of the Yrs operation that created a node: client ID plus counter. Needs no coordination, and survives edits. In v1 a move makes a copy, which gets a new node ID.

**Onion skin**
: A translucent overlay of another state (a session, a paused queue, another connection's session that hasn't been merged yet) drawn over the current one.

**Paused queue**
: A local session whose automatic merge is switched off, shown as a preview until it's released (merged).

**Patch stream**
: A page's HTTP response kept open by a server-side muppet, which flushes a `<template for>` HTML patch each time the session changes. Not XTXP operations: rendered HTML.

**Public key (identity)**
: What a user is in XTXP. Proved by signing a challenge; fetched onto a device through an existing sign-in, from the user's own storage.

**Redline**
: A per-author tracked-changes view: the diff produced when a session is replayed into its parent.

**Session**
: A lightweight line of a document's history (a branch, in git's terms), identified by where it lives: `{host}/{path}@{name}`. It records its parent's address and the point where it was forked. A user's private state, history undo, proposed edits, previews and paused queues are all sessions. Each session lives on exactly one host.

**Snapshot**
: A state vector plus a delete set: what names an exact point in history. Sessions record the snapshot they were forked at; URLs and ETags carry a short hash of one.

**State vector**
: A map from each client to the highest clock value seen from it. Two peers exchange state vectors to work out which operations the other is missing. It doesn't cover deletions, so it doesn't pin a state on its own: see Snapshot.

**Trust** (between sessions)
: A session trusting another session, so the other's changes merge into it automatically. Trust can run one way or both ways.

**Upstream peer**
: For live web branching, the origin website treated as a peer. Its "edits" are the differences between successive fetches.

**Xmesh**
: The CRDT engine: a pure Rust layer on Yrs's own XML types that adds full XML node-kind mapping, XML Patch translation and canonical output. A tree layer of its own and a native C++ rewrite are possible later steps.

**XTXP**
: XML to XML Protocol. The specification: The Math and The Wire.

**Yrs**
: The Rust port of Yjs, and the base Xmesh is built on.

**YATA**
: Yet Another Transformation Approach. The sequence CRDT algorithm Yrs uses to order concurrent insertions, for an element's children and for text alike.
