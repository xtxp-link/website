---
title: Decision log
description: The decisions currently in force, in the order they were made.
---

The decisions currently in force. Numbers stay stable so links keep working.

## 1. Relays and peers

**Hosting MUPPETs** admit, route and store operations. Every MUPPET, hosting or not, runs the same engine.


## 2. The no-JS client is a puppet

A plain HTML browser drives a **server-side MUPPET**, which turns form POSTs into real CRDT operations and acts for that one user. Because it can be one of the user's own devices, end-to-end encrypted rooms stay possible.

## 5. Inkscape: a maintained fork

With a separate engine repository, scheduled rebases and a tracked diff size. See [The Inkscape fork](/build/inkscape-fork/).

## 6. Milestones

A y-sweet review → M1 headless convergence → M2 Inkscape plus no-JS → M3 Inkscape plus Wasm → M4 Inkscape plus Conversations. See [Milestones](/build/milestones/).

## 7. Peer model with hosted sessions

- **MUPPET is client-side Xmesh, and the application layer.** No server "finalises" state. The vector canvas, spatial chat and comments are MUPPET views, wherever a MUPPET runs.
- **XTXP is node to node.**
- **A session is hosted by exactly one MUPPET**; any number of MUPPETs may hold copies. A session is a fork of the document's history.
- **Server-side rendering is a server-side MUPPET.** Hosts hold sessions; every MUPPET executes, and those with a user render.


## 9. One address form: `{host}/{path}@{ref}`

Every document, native or an ordinary website, is addressed as `xtxp.link/{host}/{path}@{ref}`. There is no proxy marker: a website is a document whose upstream peer is the origin, and `@origin` is that peer's session. The last `@` always starts the ref, and generated links always carry one. A first path segment without a dot is a keyword for the disco's own pages. See [Addressing](/spec/addressing/).


## 11. Transport: WebSocket first, XMPP as a bridge

XTXP's wire is a small sync protocol that doesn't care about transport: operations need only arrive eventually, at least once, in any order, and reconnecting is a state-vector exchange built into XTXP. Its bindings are **WebSocket** (primary, for raw speed), **HTTP** (no-JS browsers, through a server-side MUPPET) and an **XMPP bridge** for mobile and chat clients from M4. Cursors and presence travel as separate, never-archived messages. See [The Wire](/spec/wire/).


## 12. Identity is a public key; access is granted by key

A user is a public key, authenticated by signing a challenge. Signing in with an existing account (Google, Apple, Mozilla) fetches the private key from the user's own storage. Signatures happen only at identity steps: connecting, binding a client ID to a key, and granting or revoking access. Whoever creates a session owns it and grants `read` or `write` to keys or to `*`. A host enforces grants on arrival, and **revocation closes the door to new edits on arrival**, because judging by claimed history position would let a revoked user backdate edits. Late edits land on a fork the revoked user owns. See [Identity and access](/spec/identity/).


## 13. Xmesh v1 is Yrs plus a tree layer

The first Xmesh is a thin, pure Rust layer on **Yrs** rather than a new engine. Yrs supplies YATA ordering, maps, text, state vectors, a binary update format, snapshots and a sync protocol. Xmesh adds an XML tree schema (a map of nodes with parent pointers and fractional indexes), **cycle-safe moves after Evan Wallace's algorithm**, XML Patch translation and canonical XML output. It stays a pure core, reached through a C interface (Inkscape), Wasm (browser) and Rust directly (server MUPPET and hosts). A native C++ engine becomes a later spike, held to the same vectors.


## 14. Toolchain first: ledger and keyframes go on the roadmap

