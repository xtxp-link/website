---
title: Decision log
description: The decisions currently in force, in the order they were made.
---

The decisions currently in force. Numbers stay stable so links keep working.

## 1. Relays and peers

**Hosting muppets** admit, route and store operations. Every muppet, hosting or not, runs the same engine.


## 2. The no-JS client is a puppet

A plain HTML browser drives a **server-side muppet**, which turns form POSTs into real CRDT operations and acts for that one user. Because it can be one of the user's own devices, end-to-end encrypted rooms stay possible.

## 5. Inkscape: a maintained fork

With a separate engine repository, scheduled rebases and a tracked diff size. See [The Inkscape fork](/build/inkscape-fork/).

## 6. Milestones

M1-y-sweet and M2-y-sweet on a stock y-sweet ([decision 25](#25-run-m1-and-m2-on-a-stock-y-sweet-first)) → M1 headless convergence → M2 Inkscape plus no-JS → M3 Inkscape plus Wasm → M4 Inkscape plus Conversations. See [Milestones](/build/milestones/).

## 7. Peer model with hosted sessions

- **Muppet is client-side Xmesh, and the application layer.** No server "finalises" state. The vector canvas, spatial chat and comments are muppet views, wherever a muppet runs.
- **XTXP is node to node.**
- **A session is hosted by exactly one muppet**; any number of muppets may hold copies. A session is a fork of the document's history.
- **Server-side rendering is a server-side muppet.** Hosts hold sessions; every muppet executes, and those with a user render.


## 9. One address form: `{host}/{path}@{ref}`

Every document, native or an ordinary website, is addressed as `xtxp.link/{host}/{path}@{ref}`. There is no proxy marker: a website is a document whose upstream peer is the origin, and `@origin` is that peer's session. The last `@` always starts the ref, and generated links always carry one. A first path segment without a dot is a keyword for the disco's own pages. See [Addressing](/spec/addressing/).


## 11. Transport: WebSocket first, XMPP as a bridge

XTXP's wire is a small sync protocol that doesn't care about transport: operations need only arrive eventually, at least once, in any order, and reconnecting is a state-vector exchange built into XTXP. Its bindings are **WebSocket** (primary, for raw speed), **HTTP** (no-JS browsers, through a server-side muppet) and an **XMPP bridge** for mobile and chat clients from M4. Cursors and presence travel as separate, never-archived messages. See [The Wire](/spec/wire/).


## 12. Identity is a public key; access is granted by key

A user is a public key, authenticated by signing a challenge. Signing in with an existing account (Google, Apple, Mozilla) fetches the private key from the user's own storage. Signatures happen only at identity steps: connecting, binding a client ID to a key, and granting or revoking access. Whoever creates a session owns it and grants `read` or `write` to keys or to `*`. A host enforces grants on arrival, and **revocation closes the door to new edits on arrival**, because judging by claimed history position would let a revoked user backdate edits. Late edits land on a fork the revoked user owns. See [Identity and access](/spec/identity/).


## 13. Xmesh v1 is a thin layer on Yrs

The first Xmesh is a thin, pure Rust layer on **Yrs** rather than a new engine. Yrs supplies YATA ordering, maps, text, state vectors, a binary update format, snapshots and a sync protocol. Xmesh adds the mapping of XML onto Yrs (see decision 20), XML Patch translation and canonical XML output. It stays a pure core, reached through a C interface (Inkscape), Wasm (browser) and Rust directly (server muppet and hosts). A native C++ engine becomes a later spike, held to the same vectors.


## 14. Toolchain first: ledger and keyframes go on the roadmap

Sessions persist the way the Yrs toolchain already does: a full state encoded as one update for loading, and append-then-compact storage. A dedicated ledger and keyframes are on the [roadmap](/build/milestones/#roadmap), to be built only if that falls short.


## 15. Hosting runs as a small Rust server

With Xmesh in Rust, hosting muppets run as a small Rust server: one async actor per session, a WebSocket endpoint, admission and grants, and append-then-compact storage, with the server-side muppet in the same binary. It's built only after M1 and M2 have run on a stock **y-sweet** ([decision 25](#25-run-m1-and-m2-on-a-stock-y-sweet-first)), and borrows from y-sweet rather than extending it.


## 16. Any muppet can host sessions; sessions are named by where they live

There is one kind of node, the muppet. Any muppet can host sessions: it admits, routes and stores them, usually headless on a server, with no views and no user of its own. A session is identified by its address, `{host}/{path}@{name}`, with no generated IDs; it lives on exactly one host, and only that host admits edits to it. The creator names it: asking for an existing name opens that session (subject to grants), and creating a fork on a taken name is rejected. **Trust between sessions drives automatic merges**, one way or both, which is how sessions on different hosts keep each other up to date. See [Sessions and history](/spec/sessions/#sessions-on-other-hosts-and-trust-between-them).

## 17. Sessions

A line of a document's history is a **session**: lightweight enough to make one per person, per proposal or per visit. That includes a single user's private state, which may never leave that user's own muppet. Everything decision 16 says of branches holds for sessions. See [Sessions and history](/spec/sessions/).

## 18. xtxp.link is a muppet disco, not a host

XTXP doesn't aim to host everyone's sessions, which cost server resources. xtxp.link is a **muppet disco**: it finds the muppets hosting the sessions a signed query may see, and can start a session on an instance, including one on the user's own machine, but hosts nothing itself. Anyone can run a disco. A domain owner can claim its `@origin` by key with a DNS TXT record, and decide through the **bouncer** which forks are listed and what's officially relayed. Federation follows Mastodon's model on ActivityPub in spirit; its rules are still to be defined. Until then, a host serves its own sessions directly. The disco is a future milestone, deliberately deferred. See [The muppet disco](/spec/disco/).

## 19. Snapshots, admission by session, fresh client IDs

- **A snapshot names a point in history**: a state vector plus a delete set. Sessions record the snapshot they forked at; `@{snapshot}` URLs and ETags carry a short hash of one. Yrs's garbage collection stays off.
- **Hosts admit or refuse whole sessions, never single updates.** Every connection edits in its own session, which reaches a shared session by merging. A refused session isn't lost: it stays a session and shows as an onion skin, and if admitted later its merge carries on.
- **A client ID is fresh for every session and every connection.** Bindings name a session address, and a host rejects a client ID already in the session's history.

See [The Math](/spec/math/#snapshots-name-points-in-history), [Sessions and history](/spec/sessions/#admission-is-by-session) and [Identity and access](/spec/identity/).

## 20. v1 uses Yrs's own XML types

Xmesh v1 builds on Yrs's XML fragment, element and text types: a stable, open implementation, so the project can make something, get feedback and understand it before designing the next thing. Every XML node kind maps across (comments, processing instructions and CDATA as elements with reserved names), names are stored expanded, node IDs are the Yrs IDs of the items that created them, and genesis is one fixed update. Child order comes from YATA. **A move is a delete plus an inserted copy**, so cycles can't happen, at the cost of three known gaps, kept as expected failures in the test vectors: an edit made during a move lands on the original, two concurrent moves make two copies, and a large move costs its size. A tree layer of our own (a "moved to" link resolved when reading, or a node map with Wallace's cycle-safe moves) is the next design, to reflect on after M2. See [The Math](/spec/math/#data-model).

## 21. Canonical form v0, and one wire format to start

- **Hashes use Xmesh canonical form v0**: UTF-8, deleted nodes left out, attributes sorted by expanded name, fixed prefixes for known namespaces, no whitespace outside text, minimal escaping. Versioned. See [The Math](/spec/math/#canonical-form-v0).
- **On the wire, peers exchange Yrs v1 updates in XTXP frames.** XML Patch is only for import and export. HTTP serves browsers; the stream is a WebSocket upgrade. This is a starting point to build on, and needs further work. See [The Wire](/spec/wire/#one-wire-format-to-start).

## 22. Handshake signatures, and the smallest M1

- **Ed25519 keys, with a domain tag on every signature.** A challenge answer also covers the host's name, the session address and the nonce, so it can't be relayed to sign in elsewhere. Bindings and grants have tags of their own. Cursors and presence are tied to the authenticated connection. See [Identity and access](/spec/identity/#what-gets-signed).
- **M1 is deliberately small:** one host binary serving `@main`, three CLI peers (one a late joiner) each in their own session, key files, static signed grants, file storage, a chaos proxy, and revocation only as "stop merging". See [Milestones](/build/milestones/#m1--headless-convergence).

## 23. The M2 contracts: Inkscape, no-JS editing, rendering safety

- **The Inkscape adapter** maps node IDs in a side table, suppresses echoes while applying remote edits, and maps every kind of XML node Inkscape writes. It never rewrites `id`s: the document is exactly the user's version. Undo and other whiteboard behaviour start from Inkboard's semantics, then get deliberated against tldraw and Miro. See [The Inkscape fork](/build/inkscape-fork/#the-adapter-contract).
- **Duplicate `id`s after a merge are a conflict above the CRDT**, flagged for resolution, possibly by a person. Partitioned ids are a future experiment. See [Sessions and history](/spec/sessions/#conflicts-above-the-crdt).
- **No-JS editing is form posts.** The forms can be rich HTML and CSS; each POST names its node and the snapshot it was rendered from, and carries a CSRF token. See [Addressing](/spec/addressing/#forms).
- **Scripts in documents aren't the protocol's business.** Rendering safety is a note to revisit, not a rule.
- **No-JS users get an ephemeral key tied to their HTTP session**, perhaps kept by a cookie, and granted access by the owner; the server never holds a user's own key.
- **M2 serves native documents only.**

## 24. North star: the read-write web, with XTXP in the browser

The long-term goal is XTXP as a first-class web standard, built into browsers: a browser that runs its own muppet and opens `xtxp://` links. Backwards compatibility is part of it: a Wasm muppet polyfills browsers with JavaScript, and the no-JS client keeps every other browser a full participant, so XTXP works everywhere. "Does this still work with no JS?" stays the design test. See [North star](/overview/north-star/).

## 25. Run M1 and M2 on a stock y-sweet first

- **Borrow from y-sweet; don't extend it.** y-sweet admits per connection rather than per session, uses bearer tokens rather than signed grants, starts syncing before any handshake, stores one snapshot per document rather than appending, and has nothing for forks; its core authors stopped committing in 2025. Its WebSocket wiring, storage interface and sync handling are worth borrowing.
- **A self-hosted binary, not Cloudflare Durable Objects, for M1.** y-sweet's Cloudflare support is deprecated, and M1's file storage, chaos proxy and CI suit a plain binary. A pure session actor with storage behind an interface keeps Durable Objects open for later.
- **First, M1 and M2 run on a stock, unmodified y-sweet** (v0.9.1), used its own way, to get a feel for the stack and feedback from real people. What y-sweet can't express (key grants, refusing a session, the signed handshake) is recorded as a gap, not built. XTXP's own host is then decided on what was learnt.
- **Xmesh uses Yrs 0.28** while y-sweet keeps its Yrs 0.19.2; a probe checks that the two agree.

See [Milestones](/build/milestones/#m1-y-sweet-and-m2-y-sweet).

## Naming

- **XTXP** for the protocol, **Xmesh** for the engine, **muppet** for the executor, the application layer and hosting, **session** for a line of history, **muppet disco** for discovery, **bouncer** for a domain owner's control of its `@origin`.
- **Muppet is lowercase, as plain text.** It's an ordinary word of the protocol, not a brand: capitalised only to start a sentence, never `MUPPET`, never the product's name, never paired with puppet imagery. XTXP is the public name. See [Names and marks](/brand/names/#the-muppet-advisory), which also records the name checks (*Xmesh* collides with Thinkbox XMesh; no clash found for *XTXP*).

## Conventions

- Patch operations are defined by **RFC 5261**. RFC 7351 registers the media type.