Sessions persist the way the Yrs toolchain already does: a full state encoded as one update for loading, and append-then-compact storage. A dedicated ledger and keyframes are on the [roadmap](/build/milestones/#roadmap), to be built only if that falls short.


## 15. Hosting runs as a small Rust server

With Xmesh in Rust, hosting MUPPETs run as a small Rust server: one async actor per session, a WebSocket endpoint, admission and grants, and append-then-compact storage, with the server-side MUPPET in the same binary. **y-sweet**, a Rust server for Yjs documents, is reviewed for reuse before implementation.


## 16. Any MUPPET can host sessions; sessions are named by where they live

There is one kind of node, the MUPPET. Any MUPPET can host sessions: it admits, routes and stores them, usually headless on a server, with no views and no user of its own. A session is identified by its address, `{host}/{path}@{name}`, with no generated IDs; it lives on exactly one host, and only that host admits edits to it. The creator names it: asking for an existing name opens that session (subject to grants), and creating a fork on a taken name is rejected. **Trust between sessions drives automatic merges**, one way or both, which is how sessions on different hosts keep each other up to date. See [Sessions and history](/spec/sessions/#sessions-on-other-hosts-and-trust-between-them).

## 17. Sessions

A line of a document's history is a **session**: lightweight enough to make one per person, per proposal or per visit. That includes a single user's private state, which may never leave that user's own MUPPET. Everything decision 16 says of branches holds for sessions. See [Sessions and history](/spec/sessions/).

## 18. xtxp.link is a muppet disco, not a host

XTXP doesn't aim to host everyone's sessions, which cost server resources. xtxp.link is a **muppet disco**: it finds the MUPPETs hosting the sessions a signed query may see, and can start a session on an instance, including one on the user's own machine, but hosts nothing itself. Anyone can run a disco. A domain owner can claim its `@origin` by key with a DNS TXT record, and decide through the **bouncer** which forks are listed and what's officially relayed. Federation follows Mastodon's model on ActivityPub in spirit; its rules are still to be defined. Until then, a host serves its own sessions directly. The disco is a future milestone, deliberately deferred. See [The muppet disco](/spec/disco/).

## 19. Snapshots, admission by session, fresh client IDs

- **A snapshot names a point in history**: a state vector plus a delete set. Sessions record the snapshot they forked at; `@{snapshot}` URLs and ETags carry a short hash of one. Yrs's garbage collection stays off.
- **Hosts admit or refuse whole sessions, never single updates.** Every connection edits in its own session, which reaches a shared session by merging. A refused session isn't lost: it stays a session and shows as an onion skin, and if admitted later its merge carries on.
- **A client ID is fresh for every session and every connection.** Bindings name a session address, and a host rejects a client ID already in the session's history.

See [The Math](/spec/math/#snapshots-name-points-in-history), [Sessions and history](/spec/sessions/#admission-is-by-session) and [Identity and access](/spec/identity/).

## 20. The tree schema and a deterministic move algorithm

Each node is keyed by the ID of the operation that created it, and holds its kind (element or text), its expanded name, its edges (parent → counter and position), its attributes, a `deleted` tombstone, and text content for text nodes. Position travels with the edge. Fractional keys end with the client ID. Namespaces are stored expanded, and genesis is one fixed update. Deletion hides a subtree without losing what happens inside it. Reading the tree follows a numbered algorithm that roots cycle-caught nodes in ascending node ID order. `yrs_tree` is spiked against it and adopted only if it gives the same trees. See [The Math](/spec/math/#data-model).

## 21. Canonical form v0, and one wire format to start

- **Hashes use Xmesh canonical form v0**: UTF-8, deleted nodes left out, attributes sorted by expanded name, fixed prefixes for known namespaces, no whitespace outside text, minimal escaping. Versioned. See [The Math](/spec/math/#canonical-form-v0).
- **On the wire, peers exchange Yrs v1 updates in XTXP frames.** XML Patch is only for import and export. HTTP serves browsers; the stream is a WebSocket upgrade. This is a starting point to build on, and needs further work. See [The Wire](/spec/wire/#one-wire-format-to-start).

## Naming

- **XTXP** for the protocol, **Xmesh** for the engine, **MUPPET** for the executor, the application layer and hosting, **session** for a line of history, **muppet disco** for discovery, **bouncer** for a domain owner's control of its `@origin`.
- Name checks so far: *Xmesh* collides with Thinkbox XMesh, a commercial mesh-caching plugin for VFX tools. *Muppet* is a Henson/Disney trademark: fine for an internal component, riskier on anything public-facing. No direct clash was found for *XTXP*.

## Conventions

- Patch operations are defined by **RFC 5261**. RFC 7351 registers the media type.
